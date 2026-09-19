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
    });
    filtersNav.appendChild(b);
  });

  strengthEl.addEventListener("input", () => { strength = +strengthEl.value / 100; });

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
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(rafId);
      cam.stop();
    } else if (!overlay.classList.contains("is-hidden") === false) {
      // was running before -> restart
      if (shutterBtn.disabled === false) startCamera();
    }
  });

  /* ---------------- capture ---------------- */
  shutterBtn.addEventListener("click", capture);

  async function capture() {
    if (!running) return;
    // full-res capture
    const { w, h } = cam.dimensions();
    const cap = document.createElement("canvas");
    cap.width = w; cap.height = h;
    const cctx = cap.getContext("2d");
    window.RetroFilters.draw(cctx, video, currentFilter, strength, {
      date: true,
      mirror: cam.isSelfie(),
    });

    // shutter flash + sound-less feedback
    flashEl.classList.add("is-on");
    setTimeout(() => flashEl.classList.remove("is-on"), 180);

    const dataURL = cap.toDataURL("image/jpeg", 0.92);
    try {
      const item = await window.RetroDB.add(dataURL);
      setThumb(item.dataURL);
      toast("已拍照 ✦");
    } catch (err) {
      // storage failed — still let them download
      toast("已拍照（相簿儲存失敗，請直接下載）");
      downloadDataURL(dataURL, filename());
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
