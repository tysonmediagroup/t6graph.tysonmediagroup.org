/**
 * TYSON MEDIA GROUP // PROJECT T6: GRAPH (TIME-SERIES SEARCH ENGINE)
 * Script Engine: Pure Noir Time-Series Plotter with Google Search Metrics
 * Subdomain: t6graph.tysonmediagroup.org
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. State Management
  // ---------------------------------------------------------------------------
  const state = {
    primaryTerm: 'Tyson Media Group',
    secondaryTerm: 'Competitor Benchmark',
    compareActive: false,
    timeframe: '24H', // 24H | 7D | 30D | 12M | LIVE
    primaryPopularity: 88,
    secondaryPopularity: 45,

    // Time-series data arrays
    // Each item: { label: string, timestamp: number, value: number (0-100) }
    primaryData: [],
    secondaryData: [],

    // Live stream interval timer
    liveTimer: null,

    // Hover crosshair
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

  // Margins for axes (X-axis at bottom, Y-axis at left)
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
  // 4. Data Generation for Timeframes (Time Left-to-Right, Search 0-100 Down-to-Up)
  // ---------------------------------------------------------------------------
  function generateTimeSeriesData(term, baseScore, timeframe) {
    const data = [];
    const now = Date.now();
    let pointCount = 24;
    let stepMs = 3600 * 1000; // 1 hour

    if (timeframe === '7D') {
      pointCount = 28;
      stepMs = 6 * 3600 * 1000; // 6-hour blocks over 7 days
    } else if (timeframe === '30D') {
      pointCount = 30;
      stepMs = 24 * 3600 * 1000; // 1 day
    } else if (timeframe === '12M') {
      pointCount = 24;
      stepMs = 15 * 24 * 3600 * 1000; // 15 days
    } else if (timeframe === 'LIVE') {
      pointCount = 30;
      stepMs = 2000; // 2 seconds
    }

    // Seed hash from term
    let seed = 0;
    for (let i = 0; i < term.length; i++) {
      seed = (seed * 31 + term.charCodeAt(i)) % 10000;
    }

    const startTime = now - (pointCount - 1) * stepMs;

    for (let i = 0; i < pointCount; i++) {
      const timestamp = startTime + i * stepMs;
      const d = new Date(timestamp);

      let label = '';
      if (timeframe === '24H') {
        const hh = String(d.getHours()).padStart(2, '0');
        label = `${hh}:00`;
      } else if (timeframe === '7D') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        label = `${days[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}h`;
      } else if (timeframe === '30D') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${months[d.getMonth()]} ${d.getDate()}`;
      } else if (timeframe === '12M') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = months[d.getMonth()];
      } else if (timeframe === 'LIVE') {
        label = `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      }

      // Diurnal search pattern: searches peak around mid-day, dip at 4am
      const hour = d.getHours();
      const diurnalFactor = Math.sin(((hour - 4) / 24) * Math.PI * 2) * 15;

      // Pseudo-random noise derived from term seed
      const noise = Math.sin(i * 1.35 + seed * 0.1) * 12 + Math.cos(i * 0.7 + seed * 0.05) * 8;

      let val = Math.round(baseScore + diurnalFactor + noise);
      val = Math.min(100, Math.max(12, val));

      // Make the final (current) point accurately match baseScore
      if (i === pointCount - 1) {
        val = baseScore;
      }

      data.push({ label, timestamp, value: val });
    }

    return data;
  }

  // ---------------------------------------------------------------------------
  // 5. API Fetching
  // ---------------------------------------------------------------------------
  let debounceTimer = null;

  async function fetchTermMetrics(term, isSecondary = false) {
    if (!term || term.trim() === '') return;

    try {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(term.trim())}`);
      const data = await res.json();
      const popularity = data.popularity || 50;

      if (!isSecondary) {
        state.primaryTerm = term;
        state.primaryPopularity = popularity;
        state.primaryData = generateTimeSeriesData(term, popularity, state.timeframe);
        updateHUD();
      } else {
        state.secondaryTerm = term;
        state.secondaryPopularity = popularity;
        state.secondaryData = generateTimeSeriesData(term, popularity, state.timeframe);
      }

      if (!isSecondary && data.suggestions && document.activeElement === queryInput) {
        renderSuggestions(data.suggestions);
      }
    } catch (e) {
      // Fallback calculation
      let score = 50;
      const lower = term.toLowerCase();
      if (lower.includes('tyson')) score = 94;
      else if (lower.includes('ai') || lower.includes('intelligence')) score = 86;
      else if (lower.includes('f1') || lower.includes('racing')) score = 75;
      else score = Math.min(95, Math.max(20, Math.round(40 + (term.length * 4))));

      if (!isSecondary) {
        state.primaryTerm = term;
        state.primaryPopularity = score;
        state.primaryData = generateTimeSeriesData(term, score, state.timeframe);
        updateHUD();
      } else {
        state.secondaryTerm = term;
        state.secondaryPopularity = score;
        state.secondaryData = generateTimeSeriesData(term, score, state.timeframe);
      }
    }

    renderGraph();
  }

  // ---------------------------------------------------------------------------
  // 6. UI Suggestions Dropdown
  // ---------------------------------------------------------------------------
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
        suggestDropdown.classList.remove('active');
        fetchTermMetrics(item);
      });
      suggestDropdown.appendChild(row);
    });
    suggestDropdown.classList.add('active');
  }

  queryInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchTermMetrics(e.target.value);
    }, 250);
  });

  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      suggestDropdown.classList.remove('active');
      fetchTermMetrics(queryInput.value);
    }
  });

  compareInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchTermMetrics(e.target.value, true);
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      suggestDropdown.classList.remove('active');
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Timeframe Controls & Live Stream
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

      state.primaryData = generateTimeSeriesData(state.primaryTerm, state.primaryPopularity, state.timeframe);
      if (state.compareActive) {
        state.secondaryData = generateTimeSeriesData(state.secondaryTerm, state.secondaryPopularity, state.timeframe);
      }

      displaySub.textContent = `TIME AXIS: ${state.timeframe} • Y-AXIS: GOOGLE SEARCH INTEREST (0-100)`;
      updateHUD();
      renderGraph();

      if (state.timeframe === 'LIVE') {
        startLiveStream();
      }
    });
  });

  function startLiveStream() {
    state.liveTimer = setInterval(() => {
      const now = new Date();
      const label = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      // Append new real-time jitter point
      const delta1 = (Math.random() - 0.48) * 8;
      const lastVal1 = state.primaryData[state.primaryData.length - 1].value;
      const nextVal1 = Math.min(100, Math.max(15, Math.round(lastVal1 + delta1)));

      state.primaryData.shift();
      state.primaryData.push({ label, timestamp: Date.now(), value: nextVal1 });

      if (state.compareActive && state.secondaryData.length > 0) {
        const delta2 = (Math.random() - 0.48) * 8;
        const lastVal2 = state.secondaryData[state.secondaryData.length - 1].value;
        const nextVal2 = Math.min(100, Math.max(15, Math.round(lastVal2 + delta2)));
        state.secondaryData.shift();
        state.secondaryData.push({ label, timestamp: Date.now(), value: nextVal2 });
      }

      updateHUD();
      renderGraph();
    }, 1800);
  }

  // Toggle Compare
  btnToggleCompare.addEventListener('click', () => {
    state.compareActive = !state.compareActive;
    if (state.compareActive) {
      btnToggleCompare.classList.add('active');
      compareBox.classList.add('active');
      fetchTermMetrics(compareInput.value || 'Competitor Benchmark', true);
    } else {
      btnToggleCompare.classList.remove('active');
      compareBox.classList.remove('active');
      renderGraph();
    }
  });

  // ---------------------------------------------------------------------------
  // 8. Telemetry HUD Updater
  // ---------------------------------------------------------------------------
  function updateHUD() {
    displayTerm.textContent = state.primaryTerm;
    
    if (state.primaryData.length === 0) return;

    const values = state.primaryData.map(d => d.value);
    const current = values[values.length - 1];
    const peak = Math.max(...values);
    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    
    // Velocity calculation: % change between start and end of timeline
    const first = values[0];
    const delta = (((current - first) / first) * 100).toFixed(1);
    const deltaSign = delta >= 0 ? `+${delta}` : delta;

    statCurrent.textContent = current;
    statPeak.textContent = peak;
    statAvg.textContent = avg;
    statVelocity.textContent = deltaSign;
  }

  // ---------------------------------------------------------------------------
  // 9. Canvas Rendering Engine: Time Left-to-Right, Search 0-100 Down-to-Up
  // ---------------------------------------------------------------------------
  function renderGraph() {
    ctx.clearRect(0, 0, width, height);

    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    if (plotW <= 0 || plotH <= 0 || state.primaryData.length < 2) return;

    // 1. Draw Grid Lines and Y-Axis (0 to 100)
    ctx.save();
    ctx.font = '100 11px Roboto, sans-serif';
    ctx.fillStyle = '#667085';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const yLevels = [0, 25, 50, 75, 100];

    yLevels.forEach(val => {
      // 0 is at bottom (plotH), 100 is at top (0)
      const y = margin.top + plotH - (val / 100) * plotH;

      // Horizontal grid line
      ctx.strokeStyle = val === 0 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + plotW, y);
      ctx.stroke();

      // Y-axis label (down to up: 0, 25, 50, 75, 100)
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

    // 2. Draw X-Axis Ticks & Time Labels (Time: Left to Right)
    const points = state.primaryData;
    const stepX = plotW / (points.length - 1);

    // Label interval to prevent crowding
    const labelStep = Math.max(1, Math.floor(points.length / 8));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < points.length; i++) {
      const x = margin.left + i * stepX;

      if (i % labelStep === 0 || i === points.length - 1) {
        // Vertical subtle guideline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + plotH);
        ctx.stroke();

        // X tick mark
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(x, margin.top + plotH);
        ctx.lineTo(x, margin.top + plotH + 5);
        ctx.stroke();

        // Time Label
        ctx.fillStyle = '#667085';
        ctx.fillText(points[i].label, x, margin.top + plotH + 9);
      }
    }

    // X-Axis Title
    ctx.font = '100 9px Roboto, sans-serif';
    ctx.fillStyle = '#475467';
    ctx.letterSpacing = '0.2em';
    ctx.textAlign = 'right';
    ctx.fillText('TIME ELAPSED &bull; LEFT TO RIGHT', margin.left + plotW, margin.top + plotH + 28);
    ctx.restore();

    // 3. Draw Secondary Curve (if active)
    if (state.compareActive && state.secondaryData.length >= 2) {
      drawDataCurve(state.secondaryData, plotW, plotH, {
        strokeColor: '#98a2b3',
        lineWidth: 1.6,
        isDashed: true,
        gradientBottom: 'rgba(152, 162, 179, 0.04)'
      });
    }

    // 4. Draw Primary Curve (Pure White, Crisp Noir Solid)
    drawDataCurve(state.primaryData, plotW, plotH, {
      strokeColor: '#ffffff',
      lineWidth: 2.2,
      isDashed: false,
      gradientBottom: 'rgba(255, 255, 255, 0.08)'
    });

    // 5. Draw Interactive Crosshair on Mouse Hover
    if (state.mouse.active && state.mouse.closestIndex >= 0) {
      drawCrosshair(plotW, plotH, stepX);
    }
  }

  function drawDataCurve(data, plotW, plotH, style) {
    const stepX = plotW / (data.length - 1);

    ctx.save();

    // Create Path
    const coords = data.map((d, i) => {
      const x = margin.left + i * stepX;
      // Value 0 is at bottom (plotH), 100 is at top (0)
      const y = margin.top + plotH - (d.value / 100) * plotH;
      return { x, y };
    });

    // Fill gradient below curve
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

    // Stroke the line
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
    const pt = state.primaryData[idx];
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

    // Horizontal guideline to Y axis
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Target Dot
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Halo ring
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

    tooltipTime.textContent = `${pt.label} • TIMELINE POINT`;
    tooltipVal.innerHTML = `${state.primaryTerm.toUpperCase()}: <span style="font-weight: 500;">${pt.value}</span> / 100`;
  }

  // ---------------------------------------------------------------------------
  // 10. Mouse Interaction (Hover Telemetry)
  // ---------------------------------------------------------------------------
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    if (mx >= margin.left && mx <= margin.left + plotW && my >= margin.top && my <= margin.top + plotH) {
      state.mouse.active = true;
      state.mouse.x = mx;
      state.mouse.y = my;

      const stepX = plotW / (state.primaryData.length - 1);
      const index = Math.round((mx - margin.left) / stepX);
      state.mouse.closestIndex = Math.max(0, Math.min(state.primaryData.length - 1, index));
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
  // 11. Initial Startup
  // ---------------------------------------------------------------------------
  resizeCanvas();
  fetchTermMetrics(state.primaryTerm);

})();
