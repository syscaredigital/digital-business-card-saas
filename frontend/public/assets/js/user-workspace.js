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
      if (response.status === 401) {
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

  var vcardFeatureGuides = {
    "business-hours": ["One day per line", "Monday | 9:00 AM - 5:00 PM"],
    services: ["One service per line: name | description | optional image URL", "Property valuation | Accurate local market valuation | https://example.com/image.jpg"],
    products: ["One product per line: name | price | description | optional image URL", "Modern family home | $350,000 | Three bedrooms with garden | https://example.com/home.jpg"],
    galleries: ["One image per line: caption | image URL", "Recent project | https://example.com/project.jpg"],
    "instagram-embed": ["One post image per line: caption | image URL", "Behind the scenes | https://example.com/post.jpg"],
    blogs: ["One article per line: title | summary | image or article URL", "Buying your first home | Five useful steps | https://example.com/article"],
    testimonials: ["One review per line: quote | customer name | role | optional avatar URL", "Wonderful service from start to finish | Alex Morgan | Customer | https://example.com/alex.jpg"],
    appointments: ["Title | duration in minutes; customers choose office or online", "Book a consultation | 30"],
    "social-links": ["One link per line: network name | full URL", "LinkedIn | https://linkedin.com/in/your-name"],
    "custom-links": ["One link per line: link name | full URL", "View my portfolio | https://example.com/portfolio"],
    banners: ["Add an image URL, or title | image URL", "Summer offer | https://example.com/banner.jpg"],
    iframes: ["Add a title and full content URL", "Watch my introduction | https://example.com/video"],
    "qrcode-customize": ["Add the destination or QR image URL", "https://example.com/contact"],
    advanced: ["Add each important detail on a new line", "Languages: English, Sinhala"],
    "privacy-policy": ["Add readable policy text, using a new line for each paragraph", "Your privacy policy"],
    "term-condition": ["Add readable terms, using a new line for each paragraph", "Your terms and conditions"],
    "manage-section": ["Add each extra detail on a new line", "Additional information"]
  };

  function vcardFeatureField(feature, savedValue, createMode) {
    var guide = vcardFeatureGuides[feature.key] || ["Add the content to show in this section", "Add section content"];
    var dataName = createMode ? "data-create-vcard-section" : "data-vcard-section";
    var idPrefix = createMode ? "create-vcard-section-" : "vcard-section-";
    return '<section class="vcard-feature-field"><label for="' + idPrefix + escapeHtml(feature.key) + '">' + escapeHtml(feature.label) + '</label>' +
      '<small class="vcard-feature-guide">' + escapeHtml(guide[0]) + '</small><textarea id="' + idPrefix + escapeHtml(feature.key) + '" ' + dataName + '="' + escapeHtml(feature.key) + '" rows="4" placeholder="' + escapeHtml(guide[1]) + '">' + escapeHtml(savedValue || "") + '</textarea></section>';
  }

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
    setText("vcardOverviewTotal", metrics.totalCards || 0);
    setText("vcardOverviewLive", metrics.activeCards || 0);
    setText("vcardOverviewPlan", plan.name || "Free");
    setText("vcardOverviewUsage", (metrics.totalCards || 0) + " / " + (plan.vcardLimit || 1));
    var overviewProgress = document.getElementById("vcardOverviewProgress");
    if (overviewProgress) overviewProgress.style.width = Math.min(100, (Number(metrics.totalCards || 0) / Math.max(1, Number(plan.vcardLimit || 1))) * 100) + "%";
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
    if (cards) cards.innerHTML = data.vcards && data.vcards.length ? data.vcards.slice(0, 4).map(function (card) {
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
          var publicUrl = "../public-vcard/profile.html?id=" + encodeURIComponent(card.id);
          return '<article class="client-vcard-row vcard-library-card searchable-item" data-search="' + escapeHtml([card.title, card.email, card.phone, card.template_name].join(" ").toLowerCase()) + '">' +
            '<div class="vcard-library-cover"><span class="vcard-library-template">' + escapeHtml(card.template_name || "VCard template") + '</span><div class="vcard-library-monogram">' + escapeHtml((card.title || "V").charAt(0).toUpperCase()) + '</div><span class="user-status ' + (card.is_active ? "" : "inactive") + '">' + (card.is_active ? "Live" : "Paused") + '</span></div>' +
            '<div class="vcard-library-body"><div class="client-vcard-name-cell"><div><a href="' + publicUrl + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(card.title || "Untitled card") + '</a><span>' + escapeHtml(card.description || "Your digital business card") + '</span></div></div>' +
            '<div class="vcard-library-meta"><span><small>Contact</small>' + escapeHtml(card.email || card.phone || "Not added") + '</span><span><small>Updated</small>' + escapeHtml(formatDate(card.updated_at)) + '</span></div>' +
            '<div class="vcard-library-actions"><a class="vcard-open-link" href="' + publicUrl + '" target="_blank" rel="noopener noreferrer">View card <span>↗</span></a><div class="vcard-manage"><button class="vcard-manage-toggle" type="button" data-vcard-manage-toggle="' + card.id + '" aria-expanded="false">Manage <span>•••</span></button><div class="vcard-manage-menu" data-vcard-manage-menu="' + card.id + '" hidden><a href="edit-vcard.html?id=' + encodeURIComponent(card.id) + '"><span>✎</span><div><strong>Edit VCard</strong><small>Update details and design</small></div></a><a href="' + publicUrl + '" target="_blank" rel="noopener noreferrer"><span>↗</span><div><strong>Open public card</strong><small>View the published profile</small></div></a><button type="button" class="vcard-delete-action" data-delete-vcard="' + card.id + '" data-vcard-title="' + escapeHtml(card.title || "Untitled card") + '"><span>×</span><div><strong>Delete VCard</strong><small>Permanently remove this card</small></div></button></div></div></div></div></article>';
          /* Legacy table row retained below for reference while the gallery renderer is active.
          return '<div class="client-vcard-row searchable-item" data-search="' + escapeHtml([card.title, card.email, card.phone].join(" ").toLowerCase()) + '"><label class="client-check"><input type="checkbox" aria-label="Select card"><span></span></label><div class="client-vcard-name-cell"><div class="client-vcard-thumb"></div><div><a href="../public-vcard/profile.html?id=' + encodeURIComponent(card.id) + '" target="_blank">' + escapeHtml(card.title || "Untitled card") + '</a><span>' + escapeHtml(card.description || "Digital identity") + '</span></div></div><div class="client-vcard-url-cell"><a href="../public-vcard/profile.html?id=' + encodeURIComponent(card.id) + '" target="_blank">Open public card</a></div><span>—</span><span>—</span><a href="mailto:' + escapeHtml(card.email || "") + '">' + escapeHtml(card.email || card.phone || "—") + '</a><span class="user-status ' + (card.is_active ? "" : "inactive") + '">' + (card.is_active ? "Live" : "Paused") + '</span><span class="date-pill">' + escapeHtml(formatDate(card.updated_at)) + '</span><div class="client-action-cell"><a href="edit-vcard.html?id=' + encodeURIComponent(card.id) + '" aria-label="Edit card">Edit</a></div></div>';
          */
        }).join(""));
      } else vcardTable.insertAdjacentHTML("beforeend", '<div class="user-empty">No cards found. Use “Add New VCard” to create one.</div>');
    }

    var createTemplate = document.getElementById("createVcardTemplate");
    var createTemplateGallery = document.getElementById("createVcardTemplateGallery");
    var createSummary = document.getElementById("createVcardPlanSummary");
    var createAllowance = document.getElementById("createVcardAllowance");
    var createFeatureEditor = document.getElementById("createVcardFeatureEditor");
    var entitlements = data.vcardEntitlements || {};
    var usedCards = Number(metrics.totalCards || 0), cardLimit = Number(entitlements.vcardLimit || plan.vcardLimit || 1), limitReached = usedCards >= cardLimit;
    if (createTemplate) {
      var availableTemplates = entitlements.templates || [];
      createTemplate.innerHTML = availableTemplates.length ? availableTemplates.map(function (template) {
        var category = template.templateJson && template.templateJson.category;
        return '<option value="' + template.id + '">' + escapeHtml(category ? category + " — " + template.name : template.name) + '</option>';
      }).join("") : '<option value="">No templates are included in this plan</option>';
      createTemplate.disabled = !availableTemplates.length;
      if (createTemplateGallery) {
        createTemplateGallery.innerHTML = availableTemplates.map(function (template, index) {
          var preview = template.previewUrl || "";
          var category = template.templateJson && template.templateJson.category ? template.templateJson.category : "General VCard";
          return '<button class="vcard-template-choice' + (index === 0 ? ' is-selected' : '') + '" type="button" data-template-choice="' + template.id + '"><span class="vcard-template-choice-preview">' + (preview ? '<iframe src="' + escapeHtml(preview) + '" title="" tabindex="-1" loading="lazy"></iframe>' : '<i>' + escapeHtml(template.name.charAt(0)) + '</i>') + '</span><span class="vcard-template-choice-copy"><em>' + escapeHtml(category) + '</em><strong>' + escapeHtml(template.name) + '</strong><small>' + escapeHtml(template.description || "Professional VCard design") + '</small></span><b>✓</b></button>';
        }).join("");
        createTemplateGallery.querySelectorAll("[data-template-choice]").forEach(function (choice) {
          choice.addEventListener("click", function () {
            createTemplate.value = choice.dataset.templateChoice;
            createTemplateGallery.querySelectorAll("[data-template-choice]").forEach(function (item) { item.classList.toggle("is-selected", item === choice); });
          });
        });
        createTemplate.addEventListener("change", function () {
          createTemplateGallery.querySelectorAll("[data-template-choice]").forEach(function (item) { item.classList.toggle("is-selected", item.dataset.templateChoice === createTemplate.value); });
        });
      }
    }
    if (createSummary) createSummary.innerHTML = '<strong>' + escapeHtml(entitlements.planName || "Free") + ' plan</strong><small>' +
      escapeHtml((entitlements.features || []).map(function (feature) { return feature.label; }).join(" · ") || "Basic card creation") + '</small>';
    if (createFeatureEditor) createFeatureEditor.innerHTML = '<div class="vcard-feature-heading"><strong>Included VCard sections</strong><span>' + escapeHtml(entitlements.planName || "Current plan") + '</span></div>' +
      (entitlements.features || []).filter(function (feature) { return feature.key !== "basic-details"; }).map(function (feature) {
        return vcardFeatureField(feature, "", true);
      }).join("") || '<p>Basic details are the only editable feature in this plan.</p>';
    if (createAllowance) {
      createAllowance.textContent = limitReached ? "Plan limit reached" : (cardLimit - usedCards) + " slot" + (cardLimit - usedCards === 1 ? "" : "s") + " left";
      createAllowance.classList.toggle("active", !limitReached);
    }
    var createSubmit = document.querySelector('#newVcardPanel .client-vcard-form button[type="submit"]');
    if (createSubmit) { createSubmit.disabled = limitReached || !(entitlements.templates || []).length; createSubmit.title = limitReached ? "Upgrade your plan to create another VCard" : ""; }

    var nfcTable = document.getElementById("nfcCardsTableBody");
    if (nfcTable && !document.querySelector("[data-live-nfc-order]")) {
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

  var liveNfcOrderForm = document.querySelector("[data-live-nfc-order]");
  if (liveNfcOrderForm) {
    var liveNfcData = { products: [], orders: [], vcards: [], currency: "LKR" };
    var liveNfcProductSelect = document.getElementById("nfcCardType");
    var liveNfcQuantity = document.getElementById("nfcQuantity");
    var refreshNfcOrdersButton = document.getElementById("refreshNfcOrders");
    var refreshNfcOrdersLabel = refreshNfcOrdersButton ? refreshNfcOrdersButton.querySelector("span") : null;
    var liveNfcLoading = null;
    function nfcMoney(value) {
      try { return new Intl.NumberFormat("en-LK", { style:"currency", currency:liveNfcData.currency || "LKR" }).format(Number(value || 0)); }
      catch (_) { return (liveNfcData.currency || "LKR") + " " + Number(value || 0).toFixed(2); }
    }
    function nfcBadge(status) { return '<span class="nfc-live-badge is-' + escapeHtml(status || "pending") + '">' + escapeHtml(String(status || "pending").replace(/_/g," ")) + '</span>'; }
    function nfcTracking(order) {
      if (!order.trackingNumber) return '<span class="nfc-tracking-pending"><i></i>Awaiting dispatch</span>';
      return '<button class="nfc-client-tracking" type="button" data-copy-text="' + escapeHtml(order.trackingNumber) + '" title="Copy tracking number"><span>Tracking number</span><strong>' + escapeHtml(order.trackingNumber) + '</strong><small>Click to copy</small></button>';
    }
    function updateLiveNfcTotal() {
      var product = liveNfcData.products.find(function(item){return Number(item.id)===Number(liveNfcProductSelect.value);});
      setText("nfcOrderTotal", nfcMoney((product ? product.price : 0) * Math.max(1,Number(liveNfcQuantity.value || 1))));
    }
    function renderLiveNfc(data) {
      liveNfcData = data;
      var products = data.products || [], orders = data.orders || [], vcards = data.vcards || [];
      var grid = document.getElementById("nfcUserProductGrid");
      grid.innerHTML = products.length ? products.map(function(product){return '<article class="nfc-user-product-card"><div class="nfc-user-product-visual"><img src="' + escapeHtml(product.frontImage) + '" alt="' + escapeHtml(product.name) + '" /><span>' + escapeHtml(product.category) + '</span></div><div class="nfc-user-product-copy"><small>Sync NFC collection</small><h3>' + escapeHtml(product.name) + '</h3><p>' + escapeHtml(product.description || "Premium contactless business card.") + '</p><div><strong>' + escapeHtml(nfcMoney(product.price)) + '</strong><button type="button" data-user-nfc-product="' + product.id + '">Order this card</button></div></div></article>';}).join("") : '<div class="nfc-user-loading">No NFC card products are available right now.</div>';
      setText("nfcCatalogCount", products.length + " design" + (products.length===1?"":"s"));
      liveNfcProductSelect.innerHTML = '<option value="">Select a card design</option>' + products.map(function(item){return '<option value="' + item.id + '">' + escapeHtml(item.name) + ' — ' + escapeHtml(nfcMoney(item.price)) + '</option>';}).join("");
      document.getElementById("nfcVCard").innerHTML = '<option value="">Select the VCard people will open</option>' + vcards.map(function(item){return '<option value="' + item.id + '">' + escapeHtml(item.title) + '</option>';}).join("");
      setText("nfcBankName",data.bankDetails.bankName || "Not configured");setText("nfcBankAccountName",data.bankDetails.accountName || "Not configured");setText("nfcBankAccountNumber",data.bankDetails.accountNumber || "Not configured");setText("nfcBankBranch",data.bankDetails.branch || "Not configured");
      setText("nfcMetricOrders",orders.length);setText("nfcMetricPending",orders.filter(function(item){return item.paymentStatus==="pending";}).length);setText("nfcMetricProduction",orders.filter(function(item){return ["processing","shipped"].includes(item.status);}).length);setText("nfcMetricDelivered",orders.filter(function(item){return item.status==="completed";}).length);
      var body=document.getElementById("nfcCardsTableBody");
      body.innerHTML=orders.length?orders.map(function(order){var search=[order.id,order.productName,order.vcardTitle,order.paymentStatus,order.status,order.transactionNumber,order.trackingNumber].join(" ").toLowerCase();return '<tr class="nfc-card-row" data-search="' + escapeHtml(search) + '"><td data-label="Order"><strong class="nfc-order-id">#' + order.id + '</strong><small class="nfc-order-ref">' + escapeHtml(order.transactionNumber || "No reference") + '</small></td><td data-label="Card / VCard"><div class="nfc-order-product">' + (order.productImage?'<img src="' + escapeHtml(order.productImage) + '" alt="" />':'<span>NFC</span>') + '<div><strong>' + escapeHtml(order.productName) + '</strong><small>' + escapeHtml(order.vcardTitle || "VCard not linked") + '</small></div></div></td><td data-label="Qty"><span class="nfc-client-quantity">' + order.quantity + '</span></td><td data-label="Total"><strong class="nfc-client-total">' + escapeHtml(nfcMoney(order.amount)) + '</strong></td><td data-label="Payment">' + nfcBadge(order.paymentStatus) + (order.adminNote?'<small class="nfc-admin-note">' + escapeHtml(order.adminNote) + '</small>':'') + '</td><td data-label="Fulfilment">' + nfcBadge(order.status) + '</td><td data-label="Tracking">' + nfcTracking(order) + '</td><td data-label="Ordered"><span class="nfc-client-date">' + escapeHtml(formatDate(order.orderedAt)) + '</span></td></tr>';}).join(""):'<tr><td colspan="8" class="light-empty-cell">No NFC orders yet. Choose a card above to begin.</td></tr>';
      setText("nfcCardsResults","Showing " + orders.length + " order" + (orders.length===1?"":"s"));updateLiveNfcTotal();
    }
    function loadLiveNfc(){
      if(liveNfcLoading)return liveNfcLoading;
      if(refreshNfcOrdersButton){refreshNfcOrdersButton.disabled=true;refreshNfcOrdersButton.classList.add("is-loading");if(refreshNfcOrdersLabel)refreshNfcOrdersLabel.textContent="Refreshing";}
      liveNfcLoading=request("/user/nfc").then(renderLiveNfc).catch(function(error){document.getElementById("nfcUserProductGrid").innerHTML='<div class="nfc-user-loading">' + escapeHtml(error.message) + '</div>';}).finally(function(){liveNfcLoading=null;if(refreshNfcOrdersButton){refreshNfcOrdersButton.disabled=false;refreshNfcOrdersButton.classList.remove("is-loading");if(refreshNfcOrdersLabel)refreshNfcOrdersLabel.textContent="Refresh";}});
      return liveNfcLoading;
    }
    loadLiveNfc();
    window.setInterval(function(){if(document.getElementById("nfcOrderModal").hidden&&!document.hidden)loadLiveNfc();},15000);
    window.addEventListener("focus",function(){if(document.getElementById("nfcOrderModal").hidden)loadLiveNfc();});
    document.addEventListener("visibilitychange",function(){if(!document.hidden&&document.getElementById("nfcOrderModal").hidden)loadLiveNfc();});
    if(refreshNfcOrdersButton)refreshNfcOrdersButton.addEventListener("click",loadLiveNfc);
    liveNfcProductSelect.addEventListener("change",updateLiveNfcTotal);liveNfcQuantity.addEventListener("input",updateLiveNfcTotal);
    liveNfcOrderForm.addEventListener("reset",function(){window.setTimeout(updateLiveNfcTotal,0);});
    document.addEventListener("click",function(event){var button=event.target.closest("[data-user-nfc-product]");if(!button)return;liveNfcProductSelect.value=button.dataset.userNfcProduct;updateLiveNfcTotal();document.getElementById("openNfcOrderModal").click();});
    liveNfcOrderForm.addEventListener("submit",function(event){event.preventDefault();var submit=liveNfcOrderForm.querySelector('[type="submit"]'),feedback=document.getElementById("nfcOrderFeedback");submit.disabled=true;submit.textContent="Uploading payment...";feedback.textContent="Submitting your order securely...";request("/user/nfc/orders",{method:"POST",body:new FormData(liveNfcOrderForm)}).then(function(data){feedback.textContent=data.message;liveNfcOrderForm.reset();updateLiveNfcTotal();return loadLiveNfc();}).then(function(){setTimeout(function(){document.getElementById("closeNfcOrderModal").click();},800);}).catch(function(error){feedback.textContent=error.message;}).finally(function(){submit.disabled=false;submit.textContent="Submit payment & order";});});
  }

  var billingPlansGrid = document.getElementById("billingPlansGrid");
  if (billingPlansGrid) {
    var billingFeedback = document.getElementById("billingPlanFeedback");
    var paymentModal = document.getElementById("manualPaymentModal");
    var paymentForm = document.getElementById("manualPaymentForm");
    var paymentFeedback = document.getElementById("manualPaymentFeedback");
    var billingData = null;
    function billingMoney(value, currency) {
      try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(Number(value || 0)); }
      catch (_) { return (currency || "USD") + " " + Number(value || 0).toFixed(2); }
    }
    function closePaymentModal() { if (paymentModal) paymentModal.hidden = true; }
    function openPaymentModal(plan) {
      if (!billingData.bankConfigured) { billingFeedback.textContent = "Bank payment details are not configured yet. Please contact support."; return; }
      setText("paymentPlanName", plan.name); setText("paymentPlanAmount", billingMoney(plan.price, billingData.currency));
      setText("paymentBankName", billingData.bankDetails.bankName); setText("paymentAccountName", billingData.bankDetails.accountName);
      setText("paymentAccountNumber", billingData.bankDetails.accountNumber); setText("paymentBankBranch", billingData.bankDetails.branch);
      setText("paymentBankSwift", billingData.bankDetails.swiftCode || "Not required");
      document.getElementById("paymentPlanId").value = plan.id;
      paymentFeedback.textContent = ""; paymentModal.hidden = false;
      paymentForm.elements.transactionNumber.focus();
    }
    function renderBillingPlans(data) {
      billingData = data;
      var pendingPlanId = data.pending ? Number(data.pending.planId) : null;
      billingPlansGrid.innerHTML = (data.plans || []).map(function (plan) {
        var current = Number(data.currentPlanId) === Number(plan.id) || (!data.currentPlanId && Number(plan.price) === 0), pending = pendingPlanId === Number(plan.id), waiting = Boolean(data.pending) && !pending;
        var features = [plan.vcardLimit + " VCards", plan.nfcLimit + " NFC cards", plan.analyticsLimit + " analytics"].concat(plan.features || []);
        return '<article class="billing-plan-option' + (current ? ' is-current' : '') + '"><div><span>' + (current ? "Current plan" : pending ? "Approval pending" : "Available") + '</span><h4>' + escapeHtml(plan.name) + '</h4><strong>' + billingMoney(plan.price, data.currency) + '<small> / ' + escapeHtml(plan.billingInterval) + '</small></strong></div><ul>' + features.map(function (feature) { return '<li>' + escapeHtml(feature) + '</li>'; }).join("") + '</ul><button type="button" data-upgrade-plan-id="' + plan.id + '"' + (current || pending || waiting ? ' disabled' : '') + '>' + (current ? "Current plan" : pending ? "Pending approval" : waiting ? "Payment pending" : "Proceed to payment") + '</button></article>';
      }).join("");
      var history = document.getElementById("billingPaymentHistory");
      if (history) history.innerHTML = data.payments && data.payments.length ? data.payments.map(function (payment) {
        return '<li><strong>' + escapeHtml(payment.planName) + '</strong> — ' + escapeHtml(billingMoney(payment.amount, payment.currency)) +
          ' <span class="payment-history-status is-' + escapeHtml(payment.status) + '">' + escapeHtml(payment.status) + '</span><small>Transaction ' + escapeHtml(payment.transactionNumber || "—") + ' · ' + escapeHtml(formatDate(payment.createdAt)) + '</small></li>';
      }).join("") : '<li>No manual payments submitted yet.</li>';
      if (data.pending && billingFeedback) billingFeedback.textContent = "Your " + data.pending.planName + " payment is waiting for super-admin approval. Your current plan remains active.";
    }
    function loadBillingPlans() { request("/user/plans").then(renderBillingPlans).catch(function (error) { billingPlansGrid.innerHTML = '<div class="user-empty">' + escapeHtml(error.message) + '</div>'; }); }
    loadBillingPlans();
    billingPlansGrid.addEventListener("click", function (event) {
      var button = event.target.closest("[data-upgrade-plan-id]");
      if (!button || button.disabled) return;
      var plan = (billingData.plans || []).find(function (item) { return Number(item.id) === Number(button.dataset.upgradePlanId); });
      if (plan) openPaymentModal(plan);
    });
    if (paymentModal) paymentModal.querySelectorAll("[data-close-payment-modal]").forEach(function (button) { button.addEventListener("click", closePaymentModal); });
    if (paymentForm) paymentForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var submit = paymentForm.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = "Uploading..."; paymentFeedback.textContent = "";
      request("/user/subscriptions/manual-payment", { method: "POST", body: new FormData(paymentForm) })
        .then(function (data) { paymentFeedback.textContent = data.message; paymentForm.reset(); setTimeout(function () { closePaymentModal(); loadBillingPlans(); }, 900); })
        .catch(function (error) { paymentFeedback.textContent = error.message; })
        .finally(function () { submit.disabled = false; submit.textContent = "Submit payment for review"; });
    });
    document.querySelectorAll('[data-action="upgrade-plan"]').forEach(function (button) {
      button.addEventListener("click", function (event) { event.stopImmediatePropagation(); document.getElementById("billingPlanCatalog").scrollIntoView({ behavior: "smooth" }); }, true);
    });
  }

  function formatDate(value) {
    return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
  }

  function formatAppointmentRange(startsAt, endsAt) {
    if (!startsAt) return "—";
    var start = new Date(startsAt);
    var startLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(start);
    if (!endsAt) return startLabel;
    var endLabel = new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(endsAt));
    return startLabel + " – " + endLabel;
  }

  function formatMeetingMode(value) {
    var normalized = String(value || "").toLowerCase();
    if (normalized === "office") return "Visit office";
    if (normalized === "online") return "Online meeting";
    if (normalized.includes("online") && /visit|office/.test(normalized)) return "Office / online";
    return value || "—";
  }

  var affiliateApplicationForm = document.getElementById("affiliateApplicationForm");
  if (affiliateApplicationForm) {
    var affiliateData = null;
    var affiliateDashboardContent = document.getElementById("affiliateDashboardContent");
    var affiliateTables = document.querySelector(".affiliations-section-shell");
    var affiliateEnrollment = document.getElementById("affiliateEnrollmentPanel");
    var affiliateNotice = document.getElementById("affiliateAccountNotice");
    var affiliatePayoutForm = document.getElementById("affiliatePayoutForm");
    var affiliateHeroGuideButton = document.getElementById("affiliateHeroGuideButton");
    if (affiliateHeroGuideButton) affiliateHeroGuideButton.addEventListener("click",function(){
      var guideButton = document.getElementById("openAffiliateGuideModal");
      if (guideButton) guideButton.click();
    });
    function affiliateMoney(value, currency) {
      try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(Number(value || 0)); }
      catch (_) { return (currency || "USD") + " " + Number(value || 0).toFixed(2); }
    }
    function affiliateStatus(status) { return '<span class="affiliate-live-status is-' + escapeHtml(status) + '">' + escapeHtml(status) + '</span>'; }
    function renderUserAffiliations(data) {
      affiliateData = data;
      var profile = data.profile;
      var referrals = Array.isArray(data.referrals) ? data.referrals : [];
      var commissions = Array.isArray(data.commissions) ? data.commissions : [];
      var withdrawals = Array.isArray(data.withdrawals) ? data.withdrawals : [];
      var balances = Array.isArray(data.balances) ? data.balances : [];
      affiliateEnrollment.hidden = Boolean(profile);
      affiliateDashboardContent.hidden = !profile;
      affiliateTables.hidden = !profile;
      affiliatePayoutForm.hidden = !profile;
      if (!profile) { affiliateNotice.hidden = true; return; }
      affiliatePayoutForm.elements.paymentMethod.value = profile.paymentMethod;
      affiliatePayoutForm.elements.payoutDetails.value = profile.payoutDetails || "";
      affiliateNotice.hidden = profile.status === "active";
      affiliateNotice.textContent = profile.status === "pending" ? "Your affiliate application is waiting for super-admin approval. Your referral link will become usable after approval." : "Your affiliate account is " + profile.status + ". Contact support if you need help.";
      // Build from the page currently serving the dashboard so local development
      // ports (for example :5500) and production origins are both preserved.
      var registrationUrl = new URL("../auth/register.html", window.location.href);
      registrationUrl.searchParams.set("ref", profile.referralCode);
      document.getElementById("affiliateReferralLink").value = registrationUrl.href;
      var openReferralLink = document.getElementById("affiliateOpenReferralLink");
      openReferralLink.href = registrationUrl.href;
      setText("affiliateProfileCode", profile.referralCode || "—");
      setText("affiliateProfileStatus", String(profile.status || "pending").replace(/_/g, " "));
      setText("affiliateProfileCommission", Number(profile.commissionValue || 0).toLocaleString() + (profile.commissionType === "percentage" ? "%" : " fixed"));
      setText("affiliateProfilePayout", String(profile.paymentMethod || "not set").replace(/_/g, " "));
      setText("affiliateProfileSince", profile.createdAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(profile.createdAt)) : "—");
      var primary = balances[0] || { currency: "USD", earned: 0, available: 0 };
      setText("affiliateTotalCommission", balances.length ? balances.map(function (item) { return affiliateMoney(Number(item.earned || 0) + Number(item.pending || 0), item.currency); }).join(" · ") : affiliateMoney(0, "USD"));
      setText("affiliateAvailableBalance", balances.length ? balances.map(function (item) { return affiliateMoney(item.available, item.currency); }).join(" · ") : affiliateMoney(0, "USD"));
      var pendingCommissionCount = commissions.filter(function (item) { return item.status === "pending"; }).length;
      setText("affiliateReferralSummary", pendingCommissionCount + " pending review · " + referrals.filter(function (item) { return item.status === "qualified"; }).length + " qualified of " + referrals.length + " referrals");
      setText("affiliateBalanceCurrency", profile.status === "active" ? "Available now" : "Account " + profile.status);
      setText("affiliateMinimumWithdrawal", "Minimum withdrawal: " + affiliateMoney(data.minimumWithdrawal, primary.currency));
      var currencySelect = document.getElementById("affiliateWithdrawalCurrency");
      currencySelect.innerHTML = balances.length ? balances.map(function (item) { return '<option value="' + escapeHtml(item.currency) + '">' + escapeHtml(item.currency) + ' — ' + escapeHtml(affiliateMoney(item.available, item.currency)) + '</option>'; }).join("") : '<option value="USD">USD — no approved balance</option>';
      document.getElementById("affiliateWithdrawalForm").querySelector('button[type="submit"]').disabled = profile.status !== "active" || !balances.some(function (item) { return item.available >= data.minimumWithdrawal; });

      var referralsBody = document.getElementById("affiliateUsersTableBody");
      referralsBody.innerHTML = referrals.length ? referrals.map(function (referral) {
        return '<tr class="affiliate-user-row" data-search="' + escapeHtml([referral.user.name,referral.user.email,referral.status].join(" ").toLowerCase()) + '"><td><div class="affiliate-brand-cell"><div class="affiliate-logo-chip">' + escapeHtml(profile.referralCode.slice(0,2)) + '</div><div><strong>' + escapeHtml(profile.referralCode) + '</strong><span>' + affiliateStatus(referral.status) + '</span></div></div></td><td><div class="affiliate-user-cell"><div><strong>' + escapeHtml(referral.user.name) + '</strong><span>' + escapeHtml(referral.user.email) + '</span></div></div></td><td><span class="affiliate-amount-pill">' + escapeHtml(affiliateMoney(referral.commission,referral.currency)) + '</span></td><td><span class="date-pill">' + escapeHtml(formatDate(referral.joinedAt)) + '</span></td></tr>';
      }).join("") : '<tr><td colspan="4" class="light-empty-cell">No one has registered with your referral link yet.</td></tr>';
      setText("affiliateUsersResults", "Showing " + referrals.length + " result" + (referrals.length === 1 ? "" : "s"));

      var commissionsBody = document.getElementById("affiliateTransactionsTableBody");
      commissionsBody.innerHTML = commissions.length ? commissions.map(function (commission) {
        return '<tr class="affiliate-transaction-row" data-search="' + escapeHtml([commission.referredName,commission.status,commission.description].join(" ").toLowerCase()) + '"><td>' + escapeHtml(commission.referredName) + '</td><td><strong>' + escapeHtml(affiliateMoney(commission.amount,commission.currency)) + '</strong></td><td>' + affiliateStatus(commission.status) + '</td><td>' + escapeHtml(formatDate(commission.createdAt)) + '</td><td>' + escapeHtml(commission.description || "—") + '</td></tr>';
      }).join("") : '<tr><td colspan="5" class="light-empty-cell">No commission transactions yet.</td></tr>';
      setText("affiliateTransactionsResults", "Showing " + commissions.length + " result" + (commissions.length === 1 ? "" : "s"));
      var withdrawalsBody = document.getElementById("affiliateWithdrawalsTableBody");
      withdrawalsBody.innerHTML = withdrawals.length ? withdrawals.map(function (withdrawal) {
        return '<tr><td><strong>' + escapeHtml(affiliateMoney(withdrawal.amount,withdrawal.currency)) + '</strong></td><td>' + escapeHtml(withdrawal.method.replace(/_/g," ")) + '</td><td>' + affiliateStatus(withdrawal.status) + '</td><td>' + escapeHtml(formatDate(withdrawal.createdAt)) + '</td><td>' + escapeHtml(withdrawal.adminNote || "—") + '</td></tr>';
      }).join("") : '<tr><td colspan="5" class="light-empty-cell">No withdrawal requests yet.</td></tr>';
    }
    function loadUserAffiliations() { request("/user/affiliations").then(renderUserAffiliations).catch(function (error) { affiliateNotice.hidden=false;affiliateNotice.textContent=error.message; }); }
    loadUserAffiliations();
    affiliateApplicationForm.addEventListener("submit", function (event) {
      event.preventDefault(); var button=affiliateApplicationForm.querySelector('button[type="submit"]'),fd=new FormData(affiliateApplicationForm),feedback=document.getElementById("affiliateApplicationFeedback");
      button.disabled=true;feedback.textContent="Submitting...";
      request("/user/affiliations/apply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({referralCode:fd.get("referralCode"),paymentMethod:fd.get("paymentMethod"),payoutDetails:fd.get("payoutDetails")})})
        .then(function(data){feedback.textContent=data.message;loadUserAffiliations();}).catch(function(error){feedback.textContent=error.message;}).finally(function(){button.disabled=false;});
    });
    affiliatePayoutForm.addEventListener("submit",function(event){event.preventDefault();var button=affiliatePayoutForm.querySelector("button"),fd=new FormData(affiliatePayoutForm),feedback=document.getElementById("affiliatePayoutFeedback");button.disabled=true;request("/user/affiliations/payout",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paymentMethod:fd.get("paymentMethod"),payoutDetails:fd.get("payoutDetails")})}).then(function(data){feedback.textContent=data.message;loadUserAffiliations();}).catch(function(error){feedback.textContent=error.message;}).finally(function(){button.disabled=false;});});
    document.getElementById("affiliateWithdrawalForm").addEventListener("submit",function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector("button"),fd=new FormData(form),feedback=document.getElementById("affiliateWithdrawalFeedback");button.disabled=true;feedback.textContent="Submitting...";request("/user/affiliations/withdrawals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount:Number(fd.get("amount")),currency:fd.get("currency"),note:fd.get("note")})}).then(function(data){feedback.textContent=data.message;form.reset();loadUserAffiliations();}).catch(function(error){feedback.textContent=error.message;button.disabled=false;});});
    document.addEventListener("click",function(event){
      var copy=event.target.closest('[data-action="copy-link"]');
      if(!copy)return;
      event.stopImmediatePropagation();
      var input=document.getElementById("affiliateReferralLink"),label=copy.querySelector("span"),copyText=function(){input.focus();input.select();document.execCommand("copy");return Promise.resolve();};
      var operation=navigator.clipboard&&window.isSecureContext?navigator.clipboard.writeText(input.value):copyText();
      operation.then(function(){if(label)label.textContent="Copied";setTimeout(function(){if(label)label.textContent="Copy link";},1200);}).catch(function(){if(label)label.textContent="Select link";input.focus();input.select();});
    },true);
  }

  var enquiriesBody = document.getElementById("enquiriesTableBody");
  if (enquiriesBody) {
    enquiriesBody.innerHTML = '<tr><td colspan="7" class="light-empty-cell">Loading enquiries...</td></tr>';
    request("/user/enquiries").then(function (data) {
      var rows = data.enquiries || [];
      var now = new Date();
      var monthlyEnquiries = rows.filter(function (item) {
        var created = new Date(item.contacted_at);
        return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
      }).length;
      setText("enquiryMetricTotal", rows.length);
      setText("enquiryMetricEmail", rows.filter(function (item) { return Boolean(item.email); }).length);
      setText("enquiryMetricMonth", monthlyEnquiries);
      enquiriesBody.innerHTML = rows.length ? rows.map(function (item) {
        var searchable = [item.vcard_name, item.name, item.email, item.phone, item.company, item.message].join(" ");
        var message = item.message || "No message";
        var reply = item.email ? '<a class="client-enquiry-action" href="mailto:' + escapeHtml(item.email) + '" aria-label="Reply to enquiry">↗</a>' : "—";
        return '<tr class="enquiry-row" data-search="' + escapeHtml(searchable.toLowerCase()) + '"><td data-label="VCard Name">' + escapeHtml(item.vcard_name || "Digital card") + '</td><td data-label="Name">' + escapeHtml(item.name || "—") + '</td><td data-label="Email">' + (item.email ? '<a href="mailto:' + escapeHtml(item.email) + '">' + escapeHtml(item.email) + "</a>" : "—") + '</td><td data-label="Phone">' + escapeHtml(item.phone || "—") + '</td><td data-label="Message"><div class="client-enquiry-message">' + escapeHtml(message) + '</div></td><td data-label="Created On">' + escapeHtml(formatDate(item.contacted_at)) + '</td><td data-label="Action">' + reply + '</td></tr>';
      }).join("") : '<tr><td colspan="7" class="light-empty-cell">No enquiries yet. New contact requests will appear here.</td></tr>';
      setText("enquiriesResults", "Showing " + rows.length + " result" + (rows.length === 1 ? "" : "s"));
    }).catch(function (error) { enquiriesBody.innerHTML = '<tr><td colspan="7" class="light-empty-cell">' + escapeHtml(error.message) + "</td></tr>"; });
  }

  var appointmentsBody = document.getElementById("appointmentsTableBody");
  var appointmentsActionStatus = document.getElementById("appointmentsActionStatus");
  var appointmentStatusFilter = document.getElementById("appointmentStatusFilter");
  var appointmentCalendarToggle = document.getElementById("appointmentCalendarToggle");
  var appointmentCalendarPanel = document.getElementById("appointmentCalendarPanel");
  var appointmentDateFilter = document.getElementById("appointmentDateFilter");
  var appointmentDateClear = document.getElementById("appointmentDateClear");
  function appointmentQuery() {
    var params = new URLSearchParams();
    if (appointmentStatusFilter && appointmentStatusFilter.value) params.set("status", appointmentStatusFilter.value);
    if (appointmentDateFilter && appointmentDateFilter.value) params.set("date", appointmentDateFilter.value);
    return params.toString() ? "?" + params.toString() : "";
  }
  function appointmentFeedback(message, isError) {
    if (!appointmentsActionStatus) return;
    appointmentsActionStatus.textContent = message || "";
    appointmentsActionStatus.classList.toggle("is-error", Boolean(isError));
  }
  function loadAppointments() {
    if (!appointmentsBody) return;
    appointmentsBody.innerHTML = '<tr><td colspan="8" class="light-empty-cell">Loading appointments...</td></tr>';
    request("/user/appointments" + appointmentQuery()).then(function (data) {
      var rows = data.appointments || [];
      var summary = data.summary || {};
      setText("appointmentMetricTotal", summary.total == null ? rows.length : summary.total);
      setText("appointmentMetricPending", summary.pending == null ? rows.filter(function (item) { return item.status === "pending"; }).length : summary.pending);
      setText("appointmentMetricApproved", summary.approved == null ? rows.filter(function (item) { return item.status === "approved"; }).length : summary.approved);
      setText("appointmentMetricOnline", summary.online == null ? rows.filter(function (item) { return item.appointment_type === "online"; }).length : summary.online);
      appointmentsBody.innerHTML = rows.length ? rows.map(function (item) {
        var searchable = [item.vcard_name, item.name, item.email, item.phone, item.status, item.appointment_type].join(" ");
        var action = item.status === "pending"
          ? '<div class="client-appointment-actions"><button class="client-appointment-approve" type="button" data-appointment-status="approved" data-appointment-id="' + item.id + '"' + (item.email ? "" : " disabled title=\"Customer email is missing\"") + '>Approve</button><button class="client-appointment-reject" type="button" data-appointment-status="rejected" data-appointment-id="' + item.id + '">Reject</button></div>'
          : '<span class="client-appointment-complete">✓ ' + escapeHtml(item.status) + '</span>';
        return '<tr class="appointment-row" data-search="' + escapeHtml(searchable.toLowerCase()) + '"><td data-label="VCard Name">' + escapeHtml(item.vcard_name || "Digital card") + '</td><td data-label="Name">' + escapeHtml(item.name) + '</td><td data-label="Email">' + escapeHtml(item.email || "—") + '</td><td data-label="Phone">' + escapeHtml(item.phone || "—") + '</td><td data-label="Appointment Time"><span class="appointment-time-pill">' + escapeHtml(formatAppointmentRange(item.starts_at, item.ends_at)) + '</span></td><td data-label="Status"><span class="appointment-status-pill status-' + escapeHtml(item.status) + '">' + escapeHtml(item.status) + '</span></td><td data-label="Meeting Mode"><span class="appointment-type-pill">' + escapeHtml(formatMeetingMode(item.appointment_type)) + '</span></td><td data-label="Action">' + action + '</td></tr>';
      }).join("") : '<tr><td colspan="8" class="light-empty-cell">No appointments match the selected filters.</td></tr>';
      setText("appointmentsResults", "Showing " + rows.length + " result" + (rows.length === 1 ? "" : "s"));
    }).catch(function (error) {
      appointmentsBody.innerHTML = '<tr><td colspan="8" class="light-empty-cell">' + escapeHtml(error.message) + "</td></tr>";
      appointmentFeedback(error.message, true);
    });
  }
  if (appointmentsBody) {
    loadAppointments();
    appointmentsBody.addEventListener("click", function (event) {
      var button = event.target.closest("[data-appointment-status]");
      if (!button || button.disabled) return;
      var nextStatus = button.dataset.appointmentStatus;
      var originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = nextStatus === "approved" ? "Sending..." : "Updating...";
      appointmentFeedback(nextStatus === "approved"
        ? "Approving appointment and sending confirmation email..."
        : "Rejecting appointment...", false);
      request("/user/appointments/" + encodeURIComponent(button.dataset.appointmentId) + "/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      }).then(function (data) {
        appointmentFeedback(data.message, false);
        loadAppointments();
      }).catch(function (error) {
        appointmentFeedback(error.message, true);
        button.disabled = false;
        button.textContent = originalLabel;
      });
    });
    if (appointmentStatusFilter) appointmentStatusFilter.addEventListener("change", loadAppointments);
    if (appointmentCalendarToggle && appointmentCalendarPanel) {
      appointmentCalendarToggle.addEventListener("click", function () {
        var opening = appointmentCalendarPanel.hidden;
        appointmentCalendarPanel.hidden = !opening;
        appointmentCalendarToggle.setAttribute("aria-expanded", String(opening));
        appointmentCalendarToggle.classList.toggle("is-active", opening);
        if (opening && appointmentDateFilter) appointmentDateFilter.focus();
      });
    }
    if (appointmentDateFilter) appointmentDateFilter.addEventListener("change", function () {
      loadAppointments();
      appointmentFeedback(appointmentDateFilter.value ? "Showing appointments for the selected date." : "", false);
    });
    if (appointmentDateClear) appointmentDateClear.addEventListener("click", function () {
      if (appointmentDateFilter) appointmentDateFilter.value = "";
      loadAppointments();
      appointmentFeedback("Calendar filter cleared.", false);
    });
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
        var entitlements = data.entitlements || {};
        editor.elements.title.value = card.title || "";
        editor.elements.email.value = card.email || "";
        editor.elements.phone.value = card.phone || "";
        editor.elements.websiteUrl.value = card.website_url || "";
        editor.elements.address.value = card.address || "";
        editor.elements.description.value = card.description || "";
        editor.elements.occupation.value = card.settings && card.settings.sections ? (card.settings.sections["basic-details"] || "") : "";
        editor.elements.isActive.checked = Boolean(card.is_active);
        editor.elements.templateId.innerHTML = (entitlements.templates || []).map(function (template) {
          var category = template.templateJson && template.templateJson.category;
          return '<option value="' + template.id + '">' + escapeHtml(category ? category + " — " + template.name : template.name) + '</option>';
        }).join("");
        editor.elements.templateId.value = String(card.template_id || entitlements.templates?.[0]?.id || "");
        var featureEditor = document.getElementById("vcardFeatureEditor");
        var savedSections = card.settings && card.settings.sections ? card.settings.sections : {};
        if (featureEditor) featureEditor.innerHTML = '<div class="vcard-feature-heading"><strong>Plan-enabled card sections</strong><span>' + escapeHtml(entitlements.planName || "Current plan") + '</span></div>' +
          (entitlements.features || []).filter(function (feature) { return feature.key !== "basic-details"; }).map(function (feature) {
            return vcardFeatureField(feature, savedSections[feature.key], false);
          }).join("") || '<p>Basic details are the only editable feature in this plan.</p>';
        editorStatus.textContent = "Loaded from your account";
      }).catch(function (error) { editorStatus.textContent = error.message; });
      editor.addEventListener("submit", function (event) {
        event.preventDefault();
        var button = editor.querySelector('button[type="submit"]');
        button.disabled = true; editorStatus.textContent = "Saving...";
        var sections = {};
        editor.querySelectorAll("[data-vcard-section]").forEach(function (field) { sections[field.dataset.vcardSection] = field.value.trim(); });
        request("/user/vcards/" + encodeURIComponent(cardId), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editor.elements.title.value.trim(), templateId: Number(editor.elements.templateId.value), email: editor.elements.email.value.trim(), phone: editor.elements.phone.value.trim(), websiteUrl: editor.elements.websiteUrl.value.trim(), address: editor.elements.address.value.trim(), description: editor.elements.description.value.trim(), sections: sections, isActive: editor.elements.isActive.checked }) })
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
      var template = document.getElementById("createVcardTemplate");
      var sections = {};
      createCardForm.querySelectorAll("[data-create-vcard-section]").forEach(function (field) { sections[field.dataset.createVcardSection] = field.value.trim(); });
      var occupation = document.getElementById("occupation");
      if (occupation && occupation.value.trim()) sections["basic-details"] = occupation.value.trim();
      request("/user/vcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.value.trim(), templateId: Number(template && template.value), description: description ? description.value.trim() : "", sections: sections }) })
        .then(function (data) { window.location.href = "edit-vcard.html?id=" + encodeURIComponent(data.vcard.id); })
        .catch(function (error) { window.alert(error.message); if (button) button.disabled = false; });
    });
  }

  function setVcardActionFeedback(message, isError) {
    var feedback = document.getElementById("vcardActionFeedback");
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.classList.toggle("is-error", Boolean(isError));
    window.setTimeout(function () { feedback.hidden = true; }, 4500);
  }

  function closeVcardManageMenus(exceptId) {
    document.querySelectorAll("[data-vcard-manage-menu]").forEach(function (menu) {
      if (String(menu.dataset.vcardManageMenu) !== String(exceptId || "")) menu.hidden = true;
    });
    document.querySelectorAll("[data-vcard-manage-toggle]").forEach(function (toggle) {
      if (String(toggle.dataset.vcardManageToggle) !== String(exceptId || "")) toggle.setAttribute("aria-expanded", "false");
    });
  }

  document.addEventListener("click", function (event) {
    var manageToggle = event.target.closest("[data-vcard-manage-toggle]");
    if (manageToggle) {
      var menuId = manageToggle.dataset.vcardManageToggle;
      var menu = document.querySelector('[data-vcard-manage-menu="' + menuId + '"]');
      var shouldOpen = menu && menu.hidden;
      closeVcardManageMenus(menuId);
      if (menu) menu.hidden = !shouldOpen;
      manageToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      return;
    }

    var deleteButton = event.target.closest("[data-delete-vcard]");
    if (deleteButton) {
      var vcardId = deleteButton.dataset.deleteVcard;
      var vcardTitle = deleteButton.dataset.vcardTitle || "this VCard";
      if (!window.confirm('Delete "' + vcardTitle + '"? This action cannot be undone.')) return;
      deleteButton.disabled = true;
      deleteButton.classList.add("is-deleting");
      request("/user/vcards/" + encodeURIComponent(vcardId), { method: "DELETE" })
        .then(function (data) {
          closeVcardManageMenus();
          setVcardActionFeedback(data.message || "VCard deleted successfully", false);
          return request("/user/dashboard");
        })
        .then(renderDashboard)
        .catch(function (error) {
          setVcardActionFeedback(error.message, true);
          deleteButton.disabled = false;
          deleteButton.classList.remove("is-deleting");
        });
      return;
    }

    if (!event.target.closest(".vcard-manage")) closeVcardManageMenus();
  });

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
