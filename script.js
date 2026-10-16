/**
 * TYSON MEDIA GROUP // PROJECT T6: GRAPH
 * Zero Hallucination Engine: Renders 100% Genuine Google Trends Timeline Data
 * Subdomain: t6graph.tysonmediagroup.org
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. State Management
  // ---------------------------------------------------------------------------
  const state = {
    primaryTerm: 'tyson',
    secondaryTerm: 'media',
    compareActive: false,
    timeframe: '24H', // 24H | 7D | 30D | 12M | LIVE
    isLoading: false,
    isRealData: false,

    // Real data arrays directly from Google Trends
    points: [], // Array of { label, fullTime, value, compareValue }

    // Live refresh timer
    liveTimer: null,

    // Mouse hover tracking
    mouse: {
      active: false,
      x: 0,
      y: 0,
      closestIndex: -1
    }
  };

  // ---------------------------------------------------------------------------
  // 2. DOM Elements
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById('graphCanvas');
  const ctx = canvas.getContext('2d');

  const queryInput = document.getElementById('queryInput');
  const compareInput = document.getElementById('compareInput');
  const compareBox = document.getElementById('compareBox');
  const btnToggleCompare = document.getElementById('btnToggleCompare');
  const suggestDropdown = document.getElementById('suggestDropdown');
  const timeframeButtons = document.querySelectorAll('.btn-timeframe');

  const displayTerm = document.getElementById('displayTerm');
  const displaySub = document.getElementById('displaySub');
  const statCurrent = document.getElementById('statCurrent');
  const statPeak = document.getElementById('statPeak');
  const statAvg = document.getElementById('statAvg');
  const statVelocity = document.getElementById('statVelocity');

  const graphTooltip = document.getElementById('graphTooltip');
  const tooltipTime = document.getElementById('tooltipTime');
  const tooltipVal = document.getElementById('tooltipVal');

  // ---------------------------------------------------------------------------
  // 3. Canvas Sizing
  // ---------------------------------------------------------------------------
  let dpr = window.devicePixelRatio || 1;
  let width = 0;
  let height = 0;

  const margin = {
    top: 90,
    right: 40,
    bottom: 50,
    left: 65
  };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    renderGraph();
  }

  window.addEventListener('resize', resizeCanvas);

  // ---------------------------------------------------------------------------
  // 4. Fetch Real Google Trends Timeline Data
  // ---------------------------------------------------------------------------
  let fetchController = null;

  async function fetchRealGoogleTrends(term, compare = '', range = '24H') {
    if (!term || term.trim() === '') return;

    if (fetchController) {
      fetchController.abort();
    }
    fetchController = new AbortController();

    state.isLoading = true;
    displaySub.textContent = `FETCHING AUTHENTIC GOOGLE TRENDS DATA FOR "${term.toUpperCase()}"...`;
    renderGraph();

    try {
      const compareParam = state.compareActive && compare ? `&compare=${encodeURIComponent(compare.trim())}` : '';
      const url = `/api/timeline?q=${encodeURIComponent(term.trim())}${compareParam}&range=${range}`;

      const res = await fetch(url, { signal: fetchController.signal });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await res.json();

      if (data.timeline && data.timeline.length > 0) {
        state.isRealData = true;
        state.points = data.timeline.map(pt => {
          const val1 = Array.isArray(pt.value) ? pt.value[0] : 0;
          const val2 = (Array.isArray(pt.value) && pt.value.length > 1) ? pt.value[1] : 0;

          // Simplify axis time for readability
          let label = pt.formattedAxisTime || pt.formattedTime || '';
          if (label.includes(' at ')) {
            label = label.split(' at ')[1].replace(':00', '');
          }

          return {
            label,
            fullTime: pt.formattedTime || pt.formattedAxisTime,
            value: typeof val1 === 'number' ? val1 : parseInt(val1, 10) || 0,
            compareValue: typeof val2 === 'number' ? val2 : parseInt(val2, 10) || 0
          };
        });

        displaySub.textContent = `GOOGLE TRENDS LIVE // ${data.pointsCount} REAL DATA POINTS • RANGE: ${range}`;
      } else {
        state.isRealData = false;
        state.points = [];
        displaySub.textContent = `NO SUFFICIENT GOOGLE TRENDS VOLUME FOR "${term.toUpperCase()}" IN ${range}`;
      }

      state.isLoading = false;
      updateHUD();
      renderGraph();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Timeline fetch error:', err);
      state.isLoading = false;
      displaySub.textContent = `UNABLE TO REACH GOOGLE TRENDS LIVE API // CHECK CONNECTION`;
      renderGraph();
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Google Autocomplete Suggest Integration
  // ---------------------------------------------------------------------------
  let suggestTimer = null;

  async function fetchSuggestions(query) {
    if (!query || query.trim().length < 2) {
      suggestDropdown.classList.remove('active');
      return;
    }

    try {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();

      if (data.suggestions && data.suggestions.length > 0) {
        renderSuggestions(data.suggestions);
      } else {
        suggestDropdown.classList.remove('active');
      }
    } catch (e) {
      suggestDropdown.classList.remove('active');
    }
  }

  function renderSuggestions(list) {
    suggestDropdown.innerHTML = '';
    list.slice(0, 6).forEach(item => {
      const row = document.createElement('div');
      row.className = 'suggest-item';
      row.innerHTML = `
        <span class="suggest-term">${item}</span>
        <span class="suggest-tag">GOOGLE TREND</span>
      `;
      row.addEventListener('click', () => {
        queryInput.value = item;
        state.primaryTerm = item;
        suggestDropdown.classList.remove('active');
        fetchRealGoogleTrends(item, state.secondaryTerm, state.timeframe);
      });
      suggestDropdown.appendChild(row);
    });
    suggestDropdown.classList.add('active');
  }

  // Input listeners
  queryInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => {
      fetchSuggestions(val);
      if (val.trim()) {
        state.primaryTerm = val.trim();
        fetchRealGoogleTrends(state.primaryTerm, state.secondaryTerm, state.timeframe);
      }
    }, 400);
  });

  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      suggestDropdown.classList.remove('active');
      state.primaryTerm = queryInput.value.trim();
      fetchRealGoogleTrends(state.primaryTerm, state.secondaryTerm, state.timeframe);
    }
  });

  compareInput.addEventListener('input', (e) => {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => {
      state.secondaryTerm = e.target.value.trim();
      fetchRealGoogleTrends(state.primaryTerm, state.secondaryTerm, state.timeframe);
    }, 450);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      suggestDropdown.classList.remove('active');
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Timeframe Range Selector & Live Stream
  // ---------------------------------------------------------------------------
  timeframeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      timeframeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.timeframe = btn.dataset.range;

      if (state.liveTimer) {
        clearInterval(state.liveTimer);
        state.liveTimer = null;
      }

      fetchRealGoogleTrends(state.primaryTerm, state.secondaryTerm, state.timeframe);

      if (state.timeframe === 'LIVE') {
        // Poll Google Trends every 20 seconds for real-time live pulse
        state.liveTimer = setInterval(() => {
          fetchRealGoogleTrends(state.primaryTerm, state.secondaryTerm, 'LIVE');
        }, 20000);
      }
    });
  });

  // Toggle Compare
  btnToggleCompare.addEventListener('click', () => {
    state.compareActive = !state.compareActive;
    if (state.compareActive) {
      btnToggleCompare.classList.add('active');
      compareBox.classList.add('active');
      state.secondaryTerm = compareInput.value.trim() || 'media';
      fetchRealGoogleTrends(state.primaryTerm, state.secondaryTerm, state.timeframe);
    } else {
      btnToggleCompare.classList.remove('active');
      compareBox.classList.remove('active');
      fetchRealGoogleTrends(state.primaryTerm, '', state.timeframe);
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Telemetry HUD Updater
  // ---------------------------------------------------------------------------
  function updateHUD() {
    displayTerm.textContent = state.primaryTerm;

    if (!state.points || state.points.length === 0) {
      statCurrent.textContent = '--';
      statPeak.textContent = '--';
      statAvg.textContent = '--';
      statVelocity.textContent = '--';
      return;
    }

    const values = state.points.map(d => d.value);
    const current = values[values.length - 1];
    const peak = Math.max(...values);
    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);

    const first = values[0] || 1;
    const delta = (((current - first) / Math.max(1, first)) * 100).toFixed(1);
    const deltaSign = delta >= 0 ? `+${delta}` : delta;

    statCurrent.textContent = current;
    statPeak.textContent = peak;
    statAvg.textContent = avg;
    statVelocity.textContent = deltaSign;
  }

  // ---------------------------------------------------------------------------
  // 8. Canvas Rendering Engine: Time Left-to-Right, Search 0-100 Down-to-Up
  // ---------------------------------------------------------------------------
  function renderGraph() {
    ctx.clearRect(0, 0, width, height);

    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    if (plotW <= 0 || plotH <= 0) return;

    // 1. Draw Grid Lines and Y-Axis (0 to 100 from down to up)
    ctx.save();
    ctx.font = '100 11px Roboto, sans-serif';
    ctx.fillStyle = '#667085';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const yLevels = [0, 25, 50, 75, 100];

    yLevels.forEach(val => {
      // 0 is down at margin.top + plotH; 100 is up at margin.top
      const y = margin.top + plotH - (val / 100) * plotH;

      ctx.strokeStyle = val === 0 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + plotW, y);
      ctx.stroke();

      ctx.fillText(String(val), margin.left - 12, y);
    });

    // Y-Axis Title
    ctx.save();
    ctx.translate(18, margin.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = '100 9px Roboto, sans-serif';
    ctx.fillStyle = '#475467';
    ctx.letterSpacing = '0.25em';
    ctx.textAlign = 'center';
    ctx.fillText('GOOGLE SEARCH INTEREST (0 - 100)', 0, 0);
    ctx.restore();

    // If loading or empty
    if (state.isLoading) {
      ctx.font = '100 13px Roboto, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('QUERYING GOOGLE TRENDS DATABASE...', margin.left + plotW / 2, margin.top + plotH / 2);
      ctx.restore();
      return;
    }

    if (!state.points || state.points.length < 2) {
      ctx.font = '100 13px Roboto, sans-serif';
      ctx.fillStyle = '#475467';
      ctx.textAlign = 'center';
      ctx.fillText('NO GOOGLE TRENDS DATA AVAILABLE', margin.left + plotW / 2, margin.top + plotH / 2);
      ctx.restore();
      return;
    }

    // 2. Draw X-Axis Ticks & Time Labels (Time from left to right)
    const points = state.points;
    const stepX = plotW / (points.length - 1);
    const labelStep = Math.max(1, Math.floor(points.length / 8));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < points.length; i++) {
      const x = margin.left + i * stepX;

      if (i % labelStep === 0 || i === points.length - 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + plotH);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(x, margin.top + plotH);
        ctx.lineTo(x, margin.top + plotH + 5);
        ctx.stroke();

        ctx.fillStyle = '#667085';
        ctx.fillText(points[i].label, x, margin.top + plotH + 9);
      }
    }

    // X-Axis Sub-label
    ctx.font = '100 9px Roboto, sans-serif';
    ctx.fillStyle = '#475467';
    ctx.letterSpacing = '0.2em';
    ctx.textAlign = 'right';
    ctx.fillText('TIME ELAPSED • LEFT TO RIGHT', margin.left + plotW, margin.top + plotH + 28);
    ctx.restore();

    // 3. Draw Comparison Curve (if active)
    if (state.compareActive) {
      drawDataCurve(points, 'compareValue', plotW, plotH, {
        strokeColor: '#98a2b3',
        lineWidth: 1.6,
        isDashed: true,
        gradientBottom: 'rgba(152, 162, 179, 0.04)'
      });
    }

    // 4. Draw Primary Curve (Real Google Trends Points, Pure White)
    drawDataCurve(points, 'value', plotW, plotH, {
      strokeColor: '#ffffff',
      lineWidth: 2.2,
      isDashed: false,
      gradientBottom: 'rgba(255, 255, 255, 0.08)'
    });

    // 5. Draw Interactive Crosshair on Hover
    if (state.mouse.active && state.mouse.closestIndex >= 0) {
      drawCrosshair(plotW, plotH, stepX);
    }
  }

  function drawDataCurve(data, valueKey, plotW, plotH, style) {
    const stepX = plotW / (data.length - 1);

    ctx.save();

    const coords = data.map((d, i) => {
      const x = margin.left + i * stepX;
      const rawVal = Math.min(100, Math.max(0, d[valueKey] || 0));
      const y = margin.top + plotH - (rawVal / 100) * plotH;
      return { x, y };
    });

    // Fill area below curve
    const areaGrad = ctx.createLinearGradient(0, margin.top, 0, margin.top + plotH);
    areaGrad.addColorStop(0, style.gradientBottom);
    areaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.moveTo(coords[0].x, margin.top + plotH);
    ctx.lineTo(coords[0].x, coords[0].y);

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const midX = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(midX, p0.y, midX, p1.y, p1.x, p1.y);
    }

    ctx.lineTo(coords[coords.length - 1].x, margin.top + plotH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const midX = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(midX, p0.y, midX, p1.y, p1.x, p1.y);
    }

    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.lineWidth;
    if (style.isDashed) {
      ctx.setLineDash([5, 4]);
    } else {
      ctx.setLineDash([]);
      ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowBlur = 8;
    }
    ctx.stroke();

    ctx.restore();
  }

  function drawCrosshair(plotW, plotH, stepX) {
    const idx = state.mouse.closestIndex;
    const pt = state.points[idx];
    if (!pt) return;

    const x = margin.left + idx * stepX;
    const y = margin.top + plotH - (pt.value / 100) * plotH;

    ctx.save();

    // Dotted vertical line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + plotH);
    ctx.stroke();

    // Target Dot
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Target Ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // Position HTML tooltip
    const canvasRect = canvas.getBoundingClientRect();
    const tooltipX = canvasRect.left + x + 15;
    const tooltipY = canvasRect.top + y - 45;

    graphTooltip.style.left = `${tooltipX}px`;
    graphTooltip.style.top = `${tooltipY}px`;
    graphTooltip.style.display = 'block';

    tooltipTime.textContent = `${pt.fullTime || pt.label} • REAL GOOGLE TIMESTAMP`;
    let valText = `${state.primaryTerm.toUpperCase()}: <span style="font-weight: 500;">${pt.value}</span> / 100`;
    if (state.compareActive) {
      valText += ` &bull; ${state.secondaryTerm.toUpperCase()}: <span style="color: #98a2b3;">${pt.compareValue}</span> / 100`;
    }
    tooltipVal.innerHTML = valText;
  }

  // ---------------------------------------------------------------------------
  // 9. Mouse Hover Interaction
  // ---------------------------------------------------------------------------
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    if (mx >= margin.left && mx <= margin.left + plotW && my >= margin.top && my <= margin.top + plotH && state.points.length > 1) {
      state.mouse.active = true;
      state.mouse.x = mx;
      state.mouse.y = my;

      const stepX = plotW / (state.points.length - 1);
      const index = Math.round((mx - margin.left) / stepX);
      state.mouse.closestIndex = Math.max(0, Math.min(state.points.length - 1, index));
    } else {
      state.mouse.active = false;
      graphTooltip.style.display = 'none';
    }

    renderGraph();
  });

  canvas.addEventListener('mouseleave', () => {
    state.mouse.active = false;
    graphTooltip.style.display = 'none';
    renderGraph();
  });

  // ---------------------------------------------------------------------------
  // 10. Initial Startup
  // ---------------------------------------------------------------------------
  resizeCanvas();
  queryInput.value = state.primaryTerm;
  fetchRealGoogleTrends(state.primaryTerm, '', state.timeframe);

})();
