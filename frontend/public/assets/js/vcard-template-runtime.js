(function () {
  "use strict";
  var id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;
  var API = window.location.protocol + "//" + window.location.hostname + ":5000/api/public/vcards/" + encodeURIComponent(id);
  var labels = {
    "business-hours":"Business Hours", "qrcode-customize":"Customize QR Code", services:"Services", products:"Products",
    "instagram-embed":"Instagram", galleries:"Galleries", blogs:"Blogs", testimonials:"Testimonials", iframes:"Embedded Content",
    appointments:"Appointments", "social-links":"Social Links", "custom-links":"Custom Links", banners:"Banner",
    advanced:"Advanced", "custom-fonts":"Fonts", seo:"SEO", "privacy-policy":"Privacy Policy",
    "term-condition":"Terms & Conditions", "manage-section":"More Information"
  };
  function text(selector, value) { var node = document.querySelector(selector); if (node && value) node.textContent = value; }
  function safeUrl(value) { try { var url = new URL(String(value)); return /^https?:$/.test(url.protocol) ? url.href : ""; } catch (_) { return ""; } }
  function setContact(index, value, type) {
    var nodes = document.querySelectorAll(".contact-value"), node = nodes[index];
    if (!node || !value) return;
    node.textContent = value;
    if (type) { var link = document.createElement("a"); link.href = type + value; link.textContent = value; link.style.color = "inherit"; node.replaceChildren(link); }
  }
  function removeDemoSections() {
    var patterns = /expertise|services|programs|projects|listings|pricing|packages|clients say|testimonial|business hours/i;
    document.querySelectorAll(".section-title h2").forEach(function (heading) {
      if (patterns.test(heading.textContent || "")) { var section = heading.closest("section"); if (section) section.remove(); }
    });
  }
  function buildSections(card) {
    var sections = card.sections || {}, keys = Object.keys(sections).filter(function (key) { return key !== "basic-details" && sections[key]; });
    if (!keys.length) return;
    var container = document.createElement("section");
    container.className = "live-vcard-sections";
    var style = document.createElement("style");
    style.textContent = ".live-vcard-sections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:24px 0}.live-vcard-section{padding:24px;border:1px solid rgba(100,116,139,.2);border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.06)}.live-vcard-section h2{margin:0 0 12px;font:800 18px/1.3 Inter,Arial,sans-serif}.live-vcard-section div{color:#526078;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.live-vcard-section a{display:block;margin:6px 0;color:inherit;font-weight:700}.live-vcard-section.wide{grid-column:1/-1}@media(max-width:680px){.live-vcard-sections{grid-template-columns:1fr}.live-vcard-section.wide{grid-column:auto}}";
    document.head.appendChild(style);
    keys.forEach(function (key) {
      var article = document.createElement("article"), heading = document.createElement("h2"), body = document.createElement("div");
      article.className = "live-vcard-section" + (/privacy|term|advanced|manage/.test(key) ? " wide" : "");
      heading.textContent = labels[key] || key;
      if (key === "social-links" || key === "custom-links") {
        String(sections[key]).split(/\r?\n/).filter(Boolean).forEach(function (line) {
          var parts = line.split(/\s*[|,]\s*/, 2), url = safeUrl(parts.length > 1 ? parts[1] : parts[0]);
          if (url) { var anchor = document.createElement("a"); anchor.href = url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; anchor.textContent = parts.length > 1 ? parts[0] : url; body.appendChild(anchor); }
          else { var row = document.createElement("div"); row.textContent = line; body.appendChild(row); }
        });
      } else body.textContent = sections[key];
      article.append(heading, body); container.appendChild(article);
    });
    var shell = document.querySelector(".vcard-shell") || document.body;
    var before = shell.querySelector("#message,.message-panel,.action-grid");
    shell.insertBefore(container, before || null);
  }
  function hydrate(card) {
    document.title = (card.ownerName || card.title || "Digital VCard") + " | Sync E-Card";
    text(".profile-name", card.title || card.ownerName);
    text(".profile-role", card.sections && card.sections["basic-details"] || card.description);
    text(".profile-company", card.companyName);
    text(".intro-copy", card.description);
    setContact(0, card.email, "mailto:"); setContact(1, card.phone, "tel:"); setContact(2, card.websiteUrl); setContact(3, card.address);
    var website = document.querySelectorAll(".contact-value")[2], websiteUrl = safeUrl(card.websiteUrl);
    if (website && websiteUrl) { var anchor = document.createElement("a"); anchor.href = websiteUrl; anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; anchor.textContent = card.websiteUrl; anchor.style.color = "inherit"; website.replaceChildren(anchor); }
    if (card.avatarUrl) { var avatar = document.querySelector(".profile-avatar"); if (avatar) { var image = document.createElement("img"); image.src = card.avatarUrl; image.alt = card.ownerName || "Profile photo"; image.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:inherit"; avatar.replaceChildren(image); } }
    removeDemoSections(); buildSections(card);
    document.documentElement.classList.add("live-vcard-ready");
  }
  fetch(API).then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.message || "Unable to load VCard"); return data; }); })
    .then(function (data) { hydrate(data.vcard); })
    .catch(function () { document.documentElement.classList.add("live-vcard-error"); });
})();
