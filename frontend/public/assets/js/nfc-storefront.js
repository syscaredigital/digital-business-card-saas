(function () {
  "use strict";
  var root = document.getElementById("nfcProductLines");
  if (!root || !window.SyncNfcCatalog) return;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function formatPrice(price) {
    return new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(Number(price) || 0);
  }

  function render() {
    var products = window.SyncNfcCatalog.getProducts();
    var lines = window.SyncNfcCatalog.lines;
    root.innerHTML = Object.keys(lines).map(function (lineKey, lineIndex) {
      var line = lines[lineKey];
      var lineProducts = products.filter(function (item) { return item.line === lineKey; });
      if (!lineProducts.length) return "";
      return '<section class="nfc-line-section" id="' + lineKey + '-line" data-line="' + lineKey + '">' +
        '<div class="container">' +
          '<header class="nfc-line-heading"><div><div class="nfc-line-title"><span>0' + (lineIndex + 1) + '</span><h2>' + escapeHtml(line.name) + '</h2></div><p>' + escapeHtml(line.description) + '</p></div><b>' + escapeHtml(line.badge) + '</b></header>' +
          '<div class="nfc-package-grid">' + lineProducts.map(function (item, productIndex) { return renderProduct(item, productIndex); }).join("") + '</div>' +
        '</div></section>';
    }).join("");
  }

  function renderProduct(item, productIndex) {
    var image = escapeHtml(item.image || "../../public/assets/images/login-card-front.png");
    return '<article class="nfc-package-card' + (item.featured ? ' is-featured' : '') + '">' +
      (item.badge ? '<span class="nfc-package-badge">' + escapeHtml(item.badge) + '</span>' : '') +
      '<div class="nfc-package-image tone-' + escapeHtml(item.tone || "black") + '"><span class="nfc-product-index">0' + (productIndex + 1) + '</span><img src="' + image + '" alt="' + escapeHtml(item.name) + ' NFC card" /></div>' +
      '<div class="nfc-package-body"><div class="nfc-product-label"><span>Sync NFC</span><i></i></div><h3>' + escapeHtml(item.name) + '</h3>' +
      '<p class="nfc-package-price"><span>LKR</span> ' + formatPrice(item.price) + '</p>' +
      '<ul>' + (item.features || []).map(function (feature) { return '<li><span aria-hidden="true">&#10003;</span>' + escapeHtml(feature) + '</li>'; }).join("") + '</ul>' +
      '<a class="nfc-select-button" href="../auth/register.html?card=' + encodeURIComponent(item.id) + '">Select card <span aria-hidden="true">&rarr;</span></a></div></article>';
  }

  render();
  window.addEventListener("storage", render);
  window.addEventListener("nfc-catalog-updated", render);
})();
