(function () {
  "use strict";
  var id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;
  var API = window.location.protocol + "//" + window.location.hostname + ":5000/api/public/vcards/" + encodeURIComponent(id);
  function text(selector, value) { var node = document.querySelector(selector); if (node && value) node.textContent = value; }
  function safeUrl(value) { try { var url = new URL(String(value)); return /^https?:$/.test(url.protocol) ? url.href : ""; } catch (_) { return ""; } }
  function setContact(index, value, type) {
    var nodes = document.querySelectorAll(".contact-value"), node = nodes[index];
    if (!node || !value) return;
    node.textContent = value;
    if (type) { var link = document.createElement("a"); link.href = type + value; link.textContent = value; link.style.color = "inherit"; node.replaceChildren(link); }
  }
  function removeDemoSections() {
    document.querySelectorAll(".industry-card .industry-showcase,.industry-card .industry-feature-panel,.industry-card .industry-hours").forEach(function (section) { section.remove(); });
    var patterns = /expertise|services|programs|projects|listings|pricing|packages|clients say|testimonial|business hours|areas? of impact|property highlights|engagement packages/i;
    document.querySelectorAll(".section-title h2").forEach(function (heading) {
      if (patterns.test(heading.textContent || "")) { var section = heading.closest("section"); if (section) section.remove(); }
    });
  }
  function buildSections(card) {
    var sections = card.sections || {}, keys = Object.keys(sections).filter(function (key) { return key !== "basic-details" && sections[key]; });
    if (!keys.length || !window.SyncVCardFeatures) return;
    var container = window.SyncVCardFeatures.renderAll(sections);
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
