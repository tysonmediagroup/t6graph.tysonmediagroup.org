/**
 * T6 GRAPH - Localhost Development Server
 * Serves static assets and mirrors Cloudflare Pages Edge Functions locally.
 * Zero external dependencies (uses native Node.js http and fetch).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 1: /api/suggest
  if (pathname === '/api/suggest') {
    const q = parsedUrl.query.q || 'tyson';
    try {
      const targetUrl = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}`;
      const googleRes = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const data = await googleRes.json();
      const query = data[0] || q;
      const suggestions = data[1] || [];
      const meta = data[4] || {};
      const relevanceScores = meta['google:suggestrelevance'] || [];
      const verbatimRelevance = meta['google:verbatimrelevance'] || 1000;

      const popularityScore = Math.min(100, Math.max(5, Math.round((verbatimRelevance / 1400) * 100)));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        term: query,
        popularity: popularityScore,
        verbatimRelevance,
        suggestions: suggestions.slice(0, 8),
        scores: relevanceScores.slice(0, 8),
        source: 'google-suggest-local',
        timestamp: Date.now()
      }));
    } catch (err) {
      // Graceful fallback with dynamic algorithm
      const lengthScore = Math.min(85, Math.max(30, Math.round(50 + (q.length * 3))));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        term: q,
        popularity: lengthScore,
        suggestions: [`${q} official`, `${q} online`, `${q} media`, `${q} audio`],
        source: 'fallback-heuristic'
      }));
    }
    return;
  }

  // API 2: /api/trends
  if (pathname === '/api/trends') {
    const geo = parsedUrl.query.geo || 'US';
    try {
      const rssUrl = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
      const rssRes = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const xml = await rssRes.text();

      const items = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;

      while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
        const itemContent = match[1];
        const titleMatch = /<title>(.*?)<\/title>/.exec(itemContent);
        const trafficMatch = /<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/.exec(itemContent);
        const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemContent);

        if (titleMatch) {
          const title = titleMatch[1].replace('<![CDATA[', '').replace(']]>', '').trim();
          const rawTraffic = trafficMatch ? trafficMatch[1].trim() : '50K+';
          
          let trafficNum = 50000;
          if (rawTraffic.includes('M+')) {
            trafficNum = parseFloat(rawTraffic) * 1000000;
          } else if (rawTraffic.includes('K+')) {
            trafficNum = parseFloat(rawTraffic) * 1000;
          } else if (rawTraffic.includes('+')) {
            trafficNum = parseFloat(rawTraffic);
          }

          const popularity = Math.min(100, Math.max(25, Math.round((Math.log10(trafficNum) / 6.5) * 100)));

          items.push({
            title,
            traffic: rawTraffic,
            trafficNum,
            popularity,
            pubDate: pubDateMatch ? pubDateMatch[1] : null
          });
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        geo,
        count: items.length,
        trends: items,
        timestamp: Date.now()
      }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        geo,
        trends: [
          { title: 'Tyson Media Group', traffic: '200K+', popularity: 98 },
          { title: 'Project T6', traffic: '100K+', popularity: 92 },
          { title: 'Quantum Computing', traffic: '50K+', popularity: 74 },
          { title: 'Neural Interfaces', traffic: '20K+', popularity: 60 }
        ]
      }));
    }
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  TYSON MEDIA GROUP // PROJECT T6 SONAR`);
  console.log(`  Localhost Server Live: http://localhost:${PORT}`);
  console.log(`  Target Subdomain:      https://t6graph.tysonmediagroup.org`);
  console.log(`======================================================\n`);
});
