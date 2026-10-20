/**
 * Cloudflare Pages Function: /api/timeline
 * Fetches Google Trends time-series data on the edge
 */
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

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || 'tyson';
  const compare = url.searchParams.get('compare') || '';
  const range = url.searchParams.get('range') || '24H';

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=60'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
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
      startTime = new Date(now.getTime() - 4 * 60 * 60 * 1000);
      granular = true;
    }

    const isLessThan7Days = (Math.abs(now - startTime) / (24 * 60 * 60 * 1000)) < 7;
    const includeTime = isLessThan7Days && granular;
    const timeStr = `${convertDateToString(startTime, includeTime)} ${convertDateToString(now, includeTime)}`;
    const tz = 0;

    const keywordList = compare ? [q, compare] : [q];
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
    const parsed = JSON.parse(multilineRaw.slice(5));
    const timeline = parsed.default ? parsed.default.timelineData : [];

    return new Response(JSON.stringify({
      term: q,
      compare: compare || null,
      range,
      pointsCount: timeline.length,
      isRealData: true,
      source: 'google-trends-edge',
      timeline: timeline.map(pt => ({
        time: pt.time,
        formattedTime: pt.formattedTime,
        formattedAxisTime: pt.formattedAxisTime,
        value: pt.value,
        hasData: pt.hasData
      }))
    }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      isRealData: false,
      term: q
    }), { status: 500, headers });
  }
}
