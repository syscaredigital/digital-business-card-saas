(function () {
  "use strict";
  var API = window.location.protocol + "//" + window.location.hostname + ":5000/api";
  var token = localStorage.getItem("token");
  var user;
  try { user = JSON.parse(localStorage.getItem("user") || "null"); } catch (_) { user = null; }

  if (!token) {
    window.location.replace("../auth/login.html?return=user");
    return;
  }

  document.body.classList.add("user-workspace");
  document.querySelectorAll(".sidebar-logo").forEach(function (logo) {
    logo.innerHTML = '<img src="../../public/assets/images/logos/sync-e-logo-white-web.png" alt="Sync E-Card">';
  });
  document.querySelectorAll('a[href="manage-subscription.html"]').forEach(function (link) {
    link.href = "payments.html";
    if (link.classList.contains("nav-item")) link.textContent = "Billing";
  });

  var name = user && (user.name || [user.firstName, user.lastName].filter(Boolean).join(" "));
  document.querySelectorAll(".user-name").forEach(function (node) { node.textContent = name || "My account"; });
  document.querySelectorAll(".user-avatar-placeholder").forEach(function (node) {
    node.textContent = (name || "User").split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0); }).join("").toUpperCase();
  });

  window.addEventListener("storage", function (event) {
    if (event.key === "token" && !event.newValue) window.location.replace("../auth/login.html");
  });

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char];
    });
  }

  function request(path, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, { Authorization: "Bearer " + token });
    return fetch(API + path, options).then(async function (response) {
      var data = await response.json().catch(function () { return {}; });
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token"); localStorage.removeItem("user");
        window.location.replace("../auth/login.html?expired=1");
        throw new Error("Your session has expired");
      }
      if (!response.ok) throw new Error(data.message || "Unable to load your workspace");
      return data;
    });
  }

  function setText(id, value) { var node = document.getElementById(id); if (node) node.textContent = value; }
  function money(value) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(value || 0)); }

  function renderDashboard(data) {
    var profile = data.user || {}, plan = data.subscription || {}, metrics = data.metrics || {};
    var displayName = profile.name || name || "there";
    localStorage.setItem("user", JSON.stringify(Object.assign({}, user || {}, profile)));
    setText("userGreeting", "Welcome back, " + displayName.split(" ")[0]);
    setText("dashboardName", displayName);
    setText("dashboardPlan", plan.name || "Free");
    setText("metricCards", metrics.activeCards || 0);
    setText("metricViews", Number(metrics.profileViews || 0).toLocaleString());
    setText("metricEnquiries", metrics.enquiries || 0);
    setText("metricOrders", metrics.pendingOrders || 0);
    setText("planUsageLabel", (metrics.activeCards || 0) + " of " + (plan.vcardLimit || 1) + " cards used");
    setText("billingPlanName", plan.name || "Free");
    setText("billingPlanDescription", (plan.name || "Free") + " subscription for your Sync E-Card workspace.");
    setText("billingPlanStatus", plan.status || "inactive");
    setText("billingRenewalDate", plan.endDate ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(plan.endDate)) : "No renewal");
    setText("billingCardLimit", plan.vcardLimit || 1);
    var fill = document.getElementById("planUsageFill");
    if (fill) fill.style.width = Math.min(100, ((metrics.activeCards || 0) / Math.max(1, plan.vcardLimit || 1)) * 100) + "%";
    document.querySelectorAll(".user-plan").forEach(function (node) { node.textContent = (plan.name || "Free") + " plan"; });

    var cards = document.getElementById("dashboardCards");
    if (cards) cards.innerHTML = data.vcards && data.vcards.length ? data.vcards.map(function (card) {
      return '<a class="user-card-item" href="vcards.html"><span class="user-card-mark">' + escapeHtml((card.title || "C").charAt(0).toUpperCase()) + '</span><span class="user-card-copy"><strong>' + escapeHtml(card.title || "Untitled card") + '</strong><span>' + escapeHtml(card.email || card.phone || "Ready to complete") + '</span></span><span class="user-status ' + (card.is_active ? "" : "inactive") + '">' + (card.is_active ? "Live" : "Paused") + "</span></a>";
    }).join("") : '<div class="user-empty">No cards yet. Create your first digital card to get started.</div>';

    var notifications = document.getElementById("notificationList");
    var unread = (data.notifications || []).filter(function (item) { return !item.is_read; }).length;
    setText("notificationCount", unread);
    if (notifications) notifications.innerHTML = data.notifications && data.notifications.length ? data.notifications.map(function (item) {
      return '<div class="notification-item"><strong>' + escapeHtml(item.title) + '</strong><p>' + escapeHtml(item.message) + "</p></div>";
    }).join("") : '<div class="user-empty">You are all caught up.</div>';

    var vcardTable = document.querySelector("#vcardListPanel .client-vcard-table-shell");
    if (vcardTable) {
      vcardTable.querySelectorAll(".client-vcard-row, .user-empty").forEach(function (row) { row.remove(); });
      if (data.vcards && data.vcards.length) {
        vcardTable.insertAdjacentHTML("beforeend", data.vcards.map(function (card) {
          return '<div class="client-vcard-row searchable-item" data-search="' + escapeHtml([card.title, card.email, card.phone].join(" ").toLowerCase()) + '"><label class="client-check"><input type="checkbox" aria-label="Select card"><span></span></label><div class="client-vcard-name-cell"><div class="client-vcard-thumb"></div><div><a href="../public-vcard/profile.html?id=' + encodeURIComponent(card.id) + '" target="_blank">' + escapeHtml(card.title || "Untitled card") + '</a><span>' + escapeHtml(card.description || "Digital identity") + '</span></div></div><div class="client-vcard-url-cell"><a href="../public-vcard/profile.html?id=' + encodeURIComponent(card.id) + '" target="_blank">Open public card</a></div><span>—</span><span>—</span><a href="mailto:' + escapeHtml(card.email || "") + '">' + escapeHtml(card.email || card.phone || "—") + '</a><span class="user-status ' + (card.is_active ? "" : "inactive") + '">' + (card.is_active ? "Live" : "Paused") + '</span><span class="date-pill">' + escapeHtml(formatDate(card.updated_at)) + '</span><div class="client-action-cell"><a href="edit-vcard.html?id=' + encodeURIComponent(card.id) + '" aria-label="Edit card">Edit</a></div></div>';
        }).join(""));
      } else vcardTable.insertAdjacentHTML("beforeend", '<div class="user-empty">No cards found. Use “Add New VCard” to create one.</div>');
    }

    var nfcTable = document.getElementById("nfcCardsTableBody");
    if (nfcTable) {
      var nfcRows = data.nfcCards || [];
      nfcTable.innerHTML = nfcRows.length ? nfcRows.map(function (card) {
        return '<tr class="nfc-card-row" data-search="' + escapeHtml([card.tag_identifier, card.serial_number, card.status].join(" ").toLowerCase()) + '"><td data-label="Card Type"><span class="user-card-mark">N</span></td><td data-label="Name">' + escapeHtml(card.tag_identifier) + '</td><td data-label="Serial">' + escapeHtml(card.serial_number || "—") + '</td><td data-label="Phone">—</td><td data-label="Assigned">' + escapeHtml(formatDate(card.assigned_at)) + '</td><td data-label="Status"><span class="user-status ' + (card.status === "active" ? "" : "inactive") + '">' + escapeHtml(card.status) + '</span></td><td data-label="Action">—</td></tr>';
      }).join("") : '<tr><td colspan="7" class="light-empty-cell">No NFC cards are assigned to this account.</td></tr>';
      setText("nfcCardsResults", "Showing " + nfcRows.length + " result" + (nfcRows.length === 1 ? "" : "s"));
    }
  }

  if (document.getElementById("userDashboardRoot")) {
    request("/user/dashboard").then(renderDashboard).catch(function (error) {
      var root = document.getElementById("dashboardCards");
      if (root) root.innerHTML = '<div class="user-empty">' + escapeHtml(error.message) + "</div>";
    });
  }
  else {
    request("/user/dashboard").then(renderDashboard).catch(function () {});
  }

  function formatDate(value) {
    return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
  }

  var enquiriesBody = document.getElementById("enquiriesTableBody");
  if (enquiriesBody) {
    enquiriesBody.innerHTML = '<tr><td colspan="7" class="light-empty-cell">Loading enquiries...</td></tr>';
    request("/user/enquiries").then(function (data) {
      var rows = data.enquiries || [];
      enquiriesBody.innerHTML = rows.length ? rows.map(function (item) {
        var searchable = [item.vcard_name, item.name, item.email, item.phone, item.company].join(" ");
        return '<tr class="enquiry-row" data-search="' + escapeHtml(searchable.toLowerCase()) + '"><td data-label="VCard Name">' + escapeHtml(item.vcard_name || "Digital card") + '</td><td data-label="Name">' + escapeHtml(item.name || "—") + '</td><td data-label="Email">' + (item.email ? '<a href="mailto:' + escapeHtml(item.email) + '">' + escapeHtml(item.email) + "</a>" : "—") + '</td><td data-label="Phone">' + escapeHtml(item.phone || "—") + '</td><td data-label="Message">' + escapeHtml(item.message || "No message") + '</td><td data-label="Created On">' + escapeHtml(formatDate(item.contacted_at)) + '</td><td data-label="Action"><a class="client-enquiry-action" href="mailto:' + escapeHtml(item.email || "") + '" aria-label="Reply to enquiry">↗</a></td></tr>';
      }).join("") : '<tr><td colspan="7" class="light-empty-cell">No enquiries yet. New contact requests will appear here.</td></tr>';
      setText("enquiriesResults", "Showing " + rows.length + " result" + (rows.length === 1 ? "" : "s"));
    }).catch(function (error) { enquiriesBody.innerHTML = '<tr><td colspan="7" class="light-empty-cell">' + escapeHtml(error.message) + "</td></tr>"; });
  }

  var appointmentsBody = document.getElementById("appointmentsTableBody");
  if (appointmentsBody) {
    appointmentsBody.innerHTML = '<tr><td colspan="8" class="light-empty-cell">Loading appointments...</td></tr>';
    request("/user/appointments").then(function (data) {
      var rows = data.appointments || [];
      appointmentsBody.innerHTML = rows.length ? rows.map(function (item) {
        var searchable = [item.vcard_name, item.name, item.email, item.phone, item.status].join(" ");
        return '<tr class="appointment-row" data-search="' + escapeHtml(searchable.toLowerCase()) + '"><td data-label="VCard Name">' + escapeHtml(item.vcard_name || "Digital card") + '</td><td data-label="Name">' + escapeHtml(item.name) + '</td><td data-label="Email">' + escapeHtml(item.email || "—") + '</td><td data-label="Phone">' + escapeHtml(item.phone || "—") + '</td><td data-label="Appointment Time"><span class="appointment-time-pill">' + escapeHtml(formatDate(item.starts_at)) + '</span></td><td data-label="Status"><span class="appointment-status-pill">' + escapeHtml(item.status) + '</span></td><td data-label="Type"><span class="appointment-type-pill">' + escapeHtml(item.appointment_type) + '</span></td><td data-label="Action">—</td></tr>';
      }).join("") : '<tr><td colspan="8" class="light-empty-cell">No appointments scheduled.</td></tr>';
      setText("appointmentsResults", "Showing " + rows.length + " result" + (rows.length === 1 ? "" : "s"));
    }).catch(function (error) { appointmentsBody.innerHTML = '<tr><td colspan="8" class="light-empty-cell">' + escapeHtml(error.message) + "</td></tr>"; });
  }

  var ordersBody = document.getElementById("productOrdersTableBody");
  if (ordersBody) {
    ordersBody.innerHTML = '<tr><td colspan="6" class="light-empty-cell">Loading orders...</td></tr>';
    request("/user/orders").then(function (data) {
      var rows = data.orders || [];
      ordersBody.innerHTML = rows.length ? rows.map(function (item) {
        var searchable = [item.id, item.status, item.tracking_number].join(" ");
        return '<tr class="product-order-row" data-search="' + escapeHtml(searchable.toLowerCase()) + '"><td data-label="Product Name">NFC Card × ' + escapeHtml(item.quantity) + '</td><td data-label="Name">Order #' + escapeHtml(item.id) + '</td><td data-label="Ordered At">' + escapeHtml(formatDate(item.ordered_at)) + '</td><td data-label="Status"><span class="user-status ' + (item.status === "pending" ? "inactive" : "") + '">' + escapeHtml(item.status) + '</span></td><td data-label="Amount">' + money(item.amount) + '</td><td data-label="Action">' + escapeHtml(item.tracking_number || "—") + "</td></tr>";
      }).join("") : '<tr><td colspan="6" class="light-empty-cell">No product orders yet.</td></tr>';
      setText("productOrdersResults", "Showing " + rows.length + " result" + (rows.length === 1 ? "" : "s"));
    }).catch(function (error) { ordersBody.innerHTML = '<tr><td colspan="6" class="light-empty-cell">' + escapeHtml(error.message) + "</td></tr>"; });
  }

  var editor = document.getElementById("userVcardEditor");
  if (editor) {
    var cardId = new URLSearchParams(window.location.search).get("id");
    var editorStatus = document.getElementById("vcardEditorStatus");
    if (!cardId) {
      editorStatus.textContent = "No card was selected.";
      editor.querySelector('button[type="submit"]').disabled = true;
    } else {
      request("/user/vcards/" + encodeURIComponent(cardId)).then(function (data) {
        var card = data.vcard;
        editor.elements.title.value = card.title || "";
        editor.elements.email.value = card.email || "";
        editor.elements.phone.value = card.phone || "";
        editor.elements.websiteUrl.value = card.website_url || "";
        editor.elements.address.value = card.address || "";
        editor.elements.description.value = card.description || "";
        editor.elements.isActive.checked = Boolean(card.is_active);
        editorStatus.textContent = "Loaded from your account";
      }).catch(function (error) { editorStatus.textContent = error.message; });
      editor.addEventListener("submit", function (event) {
        event.preventDefault();
        var button = editor.querySelector('button[type="submit"]');
        button.disabled = true; editorStatus.textContent = "Saving...";
        request("/user/vcards/" + encodeURIComponent(cardId), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editor.elements.title.value.trim(), email: editor.elements.email.value.trim(), phone: editor.elements.phone.value.trim(), websiteUrl: editor.elements.websiteUrl.value.trim(), address: editor.elements.address.value.trim(), description: editor.elements.description.value.trim(), isActive: editor.elements.isActive.checked }) })
          .then(function () { editorStatus.textContent = "Saved successfully"; })
          .catch(function (error) { editorStatus.textContent = error.message; })
          .finally(function () { button.disabled = false; });
      });
    }
  }

  var createCardForm = document.querySelector("#newVcardPanel .client-vcard-form");
  if (createCardForm) {
    createCardForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var title = document.getElementById("vcardName");
      var description = document.getElementById("vcardDescription");
      if (!title || !title.value.trim()) return;
      var button = createCardForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      request("/user/vcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.value.trim(), description: description ? description.value.trim() : "" }) })
        .then(function (data) { window.location.href = "edit-vcard.html?id=" + encodeURIComponent(data.vcard.id); })
        .catch(function (error) { window.alert(error.message); if (button) button.disabled = false; });
    });
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest('[data-action="clear-notifications"]');
    if (!button) return;
    request("/user/notifications/read", { method: "PATCH" }).then(function () { setText("notificationCount", "0"); });
  });

  var logout = document.getElementById("logoutButton");
  if (logout) logout.addEventListener("click", async function () {
    logout.disabled = true;
    try { await request("/auth/logout", { method: "POST" }); } catch (_) {}
    localStorage.removeItem("token"); localStorage.removeItem("user"); sessionStorage.clear();
    window.location.replace("../auth/login.html?loggedOut=1");
  });

  window.SyncEUser = { request: request, escapeHtml: escapeHtml, money: money };
})();
