/* ===================================================================
   Retro Cam — local gallery (IndexedDB)
   Stores captured photos entirely on-device. No server, no upload.
   =================================================================== */
(function () {
  "use strict";

  const DB_NAME = "retro-cam";
  const STORE = "photos";
  const VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("此瀏覽器不支援 IndexedDB"));
        return;
      }
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: "id" });
          os.createIndex("createdAt", "createdAt");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function tx(mode) {
    return open().then((db) => db.transaction(STORE, mode).objectStore(STORE));
  }

  async function add(dataURL) {
    const item = {
      id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
      dataURL,
      createdAt: Date.now(),
    };
    const store = await tx("readwrite");
    return new Promise((resolve, reject) => {
      const r = store.add(item);
      r.onsuccess = () => resolve(item);
      r.onerror = () => reject(r.error);
    });
  }

  async function all() {
    const store = await tx("readonly");
    return new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => {
        const items = (r.result || []).sort((a, b) => b.createdAt - a.createdAt);
        resolve(items);
      };
      r.onerror = () => reject(r.error);
    });
  }

  async function remove(id) {
    const store = await tx("readwrite");
    return new Promise((resolve, reject) => {
      const r = store.delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  async function latest() {
    const items = await all();
    return items[0] || null;
  }

  window.RetroDB = { add, all, remove, latest };
})();
