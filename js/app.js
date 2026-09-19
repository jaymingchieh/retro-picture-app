/* ===================================================================
   RETRO STUDIO — app logic
   Part A: ChatGPT prompt generator
   Part B: 80s photo filter (canvas)
   =================================================================== */
(function () {
  "use strict";

  const DATA = window.RETRO_DATA;
  const $ = (sel) => document.querySelector(sel);

  /* ----------------------------------------------------------------
     Toast helper
  ---------------------------------------------------------------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-show"), 1800);
  }

  /* ================================================================
     PART A — PROMPT GENERATOR
  ================================================================ */
  let currentLang = "zh";

  const optionSelects = Array.from(document.querySelectorAll("select[data-opt]"));

  // 填入選單
  optionSelects.forEach((sel) => {
    const key = sel.dataset.opt;
    const list = DATA.options[key] || [];
    list.forEach((item) => {
      const o = document.createElement("option");
      o.value = item.id;
      o.textContent = item.label;
      sel.appendChild(o);
    });
    if (DATA.defaults[key]) sel.value = DATA.defaults[key];
  });

  // 由 id 取回選項物件
  function pick(key) {
    const id = $(`#opt-${idFor(key)}`).value;
    return DATA.options[key].find((x) => x.id === id) || DATA.options[key][0];
  }
  // select 的 element id 與 data key 對應 (兩者相同，僅集中管理)
  function idFor(key) { return key; }

  function buildPromptZH() {
    const era = pick("era").zh;
    const scene = pick("scene").zh;
    const brow = pick("brow").zh;
    const eye = pick("eye").zh;
    const blush = pick("blush").zh;
    const lip = pick("lip").zh;
    const hair = pick("hair").zh;
    const outfit = pick("outfit").zh;
    const film = pick("film").zh;
    const keepFace = $("#opt-keepface").checked;
    const noModern = $("#opt-nomodern").checked;

    let s = "";
    s += keepFace
      ? `參考我上傳的照片，保留我的主要五官與臉型特徵，把我變成${era}的${scene}。`
      : `參考我上傳的照片，把我重新想像成${era}的${scene}。`;
    s += `妝容使用${brow}、${eye}、${blush}與${lip}；`;
    s += `頭髮改為${hair}。`;
    s += `穿著${outfit}。`;
    s += `${film}。`;
    s += noModern ? `整體寫實自然，不要現代感元素。` : `整體風格自然。`;
    return s;
  }

  function buildPromptEN() {
    const era = pick("era").en;
    const scene = pick("scene").en;
    const brow = pick("brow").en;
    const eye = pick("eye").en;
    const blush = pick("blush").en;
    const lip = pick("lip").en;
    const hair = pick("hair").en;
    const outfit = pick("outfit").en;
    const film = pick("film").en;
    const keepFace = $("#opt-keepface").checked;
    const noModern = $("#opt-nomodern").checked;

    let s = "";
    s += keepFace
      ? `Using the photo I uploaded, keep my main facial features and face shape, and reimagine me as ${scene} in ${era}. `
      : `Using the photo I uploaded, reimagine me as ${scene} in ${era}. `;
    s += `For makeup use ${brow}, ${eye}, ${blush} and ${lip}. `;
    s += `Change the hair to ${hair}. `;
    s += `Dress me in ${outfit}. `;
    s += `${capitalize(film)}. `;
    s += noModern
      ? `Keep it realistic and natural, with no modern elements.`
      : `Keep the overall style natural.`;
    return s;
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function renderPrompt() {
    const text = currentLang === "zh" ? buildPromptZH() : buildPromptEN();
    $("#prompt-output").value = text;
  }

  // 事件: 選項變動
  optionSelects.forEach((sel) => sel.addEventListener("change", renderPrompt));
  $("#opt-keepface").addEventListener("change", renderPrompt);
  $("#opt-nomodern").addEventListener("change", renderPrompt);

  // 語言切換
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lang-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentLang = btn.dataset.lang;
      renderPrompt();
    });
  });

  // 一鍵複製
  $("#copy-btn").addEventListener("click", async () => {
    const text = $("#prompt-output").value;
    try {
      await navigator.clipboard.writeText(text);
      toast("已複製指令 ✦");
    } catch (e) {
      // fallback
      const ta = $("#prompt-output");
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
        toast("已複製指令 ✦");
      } catch (_) {
        toast("複製失敗，請手動選取");
      }
    }
  });

  renderPrompt(); // 初始

  /* ================================================================
     PART B — 80s PHOTO FILTER
  ================================================================ */
  const canvas = $("#photo-canvas");
  const ctx = canvas.getContext("2d");
  const placeholder = $("#photo-placeholder");
  let sourceImg = null;
  let noiseCanvas = null; // 快取的顆粒圖層

  // 填入濾鏡預設
  const fxPreset = $("#fx-preset");
  DATA.filterPresets.forEach((p) => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.label;
    fxPreset.appendChild(o);
  });

  // 每個濾鏡的色彩參數
  const PRESET_FX = {
    "80s-warm":      { sat: 1.15, contrast: 1.12, r: 1.12, g: 1.02, b: 0.82, tintR: 30, tintG: 12, tintB: -18, fade: 0.10 },
    "faded-film":    { sat: 0.82, contrast: 0.92, r: 1.05, g: 1.0,  b: 0.98, tintR: 18, tintG: 10, tintB: 6,   fade: 0.22 },
    "sepia":         { sat: 0.35, contrast: 1.05, r: 1.20, g: 1.0,  b: 0.72, tintR: 42, tintG: 22, tintB: -20, fade: 0.14 },
    "cool-retro":    { sat: 0.95, contrast: 1.08, r: 0.94, g: 1.0,  b: 1.14, tintR: -14,tintG: 4,  tintB: 26,  fade: 0.12 },
    "high-contrast": { sat: 1.25, contrast: 1.30, r: 1.08, g: 1.0,  b: 0.92, tintR: 12, tintG: 6,  tintB: -6,  fade: 0.04 },
  };

  const fxStrength = $("#fx-strength");
  const fxGrain = $("#fx-grain");
  const fxVignette = $("#fx-vignette");
  const fxDate = $("#fx-date");

  // 讀檔
  $("#file-input").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        sourceImg = img;
        setupCanvas(img);
        noiseCanvas = null; // 尺寸改變，重建顆粒
        render();
        canvas.classList.add("is-visible");
        placeholder.classList.add("is-hidden");
        $("#download-btn").disabled = false;
      };
      img.onerror = () => toast("無法讀取這張圖片");
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  function setupCanvas(img) {
    const maxW = 1400;
    const scale = Math.min(1, maxW / img.naturalWidth);
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
  }

  function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

  function buildNoise(w, h) {
    const nc = document.createElement("canvas");
    nc.width = w; nc.height = h;
    const nctx = nc.getContext("2d");
    const id = nctx.createImageData(w, h);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    nctx.putImageData(id, 0, 0);
    return nc;
  }

  function render() {
    if (!sourceImg) return;
    const w = canvas.width, h = canvas.height;
    const strength = +fxStrength.value / 100;
    const preset = PRESET_FX[fxPreset.value] || PRESET_FX["80s-warm"];

    // 1) 畫原圖
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(sourceImg, 0, 0, w, h);

    // 2) 逐像素套色調 (依 strength 混合)
    const frame = ctx.getImageData(0, 0, w, h);
    const d = frame.data;
    const sat = mix(1, preset.sat, strength);
    const con = mix(1, preset.contrast, strength);
    const rMul = mix(1, preset.r, strength);
    const gMul = mix(1, preset.g, strength);
    const bMul = mix(1, preset.b, strength);
    const tR = preset.tintR * strength;
    const tG = preset.tintG * strength;
    const tB = preset.tintB * strength;
    const fade = preset.fade * strength; // 提升黑階，模擬褪色
    const conOff = 128 * (1 - con);

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      // 飽和度
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * sat;
      g = gray + (g - gray) * sat;
      b = gray + (b - gray) * sat;
      // 色頻增益 + tint
      r = r * rMul + tR;
      g = g * gMul + tG;
      b = b * bMul + tB;
      // 對比
      r = r * con + conOff;
      g = g * con + conOff;
      b = b * con + conOff;
      // 褪色 (lift blacks)
      r = r + (255 - r) * fade * 0.25 + 255 * fade * 0.05;
      g = g + (255 - g) * fade * 0.25 + 255 * fade * 0.05;
      b = b + (255 - b) * fade * 0.25 + 255 * fade * 0.05;

      d[i] = clamp(r);
      d[i + 1] = clamp(g);
      d[i + 2] = clamp(b);
    }
    ctx.putImageData(frame, 0, 0);

    // 3) 底片顆粒
    const grain = +fxGrain.value / 100;
    if (grain > 0) {
      if (!noiseCanvas || noiseCanvas.width !== w || noiseCanvas.height !== h) {
        noiseCanvas = buildNoise(w, h);
      }
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = grain * 0.5;
      ctx.drawImage(noiseCanvas, 0, 0);
      ctx.restore();
    }

    // 4) 暈影
    const vig = +fxVignette.value / 100;
    if (vig > 0) {
      const grad = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.35,
        w / 2, h / 2, Math.max(w, h) * 0.75
      );
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(20,5,25,${vig * 0.85})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // 5) 日期戳記
    if (fxDate.checked) {
      drawDateStamp(w, h);
    }
  }

  function drawDateStamp(w, h) {
    const size = Math.max(14, Math.round(w * 0.028));
    ctx.save();
    ctx.font = `${size}px "Courier New", monospace`;
    ctx.textBaseline = "bottom";
    ctx.textAlign = "right";
    const stamp = fakeRetroDate();
    const pad = Math.round(size * 0.8);
    // 發光橘字，模擬底片日期
    ctx.shadowColor = "rgba(255,140,0,0.9)";
    ctx.shadowBlur = size * 0.5;
    ctx.fillStyle = "#ffb43a";
    ctx.fillText(stamp, w - pad, h - pad);
    ctx.restore();
  }

  function fakeRetroDate() {
    // 隨機一個 80 年代日期 (穩定於本次 session 內)
    if (!fakeRetroDate.cached) {
      const y = 80 + Math.floor(Math.random() * 10); // 80-89
      const m = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
      const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
      fakeRetroDate.cached = `'${y} ${m} ${day}`;
    }
    return fakeRetroDate.cached;
  }

  function mix(a, b, t) { return a + (b - a) * t; }

  // slider 事件
  [fxStrength, fxGrain, fxVignette].forEach((slider) => {
    slider.addEventListener("input", () => {
      $(`#${slider.id}-val`).textContent = slider.value + "%";
      render();
    });
  });
  fxPreset.addEventListener("change", render);
  fxDate.addEventListener("change", render);

  // 下載
  $("#download-btn").addEventListener("click", () => {
    if (!sourceImg) return;
    const link = document.createElement("a");
    link.download = "retro-80s-photo.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast("已下載照片 ✦");
  });
})();
