(function () {
  "use strict";
  var root = document.getElementById("publicVcardRoot");
  var id = new URLSearchParams(window.location.search).get("id");
  var labels = {
    "business-hours": "Business Hours", "qrcode-customize": "QR Code", services: "Services",
    products: "Products", "instagram-embed": "Instagram", galleries: "Gallery", blogs: "Blogs",
    testimonials: "Testimonials", iframes: "Embedded Content", appointments: "Appointments",
    "social-links": "Social Links", "custom-links": "Links", banners: "Banner", advanced: "More Information",
    "custom-fonts": "Typography", seo: "SEO", "privacy-policy": "Privacy Policy",
    "term-condition": "Terms & Conditions", "manage-section": "More Sections"
  };
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>'"]/g, function (char) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]; }); }
  function safeWebUrl(value) { try { var url = new URL(String(value)); return /^(https?:)$/.test(url.protocol) ? url.href : ""; } catch (_) { return ""; } }
  function link(value, label) { var url = safeWebUrl(value); return url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label || value) + '</a>' : ""; }
  function section(key, content) {
    if (!content) return "";
    var body = escapeHtml(content).replace(/\r?\n/g, "<br>");
    if (key === "social-links" || key === "custom-links") {
      body = String(content).split(/\r?\n/).filter(Boolean).map(function (line) {
        var parts = line.split(/\s*[|,]\s*/, 2), url = parts.length > 1 ? parts[1] : parts[0];
        return /^https?:\/\//i.test(url) ? link(url, parts.length > 1 ? parts[0] : url) : escapeHtml(line);
      }).join("");
    }
    return '<section class="public-vcard-section section-' + escapeHtml(key) + '"><span>' + escapeHtml(labels[key] || key) + '</span><div>' + body + '</div></section>';
  }
  function render(card) {
    var config = card.template && card.template.config || {}, colors = config.colors || {};
    document.documentElement.style.setProperty("--card-primary", colors.primary || "#172033");
    document.documentElement.style.setProperty("--card-accent", colors.accent || "#e63946");
    document.title = (card.title || card.ownerName || "Digital VCard") + " | Sync E-Card";
    var initials = (card.ownerName || card.title || "V").split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0); }).join("").toUpperCase();
    var contact = [card.email ? '<a href="mailto:' + escapeHtml(card.email) + '">Email</a>' : "", card.phone ? '<a href="tel:' + escapeHtml(card.phone) + '">Call</a>' : "", link(card.websiteUrl, "Website")].filter(Boolean).join("");
    var sections = Object.keys(card.sections || {}).filter(function (key) { return key !== "basic-details"; }).map(function (key) { return section(key, card.sections[key]); }).join("");
    root.className = "public-card-shell layout-" + escapeHtml(config.layout || "default");
    root.innerHTML = '<header class="public-vcard-hero"><div class="public-vcard-template">' + escapeHtml(card.template && card.template.name || "Digital VCard") + '</div><div class="public-vcard-avatar">' + (card.avatarUrl ? '<img src="' + escapeHtml(card.avatarUrl) + '" alt="">' : escapeHtml(initials)) + '</div><h1>' + escapeHtml(card.title || card.ownerName || "Digital VCard") + '</h1><h2>' + escapeHtml(card.sections && card.sections["basic-details"] || "") + '</h2><p>' + escapeHtml(card.companyName || "") + '</p><div class="public-vcard-actions">' + contact + '</div></header>' +
      '<section class="public-vcard-intro"><p>' + escapeHtml(card.description || "").replace(/\r?\n/g, "<br>") + '</p>' + (card.address ? '<address>' + escapeHtml(card.address) + '</address>' : "") + '</section>' +
      '<div class="public-vcard-sections">' + (sections || '<section class="public-vcard-section"><span>Contact</span><div>Use the buttons above to get in touch.</div></section>') + '</div><footer>Powered by Sync E-Card</footer>';
  }
  function selectedTemplateUrl(card) {
    var previewUrl = card && card.template && card.template.previewUrl;
    if (!previewUrl || /profile\.html(?:$|[?#])/i.test(previewUrl)) return "";
    try {
      var target = new URL(previewUrl, window.location.href);
      target.searchParams.set("id", id);
      return target.href;
    } catch (_) { return ""; }
  }
  if (!id) { root.innerHTML = '<div class="public-card-state is-error">No VCard was selected.</div>'; return; }
  var api = window.location.protocol + "//" + window.location.hostname + ":5000/api/public/vcards/" + encodeURIComponent(id);
  fetch(api).then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.message || "Unable to load VCard"); return data; }); })
    .then(function (data) { var target = selectedTemplateUrl(data.vcard); if (target) window.location.replace(target); else render(data.vcard); })
    .catch(function (error) { root.innerHTML = '<div class="public-card-state is-error">' + escapeHtml(error.message) + '</div>'; });
})();
