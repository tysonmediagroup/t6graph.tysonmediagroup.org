<p align="center">
  <a href="https://t6graph.tysonmediagroup.org">
    <img src="assets/TYSONMediaGroupBanner.png" alt="TYSON Media Group" width="700">
  </a>
</p>

<h1 align="center">PROJECT T6 // SONAR</h1>

<p align="center">
  <a href="https://t6graph.tysonmediagroup.org"><img src="https://img.shields.io/badge/Subdomain-t6graph.tysonmediagroup.org-d4af37" alt="Subdomain"></a>
  <a href="https://pages.cloudflare.com"><img src="https://img.shields.io/badge/Host-Cloudflare%20Pages-F38020?logo=cloudflare" alt="Cloudflare Pages"></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API"><img src="https://img.shields.io/badge/Engine-HTML5%20Canvas%2060FPS-000000" alt="Canvas 60FPS"></a>
</p>

<p align="center">
  <em>"Stillness in Motion."</em>
</p>

Official real-time Search Frequency Oscilloscope and Trend Telemetry visualizer for **TYSON Media Group** ([t6graph.tysonmediagroup.org](https://t6graph.tysonmediagroup.org)).

Part of the **Project T6** Next-Gen Web Suite.

---

## Overview

**PROJECT T6 // SONAR** translates global search popularity and Google trend velocity directly into mathematical waveform frequencies. As a search keyword gains popularity, the carrier waveform accelerates into high-frequency oscillations with dynamic harmonic resonance.

- **Aesthetic**: Midnight Noir, Cormorant Garamond luxury headers, and ultra-thin surgical Roboto telemetry HUD.
- **Engine**: 60FPS pure HTML5 Canvas wave synthesizer with harmonic sub-bands and drifting spark particle physics.
- **Cloudflare Edge Native**: Runs serverlessly on Cloudflare Pages with edge functions (`functions/api/`) proxying Google trends and autocomplete with zero CORS latency.
- **Audio Synthesizer**: Built-in Web Audio API oscillator that dynamically modulates pitch to match the visual frequency of any search term.
- **Comparison Engine**: Dual-wave overlay pitting keywords head-to-head.

---

## Local Development

Run the zero-dependency localhost dev server:

```bash
node server.js
```

Then visit:
```text
http://localhost:3000
```

## Cloudflare Pages Deployment

Deploy directly from Git or using Wrangler:

```bash
npx wrangler pages deploy . --project-name=t6graph
```

Or connect the GitHub repository to Cloudflare Pages:
- **Build command**: *(none)*
- **Build output directory**: `/`
