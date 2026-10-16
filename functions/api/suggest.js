/**
 * Cloudflare Pages Function: /api/suggest
 * Proxies Google Suggest on the edge with no CORS restrictions
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || 'tyson';

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=300'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const targetUrl = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}`;
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Google returned status ${res.status}`);
    }

    const data = await res.json();
    const query = data[0] || q;
    const suggestions = data[1] || [];
    const meta = data[4] || {};
    const relevanceScores = meta['google:suggestrelevance'] || [];
    const verbatimRelevance = meta['google:verbatimrelevance'] || 1000;

    // Calculate a normalized popularity score between 1 and 100
    // Higher relevance in Google suggest implies higher search frequency
    const avgScore = relevanceScores.length > 0 
      ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length 
      : 500;
    
    // Scale verbatim & avg relevance to a 0-100 popularity index
    const popularityScore = Math.min(100, Math.max(5, Math.round((verbatimRelevance / 1400) * 100)));

    return new Response(JSON.stringify({
      term: query,
      popularity: popularityScore,
      verbatimRelevance,
      suggestions: suggestions.slice(0, 8),
      scores: relevanceScores.slice(0, 8),
      source: 'google-suggest-edge',
      timestamp: Date.now()
    }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      term: q,
      popularity: 50,
      suggestions: [q]
    }), { status: 500, headers });
  }
}
