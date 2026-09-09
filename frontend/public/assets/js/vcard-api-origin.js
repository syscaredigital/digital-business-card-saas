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

    // Same-origin works behind HTTPS proxies and on any server port. Separate
    // static preview servers can opt in via SYNC_API_ORIGIN or the meta tag.
    return window.location.origin;
  }

  window.SyncVCardApiOrigin = resolveOrigin();
})();
