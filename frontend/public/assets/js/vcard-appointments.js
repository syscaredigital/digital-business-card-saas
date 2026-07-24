(function () {
  "use strict";
  var id = new URLSearchParams(window.location.search).get("id");
  var apiOrigin = window.location.protocol === "file:" || (window.location.port && window.location.port !== "5000")
    ? "http://localhost:5000" : window.location.origin;

  function localDateValue(date) {
    var offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  document.addEventListener("focusin", function (event) {
    if (event.target.matches('[data-vcard-appointment-form] input[type="date"]')) {
      event.target.min = localDateValue(new Date());
    }
  });

  document.addEventListener("submit", function (event) {
    var form = event.target.closest("[data-vcard-appointment-form]");
    if (!form) return;
    event.preventDefault();

    var status = form.querySelector(".vfeature-booking-status");
    var button = form.querySelector('button[type="submit"]');
    var data = new FormData(form);
    var name = String(data.get("name") || "").trim();
    var email = String(data.get("email") || "").trim();
    var phone = String(data.get("phone") || "").trim();
    var date = String(data.get("date") || "");
    var time = String(data.get("time") || "");
    var meetingMode = String(data.get("meetingMode") || "");

    status.classList.remove("is-error", "is-success");
    if (!id) {
      status.textContent = "Customer bookings become active after this template is published as a VCard.";
      return;
    }
    if (!name || !email || !date || !time || !meetingMode) {
      status.textContent = "Enter your name, email, date, time, and meeting type.";
      status.classList.add("is-error");
      return;
    }
    var startsAt = new Date(date + "T" + time);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now() + 5 * 60 * 1000) {
      status.textContent = "Choose a future appointment date and time.";
      status.classList.add("is-error");
      return;
    }

    button.disabled = true;
    status.textContent = "Submitting your appointment...";
    fetch(apiOrigin + "/api/public/vcards/" + encodeURIComponent(id) + "/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        email: email,
        phone: phone,
        startsAt: startsAt.toISOString(),
        durationMinutes: Number(form.dataset.durationMinutes || 30),
        appointmentType: meetingMode,
        notes: String(data.get("notes") || "").trim()
      })
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) throw new Error(payload.message || "Unable to request the appointment");
        return payload;
      });
    }).then(function (payload) {
      form.reset();
      status.textContent = payload.message;
      status.classList.add("is-success");
    }).catch(function (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
    }).finally(function () {
      button.disabled = false;
    });
  });
}());
