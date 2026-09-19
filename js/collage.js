/* ===================================================================
   Retro Cam — four-cut collage composer (인생네컷 style)
   Composes 4 captured frames into a retro photo strip or 2x2 grid,
   with a colored frame, footer caption and date.
   =================================================================== */
(function () {
  "use strict";

  const FRAMES = [
    { id: "cream", label: "奶油", bg: "#fdf1e7", ink: "#3a2e36" },
    { id: "white", label: "白", bg: "#fffdfb", ink: "#3a2e36" },
    { id: "black", label: "黑", bg: "#1a1418", ink: "#fdf1e7" },
    { id: "coral", label: "珊瑚", bg: "#ff7a7a", ink: "#fffdfb" },
  ];

  const LAYOUTS = [
    { id: "strip", label: "直式相條" },
    { id: "grid", label: "2×2 格" },
  ];

  // draw source (canvas/image) into dest rect with "cover" cropping
  function drawCover(ctx, src, dx, dy, dw, dh) {
    const sw = src.width || src.naturalWidth;
    const sh = src.height || src.naturalHeight;
    const scale = Math.max(dw / sw, dh / sh);
    const w = sw * scale, h = sh * scale;
    const ox = dx + (dw - w) / 2;
    const oy = dy + (dh - h) / 2;
    ctx.drawImage(src, ox, oy, w, h);
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * @param {Array<HTMLCanvasElement|HTMLImageElement>} shots  exactly 4
   * @param {Object} opts { layout:'strip'|'grid', frame:id, caption, date }
   * @returns {HTMLCanvasElement}
   */
  function compose(shots, opts) {
    opts = opts || {};
    const frame = FRAMES.find((f) => f.id === opts.frame) || FRAMES[0];
    const layout = opts.layout === "grid" ? "grid" : "strip";
    const caption = opts.caption || "RETRO CAM";
    const date = opts.date || dateStr();

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const cellR = 10;

    if (layout === "strip") {
      const W = 720, margin = 36, gap = 20, footer = 128;
      const cellW = W - margin * 2;
      const cellH = Math.round(cellW * 3 / 4);
      const H = margin + cellH * 4 + gap * 3 + footer;
      canvas.width = W; canvas.height = H;
      paintFrame(ctx, W, H, frame);
      for (let i = 0; i < 4; i++) {
        const x = margin;
        const y = margin + i * (cellH + gap);
        cell(ctx, shots[i], x, y, cellW, cellH, cellR);
      }
      drawFooter(ctx, 0, H - footer, W, footer, frame, caption, date);
    } else {
      const W = 720, margin = 34, gap = 18, footer = 108;
      const cellW = Math.round((W - margin * 2 - gap) / 2);
      const cellH = Math.round(cellW * 3 / 4);
      const H = margin + cellH * 2 + gap + footer;
      canvas.width = W; canvas.height = H;
      paintFrame(ctx, W, H, frame);
      for (let i = 0; i < 4; i++) {
        const col = i % 2, row = (i / 2) | 0;
        const x = margin + col * (cellW + gap);
        const y = margin + row * (cellH + gap);
        cell(ctx, shots[i], x, y, cellW, cellH, cellR);
      }
      drawFooter(ctx, 0, H - footer, W, footer, frame, caption, date);
    }
    return canvas;
  }

  function paintFrame(ctx, W, H, frame) {
    ctx.fillStyle = frame.bg;
    ctx.fillRect(0, 0, W, H);
  }

  function cell(ctx, src, x, y, w, h, r) {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, w, h);
    if (src) drawCover(ctx, src, x, y, w, h);
    ctx.restore();
    // subtle inner border
    ctx.save();
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawFooter(ctx, x, y, w, h, frame, caption, date) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // caption (brand)
    ctx.fillStyle = frame.ink;
    ctx.font = `700 ${Math.round(h * 0.30)}px "Baloo 2","Noto Sans TC",sans-serif`;
    ctx.fillText(caption, x + w / 2, y + h * 0.40);
    // date (mono)
    ctx.font = `${Math.round(h * 0.34)}px "VT323","Courier New",monospace`;
    ctx.fillStyle = frame.id === "black" || frame.id === "coral"
      ? "rgba(255,255,255,0.85)" : "rgba(58,46,54,0.7)";
    ctx.fillText(date, x + w / 2, y + h * 0.74);
    ctx.restore();
  }

  function dateStr(d) {
    d = d || new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `'${String(d.getFullYear()).slice(2)} ${p(d.getMonth() + 1)} ${p(d.getDate())}`;
  }

  window.RetroCollage = { compose, FRAMES, LAYOUTS, dateStr };
})();
