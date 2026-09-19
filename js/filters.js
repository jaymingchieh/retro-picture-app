/* ===================================================================
   Retro Cam — filter engine
   Each filter = a CSS filter string (fast, GPU) applied via ctx.filter,
   plus overlay params (grain / vignette / light leak / tint) composited
   on top. Same code path is used for the live preview and the capture.
   A filter may also carry frame:"polaroid" to render a white Polaroid
   border with the date printed in the bottom band.
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
      id: "sepia",
      name: "泛黃老照片",
      css: "sepia(0.78) saturate(0.85) contrast(1.02) brightness(1.06)",
      grain: 0.30, vignette: 0.34, leak: "warm", tint: "rgba(255,200,140,0.16)",
    },
    {
      id: "polaroid",
      name: "拍立得",
      css: "saturate(1.08) contrast(1.05) brightness(1.07)",
      grain: 0.16, vignette: 0.14, leak: null, tint: "rgba(255,240,215,0.07)",
      frame: "polaroid",
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
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const s = Math.max(0, Math.min(1, strength));
    const polaroid = filter.frame === "polaroid";

    // inner rect = where the photo goes (whole canvas, or inset for polaroid)
    let ix = 0, iy = 0, iw = W, ih = H, band = 0;
    if (polaroid) {
      const edge = Math.round(Math.min(W, H) * 0.05);
      band = Math.round(Math.min(W, H) * 0.16);
      ix = edge; iy = edge; iw = W - edge * 2; ih = H - edge - band;
    }

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // polaroid white paper
    if (polaroid) {
      ctx.fillStyle = "#fbf7f0";
      ctx.fillRect(0, 0, W, H);
    }

    // clip to inner rect so overlays stay inside the photo
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();

    // base image (optionally mirrored for selfie), cover-fit into inner rect
    ctx.save();
    if (opts.mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.filter = s > 0 && filter.css !== "none" ? scaleFilter(filter.css, s) : "none";
    const mx = opts.mirror ? W - (ix + iw) : ix; // mirrored inner-x origin
    drawCover(ctx, source, mx, iy, iw, ih);
    ctx.restore();
    ctx.filter = "none";

    if (s > 0) {
      if (filter.tint) {
        ctx.save();
        ctx.globalAlpha = s;
        ctx.fillStyle = filter.tint;
        ctx.fillRect(ix, iy, iw, ih);
        ctx.restore();
      }
      if (filter.leak) drawLeak(ctx, ix, iy, iw, ih, filter.leak, s);
      if (filter.grain > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = filter.grain * s;
        const n = noise(W, H);
        ctx.drawImage(n, 0, 0);
        ctx.restore();
      }
      if (filter.vignette > 0) {
        const cx = ix + iw / 2, cy = iy + ih / 2;
        const g = ctx.createRadialGradient(
          cx, cy, Math.min(iw, ih) * 0.34,
          cx, cy, Math.max(iw, ih) * 0.72
        );
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(20,10,20," + (filter.vignette * s * 0.9).toFixed(3) + ")");
        ctx.fillStyle = g;
        ctx.fillRect(ix, iy, iw, ih);
      }
    }
    // user-selected light-leak / flare overlay (independent of filter strength)
    if (opts.overlay && opts.overlay !== "none" && window.RetroLeaks) {
      window.RetroLeaks.apply(ctx, opts.overlay, ix, iy, iw, ih, opts.overlayStrength);
    }
    ctx.restore(); // end clip

    // date stamp
    if (opts.date) {
      if (polaroid) drawPolaroidDate(ctx, ix, iy + ih, iw, band);
      else drawDate(ctx, W, H);
    }
    ctx.restore();
  }

  function drawCover(ctx, src, dx, dy, dw, dh) {
    const sw = src.videoWidth || src.naturalWidth || src.width;
    const sh = src.videoHeight || src.naturalHeight || src.height;
    if (!sw || !sh) { ctx.drawImage(src, dx, dy, dw, dh); return; }
    const scale = Math.max(dw / sw, dh / sh);
    const w = sw * scale, h = sh * scale;
    ctx.drawImage(src, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
  }

  // scale a css filter string toward "none" by strength (interpolate numbers)
  function scaleFilter(css, s) {
    if (s >= 0.999) return css;
    return css.replace(/([a-z-]+)\(([-0-9.]+)([a-z%]*)\)/g, (m, fn, num, unit) => {
      const val = parseFloat(num);
      const identity = (fn === "hue-rotate" || unit === "deg") ? 0
        : (fn === "sepia" || fn === "grayscale" || fn === "blur" || fn === "invert") ? 0
        : 1;
      const scaled = identity + (val - identity) * s;
      return `${fn}(${round(scaled)}${unit})`;
    });
  }
  function round(n) { return Math.round(n * 1000) / 1000; }

  function drawLeak(ctx, ix, iy, iw, ih, kind, s) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.6 * s;
    const cx = ix + iw * 0.9, cy = iy + ih * 0.12;
    const corner = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(iw, ih) * 0.55);
    if (kind === "warm") {
      corner.addColorStop(0, "rgba(255,120,40,0.85)");
      corner.addColorStop(0.5, "rgba(255,60,80,0.35)");
      corner.addColorStop(1, "rgba(255,0,0,0)");
    } else {
      corner.addColorStop(0, "rgba(120,180,255,0.7)");
      corner.addColorStop(1, "rgba(0,0,255,0)");
    }
    ctx.fillStyle = corner;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.restore();
  }

  let cachedDate = null;
  function currentDate() {
    if (!cachedDate) {
      const d = new Date();
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      cachedDate = `'${yy} ${mm} ${dd}`;
    }
    return cachedDate;
  }

  function drawDate(ctx, w, h) {
    const size = Math.max(16, Math.round(w * 0.045));
    ctx.save();
    ctx.font = `${size}px "VT323", "Courier New", monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const pad = Math.round(size * 0.7);
    ctx.shadowColor = "rgba(255,140,0,0.95)";
    ctx.shadowBlur = size * 0.6;
    ctx.fillStyle = "#ffa53a";
    ctx.fillText(currentDate(), w - pad, h - pad);
    ctx.restore();
  }

  function drawPolaroidDate(ctx, x, y, w, band) {
    const size = Math.max(18, Math.round(band * 0.42));
    ctx.save();
    ctx.font = `${size}px "VT323", "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5a4d46";
    ctx.fillText(currentDate(), x + w / 2, y + band / 2);
    ctx.restore();
  }

  window.RetroFilters = { list: FILTERS, draw: draw, resetDate: () => (cachedDate = null) };
})();
