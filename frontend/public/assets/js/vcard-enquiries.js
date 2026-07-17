(function () {
  "use strict";
  var id = new URLSearchParams(window.location.search).get("id");
  document.querySelectorAll(".message-panel").forEach(function (panel) {
    var button = panel.querySelector(".submit-button");
    var name = panel.querySelector('input[type="text"]');
    var email = panel.querySelector('input[type="email"]');
    var phone = panel.querySelector('input[type="tel"]');
    var message = panel.querySelector("textarea");
    if (!button || !name || !message) return;
    var status = document.createElement("p");
    status.className = "vcard-enquiry-status";
    status.setAttribute("role", "status");
    button.insertAdjacentElement("afterend", status);
    button.addEventListener("click", function () {
      if (!id) {
        status.textContent = "Enquiries become active when this template is published as a VCard.";
        return;
      }
      var payload = {
        name: name.value.trim(),
        email: email ? email.value.trim() : "",
        phone: phone ? phone.value.trim() : "",
        message: message.value.trim()
      };
      if (!payload.name || (!payload.email && !payload.phone) || !payload.message) {
        status.textContent = "Please enter your name, message, and email or phone number.";
        status.classList.add("is-error");
        return;
      }
      var apiOrigin = window.location.protocol === "file:" || (window.location.port && window.location.port !== "5000")
        ? "http://localhost:5000" : window.location.origin;
      button.disabled = true;
      status.classList.remove("is-error");
      status.textContent = "Sending your enquiry...";
      fetch(apiOrigin + "/api/public/vcards/" + encodeURIComponent(id) + "/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.message || "Unable to send your enquiry");
          return data;
        });
      }).then(function (data) {
        status.textContent = data.message;
        name.value = "";
        if (email) email.value = "";
        if (phone) phone.value = "";
        message.value = "";
      }).catch(function (error) {
        status.classList.add("is-error");
        status.textContent = error.message;
      }).finally(function () { button.disabled = false; });
    });
  });
}());
