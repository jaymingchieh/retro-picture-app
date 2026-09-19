/* ===================================================================
   Retro Cam — light leak / lens flare overlays
   Procedurally drawn (no external images). Applied on top of the
   filtered photo with additive "screen" blending, inside the photo area.
   =================================================================== */
(function () {
  "use strict";

  // soft radial glow helper (screen blend assumed set by caller)
  function glow(ctx, cx, cy, r, stops) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    stops.forEach((s) => g.addColorStop(s[0], s[1]));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  const LEAKS = [
    { id: "none", name: "無", draw: null },

    {
      id: "warm-corner", name: "暖角漏光",
      draw(ctx, x, y, w, h, a) {
        const cx = x + w * 0.86, cy = y + h * 0.12, r = Math.max(w, h) * 0.7;
        glow(ctx, cx, cy, r, [
          [0, `rgba(255,150,60,${0.75 * a})`],
          [0.45, `rgba(255,70,80,${0.30 * a})`],
          [1, "rgba(255,0,0,0)"],
        ]);
      },
    },

    {
      id: "rainbow", name: "彩虹光斑",
      draw(ctx, x, y, w, h, a) {
        // bright source glow at top-right, flare dots along the diagonal
        const sx = x + w * 0.88, sy = y + h * 0.14;
        glow(ctx, sx, sy, Math.max(w, h) * 0.5, [
          [0, `rgba(255,240,210,${0.7 * a})`],
          [0.5, `rgba(255,190,120,${0.22 * a})`],
          [1, "rgba(255,180,120,0)"],
        ]);
        const ex = x + w * 0.14, ey = y + h * 0.86;
        const dots = [
          [0.30, w * 0.075, `rgba(120,220,220,${0.40 * a})`],
          [0.44, w * 0.045, `rgba(255,120,190,${0.40 * a})`],
          [0.56, w * 0.10, `rgba(255,210,120,${0.34 * a})`],
          [0.68, w * 0.035, `rgba(150,170,255,${0.42 * a})`],
          [0.82, w * 0.06, `rgba(180,255,190,${0.32 * a})`],
        ];
        dots.forEach(([t, r, col]) => {
          const dx = sx + (ex - sx) * t, dy = sy + (ey - sy) * t;
          glow(ctx, dx, dy, r, [[0, col], [1, "rgba(255,255,255,0)"]]);
        });
      },
    },

    {
      id: "sunflare", name: "陽光光暈",
      draw(ctx, x, y, w, h, a) {
        // big warm glow from top-center + a horizontal streak
        glow(ctx, x + w * 0.5, y - h * 0.04, Math.max(w, h) * 0.85, [
          [0, `rgba(255,225,160,${0.6 * a})`],
          [0.55, `rgba(255,190,110,${0.18 * a})`],
          [1, "rgba(255,190,110,0)"],
        ]);
        const gy = y + h * 0.24;
        const lg = ctx.createLinearGradient(x, gy, x + w, gy);
        lg.addColorStop(0, "rgba(255,220,150,0)");
        lg.addColorStop(0.5, `rgba(255,235,180,${0.30 * a})`);
        lg.addColorStop(1, "rgba(255,220,150,0)");
        ctx.fillStyle = lg;
        ctx.fillRect(x, y + h * 0.10, w, h * 0.28);
      },
    },

    {
      id: "red-streak", name: "復古紅光",
      draw(ctx, x, y, w, h, a) {
        // vintage red light-leak washing in from the left edge + hot core
        const lg = ctx.createLinearGradient(x, y, x + w * 0.55, y);
        lg.addColorStop(0, `rgba(255,45,40,${0.55 * a})`);
        lg.addColorStop(0.4, `rgba(255,90,60,${0.22 * a})`);
        lg.addColorStop(1, "rgba(255,60,40,0)");
        ctx.fillStyle = lg;
        ctx.fillRect(x, y, w, h);
        glow(ctx, x + w * 0.04, y + h * 0.30, Math.max(w, h) * 0.4, [
          [0, `rgba(255,120,70,${0.5 * a})`],
          [1, "rgba(255,80,40,0)"],
        ]);
      },
    },

    {
      id: "gold-dust", name: "金色光塵",
      draw(ctx, x, y, w, h, a) {
        // scattered soft golden bokeh (deterministic positions)
        const pts = [
          [0.18, 0.22, 0.055, 0.42], [0.30, 0.62, 0.035, 0.35],
          [0.46, 0.30, 0.070, 0.30], [0.58, 0.74, 0.030, 0.40],
          [0.70, 0.20, 0.050, 0.34], [0.80, 0.55, 0.042, 0.38],
          [0.24, 0.82, 0.028, 0.34], [0.90, 0.80, 0.048, 0.30],
          [0.64, 0.46, 0.024, 0.44], [0.40, 0.90, 0.032, 0.30],
        ];
        pts.forEach(([px, py, pr, pa]) => {
          glow(ctx, x + w * px, y + h * py, w * pr, [
            [0, `rgba(255,215,120,${pa * a})`],
            [0.6, `rgba(255,195,90,${pa * 0.4 * a})`],
            [1, "rgba(255,195,90,0)"],
          ]);
        });
      },
    },
  ];

  function apply(ctx, id, x, y, w, h, strength) {
    const leak = LEAKS.find((l) => l.id === id);
    if (!leak || !leak.draw) return;
    const a = Math.max(0, Math.min(1, strength == null ? 1 : strength));
    if (a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    leak.draw(ctx, x, y, w, h, a);
    ctx.restore();
  }

  window.RetroLeaks = { list: LEAKS, apply };
})();
