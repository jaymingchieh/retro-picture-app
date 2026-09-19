/* ===================================================================
   Retro Cam — camera controller (getUserMedia)
   =================================================================== */
(function () {
  "use strict";

  function Camera(videoEl) {
    this.video = videoEl;
    this.stream = null;
    this.facing = "environment"; // 'environment' | 'user'
  }

  Camera.prototype.isSupported = function () {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  };

  Camera.prototype.isSelfie = function () {
    return this.facing === "user";
  };

  Camera.prototype.start = async function () {
    if (!this.isSupported()) {
      throw new Error("此裝置或瀏覽器不支援相機存取");
    }
    this.stop();
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: this.facing },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // fall back to any camera if exact facing mode fails
      if (err && (err.name === "OverconstrainedError" || err.name === "NotFoundError")) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      } else {
        throw err;
      }
    }
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});
    await this._ready();
    return this.stream;
  };

  Camera.prototype._ready = function () {
    const v = this.video;
    if (v.videoWidth) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => { v.removeEventListener("loadedmetadata", done); resolve(); };
      v.addEventListener("loadedmetadata", done);
    });
  };

  Camera.prototype.stop = function () {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  };

  Camera.prototype.flip = async function () {
    this.facing = this.facing === "environment" ? "user" : "environment";
    return this.start();
  };

  Camera.prototype.dimensions = function () {
    return { w: this.video.videoWidth || 1280, h: this.video.videoHeight || 720 };
  };

  Camera.prototype.errorMessage = function (err) {
    if (!err) return "無法開啟相機";
    switch (err.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "相機權限被拒絕，請到瀏覽器設定允許相機";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "找不到相機裝置";
      case "NotReadableError":
      case "TrackStartError":
        return "相機正被其他 App 使用中";
      default:
        return err.message || "無法開啟相機";
    }
  };

  window.Camera = Camera;
})();
