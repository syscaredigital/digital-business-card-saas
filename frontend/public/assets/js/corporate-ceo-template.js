(function () {
  "use strict";
  var root = document.querySelector("[data-ceo-card]");
  var id = new URLSearchParams(window.location.search).get("id");
  var orderedKeys = ["services", "appointments", "galleries", "products", "testimonials", "business-hours"];

  function safeUrl(value) {
    try {
      var input = String(value || "").trim();
      if (!/^https?:\/\//i.test(input)) return "";
      var url = new URL(input);
      return /^(https?:)$/.test(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  }
  function parts(line) { return String(line || "").split(/\s*\|\s*/).map(function (part) { return part.trim(); }); }
  function lines(value) { return String(value || "").split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean); }
  function findUrl(values) {
    for (var index = values.length - 1; index >= 0; index -= 1) {
      var url = safeUrl(values[index]);
      if (url) return url;
    }
    return "";
  }
  function initials(value) {
    return String(value || "CEO").split(/\s+/).slice(0, 2).map(function (word) { return word.charAt(0); }).join("").toUpperCase();
  }
  function setText(selector, value) {
    var node = root.querySelector(selector);
    if (node && String(value || "").trim()) node.textContent = value;
  }
  function setContact(type, value, prefix) {
    var item = root.querySelector('[data-contact="' + type + '"]');
    if (!item) return;
    if (!String(value || "").trim()) { item.hidden = true; return; }
    item.hidden = false;
    item.querySelector(".contact-value").textContent = value;
    if (item.tagName === "A") item.href = prefix ? prefix + value : safeUrl(value) || "#";
  }
  function renderBanner(content) {
    var holder = root.querySelector("[data-ceo-banner]");
    var url = findUrl(parts(lines(content)[0] || content));
    if (!url) return;
    var image = document.createElement("img");
    image.src = url;
    image.alt = parts(lines(content)[0] || "")[0] || "Profile banner";
    holder.replaceChildren(image);
  }
  function renderSocials(content) {
    var holder = root.querySelector("[data-ceo-socials]");
    holder.textContent = "";
    lines(content).forEach(function (line) {
      var value = parts(line), url = findUrl(value);
      if (!url) return;
      var label = value[0] === url ? "Link" : value[0];
      var anchor = document.createElement("a");
      anchor.className = "ceo-social-link";
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.title = label;
      anchor.setAttribute("aria-label", label);
      anchor.textContent = label.slice(0, 2).toUpperCase();
      holder.appendChild(anchor);
    });
    holder.hidden = !holder.children.length;
  }
  function renderFeatures(sections) {
    var values = {};
    orderedKeys.forEach(function (key) { if (sections[key]) values[key] = sections[key]; });
    Object.keys(sections).forEach(function (key) {
      if (key !== "basic-details" && key !== "social-links" && key !== "banners" && !values[key]) values[key] = sections[key];
    });
    var rendered = window.SyncVCardFeatures.renderAll(values);
    root.querySelector("[data-ceo-features]").replaceChildren(rendered);
  }
  function hydrate(card) {
    var sections = card.sections || {};
    document.title = (card.title || card.ownerName || "Corporate CEO") + " | Sync E-Card";
    setText(".profile-name", card.title || card.ownerName);
    setText(".profile-role", sections["basic-details"] || card.description);
    setText(".profile-company", card.companyName);
    var avatar = root.querySelector(".profile-avatar");
    if (card.avatarUrl) {
      var image = document.createElement("img");
      image.src = card.avatarUrl;
      image.alt = card.ownerName || card.title || "Profile photo";
      avatar.replaceChildren(image);
    } else avatar.textContent = initials(card.title || card.ownerName);
    setContact("email", card.email, "mailto:");
    setContact("phone", card.phone, "tel:");
    setContact("website", card.websiteUrl, "");
    setContact("address", card.address, "");
    renderBanner(sections.banners);
    renderSocials(sections["social-links"]);
    renderFeatures(sections);
    root.classList.remove("is-loading");
  }
  function demoCard() {
    return {
      title: "John Wilson", ownerName: "John Wilson", companyName: "Wilson Consulting",
      email: "john@example.com", phone: "+94 76 456 898", websiteUrl: "https://example.com", address: "Colombo, Sri Lanka",
      sections: {
        "basic-details": "Corporate CEO",
        banners: "Executive team | https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85",
        "social-links": "Facebook | https://facebook.com\nX | https://x.com\nLinkedIn | https://linkedin.com",
        services: "Business strategy | Practical direction for sustainable growth\nCorporate consulting | Experienced guidance for complex decisions\nLeadership advisory | Build stronger teams and confident leaders",
        appointments: "Schedule an executive consultation | 30 minutes | https://example.com/book",
        galleries: "Leadership team | https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=600&q=80\nClient meeting | https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80\nPlanning | https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80\nWorkshop | https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=600&q=80",
        products: "Growth Blueprint | $149 | Executive planning toolkit | https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80\nStrategy Workbook | $79 | A practical leadership guide | https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=600&q=80\nTeam Dashboard | $199 | Track goals and performance | https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80",
        testimonials: "John brought clarity and momentum to our leadership team. | Ronald Richards | Customer",
        "business-hours": "Sunday | Closed\nMonday | 09:00 - 17:00\nTuesday | 09:00 - 17:00\nWednesday | 09:00 - 17:00\nThursday | 09:00 - 17:00\nFriday | 09:00 - 17:00\nSaturday | Closed"
      }
    };
  }
  root.classList.add("is-loading");
  if (!id) { hydrate(demoCard()); return; }
  var apiOrigin = window.location.protocol === "file:" || (window.location.port && window.location.port !== "5000")
    ? "http://localhost:5000" : window.location.origin;
  fetch(apiOrigin + "/api/public/vcards/" + encodeURIComponent(id))
    .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.message || "Unable to load VCard"); return data; }); })
    .then(function (data) { hydrate(data.vcard); })
    .catch(function (error) {
      root.classList.remove("is-loading");
      var message = document.createElement("p");
      message.className = "ceo-load-error";
      message.textContent = error.message;
      root.prepend(message);
    });
}());
