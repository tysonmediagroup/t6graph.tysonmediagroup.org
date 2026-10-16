/**
 * TYSON Media Group // PROJECT T6: GRAPH (t6graph.tysonmediagroup.org)
 * Unified Framework Engine:
 * 1. Multi-Theme Engine (Noir Midnight, Nintendo Wii, Frutiger Aero, Nature Botanical)
 * 2. Launch Intro Trace Sequence & Settings Modal Controller
 * 3. Zero-Hallucination Google Trends Time-Series Graph Engine (24H, 7D, 30D, 12M, 5Y, LIVE)
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
    timeframe: '24H', // 24H | 7D | 30D | 12M | 5Y | LIVE
    isLoading: false,
    isRealData: false,
    theme: localStorage.getItem('tyson_theme') || 'noir',

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
  const presetPills = document.querySelectorAll('.preset-pill');

  const displayTerm = document.getElementById('displayTerm');
  const displaySub = document.getElementById('displaySub');
  const statCurrent = document.getElementById('statCurrent');
  const statPeak = document.getElementById('statPeak');
  const statAvg = document.getElementById('statAvg');
  const statVelocity = document.getElementById('statVelocity');

  const graphTooltip = document.getElementById('graphTooltip');
  const tooltipTime = document.getElementById('tooltipTime');
  const tooltipVal = document.getElementById('tooltipVal');

  // Settings & Intro Elements
  const settingsModal = document.getElementById('settings-modal');
  const settingsToggleBtn = document.getElementById('settings-toggle-btn');
  const settingsCloseBtn = document.getElementById('settings-modal-close-btn');
  const settingsDoneBtn = document.getElementById('settings-done-btn');
  const themeOptionCards = document.querySelectorAll('.theme-option-card');
  const replayIntroBtn = document.getElementById('replay-intro-btn');
  const animatedPage = document.querySelector('.intro-animated-page');

  // ---------------------------------------------------------------------------
  // 3. Settings & Multi-Theme Engine
  // ---------------------------------------------------------------------------
  function applyTheme(themeName) {
    state.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('tyson_theme', themeName);

    themeOptionCards.forEach(card => {
      if (card.getAttribute('data-theme-choice') === themeName) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });

    renderGraph();
  }

  applyTheme(state.theme);

  if (settingsToggleBtn && settingsModal) {
    settingsToggleBtn.addEventListener('click', () => {
      settingsModal.classList.add('active');
      settingsModal.setAttribute('aria-hidden', 'false');
    });
  }

  function closeSettingsModal() {
    if (settingsModal) {
      settingsModal.classList.remove('active');
      settingsModal.setAttribute('aria-hidden', 'true');
    }
  }

  if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettingsModal);
  if (settingsDoneBtn) settingsDoneBtn.addEventListener('click', closeSettingsModal);
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettingsModal();
    });
  }

  themeOptionCards.forEach(card => {
    card.addEventListener('click', () => {
      const choice = card.getAttribute('data-theme-choice');
      applyTheme(choice);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Launch Intro Animation (Font-Ready Guard & High-Speed Trace)
  // ---------------------------------------------------------------------------
  function triggerTraceSequence() {
    if (!animatedPage) return;

    const fontLoadPromise = (document.fonts && document.fonts.load)
      ? Promise.all([
          document.fonts.load('italic 78px "Cormorant Garamond"'),
          document.fonts.ready
        ])
      : Promise.resolve();

    fontLoadPromise.then(() => {
      const traceChars = document.querySelectorAll('.trace-char');
      traceChars.forEach(ch => {
        ch.style.animation = 'none';
        void ch.offsetWidth;
        ch.style.animation = '';
      });

      const svgHero = document.querySelector('.domain-hero-svg');
      if (svgHero) {
        svgHero.style.animation = 'none';
        void svgHero.offsetWidth;
        svgHero.style.animation = '';
      }

      setTimeout(() => {
        animatedPage.classList.add('intro-complete');
        setTimeout(resizeCanvas, 100);
      }, 1850);
    }).catch(() => {
      setTimeout(() => {
        animatedPage.classList.add('intro-complete');
        setTimeout(resizeCanvas, 100);
      }, 1850);
    });
  }

  triggerTraceSequence();

  if (replayIntroBtn && animatedPage) {
    replayIntroBtn.addEventListener('click', () => {
      closeSettingsModal();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      animatedPage.classList.remove('intro-complete');
      triggerTraceSequence();
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Canvas Sizing
  // ---------------------------------------------------------------------------
  let dpr = window.devicePixelRatio || 1;
  let width = 0;
  let height = 0;

  const margin = {
    top: 95,
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderGraph();
  }

  window.addEventListener('resize', resizeCanvas);

  // ---------------------------------------------------------------------------
  // 6. Fetch Real Google Trends Timeline Data
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
  // 7. Google Autocomplete Suggest Integration & Preset Pills
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
        syncPresetPill(item);
        fetchRealGoogleTrends(item, state.secondaryTerm, state.timeframe);
      });
      suggestDropdown.appendChild(row);
    });
    suggestDropdown.classList.add('active');
  }

  function syncPresetPill(term) {
    presetPills.forEach(pill => {
      if (pill.dataset.term.toLowerCase() === term.toLowerCase()) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }

  presetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      presetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const term = pill.dataset.term;
      queryInput.value = term;
      state.primaryTerm = term;
      fetchRealGoogleTrends(term, state.secondaryTerm, state.timeframe);
    });
  });

  queryInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => {
      fetchSuggestions(val);
      if (val.trim()) {
        state.primaryTerm = val.trim();
        syncPresetPill(state.primaryTerm);
        fetchRealGoogleTrends(state.primaryTerm, state.secondaryTerm, state.timeframe);
      }
    }, 400);
  });

  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      suggestDropdown.classList.remove('active');
      state.primaryTerm = queryInput.value.trim();
      syncPresetPill(state.primaryTerm);
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
  // 8. Timeframe Range Selector & Live Stream
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
  // 9. Telemetry HUD Updater
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
  // 10. Theme-Aware Canvas Rendering Engine
  // ---------------------------------------------------------------------------
  function getThemeColors() {
    if (state.theme === 'wii') {
      return {
        primaryStroke: '#00a6e2',
        primaryGlow: 'rgba(0, 166, 226, 0.35)',
        primaryFill: 'rgba(0, 166, 226, 0.12)',
        secondaryStroke: '#475569',
        secondaryFill: 'rgba(71, 85, 105, 0.06)',
        gridBase: 'rgba(15, 23, 42, 0.25)',
        gridLine: 'rgba(15, 23, 42, 0.06)',
        axisText: '#475569'
      };
    }
    if (state.theme === 'frutiger') {
      return {
        primaryStroke: '#38bdf8',
        primaryGlow: 'rgba(56, 189, 248, 0.45)',
        primaryFill: 'rgba(56, 189, 248, 0.14)',
        secondaryStroke: '#e2e8f0',
        secondaryFill: 'rgba(226, 232, 240, 0.05)',
        gridBase: 'rgba(255, 255, 255, 0.25)',
        gridLine: 'rgba(255, 255, 255, 0.06)',
        axisText: '#94a3b8'
      };
    }
    if (state.theme === 'nature') {
      return {
        primaryStroke: '#86efac',
        primaryGlow: 'rgba(134, 239, 172, 0.4)',
        primaryFill: 'rgba(134, 239, 172, 0.1)',
        secondaryStroke: '#cbd5e1',
        secondaryFill: 'rgba(203, 213, 225, 0.04)',
        gridBase: 'rgba(255, 255, 255, 0.25)',
        gridLine: 'rgba(255, 255, 255, 0.06)',
        axisText: '#86efac'
      };
    }
    // Default Noir (Midnight Monochrome)
    return {
      primaryStroke: '#ffffff',
      primaryGlow: 'rgba(255, 255, 255, 0.4)',
      primaryFill: 'rgba(255, 255, 255, 0.08)',
      secondaryStroke: '#98a2b3',
      secondaryFill: 'rgba(152, 162, 179, 0.04)',
      gridBase: 'rgba(255, 255, 255, 0.25)',
      gridLine: 'rgba(255, 255, 255, 0.05)',
      axisText: '#717a8a'
    };
  }

  function renderGraph() {
    ctx.clearRect(0, 0, width, height);

    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    if (plotW <= 0 || plotH <= 0) return;

    const palette = getThemeColors();

    // 1. Draw Grid Lines and Y-Axis (0 to 100 from down to up)
    ctx.save();
    ctx.font = '100 11px Roboto, sans-serif';
    ctx.fillStyle = palette.axisText;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const yLevels = [0, 25, 50, 75, 100];

    yLevels.forEach(val => {
      const y = margin.top + plotH - (val / 100) * plotH;

      ctx.strokeStyle = val === 0 ? palette.gridBase : palette.gridLine;
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
    ctx.fillStyle = palette.axisText;
    ctx.letterSpacing = '0.25em';
    ctx.textAlign = 'center';
    ctx.fillText('GOOGLE SEARCH INTEREST (0 - 100)', 0, 0);
    ctx.restore();

    // If loading or empty
    if (state.isLoading) {
      ctx.font = '100 13px Roboto, sans-serif';
      ctx.fillStyle = palette.primaryStroke;
      ctx.textAlign = 'center';
      ctx.fillText('QUERYING GOOGLE TRENDS DATABASE...', margin.left + plotW / 2, margin.top + plotH / 2);
      ctx.restore();
      return;
    }

    if (!state.points || state.points.length < 2) {
      ctx.font = '100 13px Roboto, sans-serif';
      ctx.fillStyle = palette.axisText;
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
        ctx.strokeStyle = palette.gridLine;
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + plotH);
        ctx.stroke();

        ctx.strokeStyle = palette.gridBase;
        ctx.beginPath();
        ctx.moveTo(x, margin.top + plotH);
        ctx.lineTo(x, margin.top + plotH + 5);
        ctx.stroke();

        ctx.fillStyle = palette.axisText;
        ctx.fillText(points[i].label, x, margin.top + plotH + 9);
      }
    }

    // X-Axis Sub-label
    ctx.font = '100 9px Roboto, sans-serif';
    ctx.fillStyle = palette.axisText;
    ctx.letterSpacing = '0.2em';
    ctx.textAlign = 'right';
    ctx.fillText('TIME ELAPSED • LEFT TO RIGHT', margin.left + plotW, margin.top + plotH + 28);
    ctx.restore();

    // 3. Draw Comparison Curve (if active)
    if (state.compareActive) {
      drawDataCurve(points, 'compareValue', plotW, plotH, {
        strokeColor: palette.secondaryStroke,
        glowColor: 'transparent',
        lineWidth: 1.6,
        isDashed: true,
        gradientBottom: palette.secondaryFill
      });
    }

    // 4. Draw Primary Curve (Real Google Trends Points)
    drawDataCurve(points, 'value', plotW, plotH, {
      strokeColor: palette.primaryStroke,
      glowColor: palette.primaryGlow,
      lineWidth: 2.2,
      isDashed: false,
      gradientBottom: palette.primaryFill
    });

    // 5. Draw Interactive Crosshair on Hover
    if (state.mouse.active && state.mouse.closestIndex >= 0) {
      drawCrosshair(plotW, plotH, stepX, palette);
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
      ctx.shadowColor = style.glowColor;
      ctx.shadowBlur = 8;
    }
    ctx.stroke();

    ctx.restore();
  }

  function drawCrosshair(plotW, plotH, stepX, palette) {
    const idx = state.mouse.closestIndex;
    const pt = state.points[idx];
    if (!pt) return;

    const x = margin.left + idx * stepX;
    const y = margin.top + plotH - (pt.value / 100) * plotH;

    ctx.save();

    // Dotted vertical line
    ctx.strokeStyle = palette.gridBase;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + plotH);
    ctx.stroke();

    // Target Dot
    ctx.setLineDash([]);
    ctx.fillStyle = palette.primaryStroke;
    ctx.shadowColor = palette.primaryStroke;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Target Ring
    ctx.strokeStyle = palette.gridBase;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // Position HTML tooltip inside stage bounds
    const tooltipX = Math.min(width - 260, Math.max(20, x + 15));
    const tooltipY = Math.max(20, y - 55);

    graphTooltip.style.left = `${tooltipX}px`;
    graphTooltip.style.top = `${tooltipY}px`;
    graphTooltip.style.display = 'block';

    tooltipTime.textContent = `${pt.fullTime || pt.label} • REAL GOOGLE TIMESTAMP`;
    let valText = `${state.primaryTerm.toUpperCase()}: <span style="font-weight: 500;">${pt.value}</span> / 100`;
    if (state.compareActive) {
      valText += ` &bull; ${state.secondaryTerm.toUpperCase()}: <span style="opacity: 0.75;">${pt.compareValue}</span> / 100`;
    }
    tooltipVal.innerHTML = valText;
  }

  // ---------------------------------------------------------------------------
  // 11. Mouse Hover Interaction
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
  // 12. Initial Startup
  // ---------------------------------------------------------------------------
  resizeCanvas();
  queryInput.value = state.primaryTerm;
  fetchRealGoogleTrends(state.primaryTerm, '', state.timeframe);

})();
