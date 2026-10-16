/**
 * Cloudflare Pages Function: /api/trends
 * Fetches Google Daily Search Trends RSS feed on the edge
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const geo = url.searchParams.get('geo') || 'US';

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=600'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const rssUrl = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Google Trends RSS returned status ${res.status}`);
    }

    const xml = await res.text();
    
    // Simple regex parser for items in RSS without heavy XML dependencies
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
      const itemContent = match[1];
      const titleMatch = /<title>(.*?)<\/title>/.exec(itemContent);
      const trafficMatch = /<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/.exec(itemContent);
      const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemContent);
      const pictureMatch = /<ht:picture>(.*?)<\/ht:picture>/.exec(itemContent);

      if (titleMatch) {
        const title = titleMatch[1].replace('<![CDATA[', '').replace(']]>', '').trim();
        const rawTraffic = trafficMatch ? trafficMatch[1].trim() : '50K+';
        
        // Parse approximate traffic into a numeric weight
        let trafficNum = 50000;
        if (rawTraffic.includes('M+')) {
          trafficNum = parseFloat(rawTraffic) * 1000000;
        } else if (rawTraffic.includes('K+')) {
          trafficNum = parseFloat(rawTraffic) * 1000;
        } else if (rawTraffic.includes('+')) {
          trafficNum = parseFloat(rawTraffic);
        }

        // Popularity score 0-100 relative to max daily trend traffic
        const popularity = Math.min(100, Math.max(25, Math.round((Math.log10(trafficNum) / 6.5) * 100)));

        items.push({
          title,
          traffic: rawTraffic,
          trafficNum,
          popularity,
          pubDate: pubDateMatch ? pubDateMatch[1] : null,
          picture: pictureMatch ? pictureMatch[1] : null
        });
      }
    }

    return new Response(JSON.stringify({
      geo,
      count: items.length,
      trends: items,
      timestamp: Date.now()
    }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      trends: [
        { title: 'Tyson Media Group', traffic: '100K+', popularity: 95 },
        { title: 'Project T6', traffic: '50K+', popularity: 85 },
        { title: 'Artificial Intelligence', traffic: '200K+', popularity: 98 },
        { title: 'Quantum Computing', traffic: '20K+', popularity: 65 }
      ]
    }), { headers });
  }
}
