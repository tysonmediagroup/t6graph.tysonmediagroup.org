/**
 * TYSON MEDIA GROUP // PROJECT T6: SONAR FREQUENCY RADAR
 * Script Engine: Canvas Wave Synthesizer & Google Trends/Suggest Consumer
 * Domain: t6graph.tysonmediagroup.org
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. State & Telemetry Variables
  // ---------------------------------------------------------------------------
  const state = {
    currentTerm: 'Tyson Media Group',
    popularity: 94, // 0 - 100
    compareMode: false,
    compareTerm: 'Artificial Intelligence',
    comparePopularity: 82,

    // Mathematical Wave Parameters
    primary: {
      freq: 28.4,       // Hz (apparent visual frequency)
      targetFreq: 28.4,
      amp: 75,          // Amplitude in pixels
      targetAmp: 75,
      speed: 0.045,     // Phase speed
      targetSpeed: 0.045,
      phase: 0,
      harmonics: 4,
      color: '#d4af37',
      glow: 'rgba(212, 175, 55, 0.45)'
    },

    secondary: {
      freq: 18.2,
      targetFreq: 18.2,
      amp: 55,
      targetAmp: 55,
      speed: 0.03,
      targetSpeed: 0.03,
      phase: 0,
      harmonics: 3,
      color: '#ffffff',
      glow: 'rgba(255, 255, 255, 0.35)'
    },

    // Audio Engine
    audioActive: false,
    audioCtx: null,
    oscillator: null,
    gainNode: null,

    // Particles along wave peaks
    particles: []
  };

  // ---------------------------------------------------------------------------
  // 2. DOM Elements
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById('waveCanvas');
  const ctx = canvas.getContext('2d');

  const queryInput = document.getElementById('queryInput');
  const suggestDropdown = document.getElementById('suggestDropdown');
  const btnCompare = document.getElementById('btnCompare');
  const btnAudio = document.getElementById('btnAudio');
  const btnRefresh = document.getElementById('btnRefresh');

  const activeTermTitle = document.getElementById('activeTermTitle');
  const activeTermSubtitle = document.getElementById('activeTermSubtitle');
  const valFrequency = document.getElementById('valFrequency');
  const valVelocity = document.getElementById('valVelocity');
  const valPopularity = document.getElementById('valPopularity');
  const valHarmonics = document.getElementById('valHarmonics');

  const legendPrimary = document.getElementById('legendPrimary');
  const legendSecondaryWrap = document.getElementById('legendSecondaryWrap');
  const legendSecondary = document.getElementById('legendSecondary');
  const telemetryTimestamp = document.getElementById('telemetryTimestamp');

  const presetPills = document.querySelectorAll('.preset-pill');

  // ---------------------------------------------------------------------------
  // 3. Canvas Resizing & Particle Initialization
  // ---------------------------------------------------------------------------
  let dpr = window.devicePixelRatio || 1;
  let width = 0;
  let height = 0;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', resizeCanvas);

  // Initialize Particles
  for (let i = 0; i < 40; i++) {
    state.particles.push({
      x: Math.random(),
      yOffset: (Math.random() - 0.5) * 15,
      radius: Math.random() * 1.8 + 0.6,
      alpha: Math.random() * 0.8 + 0.2,
      speed: Math.random() * 0.002 + 0.001
    });
  }

  // ---------------------------------------------------------------------------
  // 4. API & Data Fetching (Google Suggest & Trends Edge Function)
  // ---------------------------------------------------------------------------
  let debounceTimeout = null;

  async function fetchSearchMetrics(term, isSecondary = false) {
    if (!term || term.trim() === '') return;

    try {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(term.trim())}`);
      if (!res.ok) throw new Error('Network response error');
      const data = await res.json();
      
      applyMetricsToState(term, data.popularity || 50, isSecondary, data.suggestions);
    } catch (err) {
      // Heuristic fallback for offline / static environment
      let score = 50;
      const lower = term.toLowerCase();
      if (lower.includes('tyson')) score = 96;
      else if (lower.includes('intelligence') || lower.includes('ai')) score = 88;
      else if (lower.includes('formula') || lower.includes('f1')) score = 78;
      else if (lower.includes('quantum')) score = 65;
      else {
        score = Math.min(95, Math.max(15, Math.round(40 + (term.length * 4.5))));
      }

      applyMetricsToState(term, score, isSecondary, [
        `${term} statistics`,
        `${term} online`,
        `${term} trends`,
        `${term} official`
      ]);
    }
  }

  function applyMetricsToState(term, popularity, isSecondary, suggestions = []) {
    // Map popularity (0 - 100) to frequency parameters
    // Low: 1.5 Hz | High: 36.0 Hz
    const freq = 1.5 + (popularity / 100) * 34.5;
    const speed = 0.015 + (popularity / 100) * 0.055;
    const amp = 35 + (popularity / 100) * 55;
    const harmonics = Math.max(2, Math.min(6, Math.round(1 + (popularity / 100) * 5)));

    if (!isSecondary) {
      state.currentTerm = term;
      state.popularity = popularity;
      state.primary.targetFreq = freq;
      state.primary.targetSpeed = speed;
      state.primary.targetAmp = amp;
      state.primary.harmonics = harmonics;

      // Update HUD
      activeTermTitle.textContent = term;
      activeTermSubtitle.textContent = `POPULARITY INDEX: ${popularity}/100 • HARMONIC BAND ${harmonics}`;
      valPopularity.textContent = popularity;
      valHarmonics.textContent = harmonics;
      legendPrimary.textContent = `PRIMARY: ${term}`;

      updateAudioPitch(freq);
    } else {
      state.compareTerm = term;
      state.comparePopularity = popularity;
      state.secondary.targetFreq = freq;
      state.secondary.targetSpeed = speed;
      state.secondary.targetAmp = amp;
      state.secondary.harmonics = harmonics;
      legendSecondary.textContent = `SECONDARY: ${term}`;
    }

    if (suggestions && suggestions.length > 0 && document.activeElement === queryInput) {
      renderSuggestions(suggestions);
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Suggestions Dropdown UI
  // ---------------------------------------------------------------------------
  function renderSuggestions(list) {
    suggestDropdown.innerHTML = '';
    list.slice(0, 6).forEach(item => {
      const row = document.createElement('div');
      row.className = 'suggest-item';
      row.innerHTML = `
        <span class="suggest-term">${item}</span>
        <span class="suggest-score">TREND VECTOR</span>
      `;
      row.addEventListener('click', () => {
        queryInput.value = item;
        suggestDropdown.classList.remove('active');
        fetchSearchMetrics(item);
        syncPresetPill(item);
      });
      suggestDropdown.appendChild(row);
    });
    suggestDropdown.classList.add('active');
  }

  queryInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      fetchSearchMetrics(val);
    }, 250);
  });

  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      suggestDropdown.classList.remove('active');
      fetchSearchMetrics(queryInput.value);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      suggestDropdown.classList.remove('active');
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Quick Presets & Controls
  // ---------------------------------------------------------------------------
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
      queryInput.value = pill.dataset.term;
      fetchSearchMetrics(pill.dataset.term);
    });
  });

  btnRefresh.addEventListener('click', () => {
    fetchSearchMetrics(queryInput.value);
  });

  // Toggle Compare Mode
  btnCompare.addEventListener('click', () => {
    state.compareMode = !state.compareMode;
    if (state.compareMode) {
      btnCompare.classList.add('active');
      legendSecondaryWrap.style.display = 'flex';
      const promptTerm = prompt('Enter comparison search query:', state.compareTerm) || 'Artificial Intelligence';
      fetchSearchMetrics(promptTerm, true);
    } else {
      btnCompare.classList.remove('active');
      legendSecondaryWrap.style.display = 'none';
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Web Audio API Frequency Synthesizer
  // ---------------------------------------------------------------------------
  function initAudio() {
    if (!state.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new AudioContext();
      state.oscillator = state.audioCtx.createOscillator();
      state.gainNode = state.audioCtx.createGain();

      state.oscillator.type = 'sine';
      state.gainNode.gain.setValueAtTime(0.001, state.audioCtx.currentTime);

      state.oscillator.connect(state.gainNode);
      state.gainNode.connect(state.audioCtx.destination);
      state.oscillator.start();
    }
  }

  function updateAudioPitch(freq) {
    if (!state.audioActive || !state.oscillator || !state.audioCtx) return;
    // Map visual Hz (1.5 - 36 Hz) to musical audible pitch (80 Hz - 320 Hz)
    const audibleHz = 80 + (freq / 36) * 240;
    state.oscillator.frequency.setTargetAtTime(audibleHz, state.audioCtx.currentTime, 0.1);
  }

  btnAudio.addEventListener('click', () => {
    initAudio();
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }

    state.audioActive = !state.audioActive;
    if (state.audioActive) {
      btnAudio.classList.add('active');
      state.gainNode.gain.setTargetAtTime(0.06, state.audioCtx.currentTime, 0.15);
      updateAudioPitch(state.primary.freq);
    } else {
      btnAudio.classList.remove('active');
      state.gainNode.gain.setTargetAtTime(0.0001, state.audioCtx.currentTime, 0.15);
    }
  });

  // ---------------------------------------------------------------------------
  // 8. 60FPS Canvas Waveform Rendering Engine
  // ---------------------------------------------------------------------------
  function drawHorizonGrid(centerY) {
    ctx.save();
    // Center horizontal baseline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Baseline tick markers every 60px
    ctx.fillStyle = 'rgba(212, 175, 55, 0.3)';
    for (let x = 0; x < width; x += 60) {
      ctx.fillRect(x, centerY - 4, 1, 8);
    }
    ctx.restore();
  }

  function renderWave(waveConfig, centerY, time) {
    const { freq, amp, phase, harmonics, color, glow } = waveConfig;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2.2;
    ctx.beginPath();

    const spatialFreq = (freq * 0.0008) * Math.PI * 2;

    for (let x = 0; x <= width; x += 3) {
      // Primary carrier wave
      let y = Math.sin(x * spatialFreq + phase) * amp;

      // Harmonic sub-frequencies
      if (harmonics >= 2) {
        y += Math.sin(x * spatialFreq * 2 + phase * 1.4) * (amp * 0.28);
      }
      if (harmonics >= 3) {
        y += Math.sin(x * spatialFreq * 3 - phase * 0.8) * (amp * 0.14);
      }
      if (harmonics >= 4) {
        y += Math.cos(x * spatialFreq * 4 + phase * 2.1) * (amp * 0.08);
      }

      const plotY = centerY + y;

      if (x === 0) {
        ctx.moveTo(x, plotY);
      } else {
        ctx.lineTo(x, plotY);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  function renderParticles(centerY, spatialFreq, phase, amp) {
    ctx.save();
    state.particles.forEach(p => {
      p.x += p.speed;
      if (p.x > 1) p.x = 0;

      const px = p.x * width;
      const baseWaveY = Math.sin(px * spatialFreq + phase) * amp;
      const py = centerY + baseWaveY + p.yOffset;

      ctx.fillStyle = `rgba(212, 175, 55, ${p.alpha})`;
      ctx.shadowColor = 'rgba(212, 175, 55, 0.6)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px, py, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Linear Interpolation Helper
  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  // Main Animation Loop
  let lastTimestamp = 0;

  function animate(timestamp) {
    requestAnimationFrame(animate);

    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min(32, timestamp - lastTimestamp);
    lastTimestamp = timestamp;

    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;
    drawHorizonGrid(centerY);

    // Smooth lerp primary parameters towards targets
    state.primary.freq = lerp(state.primary.freq, state.primary.targetFreq, 0.08);
    state.primary.amp = lerp(state.primary.amp, state.primary.targetAmp, 0.08);
    state.primary.speed = lerp(state.primary.speed, state.primary.targetSpeed, 0.08);
    state.primary.phase += state.primary.speed * (dt / 16.6);

    // Smooth lerp secondary parameters
    if (state.compareMode) {
      state.secondary.freq = lerp(state.secondary.freq, state.secondary.targetFreq, 0.08);
      state.secondary.amp = lerp(state.secondary.amp, state.secondary.targetAmp, 0.08);
      state.secondary.speed = lerp(state.secondary.speed, state.secondary.targetSpeed, 0.08);
      state.secondary.phase += state.secondary.speed * (dt / 16.6);

      renderWave(state.secondary, centerY, timestamp);
    }

    // Render Primary Golden Wave
    renderWave(state.primary, centerY, timestamp);

    // Render Particle Accents along Primary Wave
    const primarySpatialFreq = (state.primary.freq * 0.0008) * Math.PI * 2;
    renderParticles(centerY, primarySpatialFreq, state.primary.phase, state.primary.amp);

    // Update real-time HUD telemetry readouts
    valFrequency.textContent = state.primary.freq.toFixed(1);
    valVelocity.textContent = (state.primary.speed * 100).toFixed(2);
  }

  // ---------------------------------------------------------------------------
  // 9. Telemetry Clock
  // ---------------------------------------------------------------------------
  function updateClock() {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    telemetryTimestamp.textContent = `SYS TIME: ${timeStr} UTC`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ---------------------------------------------------------------------------
  // 10. Initialization
  // ---------------------------------------------------------------------------
  resizeCanvas();
  fetchSearchMetrics(state.currentTerm);
  requestAnimationFrame(animate);

})();
