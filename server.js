/**
 * T6 GRAPH - Localhost Development Server
 * Zero hallucination: Powers /api/timeline directly using native fetch against Google Trends
 * Returns real Google Trends time-series points (time left-to-right, interest 0-100 down-to-up).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

// In-memory cache to prevent spamming Google and avoid rate-limits
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache
let cachedCookie = '';

function convertDateToString(d, shouldIncludeTime) {
  let month = String(d.getUTCMonth() + 1).padStart(2, '0');
  let day = String(d.getUTCDate());
  const year = d.getUTCFullYear();
  if (shouldIncludeTime) {
    return `${year}-${month}-${day}T${d.getUTCHours()}\\:${d.getUTCMinutes()}\\:00`;
  }
  return `${year}-${month}-${day}`;
}

async function googleTrendsFetch(targetUrl) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };
  if (cachedCookie) headers['cookie'] = cachedCookie;

  let res = await fetch(targetUrl, { headers });
  if (res.status === 429) {
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      cachedCookie = setCookie.split(';')[0];
      headers['cookie'] = cachedCookie;
      res = await fetch(targetUrl, { headers });
    }
  }
  return res.text();
}

async function fetchInterestOverTime({ keywords, startTime, endTime = new Date(), granularTimeResolution = false }) {
  const isLessThan7Days = (Math.abs(endTime - startTime) / (24 * 60 * 60 * 1000)) < 7;
  const includeTime = isLessThan7Days && granularTimeResolution;
  const timeStr = `${convertDateToString(startTime, includeTime)} ${convertDateToString(endTime, includeTime)}`;
  const tz = new Date().getTimezoneOffset();

  const keywordList = Array.isArray(keywords) ? keywords : [keywords];
  const comparisonItem = keywordList.map(keyword => ({
    keyword,
    geo: '',
    time: timeStr
  }));

  const exploreReq = JSON.stringify({
    comparisonItem,
    category: 0,
    property: ''
  });

  const exploreUrl = `https://trends.google.com/trends/api/explore?hl=en-US&req=${encodeURIComponent(exploreReq)}&tz=${tz}`;
  const exploreRaw = await googleTrendsFetch(exploreUrl);
  const widgets = JSON.parse(exploreRaw.slice(4)).widgets;
  const timeseriesWidget = widgets.find(w => (w.id || '').includes('TIMESERIES'));

  if (!timeseriesWidget) {
    throw new Error('TIMESERIES widget not found in Google Trends response');
  }

  const widgetReq = {
    ...timeseriesWidget.request,
    requestOptions: {
      ...timeseriesWidget.request.requestOptions,
      category: 0,
      property: ''
    }
  };

  const multilineUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&req=${encodeURIComponent(JSON.stringify(widgetReq))}&token=${encodeURIComponent(timeseriesWidget.token)}&tz=${tz}`;
  const multilineRaw = await googleTrendsFetch(multilineUrl);
  return JSON.parse(multilineRaw.slice(5));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 1: /api/timeline (REAL Google Trends Time-Series Data)
  if (pathname === '/api/timeline') {
    const q = parsedUrl.query.q || 'tyson';
    const compare = parsedUrl.query.compare || '';
    const range = parsedUrl.query.range || '24H';

    const cacheKey = `${q}__${compare}__${range}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cached.data));
      return;
    }

    try {
      const now = new Date();
      let startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      let granular = true;

      if (range === '7D') {
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        granular = true;
      } else if (range === '30D') {
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        granular = false;
      } else if (range === '12M') {
        startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        granular = false;
      } else if (range === '5Y') {
        startTime = new Date(now.getTime() - 5 * 365.25 * 24 * 60 * 60 * 1000);
        granular = false;
      } else if (range === 'LIVE') {
        startTime = new Date(now.getTime() - 4 * 60 * 60 * 1000); // past 4 hours high-res
        granular = true;
      }

      const keywords = compare ? [q, compare] : q;

      const parsed = await fetchInterestOverTime({
        keywords,
        startTime,
        granularTimeResolution: granular
      });

      const timeline = parsed.default ? parsed.default.timelineData : [];

      const payload = {
        term: q,
        compare: compare || null,
        range,
        pointsCount: timeline.length,
        isRealData: true,
        source: 'google-trends-live',
        timeline: timeline.map(pt => ({
          time: pt.time,
          formattedTime: pt.formattedTime,
          formattedAxisTime: pt.formattedAxisTime,
          value: pt.value, // Array of numbers: [val1] or [val1, val2]
          hasData: pt.hasData
        }))
      };

      cache.set(cacheKey, { timestamp: Date.now(), data: payload });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    } catch (err) {
      console.error('Google Trends fetch error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: err.message,
        isRealData: false,
        term: q
      }));
    }
    return;
  }

  // API 2: /api/suggest (Google Search Autocomplete & Relevance)
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
      const verbatimRelevance = meta['google:verbatimrelevance'] || 1000;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        term: query,
        suggestions: suggestions.slice(0, 8),
        verbatimRelevance
      }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ term: q, suggestions: [] }));
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
  console.log(`  TYSON MEDIA GROUP // PROJECT T6: GRAPH`);
  console.log(`  Real Google Trends Server Live: http://localhost:${PORT}`);
  console.log(`  Endpoint: /api/timeline?q=keyword&range=24H`);
  console.log(`======================================================\n`);
});
