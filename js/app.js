/* ===================================================================
   Retro Cam — main app
   =================================================================== */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);

  // ---- elements ----
  const video = $("#video");
  const preview = $("#preview");
  const pctx = preview.getContext("2d");
  const overlay = $("#vf-overlay");
  const overlayMsg = $("#vf-overlay-msg");
  const startBtn = $("#start-btn");
  const shutterBtn = $("#shutter-btn");
  const flipBtn = $("#flip-btn");
  const flashEl = $("#flash");
  const filtersNav = $("#filters");
  const strengthEl = $("#strength");
  const vfDate = $("#vf-date");

  const cam = new window.Camera(video);
  const FILTERS = window.RetroFilters.list;

  let currentFilter = FILTERS[0];
  let strength = 1;
  let running = false;
  let rafId = null;
  let capturing = false;
  let uploadedImage = null; // when set, we are editing an uploaded photo

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-show"), 1900);
  }

  /* ---------------- filter strip ---------------- */
  FILTERS.forEach((f, i) => {
    const b = document.createElement("button");
    b.className = "filter-chip" + (i === 0 ? " is-active" : "");
    b.textContent = f.name;
    b.dataset.id = f.id;
    b.addEventListener("click", () => {
      currentFilter = f;
      document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("is-active"));
      b.classList.add("is-active");
      // ensure active chip scrolls into view
      b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      if (uploadedImage) renderUploaded();
    });
    filtersNav.appendChild(b);
  });

  strengthEl.addEventListener("input", () => {
    strength = +strengthEl.value / 100;
    if (uploadedImage) renderUploaded();
  });

  /* ---------------- mode + four-cut options ---------------- */
  let mode = "single"; // 'single' | 'four'
  const fourOpts = { layout: "strip", frame: "cream" };
  const fourOptsEl = $("#four-opts");
  const countdownEl = $("#countdown");
  const shotCounterEl = $("#shot-counter");

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (capturing) return;
      if (uploadedImage) exitUpload();
      mode = btn.dataset.mode;
      document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      fourOptsEl.hidden = mode !== "four";
    });
  });

  // layout segmented control
  const layoutSeg = $("#layout-seg");
  window.RetroCollage.LAYOUTS.forEach((l, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "seg-btn" + (l.id === fourOpts.layout ? " is-active" : "");
    b.textContent = l.label;
    b.addEventListener("click", () => {
      fourOpts.layout = l.id;
      layoutSeg.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
    });
    layoutSeg.appendChild(b);
  });

  // frame color swatches
  const frameSeg = $("#frame-seg");
  window.RetroCollage.FRAMES.forEach((f) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "frame-swatch" + (f.id === fourOpts.frame ? " is-active" : "");
    b.style.background = f.bg;
    b.title = f.label;
    b.setAttribute("aria-label", "相框：" + f.label);
    b.addEventListener("click", () => {
      fourOpts.frame = f.id;
      frameSeg.querySelectorAll(".frame-swatch").forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
    });
    frameSeg.appendChild(b);
  });

  /* ---------------- date label ---------------- */
  (function setDateLabel() {
    const d = new Date();
    vfDate.textContent = `'${String(d.getFullYear()).slice(2)} ${String(d.getMonth()+1).padStart(2,"0")} ${String(d.getDate()).padStart(2,"0")}`;
  })();

  /* ---------------- live preview loop ---------------- */
  function sizePreview() {
    const { w, h } = cam.dimensions();
    const long = Math.max(w, h);
    const scale = Math.min(1, 1280 / long);
    preview.width = Math.round(w * scale);
    preview.height = Math.round(h * scale);
  }

  function loop() {
    if (!running) return;
    if (video.readyState >= 2) {
      window.RetroFilters.draw(pctx, video, currentFilter, strength, {
        date: false,               // live view keeps date subtle via chrome; stamp burned on capture
        mirror: cam.isSelfie(),
      });
    }
    rafId = requestAnimationFrame(loop);
  }

  /* ---------------- start / stop ---------------- */
  async function startCamera() {
    overlayMsg.textContent = "開啟相機中…";
    startBtn.disabled = true;
    try {
      await cam.start();
      sizePreview();
      running = true;
      overlay.classList.add("is-hidden");
      shutterBtn.disabled = false;
      flipBtn.disabled = false;
      cancelAnimationFrame(rafId);
      loop();
    } catch (err) {
      overlayMsg.textContent = cam.errorMessage(err);
      startBtn.disabled = false;
      startBtn.textContent = "重試";
    }
  }

  startBtn.addEventListener("click", startCamera);

  flipBtn.addEventListener("click", async () => {
    if (!running) return;
    flipBtn.disabled = true;
    try {
      await cam.flip();
      sizePreview();
    } catch (err) {
      toast(cam.errorMessage(err));
    } finally {
      flipBtn.disabled = false;
    }
  });

  // pause camera when tab hidden, resume when visible
  let wasRunningBeforeHide = false;
  document.addEventListener("visibilitychange", () => {
    if (uploadedImage) return; // don't disturb upload editing
    if (document.hidden) {
      wasRunningBeforeHide = running;
      running = false;
      cancelAnimationFrame(rafId);
      cam.stop();
    } else if (wasRunningBeforeHide) {
      startCamera();
    }
  });

  /* ---------------- capture ---------------- */
  shutterBtn.addEventListener("click", () => {
    if (capturing) return;
    if (uploadedImage) { saveUploadedSingle(); return; }
    if (!running) return;
    if (mode === "four") captureFourCut();
    else captureSingle();
  });

  // capture the current live frame with the active filter -> canvas
  function captureFrameCanvas(withDate) {
    const { w, h } = cam.dimensions();
    const cap = document.createElement("canvas");
    cap.width = w; cap.height = h;
    const cctx = cap.getContext("2d");
    window.RetroFilters.draw(cctx, video, currentFilter, strength, {
      date: !!withDate,
      mirror: cam.isSelfie(),
    });
    return cap;
  }

  function shutterFlash() {
    flashEl.classList.add("is-on");
    setTimeout(() => flashEl.classList.remove("is-on"), 180);
  }

  async function saveAndThumb(dataURL, okMsg) {
    try {
      const item = await window.RetroDB.add(dataURL);
      setThumb(item.dataURL);
      toast(okMsg || "已拍照 ✦");
      return item;
    } catch (err) {
      toast("已拍照（相簿儲存失敗，請直接下載）");
      downloadDataURL(dataURL, filename());
      return null;
    }
  }

  async function captureSingle() {
    const cap = captureFrameCanvas(true);
    shutterFlash();
    await saveAndThumb(cap.toDataURL("image/jpeg", 0.92));
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function countdown(n) {
    for (let i = n; i >= 1; i--) {
      countdownEl.textContent = String(i);
      countdownEl.classList.add("is-show");
      await delay(650);
      countdownEl.classList.remove("is-show");
      await delay(120);
    }
  }

  async function captureFourCut() {
    capturing = true;
    shutterBtn.disabled = true;
    flipBtn.disabled = true;
    shotCounterEl.hidden = false;
    const shots = [];
    try {
      for (let i = 0; i < 4; i++) {
        shotCounterEl.textContent = `${i + 1} / 4`;
        await countdown(3);
        shots.push(captureFrameCanvas(false));
        shutterFlash();
        if (i < 3) await delay(700);
      }
      const collage = window.RetroCollage.compose(shots, {
        layout: fourOpts.layout,
        frame: fourOpts.frame,
      });
      const dataURL = collage.toDataURL("image/jpeg", 0.92);
      const item = await saveAndThumb(dataURL, "四格完成 ✦");
      if (item) openViewer(item);
    } catch (err) {
      toast("四格拍攝失敗，請再試一次");
    } finally {
      capturing = false;
      shotCounterEl.hidden = true;
      countdownEl.classList.remove("is-show");
      shutterBtn.disabled = false;
      flipBtn.disabled = false;
    }
  }

  /* ---------------- upload existing photos ---------------- */
  const uploadInput = $("#upload-input");
  const uploadExit = $("#upload-exit");
  const uploadBadge = $("#upload-badge");
  const MAX_EDGE = 1600;

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("圖片載入失敗"));
        img.src = ev.target.result;
      };
      reader.onerror = () => reject(new Error("讀取檔案失敗"));
      reader.readAsDataURL(file);
    });
  }

  function fitDims(w, h, maxEdge) {
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  }

  // render an image (already loaded) filtered into an offscreen canvas
  function renderImageToCanvas(img, withDate) {
    const { w, h } = fitDims(img.naturalWidth, img.naturalHeight, MAX_EDGE);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    window.RetroFilters.draw(cv.getContext("2d"), img, currentFilter, strength, {
      date: !!withDate, mirror: false,
    });
    return cv;
  }

  uploadInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    uploadInput.value = ""; // allow re-selecting same file
    if (!files.length) return;

    if (mode === "four") {
      if (files.length < 4) {
        toast("四格需要選 4 張照片");
        return;
      }
      await uploadFourCut(files.slice(0, 4));
    } else {
      try {
        const img = await loadImageFromFile(files[0]);
        enterUpload(img);
      } catch (err) {
        toast("無法載入這張照片");
      }
    }
  });

  function enterUpload(img) {
    uploadedImage = img;
    running = false;
    cancelAnimationFrame(rafId);
    // size preview canvas to the image
    const { w, h } = fitDims(img.naturalWidth, img.naturalHeight, MAX_EDGE);
    preview.width = w; preview.height = h;
    preview.classList.add("is-visible");
    overlay.classList.add("is-hidden");
    placeholder.classList.add("is-hidden");
    shutterBtn.disabled = false;
    flipBtn.disabled = true;
    uploadExit.hidden = false;
    uploadBadge.hidden = false;
    renderUploaded();
  }

  function renderUploaded() {
    if (!uploadedImage) return;
    window.RetroFilters.draw(pctx, uploadedImage, currentFilter, strength, {
      date: false, mirror: false,
    });
  }

  async function saveUploadedSingle() {
    const cv = renderImageToCanvas(uploadedImage, true);
    shutterFlash();
    await saveAndThumb(cv.toDataURL("image/jpeg", 0.92), "已儲存 ✦");
  }

  function exitUpload() {
    uploadedImage = null;
    uploadExit.hidden = true;
    uploadBadge.hidden = true;
    if (cam.stream) {
      // resume live camera
      flipBtn.disabled = false;
      sizePreview();
      running = true;
      cancelAnimationFrame(rafId);
      loop();
    } else {
      // camera was never started -> back to the start overlay
      preview.classList.remove("is-visible");
      overlay.classList.remove("is-hidden");
      shutterBtn.disabled = true;
      flipBtn.disabled = true;
      overlayMsg.textContent = "點下方按鈕開啟相機";
      startBtn.disabled = false;
      startBtn.textContent = "開啟相機";
    }
  }
  uploadExit.addEventListener("click", exitUpload);

  async function uploadFourCut(files) {
    capturing = true;
    shutterBtn.disabled = true;
    try {
      const imgs = [];
      for (const f of files) imgs.push(await loadImageFromFile(f));
      const shots = imgs.map((img) => renderImageToCanvas(img, false));
      const collage = window.RetroCollage.compose(shots, {
        layout: fourOpts.layout, frame: fourOpts.frame,
      });
      const item = await saveAndThumb(collage.toDataURL("image/jpeg", 0.92), "四格完成 ✦");
      if (item) openViewer(item);
    } catch (err) {
      toast("四格合成失敗，請再試一次");
    } finally {
      capturing = false;
      shutterBtn.disabled = running ? false : true;
    }
  }

  /* ---------------- thumbnail ---------------- */
  const lastThumb = $("#last-thumb");
  const thumbEmpty = $("#thumb-empty");
  function setThumb(dataURL) {
    if (!dataURL) { lastThumb.removeAttribute("src"); thumbEmpty.style.display = ""; return; }
    lastThumb.src = dataURL;
    thumbEmpty.style.display = "none";
  }

  /* ---------------- gallery ---------------- */
  const galleryBtn = $("#gallery-btn");
  const galleryModal = $("#gallery-modal");
  const galleryGrid = $("#gallery-grid");
  const galleryEmpty = $("#gallery-empty");
  const galleryClose = $("#gallery-close");

  galleryBtn.addEventListener("click", openGallery);
  galleryClose.addEventListener("click", () => (galleryModal.hidden = true));

  async function openGallery() {
    galleryGrid.innerHTML = "";
    let items = [];
    try { items = await window.RetroDB.all(); } catch (_) {}
    galleryEmpty.style.display = items.length ? "none" : "";
    items.forEach((it) => {
      const cell = document.createElement("button");
      cell.className = "gallery-cell";
      const img = document.createElement("img");
      img.src = it.dataURL;
      img.alt = "照片";
      img.loading = "lazy";
      cell.appendChild(img);
      cell.addEventListener("click", () => openViewer(it));
      galleryGrid.appendChild(cell);
    });
    galleryModal.hidden = false;
  }

  /* ---------------- viewer ---------------- */
  const viewerModal = $("#viewer-modal");
  const viewerImg = $("#viewer-img");
  const viewerBack = $("#viewer-back");
  const viewerDownload = $("#viewer-download");
  const viewerDelete = $("#viewer-delete");
  let viewing = null;

  function openViewer(item) {
    viewing = item;
    viewerImg.src = item.dataURL;
    viewerModal.hidden = false;
  }
  viewerBack.addEventListener("click", () => (viewerModal.hidden = true));

  viewerDownload.addEventListener("click", () => {
    if (!viewing) return;
    downloadDataURL(viewing.dataURL, filename(viewing.createdAt));
    toast("已下載 ✦");
  });

  viewerDelete.addEventListener("click", async () => {
    if (!viewing) return;
    if (!confirm("確定要刪除這張照片嗎？")) return;
    try {
      await window.RetroDB.remove(viewing.id);
      viewerModal.hidden = true;
      const latest = await window.RetroDB.latest();
      setThumb(latest ? latest.dataURL : null);
      openGallery();
      toast("已刪除");
    } catch (_) { toast("刪除失敗"); }
  });

  function filename(ts) {
    const d = ts ? new Date(ts) : new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `retrocam_${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
  }
  function downloadDataURL(dataURL, name) {
    const a = document.createElement("a");
    a.href = dataURL; a.download = name; a.click();
  }

  // close modals with Escape / back
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!viewerModal.hidden) viewerModal.hidden = true;
      else if (!galleryModal.hidden) galleryModal.hidden = true;
    }
  });

  /* ---------------- PWA: install + service worker ---------------- */
  const installBtn = $("#install-btn");
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener("appinstalled", () => { installBtn.hidden = true; });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  /* ---------------- init thumbnail from storage ---------------- */
  (async function initThumb() {
    try {
      const latest = await window.RetroDB.latest();
      if (latest) setThumb(latest.dataURL);
    } catch (_) {}
  })();

  // if not on a secure context, warn (camera needs https)
  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    overlayMsg.textContent = "相機需要 HTTPS 才能使用（請用 https 或 localhost 開啟）";
  }
})();
