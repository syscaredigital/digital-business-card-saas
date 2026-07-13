(function () {
  "use strict";
  if (!window.SyncNfcCatalog) return;
  var form = document.getElementById("nfcCardForm");
  var list = document.getElementById("nfcCatalogList");
  var modal = document.getElementById("nfcCardModal");
  if (!form || !list || !modal) return;
  var title = modal.querySelector(".nfc-modal-header h2");
  var frontPreview = document.getElementById("nfcFrontPreview");
  var imageInput = document.getElementById("nfcCardFront");
  var currentImage = "";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]; });
  }

  function money(value) { return "LKR " + new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(Number(value) || 0); }

  function render() {
    var lines = window.SyncNfcCatalog.lines;
    list.innerHTML = window.SyncNfcCatalog.getProducts().map(function (item) {
      return '<article class="nfc-row searchable-item" data-product-id="' + escapeHtml(item.id) + '" data-search="' + escapeHtml([item.name, item.line, (item.features || []).join(" ")].join(" ").toLowerCase()) + '">' +
        '<div class="nfc-name-cell"><div class="nfc-product-thumb nfc-admin-image"><img src="' + escapeHtml(item.image) + '" alt="" /></div><div class="nfc-product-meta"><h3>' + escapeHtml(item.name) + '</h3><p>' + escapeHtml(lines[item.line] ? lines[item.line].name : item.line) + ' &middot; ' + (item.features || []).length + ' features</p></div></div>' +
        '<div class="nfc-orders-cell"><span class="nfc-order-badge">0</span></div><div class="nfc-price-cell">' + money(item.price) + '</div>' +
        '<div class="nfc-action-cell"><button class="nfc-action-btn edit" type="button" data-catalog-action="edit" data-product-id="' + escapeHtml(item.id) + '" aria-label="Edit ' + escapeHtml(item.name) + '">&#9998;</button><button class="nfc-action-btn delete" type="button" data-catalog-action="delete" data-product-id="' + escapeHtml(item.id) + '" aria-label="Delete ' + escapeHtml(item.name) + '">&#128465;</button></div></article>';
    }).join("");
  }

  function setPreview(src) {
    currentImage = src || "";
    frontPreview.innerHTML = src ? '<img src="' + escapeHtml(src) + '" alt="NFC card preview" />' : '<span class="nfc-upload-placeholder"><span class="nfc-upload-bar"></span><span class="nfc-upload-bar short"></span></span>';
  }

  function resetForm() {
    form.reset();
    form.elements.productId.value = "";
    title.textContent = "New NFC Card";
    setPreview("");
  }

  function openEditor(item) {
    resetForm();
    if (item) {
      title.textContent = "Edit NFC Card";
      form.elements.productId.value = item.id;
      form.elements.cardName.value = item.name;
      form.elements.line.value = item.line;
      form.elements.price.value = item.price;
      form.elements.description.value = (item.features || []).join("\n");
      form.elements.badge.value = item.badge || "";
      form.elements.featured.checked = Boolean(item.featured);
      setPreview(item.image);
    }
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  document.getElementById("openNfcModal").addEventListener("click", function (event) { event.stopImmediatePropagation(); openEditor(null); }, true);

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-catalog-action]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var id = button.getAttribute("data-product-id");
    var products = window.SyncNfcCatalog.getProducts();
    var item = products.find(function (product) { return product.id === id; });
    if (button.getAttribute("data-catalog-action") === "edit") openEditor(item);
    if (button.getAttribute("data-catalog-action") === "delete" && item && window.confirm('Remove "' + item.name + '" from the NFC catalog?')) {
      window.SyncNfcCatalog.saveProducts(products.filter(function (product) { return product.id !== id; }));
      render();
    }
  }, true);

  imageInput.addEventListener("change", function () {
    var file = imageInput.files && imageInput.files[0];
    if (!file) return;
    if (file.size > 1500000) { window.alert("Please choose an image smaller than 1.5 MB."); imageInput.value = ""; return; }
    var reader = new FileReader();
    reader.onload = function (event) { setPreview(event.target.result); };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var products = window.SyncNfcCatalog.getProducts();
    var id = form.elements.productId.value;
    var existing = products.find(function (item) { return item.id === id; });
    var item = {
      id: id || "nfc-" + Date.now(), line: form.elements.line.value, name: form.elements.cardName.value.trim(),
      price: Number(form.elements.price.value), features: form.elements.description.value.split(/\r?\n|,/).map(function (value) { return value.trim(); }).filter(Boolean),
      image: currentImage || "../../public/assets/images/login-card-front.png", badge: form.elements.badge.value.trim(),
      featured: form.elements.featured.checked, tone: existing ? existing.tone : "black"
    };
    if (existing) products[products.indexOf(existing)] = item; else products.push(item);
    window.SyncNfcCatalog.saveProducts(products);
    render(); resetForm(); modal.hidden = true; document.body.style.overflow = "";
  }, true);

  render();
})();
