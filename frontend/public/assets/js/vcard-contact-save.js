(function () {
  "use strict";
  var params = new URLSearchParams(window.location.search);
  var id = params.get("id");
  if (!/^\d+$/.test(id || "")) return;

  var apiOrigin = window.SyncVCardApiOrigin || window.location.origin;
  var source = params.get("source") === "qr" ? "qr" : "direct";
  var contactCaptureRequired = true;
  var contactPreferenceReady = fetch(apiOrigin + "/api/public/vcards/" + encodeURIComponent(id))
    .then(function (response) { return response.ok ? response.json() : {}; })
    .then(function (data) { contactCaptureRequired = !data.vcard || data.vcard.contactCaptureRequired !== false; })
    .catch(function () {});

  fetch(apiOrigin + "/api/public/vcards/" + encodeURIComponent(id) + "/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType: source === "qr" ? "qr_scan" : "vcard_view", source: source }),
  }).catch(function () {});

  function recordEngagement(eventType, eventSource) {
    fetch(apiOrigin + "/api/public/vcards/" + encodeURIComponent(id) + "/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: eventType, source: String(eventSource || "public_vcard").slice(0, 80) }),
    }).catch(function () {});
  }

  document.addEventListener("click", function (event) {
    var shareButton = event.target.closest("[data-share-card]");
    if (!shareButton) {
      var candidate = event.target.closest("button,a");
      if (candidate && /share\\s+(?:profile|card|vcard)/i.test(String(candidate.textContent || ""))) shareButton = candidate;
    }
    if (shareButton) {
      recordEngagement("share", "share_button");
      return;
    }
    var anchor = event.target.closest("a[href]");
    if (!anchor || anchor.closest(".vcard-save-widget") || /(?:save|add)\\s+(?:to\\s+)?contacts/i.test(String(anchor.textContent || ""))) return;
    try {
      var href = new URL(anchor.href, window.location.href);
      var clickSource = href.protocol === "mailto:" ? "email" : href.protocol === "tel:" ? "phone" : href.hostname || "link";
      recordEngagement("link_click", clickSource);
    } catch (_) {}
  });

  var shell = document.createElement("div");
  shell.className = "vcard-save-widget";
  shell.innerHTML =
    '<button class="vcard-save-trigger" type="button">＋ Save to contacts</button>' +
    '<div class="vcard-save-modal" hidden>' +
      '<button class="vcard-save-backdrop" type="button" aria-label="Close"></button>' +
      '<section class="vcard-save-dialog" role="dialog" aria-modal="true" aria-labelledby="vcardSaveTitle">' +
        '<button class="vcard-save-close" type="button" aria-label="Close">×</button>' +
        '<span class="vcard-save-eyebrow">Save contact</span>' +
        '<h2 id="vcardSaveTitle">Add this VCard to your phone</h2>' +
        '<p>Share your details with the card owner, then download their contact file.</p>' +
        '<form class="vcard-save-form">' +
          '<label>Your name<input name="name" type="text" maxlength="150" autocomplete="name" required></label>' +
          '<label>Email address<input name="email" type="email" maxlength="255" autocomplete="email"></label>' +
          '<label>Phone number<input name="phone" type="tel" maxlength="50" autocomplete="tel"></label>' +
          '<label>Company <span>(optional)</span><input name="company" type="text" maxlength="255" autocomplete="organization"></label>' +
          '<label class="vcard-save-consent"><input name="consent" type="checkbox" required><span>I agree to share these details with the owner of this VCard.</span></label>' +
          '<p class="vcard-save-status" role="status" hidden></p>' +
          '<button class="vcard-save-submit" type="submit">Share details &amp; save contact</button>' +
        '</form>' +
      '</section>' +
    '</div>';
  document.body.appendChild(shell);

  var modal = shell.querySelector(".vcard-save-modal");
  var form = shell.querySelector("form");
  var status = shell.querySelector(".vcard-save-status");
  function setOpen(open) {
    modal.hidden = !open;
    document.body.classList.toggle("vcard-save-open", open);
    if (open) setTimeout(function () { form.elements.name.focus(); }, 0);
  }
  function saveContact() {
    contactPreferenceReady.then(function () {
      if (!contactCaptureRequired) {
        window.location.assign(apiOrigin + "/api/public/vcards/" + encodeURIComponent(id) + "/contact.vcf");
        return;
      }
      setOpen(true);
    });
  }
  shell.querySelector(".vcard-save-trigger").addEventListener("click", saveContact);
  document.querySelectorAll("a,button").forEach(function (node) {
    if (/^(?:\+|＋)?\s*(?:add to contacts|save contact)$/i.test(String(node.textContent || "").trim())) {
      node.addEventListener("click", function (event) { event.preventDefault(); saveContact(); });
    }
  });
  shell.querySelector(".vcard-save-backdrop").addEventListener("click", function () { setOpen(false); });
  shell.querySelector(".vcard-save-close").addEventListener("click", function () { setOpen(false); });
  document.addEventListener("keydown", function (event) { if (event.key === "Escape" && !modal.hidden) setOpen(false); });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var button = form.querySelector(".vcard-save-submit");
    var payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      company: form.elements.company.value.trim(),
      consent: form.elements.consent.checked,
    };
    if (!payload.email && !payload.phone) {
      status.hidden = false;
      status.className = "vcard-save-status is-error";
      status.textContent = "Enter an email address or phone number.";
      return;
    }
    button.disabled = true;
    button.textContent = "Preparing contact…";
    status.hidden = true;
    fetch(apiOrigin + "/api/public/vcards/" + encodeURIComponent(id) + "/contact-saves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) throw new Error(data.message || "Unable to save contact");
        return data;
      });
    }).then(function (data) {
      status.hidden = false;
      status.className = "vcard-save-status is-success";
      status.textContent = data.message;
      window.location.assign(apiOrigin + data.downloadUrl);
      button.textContent = "Contact downloaded";
      setTimeout(function () { setOpen(false); button.disabled = false; button.textContent = "Share details & save contact"; }, 1800);
    }).catch(function (error) {
      status.hidden = false;
      status.className = "vcard-save-status is-error";
      status.textContent = error.message;
      button.disabled = false;
      button.textContent = "Share details & save contact";
    });
  });
}());
