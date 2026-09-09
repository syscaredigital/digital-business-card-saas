(function () {
  "use strict";

  function configuredOrigin() {
    var meta = document.querySelector('meta[name="api-origin"]');
    var value = String(window.SYNC_API_ORIGIN || (meta && meta.content) || "").trim();
    return value.replace(/\/$/, "");
  }

  function resolveOrigin() {
    var configured = configuredOrigin();
    if (configured) return configured;
    if (window.location.protocol === "file:") return "http://localhost:5000";

    // VS Code Live Server serves files, not API routes. Keep its local preview
    // ports pointed at Express; deployed hosts continue to use their own origin.
    var localHost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);
    if (localHost && window.location.protocol === "http:" &&
        /^(5500|5501)$/.test(window.location.port)) {
      return "http://" + window.location.hostname + ":5000";
    }
    // Custom preview ports can opt in via SYNC_API_ORIGIN or the meta tag.
    return window.location.origin;
  }

  window.SyncVCardApiOrigin = resolveOrigin();
})();
