/* ===================================================================
   Retro Cam — filter engine
   Each filter = a CSS filter string (fast, GPU) applied via ctx.filter,
   plus overlay params (grain / vignette / light leak / tint) composited
   on top. Same code path is used for the live preview and the capture.
   =================================================================== */
(function () {
  "use strict";

  const FILTERS = [
    {
      id: "ccd",
      name: "CCD 清晰",
      css: "saturate(1.35) contrast(1.12) brightness(1.05)",
      grain: 0.12, vignette: 0.18, leak: null, tint: null,
    },
    {
      id: "warm",
      name: "暖陽底片",
      css: "sepia(0.28) saturate(1.15) contrast(1.05) brightness(1.06) hue-rotate(-10deg)",
      grain: 0.22, vignette: 0.30, leak: "warm", tint: "rgba(255,180,90,0.10)",
    },
    {
      id: "cool",
      name: "冷調 Y2K",
      css: "saturate(1.2) contrast(1.12) brightness(1.02) hue-rotate(8deg)",
      grain: 0.18, vignette: 0.24, leak: null, tint: "rgba(80,140,255,0.08)",
    },
    {
      id: "faded",
      name: "泛黃回憶",
      css: "sepia(0.5) saturate(0.8) contrast(0.9) brightness(1.12)",
      grain: 0.30, vignette: 0.35, leak: "warm", tint: "rgba(255,210,150,0.14)",
    },
    {
      id: "mono",
      name: "黑白底片",
      css: "grayscale(1) contrast(1.15) brightness(1.03)",
      grain: 0.28, vignette: 0.30, leak: null, tint: null,
    },
    {
      id: "flash",
      name: "夜間閃燈",
      css: "saturate(1.25) contrast(1.28) brightness(0.96)",
      grain: 0.20, vignette: 0.42, leak: null, tint: "rgba(30,20,50,0.10)",
    },
    {
      id: "none",
      name: "原色",
      css: "none",
      grain: 0, vignette: 0, leak: null, tint: null,
    },
  ];

  // grain tile cache keyed by "wxh"
  const noiseCache = {};
  function noise(w, h) {
    const key = w + "x" + h;
    if (noiseCache[key]) return noiseCache[key];
    const nc = document.createElement("canvas");
    nc.width = w; nc.height = h;
    const nctx = nc.getContext("2d");
    const img = nctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
    noiseCache[key] = nc;
    return nc;
  }

  /**
   * Render one frame with a filter onto ctx.
   * @param {CanvasRenderingContext2D} ctx  destination context
   * @param {CanvasImageSource} source       video or image
   * @param {Object} filter                  a FILTERS entry
   * @param {number} strength                0..1
   * @param {Object} [opts]                  { date: bool, mirror: bool }
   */
  function draw(ctx, source, filter, strength, opts) {
    opts = opts || {};
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const s = Math.max(0, Math.min(1, strength));

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // base image (optionally mirrored for selfie)
    ctx.save();
    if (opts.mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.filter = s > 0 && filter.css !== "none" ? scaleFilter(filter.css, s) : "none";
    ctx.drawImage(source, 0, 0, w, h);
    ctx.restore();
    ctx.filter = "none";

    if (s > 0) {
      // tint wash
      if (filter.tint) {
        ctx.save();
        ctx.globalAlpha = s;
        ctx.fillStyle = filter.tint;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      // light leak
      if (filter.leak) drawLeak(ctx, w, h, filter.leak, s);
      // grain
      if (filter.grain > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = filter.grain * s;
        const n = noise(w, h);
        ctx.drawImage(n, 0, 0);
        ctx.restore();
      }
      // vignette
      if (filter.vignette > 0) {
        const g = ctx.createRadialGradient(
          w / 2, h / 2, Math.min(w, h) * 0.34,
          w / 2, h / 2, Math.max(w, h) * 0.72
        );
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(20,10,20," + (filter.vignette * s * 0.9).toFixed(3) + ")");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    }

    // date stamp
    if (opts.date) drawDate(ctx, w, h);
    ctx.restore();
  }

  // scale a css filter string toward "none" by strength (interpolate numbers)
  function scaleFilter(css, s) {
    if (s >= 0.999) return css;
    return css.replace(/([a-z-]+)\(([-0-9.]+)([a-z%]*)\)/g, (m, fn, num, unit) => {
      const val = parseFloat(num);
      // identity value for each function
      const identity = (fn === "hue-rotate" || unit === "deg") ? 0
        : (fn === "sepia" || fn === "grayscale" || fn === "blur" || fn === "invert") ? 0
        : 1; // saturate/contrast/brightness default 1
      const scaled = identity + (val - identity) * s;
      return `${fn}(${round(scaled)}${unit})`;
    });
  }
  function round(n) { return Math.round(n * 1000) / 1000; }

  function drawLeak(ctx, w, h, kind, s) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.6 * s;
    const corner = ctx.createRadialGradient(w * 0.9, h * 0.12, 0, w * 0.9, h * 0.12, Math.max(w, h) * 0.55);
    if (kind === "warm") {
      corner.addColorStop(0, "rgba(255,120,40,0.85)");
      corner.addColorStop(0.5, "rgba(255,60,80,0.35)");
      corner.addColorStop(1, "rgba(255,0,0,0)");
    } else {
      corner.addColorStop(0, "rgba(120,180,255,0.7)");
      corner.addColorStop(1, "rgba(0,0,255,0)");
    }
    ctx.fillStyle = corner;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  let cachedDate = null;
  function drawDate(ctx, w, h) {
    if (!cachedDate) {
      const d = new Date();
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      cachedDate = `'${yy} ${mm} ${dd}`;
    }
    const size = Math.max(16, Math.round(w * 0.045));
    ctx.save();
    ctx.font = `${size}px "VT323", "Courier New", monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const pad = Math.round(size * 0.7);
    ctx.shadowColor = "rgba(255,140,0,0.95)";
    ctx.shadowBlur = size * 0.6;
    ctx.fillStyle = "#ffa53a";
    ctx.fillText(cachedDate, w - pad, h - pad);
    ctx.restore();
  }

  window.RetroFilters = { list: FILTERS, draw: draw, resetDate: () => (cachedDate = null) };
})();
