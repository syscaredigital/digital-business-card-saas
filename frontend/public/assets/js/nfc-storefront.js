(function () {
  "use strict";

  var root = document.getElementById("nfcProductLines");
  if (!root) return;
  var catalogProducts = [];
  var rateDate = "";

  var lines = {
    essential: { name: "Essential Line", badge: "Entry Level", description: "Perfect for getting started with contactless networking" },
    signature: { name: "Signature Line", badge: "Professional", description: "Advanced features for business professionals" },
    prestige: { name: "Prestige Line", badge: "Executive", description: "Premium features for executives and leaders" },
    exclusive: { name: "Exclusive Line", badge: "Luxury", description: "Premium contactless cards for professionals who demand the best" }
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function apiBaseUrl() {
    if (window.location.protocol === "file:") return "http://localhost:5000";
    if (window.location.port && window.location.port !== "5000") return "http://localhost:5000";
    return window.location.origin;
  }

  function formatPrice(price) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: selectedCurrency(), maximumFractionDigits: 2 }).format(Number(price) || 0);
  }

  function selectedCurrency() {
    var currency = String(localStorage.getItem("preferredCurrency") || "LKR").toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : "LKR";
  }

  function descriptionItems(description) {
    return String(description || "").split(/\r?\n|,/).map(function (value) { return value.trim(); }).filter(Boolean);
  }

  function renderProduct(item, productIndex) {
    var name = escapeHtml(item.name);
    var features = descriptionItems(item.description);
    return '<article class="nfc-package-card">' +
      '<div class="nfc-package-images"><span class="nfc-product-index">' + String(productIndex + 1).padStart(2, "0") + '</span>' +
        '<figure class="nfc-card-face nfc-card-face-front"><img src="' + escapeHtml(item.frontImage) + '" alt="' + name + ' front" /><figcaption>Front</figcaption></figure>' +
        '<figure class="nfc-card-face nfc-card-face-back"><img src="' + escapeHtml(item.backImage) + '" alt="' + name + ' back" /><figcaption>Back</figcaption></figure>' +
      '</div>' +
      '<div class="nfc-package-body"><div class="nfc-product-label"><span>Sync NFC</span><i></i></div><h3>' + name + '</h3>' +
      '<p class="nfc-package-price">' + formatPrice(item.price) + '</p>' +
      (features.length ? '<ul>' + features.map(function (feature) { return '<li><span aria-hidden="true">&#10003;</span>' + escapeHtml(feature) + '</li>'; }).join("") + '</ul>' : '') +
      '<a class="nfc-select-button" href="../auth/register.html?card=' + encodeURIComponent(item.id) + '&currency=' + encodeURIComponent(selectedCurrency()) + '">Select card <span aria-hidden="true">&rarr;</span></a></div></article>';
  }

  function render(products) {
    var categoryKeys = Object.keys(lines);
    categoryKeys.forEach(function (category) {
      var link = document.querySelector('.nfc-collection-nav a[href="#' + category + '-line"]');
      if (link) link.hidden = !products.some(function (item) { return item.category === category; });
    });
    var markup = categoryKeys.map(function (category, lineIndex) {
      var line = lines[category];
      var categoryProducts = products.filter(function (item) { return item.category === category; });
      if (!categoryProducts.length) return "";
      return '<section class="nfc-line-section" id="' + category + '-line" data-line="' + category + '"><div class="container">' +
        '<header class="nfc-line-heading"><div><div class="nfc-line-title"><span>0' + (lineIndex + 1) + '</span><h2>' + escapeHtml(line.name) + '</h2></div><p>' + escapeHtml(line.description) + '</p></div><b>' + escapeHtml(line.badge) + '</b></header>' +
        '<div class="nfc-package-grid">' + categoryProducts.map(renderProduct).join("") + '</div></div></section>';
    }).join("");

    root.innerHTML = (rateDate && selectedCurrency()!=="LKR" ? '<div class="nfc-catalog-state"><span>Prices are converted from LKR using the current reference rate dated ' + escapeHtml(rateDate) + '.</span></div>' : '') + (markup || '<div class="nfc-catalog-state"><strong>No NFC cards are available right now.</strong><span>Please check again soon.</span></div>');
  }

  async function loadProducts() {
    try {
      var response = await fetch(apiBaseUrl() + "/api/public/nfc-products?currency=" + encodeURIComponent(selectedCurrency()), { headers: { Accept: "application/json" } });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.message || "The NFC catalog could not be loaded.");
      catalogProducts = Array.isArray(payload.data) ? payload.data : [];
      rateDate = payload.rateDate || "";
      render(catalogProducts);
    } catch (error) {
      root.innerHTML = '<div class="nfc-catalog-state is-error"><strong>The NFC catalog could not be loaded.</strong><span>' + escapeHtml(error.message) + '</span><button type="button" id="retryNfcCatalog">Try again</button></div>';
      var retryButton = document.getElementById("retryNfcCatalog");
      if (retryButton) retryButton.addEventListener("click", loadProducts);
    }
  }

  window.addEventListener("sync:currency-change", loadProducts);
  loadProducts();
})();
