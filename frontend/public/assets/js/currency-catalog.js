(function () {
  "use strict";
  var cache = null;
  function apiBase() {
    if (location.protocol === "file:") return "http://localhost:5000";
    if (location.port && location.port !== "5000") return location.protocol + "//" + location.hostname + ":5000";
    return location.origin;
  }
  function fallback() {
    return ["LKR", "USD", "EUR", "GBP", "AUD", "CAD", "INR", "JPY", "CNY", "SGD", "AED"].map(function (code) { return { code: code, name: code }; });
  }
  function optionMarkup(currencies) {
    return currencies.map(function (item) {
      var code = String(item.code || "").toUpperCase();
      var name = String(item.name || code).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
      return '<option value="' + code + '">' + code + ' — ' + name + '</option>';
    }).join("");
  }
  function populate(select, currencies, selected) {
    if (!select) return;
    var value = String(selected || select.value || "LKR").toUpperCase();
    select.innerHTML = optionMarkup(currencies);
    if (currencies.some(function (item) { return item.code === value; })) select.value = value;
  }
  function load() {
    if (cache) return cache;
    cache = fetch(apiBase() + "/api/public/currencies").then(function (response) {
      if (!response.ok) throw new Error("Currency catalogue unavailable");
      return response.json();
    }).then(function (payload) { return Array.isArray(payload.data) ? payload.data : fallback(); }).catch(fallback);
    return cache;
  }
  function populateDocument() {
    load().then(function (currencies) {
      document.querySelectorAll("select[data-currency-select]").forEach(function (select) { populate(select, currencies); });
      window.dispatchEvent(new CustomEvent("sync:currencies-ready", { detail: { currencies: currencies } }));
    });
  }
  window.SyncCurrencies = { load: load, populate: populate };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", populateDocument);
  else populateDocument();
})();
