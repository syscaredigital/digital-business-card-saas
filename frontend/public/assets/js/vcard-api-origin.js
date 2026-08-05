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

    // When Express serves the public portal, its API is always same-origin,
    // including development instances running on a non-default port.
    if (/^\/pages\/public-vcard(?:\/|$)/.test(window.location.pathname)) {
      return window.location.origin;
    }

    var host = window.location.hostname;
    var localPreview = /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(host);
    if (localPreview && window.location.port && window.location.port !== "5000") {
      return window.location.protocol + "//" + host + ":5000";
    }
    return window.location.origin;
  }

  window.SyncVCardApiOrigin = resolveOrigin();
})();
