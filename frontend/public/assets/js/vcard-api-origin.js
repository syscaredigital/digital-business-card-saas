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
  var cardMeta = document.querySelector('meta[name="vcard-id"]');
  window.SyncVCardId = cardMeta && /^\d+$/.test(cardMeta.content) ? cardMeta.content : null;
})();

(function () {
  "use strict";
  // Remove bearer tokens left behind by older releases. This marker is only UI state.
  if (window.localStorage) window.localStorage.removeItem("token");
  window.SyncSession = {
    fetch: function (url, options) {
      var target = new URL(url, window.location.href);
      if (target.origin !== new URL(window.SyncVCardApiOrigin).origin) throw new Error("Unexpected API origin");
      options = Object.assign({}, options, { credentials: "include" });
      options.headers = Object.assign({}, options.headers, { "X-Session-Mode": "cookie", "X-Requested-With": "SyncECard" });
      return window.fetch(url, options);
    }
  };
})();
