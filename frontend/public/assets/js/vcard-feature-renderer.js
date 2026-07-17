(function () {
  "use strict";

  var labels = {
    "business-hours": "Business Hours", "qrcode-customize": "QR Code", services: "Services",
    products: "Products", "instagram-embed": "Instagram", galleries: "Gallery", blogs: "Blog",
    testimonials: "Testimonials", iframes: "Featured Content", appointments: "Make an Appointment",
    "social-links": "Connect", "custom-links": "Useful Links", banners: "Highlights", advanced: "More Information",
    "custom-fonts": "Typography", seo: "SEO", "privacy-policy": "Privacy Policy",
    "term-condition": "Terms & Conditions", "manage-section": "More Information"
  };

  var icons = {
    "business-hours": "◷", "qrcode-customize": "▦", services: "✦", products: "◇", "instagram-embed": "◎",
    galleries: "▧", blogs: "✎", testimonials: "“", iframes: "▶", appointments: "□",
    "social-links": "↗", "custom-links": "↗", banners: "★", advanced: "+", "privacy-policy": "◉",
    "term-condition": "✓", "manage-section": "+"
  };

  function safeUrl(value) {
    try {
      var input = String(value || "").trim();
      if (!/^https?:\/\//i.test(input)) return "";
      var url = new URL(input);
      return /^(https?:)$/.test(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  }

  function lines(content) {
    return String(content || "").split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
  }

  function parts(line) {
    return String(line).split(/\s*\|\s*/).map(function (part) { return part.trim(); });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function link(url, label, className) {
    var href = safeUrl(url);
    if (!href) return null;
    var anchor = el("a", className || "", label || href);
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    return anchor;
  }

  function image(url, alt, className) {
    var src = safeUrl(url);
    if (!src || (!/\.(?:avif|gif|jpe?g|png|webp|svg)(?:[?#].*)?$/i.test(src) && !/(?:images\.unsplash\.com|images\.pexels\.com|res\.cloudinary\.com)/i.test(src))) return null;
    var img = el("img", className || "");
    img.src = src;
    img.alt = alt || "";
    img.loading = "lazy";
    return img;
  }

  function findUrl(values) {
    for (var index = values.length - 1; index >= 0; index -= 1) {
      if (safeUrl(values[index])) return values[index];
    }
    return "";
  }

  function addHeader(section, key) {
    var heading = el("div", "vfeature-heading");
    heading.append(el("span", "vfeature-heading-icon", icons[key] || "•"), el("h2", "", labels[key] || key.replace(/-/g, " ")));
    section.appendChild(heading);
  }

  function renderCards(body, content, type) {
    var grid = el("div", "vfeature-card-grid");
    lines(content).forEach(function (line, index) {
      var value = parts(line), title = value[0] || "Item " + (index + 1), url = findUrl(value);
      var card = el(url ? "a" : "article", "vfeature-item-card");
      if (url && card.tagName === "A") { card.href = safeUrl(url); card.target = "_blank"; card.rel = "noopener noreferrer"; }
      var media = image(url, title, "vfeature-item-image");
      if (media) card.appendChild(media);
      else card.appendChild(el("span", "vfeature-item-icon", type === "products" ? "◇" : type === "blogs" ? "✎" : "✦"));
      var copy = el("span", "vfeature-item-copy");
      copy.appendChild(el("strong", "", title));
      var description = value.slice(1).filter(function (item) { return item !== url; }).join(" · ");
      if (description) copy.appendChild(el("small", "", description));
      card.appendChild(copy); grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  function renderGallery(body, content) {
    var grid = el("div", "vfeature-gallery-grid");
    lines(content).forEach(function (line, index) {
      var value = parts(line), url = findUrl(value), label = value[0] === url ? "Gallery image " + (index + 1) : value[0];
      var media = image(url, label, "");
      if (!media) return;
      var item = link(url, label, "vfeature-gallery-item") || el("div", "vfeature-gallery-item");
      item.textContent = ""; item.appendChild(media);
      if (label && value[0] !== url) item.appendChild(el("span", "", label));
      grid.appendChild(item);
    });
    if (grid.children.length) body.appendChild(grid); else renderText(body, content);
  }

  function renderTestimonials(body, content) {
    var track = el("div", "vfeature-testimonials");
    lines(content).forEach(function (line) {
      var value = parts(line), quote = value[0], name = value[1] || "Client", role = value[2] || "";
      var card = el("blockquote", "vfeature-quote");
      card.append(el("span", "vfeature-quote-mark", "“"), el("p", "", quote));
      var person = el("footer", "");
      var avatar = image(findUrl(value), name, "");
      if (avatar) person.appendChild(avatar); else person.appendChild(el("span", "vfeature-person-avatar", name.charAt(0).toUpperCase()));
      var meta = el("span", ""); meta.appendChild(el("strong", "", name));
      if (role) meta.appendChild(el("small", "", role));
      person.appendChild(meta); card.appendChild(person); track.appendChild(card);
    });
    body.appendChild(track);
  }

  function renderHours(body, content) {
    var list = el("div", "vfeature-hours");
    lines(content).forEach(function (line) {
      var value = parts(line);
      if (value.length === 1) {
        var match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) value = [match[1], match[2]];
      }
      var row = el("div", ""); row.append(el("strong", "", value[0]), el("span", /closed/i.test(value.slice(1).join(" ")) ? "is-closed" : "", value.slice(1).join(" · ") || "Available"));
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  function renderLinks(body, content) {
    var list = el("div", "vfeature-link-list");
    lines(content).forEach(function (line) {
      var value = parts(line), url = findUrl(value), label = value[0] === url ? url.replace(/^https?:\/\/(?:www\.)?/i, "").replace(/\/$/, "") : value[0];
      var anchor = link(url, label, "vfeature-link");
      if (anchor) { anchor.appendChild(el("span", "", "↗")); list.appendChild(anchor); }
      else list.appendChild(el("span", "vfeature-link", line));
    });
    body.appendChild(list);
  }

  function renderAppointment(body, content) {
    var value = parts(lines(content)[0] || content), url = findUrl(value);
    var panel = el("div", "vfeature-appointment");
    panel.appendChild(el("span", "vfeature-appointment-icon", "□"));
    var copy = el("div", ""); copy.appendChild(el("strong", "", value[0] || "Choose a convenient time"));
    var details = value.slice(1).filter(function (item) { return item !== url; }).join(" · ");
    if (details) copy.appendChild(el("p", "", details));
    panel.appendChild(copy);
    var action = link(url, "Book now", "vfeature-button"); if (action) panel.appendChild(action);
    body.appendChild(panel);
  }

  function renderMedia(body, content) {
    var url = findUrl(parts(lines(content)[0] || content));
    if (url) {
      var media = image(url, "Featured content", "vfeature-banner-image");
      if (media) body.appendChild(media); else body.appendChild(link(url, "View featured content", "vfeature-button"));
    } else renderText(body, content);
  }

  function renderQr(body, content) {
    var url = findUrl(parts(lines(content)[0] || content));
    if (!url) { renderText(body, content); return; }
    var panel = el("div", "vfeature-qr-panel");
    var qr = el("img", "vfeature-qr-image");
    var apiOrigin = window.location.protocol === "file:" || (window.location.port && window.location.port !== "5000")
      ? "http://localhost:5000" : window.location.origin;
    qr.src = apiOrigin + "/api/public/qrcode?data=" + encodeURIComponent(url);
    qr.alt = "QR code";
    qr.loading = "lazy";
    var copy = el("div", "");
    copy.append(el("strong", "", "Scan to open"), el("p", "", url.replace(/^https?:\/\/(?:www\.)?/i, "")));
    var action = link(url, "Open link", "vfeature-button");
    if (action) copy.appendChild(action);
    panel.append(qr, copy); body.appendChild(panel);
  }

  function renderText(body, content) {
    var copy = el("div", "vfeature-rich-text");
    lines(content).forEach(function (line) { copy.appendChild(el("p", "", line)); });
    body.appendChild(copy);
  }

  function renderSection(key, content) {
    if (!String(content || "").trim()) return null;
    var section = el("section", "vfeature-section vfeature-" + key);
    section.dataset.featureKey = key;
    addHeader(section, key);
    var body = el("div", "vfeature-body");
    if (key === "business-hours") renderHours(body, content);
    else if (key === "services" || key === "products" || key === "blogs") renderCards(body, content, key);
    else if (key === "galleries" || key === "instagram-embed") renderGallery(body, content);
    else if (key === "testimonials") renderTestimonials(body, content);
    else if (key === "social-links" || key === "custom-links") renderLinks(body, content);
    else if (key === "appointments") renderAppointment(body, content);
    else if (key === "qrcode-customize") renderQr(body, content);
    else if (key === "banners" || key === "iframes") renderMedia(body, content);
    else renderText(body, content);
    section.appendChild(body);
    return section;
  }

  function renderAll(sections) {
    var container = el("div", "vfeature-sections");
    Object.keys(sections || {}).forEach(function (key) {
      if (key === "basic-details") return;
      var section = renderSection(key, sections[key]);
      if (section) container.appendChild(section);
    });
    return container;
  }

  window.SyncVCardFeatures = { labels: labels, renderSection: renderSection, renderAll: renderAll };
}());
