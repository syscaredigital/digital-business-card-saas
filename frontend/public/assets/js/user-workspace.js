(function () {
  "use strict";
  var API = window.SyncVCardApiOrigin + "/api";
  var token = localStorage.getItem("token");
  var user;
  try { user = JSON.parse(localStorage.getItem("user") || "null"); } catch (_) { user = null; }

  if (!token) {
    window.location.replace("../auth/login.html?return=user");
    return;
  }

  document.body.classList.add("user-workspace");
  var currentUserPage = (window.location.pathname.split("/").pop() || "dashboard.html").toLowerCase();
  var navigationAliases = {
    "edit-vcard.html": "vcards.html",
    "my-vcard.html": "vcards.html",
    "contacts.html": "enquiries.html",
    "nfc-request.html": "my-nfc-cards.html",
    "manage-subscription.html": "payments.html"
  };
  var activeUserPage = navigationAliases[currentUserPage] || currentUserPage;
  var userNavigation = [
    ["dashboard.html", "Overview"],
    ["vcards.html", "My cards"],
    ["qr-code.html", "QR codes"],
    ["enquiries.html", "Enquiries"],
    ["appointments.html", "Appointments"],
    ["product-orders.html", "Orders"],
    ["affiliations.html", "Affiliations"],
    ["my-nfc-cards.html", "NFC cards"],
    ["nfc-backgrounds.html", "Backgrounds"],
    ["storage.html", "Storage"],
    ["settings.html", "Settings"],
    ["payments.html", "Billing"]
  ];
  document.querySelectorAll(".sidebar-nav").forEach(function (navigation) {
    navigation.setAttribute("aria-label", "User workspace navigation");
    navigation.innerHTML = userNavigation.map(function (item) {
      return '<a href="' + item[0] + '" class="nav-item' + (activeUserPage === item[0] ? ' active' : '') + '">' + item[1] + '</a>';
    }).join("");
  });
  document.querySelectorAll(".sidebar-logo").forEach(function (logo) {
    logo.href = "dashboard.html";
    logo.setAttribute("aria-label", "Sync E-Card dashboard");
    logo.innerHTML = '<img src="../../public/assets/images/logos/sync-e-logo-white-web.png" alt="Sync E-Card">';
  });
  document.querySelectorAll(".notif-btn").forEach(function (button) {
    if (!button.querySelector("svg")) {
      button.insertAdjacentHTML("afterbegin", '<svg class="notification-bell-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"></path><path d="M10 21h4"></path></svg>');
    }
    button.setAttribute("aria-label", "Notifications");
  });
  document.querySelectorAll(".notification-panel-header").forEach(function (header) {
    var markAllButton = header.querySelector('[data-action="clear-notifications"]');
    if (!markAllButton) {
      header.insertAdjacentHTML("beforeend", '<button type="button" class="notification-clear-btn" data-action="clear-notifications">Mark all read</button>');
    } else markAllButton.textContent = "Mark all read";
  });
  document.querySelectorAll(".notification-list").forEach(function (list) {
    list.setAttribute("aria-live", "polite");
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
  function money(value) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "LKR" }).format(Number(value || 0)); }

  function notificationTime(value) {
    if (!value) return "";
    var date = new Date(value), seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (!Number.isFinite(seconds)) return "";
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
  }

  function renderUserNotifications(data) {
    var list = document.getElementById("notificationList");
    var badge = document.getElementById("notificationCount");
    var items = data.notifications || [];
    var unread = Number(data.unreadCount != null ? data.unreadCount : data.notificationUnreadCount || 0);
    if (badge) {
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.hidden = unread < 1;
      badge.setAttribute("aria-label", unread + " unread notification" + (unread === 1 ? "" : "s"));
    }
    if (!list) return;
    if (data.enabled === false) {
      list.innerHTML = '<div class="notification-empty"><strong>Dashboard notifications are off</strong><span>You can enable them in Settings.</span></div>';
      return;
    }
    list.innerHTML = items.length ? items.map(function (item) {
      return '<button type="button" class="notification-item' + (item.is_read ? '' : ' is-unread') + '" data-notification-id="' + item.id + '">' +
        '<span class="notification-type-dot" aria-hidden="true"></span><span><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.message) + '</span><time>' + escapeHtml(notificationTime(item.created_at)) + '</time></span></button>';
    }).join("") : '<div class="notification-empty"><strong>All caught up</strong><span>No notifications yet.</span></div>';
  }

  function refreshNotifications() {
    if (!document.getElementById("notificationList")) return Promise.resolve();
    return request("/user/notifications").then(renderUserNotifications).catch(function () {});
  }

  var currencyPreferenceForm = document.getElementById("currencyPreferenceForm");
  if (currencyPreferenceForm) {
    var currencyPreferenceSelect = document.getElementById("settingsCurrency");
    var currencyPreferenceFeedback = document.getElementById("currencyPreferenceFeedback");
    request("/user/preferences").then(function (data) {
      currencyPreferenceSelect.value = data.currency || "LKR";
    }).catch(function (error) {
      currencyPreferenceFeedback.hidden = false;
      currencyPreferenceFeedback.textContent = error.message;
    });
    currencyPreferenceForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var button = currencyPreferenceForm.querySelector('[type="submit"]');
      button.disabled = true;
      button.textContent = "Saving...";
      currencyPreferenceFeedback.hidden = false;
      currencyPreferenceFeedback.classList.remove("success");
      currencyPreferenceFeedback.textContent = "Updating your workspace currency...";
      request("/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: currencyPreferenceSelect.value }),
      }).then(function (data) {
        currencyPreferenceFeedback.classList.add("success");
        currencyPreferenceFeedback.textContent = data.message + ". New purchases will use " + data.currency + "; existing records keep their original currency.";
        if (user) {
          user.preferredCurrency = data.currency;
          localStorage.setItem("user", JSON.stringify(user));
        }
      }).catch(function (error) {
        currencyPreferenceFeedback.textContent = error.message;
      }).finally(function () {
        button.disabled = false;
        button.textContent = "Save currency";
      });
    });
  }

  var accountProfileForm = document.getElementById("accountProfileForm");
  if (accountProfileForm) {
    var accountPreferencesForm=document.getElementById("accountPreferencesForm");
    var accountPasswordForm=document.getElementById("accountPasswordForm");
    var settingsEmailPasswordWrap=document.getElementById("settingsEmailPasswordWrap");
    var settingsOriginalEmail="";
    function settingsDate(value){
      if(!value)return "Not available";
      try{return new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(new Date(value));}
      catch(_){return "Not available";}
    }
    function settingsBytes(value){
      var bytes=Number(value || 0);
      if(bytes<1024*1024)return (bytes/1024).toFixed(1)+" KB";
      if(bytes<1024*1024*1024)return (bytes/(1024*1024)).toFixed(1)+" MB";
      return (bytes/(1024*1024*1024)).toFixed(2)+" GB";
    }
    function settingsFeedback(id,message,isError){
      var node=document.getElementById(id);node.textContent=message || "";
      node.classList.toggle("is-error",Boolean(isError));node.classList.toggle("is-success",Boolean(message)&&!isError);
    }
    function settingsInitials(value){return String(value || "User").split(/\s+/).slice(0,2).map(function(part){return part.charAt(0);}).join("").toUpperCase();}
    function loadAccountSettings(){
      request("/user/account-settings").then(function(data){
        var account=data.account || {},preferences=data.preferences || {},subscription=data.subscription || {},security=data.security || {},storage=data.storage || {};
        accountProfileForm.elements.name.value=account.name || "";
        accountProfileForm.elements.email.value=account.email || "";
        accountProfileForm.elements.phone.value=account.phone || "";
        settingsOriginalEmail=String(account.email || "").toLowerCase();
        document.getElementById("settingsProfileInitials").textContent=settingsInitials(account.name);
        setText("settingsMemberSince",settingsDate(account.createdAt));setText("settingsLastLogin",settingsDate(account.lastLogin));
        setText("settingsPlanName",(subscription.name || "Free")+" plan");
        setText("settingsStorageSummary",settingsBytes(storage.usedBytes)+" of "+settingsBytes(storage.limitBytes)+" used");
        accountPreferencesForm.elements.currency.value=account.currency || "LKR";
        window.addEventListener("sync:currencies-ready",function(){accountPreferencesForm.elements.currency.value=account.currency || "LKR";},{once:true});
        var timeInput=accountPreferencesForm.querySelector('input[name="timeFormat"][value="'+(preferences.timeFormat || "12")+'"]');
        if(timeInput)timeInput.checked=true;
        localStorage.setItem("timeFormat",preferences.timeFormat || "12");
        accountPreferencesForm.elements.emailNotifications.checked=Boolean(preferences.emailNotifications);
        accountPreferencesForm.elements.browserNotifications.checked=Boolean(preferences.browserNotifications);
        accountPreferencesForm.elements.marketingEmails.checked=Boolean(preferences.marketingEmails);
        accountPreferencesForm.elements.contactCaptureRequired.checked=Boolean(preferences.contactCaptureRequired);
        setText("settingsActiveSessions",Number(security.active_sessions || 0));
      }).catch(function(error){settingsFeedback("accountProfileFeedback",error.message,true);});
    }
    function updateEmailPasswordVisibility(){
      var changed=accountProfileForm.elements.email.value.trim().toLowerCase()!==settingsOriginalEmail;
      settingsEmailPasswordWrap.hidden=!changed;accountProfileForm.elements.currentPassword.required=changed;
      if(!changed)accountProfileForm.elements.currentPassword.value="";
    }
    accountProfileForm.elements.email.addEventListener("input",updateEmailPasswordVisibility);
    accountProfileForm.addEventListener("submit",function(event){
      event.preventDefault();var button=accountProfileForm.querySelector('[type="submit"]');
      button.disabled=true;button.textContent="Saving…";settingsFeedback("accountProfileFeedback","Saving your profile…");
      request("/user/account-settings/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        name:accountProfileForm.elements.name.value.trim(),email:accountProfileForm.elements.email.value.trim(),
        phone:accountProfileForm.elements.phone.value.trim(),currentPassword:accountProfileForm.elements.currentPassword.value
      })}).then(function(data){
        settingsOriginalEmail=String(data.account.email || "").toLowerCase();updateEmailPasswordVisibility();
        document.getElementById("settingsProfileInitials").textContent=settingsInitials(data.account.name);
        document.querySelectorAll(".user-name").forEach(function(node){node.textContent=data.account.name;});
        user=Object.assign({},user || {},{name:data.account.name,email:data.account.email,phoneNumber:data.account.phone});
        localStorage.setItem("user",JSON.stringify(user));settingsFeedback("accountProfileFeedback",data.message);
      }).catch(function(error){settingsFeedback("accountProfileFeedback",error.message,true);})
        .finally(function(){button.disabled=false;button.textContent="Save profile";});
    });
    accountPreferencesForm.addEventListener("submit",function(event){
      event.preventDefault();var button=accountPreferencesForm.querySelector('[type="submit"]');
      button.disabled=true;button.textContent="Saving…";settingsFeedback("accountPreferencesFeedback","Saving preferences…");
      request("/user/account-settings/preferences",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        currency:accountPreferencesForm.elements.currency.value,
        timeFormat:accountPreferencesForm.elements.timeFormat.value,
        emailNotifications:accountPreferencesForm.elements.emailNotifications.checked,
        browserNotifications:accountPreferencesForm.elements.browserNotifications.checked,
        marketingEmails:accountPreferencesForm.elements.marketingEmails.checked,
        contactCaptureRequired:accountPreferencesForm.elements.contactCaptureRequired.checked
      })}).then(function(data){
        if(user){user.preferredCurrency=data.currency;localStorage.setItem("user",JSON.stringify(user));}
        localStorage.setItem("preferredCurrency",data.currency);localStorage.setItem("timeFormat",accountPreferencesForm.elements.timeFormat.value);
        window.dispatchEvent(new CustomEvent("sync:currency-change",{detail:{currency:data.currency}}));
        settingsFeedback("accountPreferencesFeedback",data.message);
      }).catch(function(error){settingsFeedback("accountPreferencesFeedback",error.message,true);})
        .finally(function(){button.disabled=false;button.textContent="Save preferences";});
    });
    accountPasswordForm.addEventListener("submit",function(event){
      event.preventDefault();var button=accountPasswordForm.querySelector('[type="submit"]');
      if(accountPasswordForm.elements.newPassword.value!==accountPasswordForm.elements.confirmPassword.value){
        settingsFeedback("accountPasswordFeedback","New passwords do not match.",true);return;
      }
      button.disabled=true;button.textContent="Updating…";settingsFeedback("accountPasswordFeedback","Updating your password…");
      request("/user/account-settings/password",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        currentPassword:accountPasswordForm.elements.currentPassword.value,newPassword:accountPasswordForm.elements.newPassword.value
      })}).then(function(data){accountPasswordForm.reset();setText("settingsActiveSessions","1");settingsFeedback("accountPasswordFeedback",data.message);})
        .catch(function(error){settingsFeedback("accountPasswordFeedback",error.message,true);})
        .finally(function(){button.disabled=false;button.textContent="Change password";});
    });
    loadAccountSettings();
  }

  var vcardFeatureGuides = {
    "business-hours": ["One day per line", "Monday | 9:00 AM - 5:00 PM"],
    services: ["One service per line: name | description. Add its photo below.", "Property valuation | Accurate local market valuation"],
    products: ["One product per line: name | price | description. Add its photo below.", "Modern family home | $350,000 | Three bedrooms with garden"],
    galleries: ["One caption per line, then upload the matching images below.", "Recent project"],
    "instagram-embed": ["One caption per line, then upload the matching images below.", "Behind the scenes"],
    blogs: ["One article per line: title | summary | image or article URL", "Buying your first home | Five useful steps | https://example.com/article"],
    testimonials: ["One review per line: quote | customer name | role. Add the customer photo below.", "Wonderful service from start to finish | Alex Morgan | Customer"],
    appointments: ["Title | duration in minutes; customers choose office or online", "Book a consultation | 30"],
    "social-links": ["One link per line: network name | full URL", "LinkedIn | https://linkedin.com/in/your-name"],
    "custom-links": ["One link per line: link name | full URL", "View my portfolio | https://example.com/portfolio"],
    banners: ["Add a title, then upload the banner image below.", "Summer offer"],
    iframes: ["Add a title and full content URL", "Watch my introduction | https://example.com/video"],
    "qrcode-customize": ["Add the destination or QR image URL", "https://example.com/contact"],
    advanced: ["Add each important detail on a new line", "Languages: English, Sinhala"],
    "privacy-policy": ["Add readable policy text, using a new line for each paragraph", "Your privacy policy"],
    "term-condition": ["Add readable terms, using a new line for each paragraph", "Your terms and conditions"],
    "manage-section": ["Add each extra detail on a new line", "Additional information"]
  };

  var vcardImageSections = new Set(["services", "products", "galleries", "instagram-embed", "testimonials", "banners"]);
  var vcardStoragePromise;

  function vcardSectionUpload(key) {
    if (!vcardImageSections.has(key)) return "";
    return '<div class="vcard-section-image-editor" data-section-image-editor="' + escapeHtml(key) + '">' +
      '<div class="vcard-section-upload-row"><label class="vcard-section-upload"><input type="file" accept="image/png,image/jpeg,image/webp" multiple><span>+ Upload images</span></label><small data-section-storage>PNG, JPG or WebP · 1 MB each</small></div>' +
      '<div class="vcard-section-image-list" aria-live="polite"></div></div>';
  }

  function vcardFeatureField(feature, savedValue, createMode) {
    var guide = vcardFeatureGuides[feature.key] || ["Add the content to show in this section", "Add section content"];
    var dataName = createMode ? "data-create-vcard-section" : "data-vcard-section";
    var idPrefix = createMode ? "create-vcard-section-" : "vcard-section-";
    return '<section class="vcard-feature-field"><label for="' + idPrefix + escapeHtml(feature.key) + '">' + escapeHtml(feature.label) + '</label>' +
      '<small class="vcard-feature-guide">' + escapeHtml(guide[0]) + '</small><textarea id="' + idPrefix + escapeHtml(feature.key) + '" ' + dataName + '="' + escapeHtml(feature.key) + '" rows="4" placeholder="' + escapeHtml(guide[1]) + '">' + escapeHtml(savedValue || "") + '</textarea>' + vcardSectionUpload(feature.key) + '</section>';
  }

  function sectionImageValue(value) {
    return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value) || /^https?:\/\//i.test(value) ? value : "";
  }

  function initializeVcardImageEditors(root) {
    if (!root) return;
    if (!vcardStoragePromise) vcardStoragePromise = request("/user/storage").catch(function () { return null; });
    vcardStoragePromise.then(function (storage) {
      if (!storage) return;
      var available = Number(storage.availableBytes || 0) / (1024 * 1024);
      root.querySelectorAll("[data-section-storage]").forEach(function (label) {
        label.textContent = "PNG, JPG or WebP · 1 MB each · " + available.toFixed(available < 10 ? 1 : 0) + " MB plan space available";
      });
    });
    root.querySelectorAll("[data-section-image-editor]").forEach(function (editor) {
      var textarea = editor.parentElement.querySelector("textarea");
      var input = editor.querySelector('input[type="file"]');
      var list = editor.querySelector(".vcard-section-image-list");
      if (!textarea || !input || textarea._sectionImageReady) return;
      var images = [];
      var cleanLines = String(textarea.value || "").split(/\r?\n/).map(function (line, index) {
        var values = line.split(/\s*\|\s*/);
        var candidate = sectionImageValue(values[values.length - 1] || "");
        if (candidate) { images[index] = candidate; values.pop(); }
        return values.join(" | ");
      });
      textarea.value = cleanLines.join("\n");
      textarea._sectionImages = images;
      textarea._sectionImageReady = true;

      function renderImages() {
        var lines = String(textarea.value || "").split(/\r?\n/);
        list.innerHTML = images.map(function (src, index) {
          if (!src) return "";
          return '<article><img src="' + escapeHtml(src) + '" alt=""><span>' + escapeHtml((lines[index] || "Image " + (index + 1)).split("|")[0].trim()) + '</span><button type="button" data-remove-section-image="' + index + '" aria-label="Remove image">×</button></article>';
        }).join("");
      }

      list.addEventListener("click", function (event) {
        var button = event.target.closest("[data-remove-section-image]");
        if (!button) return;
        images[Number(button.dataset.removeSectionImage)] = "";
        renderImages();
      });
      input.addEventListener("change", function () {
        var files = Array.from(input.files || []);
        var invalid = files.find(function (file) { return !/^image\/(?:png|jpeg|webp)$/i.test(file.type) || file.size > 1024 * 1024; });
        if (invalid) { window.alert("Choose PNG, JPG, or WebP images no larger than 1 MB each."); input.value = ""; return; }
        Promise.all(files.map(function (file) { return new Promise(function (resolve, reject) {
          var reader = new FileReader(); reader.onload = function () { resolve({ name: file.name, src: String(reader.result || "") }); }; reader.onerror = reject; reader.readAsDataURL(file);
        }); })).then(function (uploads) {
          var lines = String(textarea.value || "").split(/\r?\n/).filter(function (line) { return line.trim(); });
          uploads.forEach(function (upload) {
            var target = images.findIndex(function (image, index) { return !image && lines[index]; });
            if (target < 0) { target = lines.length; lines.push(upload.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")); }
            images[target] = upload.src;
          });
          textarea.value = lines.join("\n");
          input.value = "";
          renderImages();
        }).catch(function () { window.alert("One of the selected images could not be read."); });
      });
      renderImages();
    });
  }

  function collectVcardSections(form, selector) {
    var sections = {};
    form.querySelectorAll(selector).forEach(function (field) {
      var lines = String(field.value || "").split(/\r?\n/);
      var images = field._sectionImages || [];
      sections[field.getAttribute(selector.slice(1, -1).split("=")[0])] = lines.map(function (line, index) {
        return line.trim() && images[index] ? line.trim() + " | " + images[index] : line.trim();
      }).filter(Boolean).join("\n");
    });
    return sections;
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
    setText("metricQrScans", Number(metrics.qrScans || 0).toLocaleString());
    setText("vcardOverviewTotal", metrics.totalCards || 0);
    setText("vcardOverviewLive", metrics.activeCards || 0);
    setText("vcardOverviewPlan", plan.name || "Free");
    setText("vcardOverviewUsage", (metrics.totalCards || 0) + " / " + (plan.vcardLimit || 1));
    var overviewProgress = document.getElementById("vcardOverviewProgress");
    if (overviewProgress) overviewProgress.style.width = Math.min(100, (Number(metrics.totalCards || 0) / Math.max(1, Number(plan.vcardLimit || 1))) * 100) + "%";
    setText("planUsageLabel", (metrics.activeCards || 0) + " of " + (plan.vcardLimit || 1) + " cards used");
    if (!document.getElementById("billingPlansGrid")) {
      setText("billingPlanName", plan.name || "Free");
      setText("billingPlanDescription", (plan.name || "Free") + " subscription for your Sync E-Card workspace.");
      setText("billingPlanStatus", plan.status || "inactive");
      setText("billingRenewalDate", plan.endDate ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(plan.endDate)) : "No renewal");
      setText("billingCardLimit", plan.vcardLimit || 1);
    }
    var fill = document.getElementById("planUsageFill");
    if (fill) fill.style.width = Math.min(100, ((metrics.activeCards || 0) / Math.max(1, plan.vcardLimit || 1)) * 100) + "%";
    document.querySelectorAll(".user-plan").forEach(function (node) { node.textContent = (plan.name || "Free") + " plan"; });

    var cards = document.getElementById("dashboardCards");
    if (cards) cards.innerHTML = data.vcards && data.vcards.length ? data.vcards.slice(0, 4).map(function (card) {
      return '<a class="user-card-item" href="vcards.html"><span class="user-card-mark">' + escapeHtml((card.title || "C").charAt(0).toUpperCase()) + '</span><span class="user-card-copy"><strong>' + escapeHtml(card.title || "Untitled card") + '</strong><span>' + escapeHtml(card.email || card.phone || "Ready to complete") + '</span></span><span class="user-status ' + (card.is_active ? "" : "inactive") + '">' + (card.is_active ? "Live" : "Paused") + "</span></a>";
    }).join("") : '<div class="user-empty">No cards yet. Create your first digital card to get started.</div>';

    renderUserNotifications({ notifications: data.notifications || [], unreadCount: data.notificationUnreadCount || 0, enabled: data.notificationsEnabled !== false });

    var vcardTable = document.querySelector("#vcardListPanel .client-vcard-table-shell");
    if (vcardTable) {
      vcardTable.querySelectorAll(".client-vcard-row, .user-empty").forEach(function (row) { row.remove(); });
      if (data.vcards && data.vcards.length) {
        vcardTable.insertAdjacentHTML("beforeend", data.vcards.map(function (card) {
          var publicUrl = card.publicUrl || card.public_url || (card.slug ? (window.location.origin + "/vcard/" + encodeURIComponent(card.slug)) : "#");
           var templatePreviewUrl = card.template_preview_url || "";
           return '<article class="client-vcard-row vcard-library-card searchable-item" data-search="' + escapeHtml([card.title, card.email, card.phone, card.template_name].join(" ").toLowerCase()) + '">' +
             '<div class="vcard-library-cover">' + (templatePreviewUrl ? '<iframe src="' + escapeHtml(templatePreviewUrl) + '" title="' + escapeHtml(card.template_name || "VCard") + ' preview" loading="lazy" tabindex="-1"></iframe>' : '') + '<span class="vcard-library-template">' + escapeHtml(card.template_name || "VCard template") + '</span><span class="user-status ' + (card.is_active ? "" : "inactive") + '">' + (card.is_active ? "Live" : "Paused") + '</span></div>' +
            '<div class="vcard-library-body"><div class="client-vcard-name-cell"><div><a href="' + escapeHtml(publicUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(card.title || "Untitled card") + '</a><span>' + escapeHtml(card.description || "Your digital business card") + '</span></div></div>' +
            '<div class="vcard-library-meta"><span><small>Contact</small>' + escapeHtml(card.email || card.phone || "Not added") + '</span><span><small>Updated</small>' + escapeHtml(formatDate(card.updated_at)) + '</span><span><small>Public URL</small><a href="' + escapeHtml(publicUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(publicUrl.replace(/^https?:\/\//,"")) + '</a></span></div>' +
            '<div class="vcard-library-actions"><a class="vcard-open-link" href="' + escapeHtml(publicUrl) + '" target="_blank" rel="noopener noreferrer">View card <span>↗</span></a><div class="vcard-manage"><button class="vcard-manage-toggle" type="button" data-vcard-manage-toggle="' + card.id + '" aria-expanded="false">Manage <span>•••</span></button><div class="vcard-manage-menu" data-vcard-manage-menu="' + card.id + '" hidden><a href="edit-vcard.html?id=' + encodeURIComponent(card.id) + '"><span>✎</span><div><strong>Edit VCard</strong><small>Update details and design</small></div></a><a href="' + escapeHtml(publicUrl) + '" target="_blank" rel="noopener noreferrer"><span>↗</span><div><strong>Open public card</strong><small>View the published profile</small></div></a><button type="button" class="vcard-delete-action" data-delete-vcard="' + card.id + '" data-vcard-title="' + escapeHtml(card.title || "Untitled card") + '"><span>×</span><div><strong>Delete VCard</strong><small>Permanently remove this card</small></div></button></div></div></div></div></article>';
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
    initializeVcardImageEditors(createFeatureEditor);
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

  var storageCategoryList = document.getElementById("storageCategoryList");
  if (storageCategoryList) {
    var refreshStorageButton = document.getElementById("refreshStorage");
    function storageBytes(value) {
      var bytes=Number(value || 0);
      if(bytes<1024)return bytes+" B";
      if(bytes<1024*1024)return (bytes/1024).toFixed(bytes<10240?1:0)+" KB";
      if(bytes<1024*1024*1024)return (bytes/(1024*1024)).toFixed(bytes<10*1024*1024?2:1)+" MB";
      return (bytes/(1024*1024*1024)).toFixed(2)+" GB";
    }
    function renderStorage(data) {
      var percent=Math.max(0,Math.min(100,Number(data.percentage || 0)));
      setText("storagePlanName",(data.plan && data.plan.name || "Free")+" plan");
      setText("storagePercent",percent.toFixed(percent<1&&percent>0?2:0)+"%");
      setText("storageUsed",storageBytes(data.usedBytes));
      setText("storageLimit",storageBytes(data.limitBytes));
      setText("storageAvailable",storageBytes(data.availableBytes)+" available");
      var pie=document.getElementById("storagePie");
      pie.style.background="conic-gradient(#8467ff 0 "+percent+"%,#262a36 "+percent+"% 100%)";
      pie.setAttribute("aria-label",storageBytes(data.usedBytes)+" used out of "+storageBytes(data.limitBytes));
      document.getElementById("storageProgress").style.width=percent+"%";
      storageCategoryList.innerHTML=(data.categories || []).map(function(category){
        var categoryPercent=data.limitBytes?Math.min(100,Number(category.bytes || 0)/Number(data.limitBytes)*100):0;
        return '<div class="storage-live-category"><div><span class="storage-category-icon">'+escapeHtml(category.label.charAt(0))+'</span><strong>'+escapeHtml(category.label)+'</strong></div><div class="storage-category-value"><strong>'+escapeHtml(storageBytes(category.bytes))+'</strong><span>'+categoryPercent.toFixed(categoryPercent<1&&categoryPercent>0?2:1)+'%</span></div><div class="storage-category-track"><i style="width:'+categoryPercent+'%"></i></div></div>';
      }).join("") || '<div class="storage-live-empty">No stored content is using your allocation yet.</div>';
      document.getElementById("storageLimitWarning").hidden=percent<100;
    }
    function loadStorage() {
      if(refreshStorageButton){refreshStorageButton.disabled=true;refreshStorageButton.textContent="Refreshing…";}
      return request("/user/storage").then(renderStorage).catch(function(error){
        storageCategoryList.innerHTML='<div class="storage-live-empty is-error">'+escapeHtml(error.message)+'</div>';
      }).finally(function(){if(refreshStorageButton){refreshStorageButton.disabled=false;refreshStorageButton.textContent="Refresh";}});
    }
    if(refreshStorageButton)refreshStorageButton.addEventListener("click",loadStorage);
    loadStorage();
  }

  var virtualNfcCatalog = document.getElementById("virtualNfcCatalog");
  if (virtualNfcCatalog && document.getElementById("virtualNfcOrderLink")) {
    var virtualNfcProducts = [];
    var virtualNfcSelected = null;
    var virtualNfcSide = "front";
    var virtualNfcCurrency = "LKR";
    var virtualNfcRefresh = document.getElementById("refreshVirtualNfc");
    var virtualNfcCardShell = document.getElementById("virtualNfcCardShell");
    var virtualNfcFrontImage = document.getElementById("virtualNfcFrontImage");
    var virtualNfcBackImage = document.getElementById("virtualNfcBackImage");
    var virtualNfcOrderLink = document.getElementById("virtualNfcOrderLink");
    var virtualNfcVcards = [];
    var virtualNfcVcardSelect = document.getElementById("virtualNfcVcard");
    var virtualNfcDetailInputs = {
      name: document.getElementById("virtualNfcDetailName"),
      role: document.getElementById("virtualNfcDetailRole"),
      phone: document.getElementById("virtualNfcDetailPhone"),
      email: document.getElementById("virtualNfcDetailEmail"),
      website: document.getElementById("virtualNfcDetailWebsite"),
      address: document.getElementById("virtualNfcDetailAddress")
    };

    function virtualNfcMoney(value) {
      try { return new Intl.NumberFormat(undefined, { style: "currency", currency: virtualNfcCurrency }).format(Number(value || 0)); }
      catch (_) { return virtualNfcCurrency + " " + Number(value || 0).toFixed(2); }
    }
    function updateVirtualNfcOrderLink() {
      if (!virtualNfcSelected) return;
      var link = "my-nfc-cards.html?product=" + encodeURIComponent(virtualNfcSelected.id);
      if (virtualNfcVcardSelect.value) link += "&vcard=" + encodeURIComponent(virtualNfcVcardSelect.value);
      virtualNfcOrderLink.href = link;
    }
    function updateVirtualNfcDetails() {
      setText("virtualNfcCardName", virtualNfcDetailInputs.name.value.trim() || "Your name");
      setText("virtualNfcCardBackName", virtualNfcDetailInputs.name.value.trim() || "Your name");
      setText("virtualNfcCardRole", virtualNfcDetailInputs.role.value.trim() || "Your role");
      setText("virtualNfcCardPhone", virtualNfcDetailInputs.phone.value.trim() || "Add your phone");
      setText("virtualNfcCardEmail", virtualNfcDetailInputs.email.value.trim() || "Add your email");
      setText("virtualNfcCardWebsite", virtualNfcDetailInputs.website.value.trim() || "Add your website");
      setText("virtualNfcCardAddress", virtualNfcDetailInputs.address.value.trim() || "Add your address");
    }
    function selectVirtualNfcVcard(vcardId) {
      var vcard = virtualNfcVcards.find(function (item) { return Number(item.id) === Number(vcardId); });
      if (vcard) {
        virtualNfcDetailInputs.name.value = vcard.title || "";
        virtualNfcDetailInputs.role.value = vcard.role || "";
        virtualNfcDetailInputs.phone.value = vcard.phone || "";
        virtualNfcDetailInputs.email.value = vcard.email || "";
        virtualNfcDetailInputs.website.value = vcard.websiteUrl || "";
        virtualNfcDetailInputs.address.value = vcard.address || "";
      }
      updateVirtualNfcDetails();
      updateVirtualNfcOrderLink();
    }
    function setVirtualNfcSide(side) {
      virtualNfcSide = side === "back" ? "back" : "front";
      virtualNfcCardShell.classList.toggle("is-flipped", virtualNfcSide === "back");
      setText("virtualNfcSideLabel", virtualNfcSide === "back" ? "Back artwork" : "Front artwork");
      document.querySelectorAll("[data-virtual-nfc-side]").forEach(function (button) {
        var active = button.dataset.virtualNfcSide === virtualNfcSide;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    function selectVirtualNfcProduct(productId) {
      var product = virtualNfcProducts.find(function (item) { return Number(item.id) === Number(productId); });
      if (!product) return;
      virtualNfcSelected = product;
      virtualNfcCatalog.querySelectorAll("[data-virtual-nfc-product]").forEach(function (button) {
        var active = Number(button.dataset.virtualNfcProduct) === Number(product.id);
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      virtualNfcFrontImage.src = product.frontImage || product.backImage || "";
      virtualNfcBackImage.src = product.backImage || product.frontImage || "";
      virtualNfcFrontImage.alt = product.name + " front artwork";
      virtualNfcBackImage.alt = product.name + " back artwork";
      setText("virtualNfcCategory", product.category || "NFC card");
      setText("virtualNfcName", product.name);
      setText("virtualNfcDescription", product.description || "Premium contactless business card ready to connect with your VCard.");
      setText("virtualNfcPrice", virtualNfcMoney(product.price));
      updateVirtualNfcOrderLink();
      virtualNfcOrderLink.classList.remove("is-disabled");
      virtualNfcOrderLink.removeAttribute("aria-disabled");
      setVirtualNfcSide("front");
    }
    function renderVirtualNfc(data) {
      virtualNfcProducts = data.products || [];
      virtualNfcVcards = data.vcards || [];
      virtualNfcCurrency = data.currency || "LKR";
      virtualNfcVcardSelect.innerHTML = '<option value="">Enter details manually</option>' + virtualNfcVcards.map(function (vcard) {
        return '<option value="' + vcard.id + '">' + escapeHtml(vcard.title) + '</option>';
      }).join("");
      var requestedVcardId = Number(new URLSearchParams(window.location.search).get("vcard"));
      var initialVcard = virtualNfcVcards.find(function (item) { return Number(item.id) === requestedVcardId; }) || virtualNfcVcards[0];
      if (initialVcard) {
        virtualNfcVcardSelect.value = String(initialVcard.id);
        selectVirtualNfcVcard(initialVcard.id);
      } else {
        updateVirtualNfcDetails();
      }
      setText("virtualNfcCount", virtualNfcProducts.length);
      if (!virtualNfcProducts.length) {
        virtualNfcCatalog.innerHTML = '<div class="virtual-nfc-empty"><strong>No designs available</strong><span>Active NFC products published by Super Admin will appear here.</span></div>';
        virtualNfcCardShell.classList.add("is-empty");
        virtualNfcOrderLink.classList.add("is-disabled");
        virtualNfcOrderLink.setAttribute("aria-disabled", "true");
        return;
      }
      virtualNfcCardShell.classList.remove("is-empty");
      virtualNfcCatalog.innerHTML = virtualNfcProducts.map(function (product) {
        return '<button class="virtual-nfc-catalog-card searchable-item" type="button" data-virtual-nfc-product="' + product.id + '" data-search="' + escapeHtml([product.name, product.category, product.description].join(" ").toLowerCase()) + '" aria-pressed="false">' +
          '<span class="virtual-nfc-catalog-image"><img src="' + escapeHtml(product.frontImage || product.backImage || "") + '" alt="" /></span>' +
          '<span class="virtual-nfc-catalog-copy"><small>' + escapeHtml(product.category || "NFC card") + '</small><strong>' + escapeHtml(product.name) + '</strong><em>' + escapeHtml(virtualNfcMoney(product.price)) + '</em></span><i>›</i></button>';
      }).join("");
      var requestedId = Number(new URLSearchParams(window.location.search).get("product"));
      var initialProduct = virtualNfcProducts.find(function (item) { return Number(item.id) === requestedId; }) || virtualNfcProducts[0];
      selectVirtualNfcProduct(initialProduct.id);
    }
    function loadVirtualNfc() {
      if (virtualNfcRefresh) { virtualNfcRefresh.disabled = true; virtualNfcRefresh.classList.add("is-loading"); }
      return request("/user/nfc").then(renderVirtualNfc).catch(function (error) {
        virtualNfcCatalog.innerHTML = '<div class="virtual-nfc-empty is-error"><strong>Unable to load designs</strong><span>' + escapeHtml(error.message) + '</span></div>';
      }).finally(function () {
        if (virtualNfcRefresh) { virtualNfcRefresh.disabled = false; virtualNfcRefresh.classList.remove("is-loading"); }
      });
    }
    virtualNfcCatalog.addEventListener("click", function (event) {
      var button = event.target.closest("[data-virtual-nfc-product]");
      if (button) selectVirtualNfcProduct(button.dataset.virtualNfcProduct);
    });
    document.querySelectorAll("[data-virtual-nfc-side]").forEach(function (button) {
      button.addEventListener("click", function () { setVirtualNfcSide(button.dataset.virtualNfcSide); });
    });
    document.getElementById("virtualNfcFlip").addEventListener("click", function () {
      setVirtualNfcSide(virtualNfcSide === "front" ? "back" : "front");
    });
    if (virtualNfcRefresh) virtualNfcRefresh.addEventListener("click", loadVirtualNfc);
    virtualNfcVcardSelect.addEventListener("change", function () { selectVirtualNfcVcard(virtualNfcVcardSelect.value); });
    Object.keys(virtualNfcDetailInputs).forEach(function (key) {
      virtualNfcDetailInputs[key].addEventListener("input", updateVirtualNfcDetails);
    });
    virtualNfcOrderLink.addEventListener("click", function (event) {
      if (!virtualNfcSelected) event.preventDefault();
    });
    loadVirtualNfc();
  }

  var virtualNfcBuilderForm = document.getElementById("virtualNfcBuilderForm");
  if (virtualNfcBuilderForm) {
    var builderCatalog = document.getElementById("virtualNfcCatalog");
    var builderDesigns = [];
    var builderVcards = [];
    var builderSelectedId = null;
    var builderSide = "front";
    var builderImages = { front: "", back: "", logo: "" };
    var builderCardShell = document.getElementById("virtualNfcCardShell");
    var builderVcardSelect = document.getElementById("virtualNfcVcard");
    var builderFeedback = document.getElementById("virtualNfcFeedback");
    var builderDelete = document.getElementById("deleteVirtualNfc");
    var builderSave = document.getElementById("saveVirtualNfc");
    var builderTextColor = document.getElementById("virtualNfcTextColor");
    var builderTextPosition = document.getElementById("virtualNfcTextPosition");
    var builderInputs = {
      name:document.getElementById("virtualNfcDetailName"),role:document.getElementById("virtualNfcDetailRole"),
      phone:document.getElementById("virtualNfcDetailPhone"),email:document.getElementById("virtualNfcDetailEmail"),
      website:document.getElementById("virtualNfcDetailWebsite"),address:document.getElementById("virtualNfcDetailAddress")
    };
    function builderSetFeedback(message,isError) {
      builderFeedback.textContent=message || "";
      builderFeedback.classList.toggle("is-error",Boolean(isError));
      builderFeedback.classList.toggle("is-success",Boolean(message) && !isError);
    }
    function builderSetSide(side) {
      builderSide=side==="back"?"back":"front";
      builderCardShell.classList.toggle("is-flipped",builderSide==="back");
      setText("virtualNfcSideLabel",builderSide==="back"?"Back preview":"Front preview");
      document.querySelectorAll("[data-virtual-nfc-side]").forEach(function(button){
        var active=button.dataset.virtualNfcSide===builderSide;
        button.classList.toggle("is-active",active);button.setAttribute("aria-pressed",active?"true":"false");
      });
    }
    function builderRenderDetails() {
      setText("virtualNfcCardName",builderInputs.name.value.trim() || "Your name");
      setText("virtualNfcCardBackName",builderInputs.name.value.trim() || "Your name");
      setText("virtualNfcCardRole",builderInputs.role.value.trim() || "Your role");
      setText("virtualNfcCardPhone",builderInputs.phone.value.trim() || "Add your phone");
      setText("virtualNfcCardEmail",builderInputs.email.value.trim() || "Add your email");
      setText("virtualNfcCardWebsite",builderInputs.website.value.trim() || "Add your website");
      setText("virtualNfcCardAddress",builderInputs.address.value.trim() || "Add your address");
      builderCardShell.style.setProperty("--virtual-nfc-text-color",builderTextColor.value || "#ffffff");
      builderCardShell.classList.remove("text-top-left","text-top-center","text-top-right",
        "text-middle-left","text-middle-center","text-middle-right",
        "text-bottom-left","text-bottom-center","text-bottom-right");
      builderCardShell.classList.add("text-"+(builderTextPosition.value || "bottom-left"));
    }
    function builderRenderImages() {
      var front=document.getElementById("virtualNfcFrontImage"),back=document.getElementById("virtualNfcBackImage");
      var frontLogo=document.getElementById("virtualNfcFrontLogo"),backLogo=document.getElementById("virtualNfcBackLogo");
      front.src=builderImages.front || "";back.src=builderImages.back || "";
      front.hidden=!builderImages.front;back.hidden=!builderImages.back;
      frontLogo.src=builderImages.logo || "";backLogo.src=builderImages.logo || "";
      frontLogo.hidden=!builderImages.logo;backLogo.hidden=!builderImages.logo;
      builderCardShell.classList.toggle("is-empty",!builderImages.front && !builderImages.back);
    }
    function builderApplyVcard(vcardId) {
      var card=builderVcards.find(function(item){return Number(item.id)===Number(vcardId);});
      if(!card)return;
      builderInputs.name.value=card.title || "";builderInputs.role.value=card.role || "";
      builderInputs.phone.value=card.phone || "";builderInputs.email.value=card.email || "";
      builderInputs.website.value=card.websiteUrl || "";builderInputs.address.value=card.address || "";
      builderRenderDetails();
    }
    function builderNew() {
      builderSelectedId=null;virtualNfcBuilderForm.reset();builderImages={front:"",back:"",logo:""};
      builderTextColor.value="#ffffff";builderTextPosition.value="bottom-left";
      builderRenderImages();builderRenderDetails();builderSetSide("front");builderDelete.hidden=true;
      setText("virtualNfcSaveStatus","New unsaved preview");builderSetFeedback("");
      builderCatalog.querySelectorAll("[data-builder-design]").forEach(function(item){item.classList.remove("is-active");});
    }
    function builderOpen(designId) {
      var design=builderDesigns.find(function(item){return Number(item.id)===Number(designId);});
      if(!design)return;
      builderSelectedId=design.id;document.getElementById("virtualNfcDesignName").value=design.name || "";
      builderVcardSelect.value=design.vcardId ? String(design.vcardId) : "";
      Object.keys(builderInputs).forEach(function(key){builderInputs[key].value=(design.details && design.details[key]) || "";});
      builderTextColor.value=(design.details && design.details.textColor) || "#ffffff";
      builderTextPosition.value=(design.details && design.details.position) || "bottom-left";
      builderImages={front:design.frontImage || "",back:design.backImage || "",logo:design.logoImage || ""};
      builderRenderImages();builderRenderDetails();builderSetSide("front");builderDelete.hidden=false;
      setText("virtualNfcSaveStatus","Editing saved preview");
      setText("virtualNfcFrontFileName","Front background saved");setText("virtualNfcBackFileName","Back background saved");
      setText("virtualNfcLogoFileName",builderImages.logo?"Logo saved":"Optional transparent logo");
      builderCatalog.querySelectorAll("[data-builder-design]").forEach(function(item){item.classList.toggle("is-active",Number(item.dataset.builderDesign)===Number(design.id));});
      builderSetFeedback("");
    }
    function builderRenderLibrary(data) {
      builderDesigns=data.designs || [];builderVcards=data.vcards || [];setText("virtualNfcCount",builderDesigns.length);
      builderVcardSelect.innerHTML='<option value="">Enter details manually</option>'+builderVcards.map(function(card){return '<option value="'+card.id+'">'+escapeHtml(card.title)+'</option>';}).join("");
      builderCatalog.innerHTML=builderDesigns.length?builderDesigns.map(function(design){
        return '<button class="virtual-nfc-catalog-card" type="button" data-builder-design="'+design.id+'"><span class="virtual-nfc-catalog-image"><img src="'+escapeHtml(design.frontImage)+'" alt="" /></span><span class="virtual-nfc-catalog-copy"><small>Custom preview</small><strong>'+escapeHtml(design.name)+'</strong><em>'+escapeHtml(formatDate(design.updatedAt))+'</em></span><i>›</i></button>';
      }).join(""):'<div class="virtual-nfc-empty"><strong>No saved previews</strong><span>Upload your own backgrounds and save your first NFC mockup.</span></div>';
      if(builderSelectedId && builderDesigns.some(function(item){return Number(item.id)===Number(builderSelectedId);})){builderOpen(builderSelectedId);}
    }
    function builderLoad() {
      return request("/user/virtual-nfc-designs").then(builderRenderLibrary).catch(function(error){
        builderCatalog.innerHTML='<div class="virtual-nfc-empty is-error"><strong>Unable to load previews</strong><span>'+escapeHtml(error.message)+'</span></div>';
      });
    }
    function builderReadFile(input,key,labelId) {
      var file=input.files && input.files[0];if(!file)return;
      if(!/^image\/(png|jpeg|webp)$/.test(file.type)){builderSetFeedback("Choose a PNG, JPG, or WebP image.",true);input.value="";return;}
      if(file.size>1572864){builderSetFeedback("Each image must be smaller than 1.5 MB.",true);input.value="";return;}
      var reader=new FileReader();
      reader.onload=function(){builderImages[key]=String(reader.result || "");setText(labelId,file.name);builderRenderImages();builderSetFeedback("");};
      reader.onerror=function(){builderSetFeedback("Unable to read that image.",true);};reader.readAsDataURL(file);
    }
    document.getElementById("virtualNfcFrontFile").addEventListener("change",function(){builderReadFile(this,"front","virtualNfcFrontFileName");});
    document.getElementById("virtualNfcBackFile").addEventListener("change",function(){builderReadFile(this,"back","virtualNfcBackFileName");});
    document.getElementById("virtualNfcLogoFile").addEventListener("change",function(){builderReadFile(this,"logo","virtualNfcLogoFileName");});
    Object.keys(builderInputs).forEach(function(key){builderInputs[key].addEventListener("input",builderRenderDetails);});
    builderTextColor.addEventListener("input",builderRenderDetails);
    builderTextPosition.addEventListener("change",builderRenderDetails);
    builderVcardSelect.addEventListener("change",function(){builderApplyVcard(this.value);});
    document.querySelectorAll("[data-virtual-nfc-side]").forEach(function(button){button.addEventListener("click",function(){builderSetSide(button.dataset.virtualNfcSide);});});
    document.getElementById("virtualNfcFlip").addEventListener("click",function(){builderSetSide(builderSide==="front"?"back":"front");});
    document.getElementById("newVirtualNfc").addEventListener("click",builderNew);
    document.getElementById("resetVirtualNfc").addEventListener("click",function(){if(builderSelectedId)builderOpen(builderSelectedId);else builderNew();});
    builderCatalog.addEventListener("click",function(event){var button=event.target.closest("[data-builder-design]");if(button)builderOpen(button.dataset.builderDesign);});
    virtualNfcBuilderForm.addEventListener("submit",function(event){
      event.preventDefault();if(!builderImages.front || !builderImages.back){builderSetFeedback("Upload both front and back background images.",true);return;}
      var payload={name:document.getElementById("virtualNfcDesignName").value.trim(),vcardId:builderVcardSelect.value || null,
        frontImage:builderImages.front,backImage:builderImages.back,logoImage:builderImages.logo,details:{}};
      Object.keys(builderInputs).forEach(function(key){payload.details[key]=builderInputs[key].value.trim();});
      payload.details.textColor=builderTextColor.value;payload.details.position=builderTextPosition.value;
      builderSave.disabled=true;builderSave.textContent="Saving…";builderSetFeedback("Saving your preview…");
      request("/user/virtual-nfc-designs"+(builderSelectedId?"/"+builderSelectedId:""),{method:builderSelectedId?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
        .then(function(data){builderSelectedId=data.design.id;builderSetFeedback(data.message);return builderLoad();})
        .catch(function(error){builderSetFeedback(error.message,true);})
        .finally(function(){builderSave.disabled=false;builderSave.textContent="Save preview";});
    });
    builderDelete.addEventListener("click",function(){
      if(!builderSelectedId || !window.confirm("Delete this saved NFC preview?"))return;
      builderDelete.disabled=true;request("/user/virtual-nfc-designs/"+builderSelectedId,{method:"DELETE"})
        .then(function(data){builderNew();builderSetFeedback(data.message);return builderLoad();})
        .catch(function(error){builderSetFeedback(error.message,true);})
        .finally(function(){builderDelete.disabled=false;});
    });
    builderNew();builderLoad();
  }

  var liveNfcOrderForm = document.querySelector("[data-live-nfc-order]");
  if (liveNfcOrderForm) {
    var liveNfcData = { products: [], orders: [], vcards: [], currency: "LKR" };
    var requestedNfcProductId = Number(new URLSearchParams(window.location.search).get("product"));
    var requestedNfcVcardId = Number(new URLSearchParams(window.location.search).get("vcard"));
    var requestedNfcProductApplied = false;
    var liveNfcProductSelect = document.getElementById("nfcCardType");
    var liveNfcQuantity = document.getElementById("nfcQuantity");
    var refreshNfcOrdersButton = document.getElementById("refreshNfcOrders");
    var refreshNfcOrdersLabel = refreshNfcOrdersButton ? refreshNfcOrdersButton.querySelector("span") : null;
    var liveNfcLoading = null;
    function nfcMoney(value, currency) {
      var code=currency || liveNfcData.currency || "LKR";
      try { return new Intl.NumberFormat(undefined, { style:"currency", currency:code }).format(Number(value || 0)); }
      catch (_) { return code + " " + Number(value || 0).toFixed(2); }
    }
    function nfcBadge(status) { return '<span class="nfc-live-badge is-' + escapeHtml(status || "pending") + '">' + escapeHtml(String(status || "pending").replace(/_/g," ")) + '</span>'; }
    function nfcTracking(order) {
      if (!order.trackingNumber) return '<span class="nfc-tracking-pending"><i></i>Awaiting dispatch</span>';
      return '<button class="nfc-client-tracking" type="button" data-copy-text="' + escapeHtml(order.trackingNumber) + '" title="Copy tracking number"><span>Tracking number</span><strong>' + escapeHtml(order.trackingNumber) + '</strong><small>Click to copy</small></button>';
    }
    function updateLiveNfcTotal() {
      var product = liveNfcData.products.find(function(item){return Number(item.id)===Number(liveNfcProductSelect.value);});
      var country=String(document.getElementById("nfcDestinationCountry").value || "LK").trim().toUpperCase();
      var domestic=country==="LK";
      var configured=domestic ? Boolean(liveNfcData.domesticShippingConfigured) : Boolean(liveNfcData.internationalShippingConfigured);
      var shipping=domestic ? Number(liveNfcData.domesticShipping || 0) : Number(liveNfcData.internationalShipping || 0);
      var subtotal=(product ? product.price : 0) * Math.max(1,Number(liveNfcQuantity.value || 1));
      var submit=liveNfcOrderForm.querySelector('[type="submit"]');
      setText("nfcDeliveryFee", configured ? nfcMoney(shipping) : "Not configured");
      setText("nfcDeliveryFeeHelp", configured ? (domestic ? "Sri Lanka delivery rate set by super admin." : "International delivery rate set by super admin.") : "A super admin must set this delivery rate before an order can be submitted.");
      setText("nfcOrderTotal", configured ? nfcMoney(subtotal + shipping) : "Awaiting delivery fee");
      setText("nfcOrderTotalCopy", configured ? "Cards " + nfcMoney(subtotal) + " + delivery " + nfcMoney(shipping) : "Card subtotal calculated; delivery fee is required");
      if(submit){submit.disabled=!configured;submit.title=configured?"":"Delivery fee is not configured";}
    }
    function renderLiveNfc(data) {
      liveNfcData = data;
      var products = data.products || [], orders = data.orders || [], vcards = data.vcards || [];
      var grid = document.getElementById("nfcUserProductGrid");
      grid.innerHTML = products.length ? products.map(function(product){return '<article class="nfc-user-product-card"><div class="nfc-user-product-visual"><img src="' + escapeHtml(product.frontImage) + '" alt="' + escapeHtml(product.name) + '" /><span>' + escapeHtml(product.category) + '</span></div><div class="nfc-user-product-copy"><small>Sync NFC collection</small><h3>' + escapeHtml(product.name) + '</h3><p>' + escapeHtml(product.description || "Premium contactless business card.") + '</p><div><strong>' + escapeHtml(nfcMoney(product.price)) + '</strong><button type="button" data-user-nfc-product="' + product.id + '">Order this card</button></div></div></article>';}).join("") : '<div class="nfc-user-loading">No NFC card products are available right now.</div>';
      setText("nfcCatalogCount", products.length + " design" + (products.length===1?"":"s"));
      if(data.rateDate && data.currency!=="LKR")setText("nfcOrderFeedback","Prices converted from LKR using the reference rate dated "+data.rateDate+". The submitted total will be saved with that rate.");
      liveNfcProductSelect.innerHTML = '<option value="">Select a card design</option>' + products.map(function(item){return '<option value="' + item.id + '">' + escapeHtml(item.name) + ' — ' + escapeHtml(nfcMoney(item.price)) + '</option>';}).join("");
      if (!requestedNfcProductApplied && requestedNfcProductId && products.some(function (item) { return Number(item.id) === requestedNfcProductId; })) {
        liveNfcProductSelect.value = String(requestedNfcProductId);
        requestedNfcProductApplied = true;
        var requestedNfcOrderButton = document.getElementById("openNfcOrderModal");
        if (requestedNfcOrderButton) window.setTimeout(function () { requestedNfcOrderButton.click(); }, 0);
      }
      document.getElementById("nfcVCard").innerHTML = '<option value="">Select the VCard people will open</option>' + vcards.map(function(item){return '<option value="' + item.id + '">' + escapeHtml(item.title) + '</option>';}).join("");
      if (requestedNfcVcardId && vcards.some(function (item) { return Number(item.id) === requestedNfcVcardId; })) {
        document.getElementById("nfcVCard").value = String(requestedNfcVcardId);
      }
      setText("nfcBankName",data.bankDetails.bankName || "Not configured");setText("nfcBankAccountName",data.bankDetails.accountName || "Not configured");setText("nfcBankAccountNumber",data.bankDetails.accountNumber || "Not configured");setText("nfcBankBranch",data.bankDetails.branch || "Not configured");
      setText("nfcMetricOrders",orders.length);setText("nfcMetricPending",orders.filter(function(item){return item.paymentStatus==="pending";}).length);setText("nfcMetricProduction",orders.filter(function(item){return ["processing","shipped"].includes(item.status);}).length);setText("nfcMetricDelivered",orders.filter(function(item){return item.status==="completed";}).length);
      var body=document.getElementById("nfcCardsTableBody");
      body.innerHTML=orders.length?orders.map(function(order){var search=[order.id,order.productName,order.vcardTitle,order.paymentStatus,order.status,order.transactionNumber,order.trackingNumber].join(" ").toLowerCase();return '<tr class="nfc-card-row" data-search="' + escapeHtml(search) + '"><td data-label="Order"><strong class="nfc-order-id">#' + order.id + '</strong><small class="nfc-order-ref">' + escapeHtml(order.transactionNumber || "No reference") + '</small></td><td data-label="Card / VCard"><div class="nfc-order-product">' + (order.productImage?'<img src="' + escapeHtml(order.productImage) + '" alt="" />':'<span>NFC</span>') + '<div><strong>' + escapeHtml(order.productName) + '</strong><small>' + escapeHtml(order.vcardTitle || "VCard not linked") + '</small></div></div></td><td data-label="Qty"><span class="nfc-client-quantity">' + order.quantity + '</span></td><td data-label="Total"><strong class="nfc-client-total">' + escapeHtml(nfcMoney(order.amount,order.currency)) + '</strong>' + (Number(order.shippingCost)>0?'<small class="nfc-order-ref">Includes '+escapeHtml(nfcMoney(order.shippingCost,order.currency))+' shipping</small>':'') + '</td><td data-label="Payment">' + nfcBadge(order.paymentStatus) + (order.adminNote?'<small class="nfc-admin-note">' + escapeHtml(order.adminNote) + '</small>':'') + '</td><td data-label="Fulfilment">' + nfcBadge(order.status) + '</td><td data-label="Tracking">' + nfcTracking(order) + '</td><td data-label="Ordered"><span class="nfc-client-date">' + escapeHtml(formatDate(order.orderedAt)) + '</span></td></tr>';}).join(""):'<tr><td colspan="8" class="light-empty-cell">No NFC orders yet. Choose a card above to begin.</td></tr>';
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
    liveNfcProductSelect.addEventListener("change",updateLiveNfcTotal);liveNfcQuantity.addEventListener("input",updateLiveNfcTotal);document.getElementById("nfcDestinationCountry").addEventListener("input",updateLiveNfcTotal);
    liveNfcOrderForm.addEventListener("reset",function(){window.setTimeout(updateLiveNfcTotal,0);});
    document.addEventListener("click",function(event){var button=event.target.closest("[data-user-nfc-product]");if(!button)return;liveNfcProductSelect.value=button.dataset.userNfcProduct;updateLiveNfcTotal();document.getElementById("openNfcOrderModal").click();});
    liveNfcOrderForm.addEventListener("submit",function(event){event.preventDefault();var submit=liveNfcOrderForm.querySelector('[type="submit"]'),feedback=document.getElementById("nfcOrderFeedback");submit.disabled=true;submit.textContent="Uploading payment...";feedback.textContent="Submitting your order securely...";request("/user/nfc/orders",{method:"POST",body:new FormData(liveNfcOrderForm)}).then(function(data){feedback.textContent=data.message;liveNfcOrderForm.reset();updateLiveNfcTotal();return loadLiveNfc();}).then(function(){setTimeout(function(){document.getElementById("closeNfcOrderModal").click();},800);}).catch(function(error){feedback.textContent=error.message;}).finally(function(){submit.textContent="Submit payment & order";updateLiveNfcTotal();});});
  }

  var billingPlansGrid = document.getElementById("billingPlansGrid");
  if (billingPlansGrid) {
    var billingFeedback = document.getElementById("billingPlanFeedback");
    var paymentModal = document.getElementById("manualPaymentModal");
    var paymentForm = document.getElementById("manualPaymentForm");
    var paymentFeedback = document.getElementById("manualPaymentFeedback");
    var couponInput = document.getElementById("paymentCouponCode");
    var couponButton = document.getElementById("applyPaymentCoupon");
    var couponRemoveButton = document.getElementById("removePaymentCoupon");
    var couponResult = document.getElementById("paymentCouponResult");
    var couponFeedback = document.getElementById("paymentCouponFeedback");
    var availableOfferList = document.getElementById("paymentAvailableOfferList");
    var refreshBillingButton = document.getElementById("refreshBilling");
    var refreshBillingLabel = document.getElementById("refreshBillingLabel");
    var billingData = null;
    var selectedPaymentPlan = null;
    var couponPreview = null;
    var billingLoading = null;
    function billingMoney(value, currency) {
      try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(Number(value || 0)); }
      catch (_) { return (currency || "USD") + " " + Number(value || 0).toFixed(2); }
    }
    function closePaymentModal() { if (paymentModal) paymentModal.hidden = true; }
    function setCouponPaymentRequirements(isFree) {
      var transactionInput = paymentForm.elements.transactionNumber;
      var slipInput = paymentForm.elements.slip;
      var bankDetails = document.getElementById("manualBankDetails");
      var paymentIntro = document.getElementById("manualPaymentIntro");
      transactionInput.required = !isFree;
      slipInput.required = !isFree;
      transactionInput.closest("label").hidden = isFree;
      slipInput.closest("label").hidden = isFree;
      bankDetails.hidden = isFree;
      paymentIntro.innerHTML = isFree
        ? "Your coupon covers the full plan price. Submit below to activate the plan immediately."
        : 'Transfer <strong id="paymentPlanAmount">—</strong> to the account below, then enter the bank transaction number and upload your receipt.';
    }
    function clearPaymentCoupon(clearInput) {
      couponPreview = null;
      couponResult.hidden = true;
      couponFeedback.textContent = "";
      couponFeedback.className = "billing-plan-feedback";
      if (clearInput) couponInput.value = "";
      setCouponPaymentRequirements(false);
      if (selectedPaymentPlan) setText("paymentPlanAmount", billingMoney(selectedPaymentPlan.price, billingData.currency));
    }
    function loadAvailableCoupons(plan) {
      if (!availableOfferList) return Promise.resolve();
      availableOfferList.innerHTML = '<small class="checkout-offer-state">Checking eligible offers...</small>';
      return request("/user/coupons/available?planId=" + encodeURIComponent(plan.id)).then(function (data) {
        var offers = Array.isArray(data.coupons) ? data.coupons : [];
        if (!offers.length) {
          availableOfferList.innerHTML = '<small class="checkout-offer-state">No public offers are available for this plan. You can still enter a private code.</small>';
          return;
        }
        availableOfferList.innerHTML = offers.map(function (offer) {
          var expiry = offer.expiresAt ? "Ends " + billingDate(offer.expiresAt, false) : "No expiry date";
          return '<article class="checkout-offer-card" data-offer-code="' + escapeHtml(offer.code) + '"><div><strong>' + escapeHtml(offer.name) + '</strong><code>' + escapeHtml(offer.code) + '</code><small>Save ' + escapeHtml(billingMoney(offer.discountAmount, offer.currency)) + ' · ' + escapeHtml(expiry) + '</small></div><div><span>' + escapeHtml(billingMoney(offer.finalAmount, offer.currency)) + '</span><button type="button" data-available-coupon="' + escapeHtml(offer.code) + '">Use code</button></div></article>';
        }).join("");
      }).catch(function (error) {
        availableOfferList.innerHTML = '<small class="checkout-offer-state is-error">Offers could not be loaded. You can enter a code manually.</small>';
      });
    }
    function openPaymentModal(plan) {
      selectedPaymentPlan = plan;
      paymentForm.reset();
      clearPaymentCoupon(true);
      setText("paymentPlanName", plan.name); setText("paymentPlanAmount", billingMoney(plan.price, billingData.currency));
      setText("paymentBankName", billingData.bankDetails.bankName); setText("paymentAccountName", billingData.bankDetails.accountName);
      setText("paymentAccountNumber", billingData.bankDetails.accountNumber); setText("paymentBankBranch", billingData.bankDetails.branch);
      setText("paymentBankSwift", billingData.bankDetails.swiftCode || "Not required");
      document.getElementById("paymentPlanId").value = plan.id;
      paymentFeedback.textContent = billingData.bankConfigured ? "" : "Bank transfer details are not configured. You can continue only with a coupon that covers the full price.";
      paymentModal.hidden = false;
      loadAvailableCoupons(plan);
      couponInput.focus();
    }
    function billingDate(value, includeTime) {
      if (!value) return "No renewal";
      try { return new Intl.DateTimeFormat(undefined, includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value)); }
      catch (_) { return String(value); }
    }
    function billingStatusClass(value) {
      return String(value || "pending").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    }
    function renderCurrentBilling(data) {
      var current = data.current;
      setText("billingCurrency", String(data.currency || "LKR") + " pricing · converted from LKR at the current rate");
      if (!current) {
        setText("billingPlanName", "No active plan"); setText("billingPlanDescription", "Choose a plan to activate your workspace.");
        setText("billingPlanStatus", "Inactive"); setText("billingCurrentPrice", billingMoney(0, data.currency));
        setText("billingCurrentInterval", "No billing interval"); setText("billingRenewalDate", "No renewal");
        setText("billingRenewalNote", "No active subscription"); setText("billingCardLimit", "0 cards"); setText("billingStorageLimit", "0 MB");
        return;
      }
      setText("billingPlanName", current.planName || "Current plan");
      setText("billingPlanDescription", (current.planName || "Your") + " workspace subscription");
      setText("billingPlanStatus", current.status || "active");
      setText("billingCurrentPrice", billingMoney(current.price, data.currency));
      setText("billingCurrentInterval", Number(current.price) > 0 ? "Billed " + String(current.billingInterval || "monthly") : "Free plan");
      setText("billingRenewalDate", current.endDate ? billingDate(current.endDate, false) : "No renewal");
      setText("billingRenewalNote", current.endDate ? (current.autoRenew ? "Automatic renewal enabled" : "Subscription end date") : "No scheduled charge");
      setText("billingCardLimit", Number(current.vcardLimit || 0).toLocaleString() + " cards");
      setText("billingStorageLimit", Number(current.storageLimitMb || 0).toLocaleString() + " MB");
      document.querySelectorAll(".user-plan").forEach(function (node) { node.textContent = (current.planName || "Current") + " plan"; });
    }
    function renderPendingBilling(data) {
      var notice = document.getElementById("billingPendingNotice");
      if (!notice) return;
      notice.hidden = !data.pending;
      if (!data.pending) return;
      setText("billingPendingTitle", data.pending.planName + " is awaiting approval");
      setText("billingPendingCopy", "Submitted " + billingDate(data.pending.submittedAt, true) + (data.pending.transactionNumber ? " · Reference " + data.pending.transactionNumber : "") + ". Your current plan remains active.");
      setText("billingPendingStatus", data.pending.paymentStatus || "pending");
    }
    function renderPaymentHistory(data) {
      var history = document.getElementById("billingPaymentHistory");
      var payments = Array.isArray(data.payments) ? data.payments : [];
      setText("billingPaymentCount", payments.length + " record" + (payments.length === 1 ? "" : "s"));
      if (!history) return;
      history.innerHTML = payments.length ? payments.map(function (payment) {
        var discount = payment.couponCode ? '<span>Coupon ' + escapeHtml(payment.couponCode) + ' saved ' + escapeHtml(billingMoney(payment.discountAmount, payment.currency)) + '</span>' : "";
        var proofUrl = payment.proofUrl ? API.replace(/\/api$/, "") + payment.proofUrl : "";
        var proof = proofUrl ? '<a href="' + escapeHtml(proofUrl) + '" target="_blank" rel="noopener">View receipt</a>' : "";
        return '<li><div class="billing-history-icon">' + escapeHtml((payment.planName || "P").charAt(0).toUpperCase()) + '</div><div class="billing-history-main"><div><strong>' + escapeHtml(payment.planName) + '</strong><span class="payment-history-status is-' + billingStatusClass(payment.status) + '">' + escapeHtml(payment.status) + '</span></div><small>' + escapeHtml(billingDate(payment.createdAt, true)) + ' · Reference ' + escapeHtml(payment.transactionNumber || "Not required") + '</small><div class="billing-history-meta">' + discount + proof + '</div></div><strong class="billing-history-amount">' + escapeHtml(billingMoney(payment.amount, payment.currency)) + '</strong></li>';
      }).join("") : '<li class="billing-history-empty"><strong>No payment activity yet</strong><span>Your bank transfer and coupon payments will appear here.</span></li>';
    }
    function renderBillingPlans(data) {
      billingData = data;
      renderCurrentBilling(data);
      renderPendingBilling(data);
      renderPaymentHistory(data);
      var pendingPlanId = data.pending ? Number(data.pending.planId) : null;
      billingPlansGrid.innerHTML = (data.plans || []).map(function (plan, index) {
        var current = Number(data.currentPlanId) === Number(plan.id);
        var pending = pendingPlanId === Number(plan.id);
        var waiting = Boolean(data.pending) && !pending;
        var features = [plan.vcardLimit + " VCards", plan.nfcLimit + " NFC cards", plan.analyticsLimit + " analytics", plan.storageLimitMb + " MB storage"].concat(plan.features || []);
        var label = current ? "Current plan" : pending ? "Approval pending" : "Available";
        var action = current ? "Current plan" : pending ? "Pending approval" : waiting ? "Payment pending" : "Choose " + plan.name;
        return '<article class="billing-plan-option' + (current ? ' is-current' : '') + '"><div class="billing-plan-number">' + String(index + 1).padStart(2, "0") + '</div><div class="billing-plan-top"><span>' + escapeHtml(label) + '</span><h4>' + escapeHtml(plan.name) + '</h4><p><strong>' + escapeHtml(billingMoney(plan.price, data.currency)) + '</strong><small> / ' + escapeHtml(plan.billingInterval) + '</small></p></div><ul>' + features.map(function (feature) { return '<li>' + escapeHtml(feature) + '</li>'; }).join("") + '</ul><button type="button" data-upgrade-plan-id="' + plan.id + '"' + (current || pending || waiting ? ' disabled' : '') + '><span>' + escapeHtml(action) + '</span><b>&rarr;</b></button></article>';
      }).join("") || '<div class="user-empty">No active plans are available.</div>';
      if (billingFeedback) {
        billingFeedback.className = "billing-plan-feedback" + (!data.bankConfigured ? " is-error" : "");
        billingFeedback.textContent = data.pending ? "Only one plan change can be reviewed at a time." : !data.bankConfigured ? "Bank transfer details are not configured. Please contact support before upgrading." : "";
      }
      var requestedPlanId = Number(new URLSearchParams(window.location.search).get("plan"));
      if (requestedPlanId && !data.pending) {
        var requestedPlan = (data.plans || []).find(function (plan) { return Number(plan.id) === requestedPlanId && Number(plan.id) !== Number(data.currentPlanId); });
        if (requestedPlan) {
          window.history.replaceState({}, "", window.location.pathname);
          openPaymentModal(requestedPlan);
        }
      }
    }
    function loadBillingPlans() {
      if (billingLoading) return billingLoading;
      if (refreshBillingButton) { refreshBillingButton.disabled = true; refreshBillingButton.classList.add("is-loading"); }
      if (refreshBillingLabel) refreshBillingLabel.textContent = "Refreshing...";
      billingLoading = request("/user/plans").then(renderBillingPlans).catch(function (error) {
        billingPlansGrid.innerHTML = '<div class="user-empty">' + escapeHtml(error.message) + '</div>';
        if (billingFeedback) { billingFeedback.className = "billing-plan-feedback is-error"; billingFeedback.textContent = "Billing data could not be refreshed."; }
      }).finally(function () {
        billingLoading = null;
        if (refreshBillingButton) { refreshBillingButton.disabled = false; refreshBillingButton.classList.remove("is-loading"); }
        if (refreshBillingLabel) refreshBillingLabel.textContent = "Refresh billing";
      });
      return billingLoading;
    }
    loadBillingPlans();
    billingPlansGrid.addEventListener("click", function (event) {
      var button = event.target.closest("[data-upgrade-plan-id]");
      if (!button || button.disabled) return;
      var plan = (billingData.plans || []).find(function (item) { return Number(item.id) === Number(button.dataset.upgradePlanId); });
      if (plan) openPaymentModal(plan);
    });
    if (paymentModal) paymentModal.querySelectorAll("[data-close-payment-modal]").forEach(function (button) { button.addEventListener("click", closePaymentModal); });
    if (refreshBillingButton) refreshBillingButton.addEventListener("click", loadBillingPlans);
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && paymentModal && !paymentModal.hidden) closePaymentModal(); });
    if (couponButton) couponButton.addEventListener("click", function () {
      var code = couponInput.value.trim().toUpperCase();
      couponInput.value = code;
      if (!selectedPaymentPlan || !code) {
        couponFeedback.className = "billing-plan-feedback is-error";
        couponFeedback.textContent = "Enter a coupon code first.";
        return;
      }
      couponButton.disabled = true;
      couponButton.textContent = "Checking...";
      couponFeedback.className = "billing-plan-feedback";
      couponFeedback.textContent = "Validating coupon...";
      request("/user/coupons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code, planId: selectedPaymentPlan.id }),
      }).then(function (data) {
        couponPreview = data;
        setText("couponOriginalAmount", billingMoney(data.originalAmount, data.currency));
        setText("couponDiscountAmount", "−" + billingMoney(data.discountAmount, data.currency));
        setText("couponFinalAmount", billingMoney(data.finalAmount, data.currency));
        couponResult.hidden = false;
        couponFeedback.className = "billing-plan-feedback is-success";
        couponFeedback.textContent = data.coupon.name + " applied.";
        setCouponPaymentRequirements(Number(data.finalAmount) === 0);
        setText("paymentPlanAmount", billingMoney(data.finalAmount, data.currency));
      }).catch(function (error) {
        clearPaymentCoupon(false);
        couponFeedback.className = "billing-plan-feedback is-error";
        couponFeedback.textContent = error.message;
      }).finally(function () {
        couponButton.disabled = false;
        couponButton.textContent = "Apply";
      });
    });
    if (couponRemoveButton) couponRemoveButton.addEventListener("click", function () { clearPaymentCoupon(true); });
    if (availableOfferList) availableOfferList.addEventListener("click", function (event) {
      var button = event.target.closest("[data-available-coupon]");
      if (!button) return;
      couponInput.value = button.getAttribute("data-available-coupon");
      couponButton.click();
    });
    if (couponInput) couponInput.addEventListener("input", function () {
      couponInput.value = couponInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      if (couponPreview && couponInput.value !== couponPreview.coupon.code) clearPaymentCoupon(false);
    });
    if (paymentForm) paymentForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (couponInput.value.trim() && (!couponPreview || couponPreview.coupon.code !== couponInput.value.trim().toUpperCase())) {
        couponFeedback.className = "billing-plan-feedback is-error";
        couponFeedback.textContent = "Apply the coupon before submitting payment.";
        couponInput.focus();
        return;
      }
      var submit = paymentForm.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = couponPreview && Number(couponPreview.finalAmount) === 0 ? "Activating..." : "Uploading..."; paymentFeedback.textContent = "";
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
    return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", hour12: localStorage.getItem("timeFormat") !== "24" }).format(new Date(value)) : "—";
  }

  function formatAppointmentRange(startsAt, endsAt) {
    if (!startsAt) return "—";
    var start = new Date(startsAt);
    var startLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", hour12: localStorage.getItem("timeFormat") !== "24" }).format(start);
    if (!endsAt) return startLabel;
    var endLabel = new Intl.DateTimeFormat(undefined, { timeStyle: "short", hour12: localStorage.getItem("timeFormat") !== "24" }).format(new Date(endsAt));
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
      affiliatePayoutForm.elements.paymentMethod.value = "bank_transfer";
      var savedBank = profile.bankDetails || {};
      ["accountHolder","bankName","accountNumber","branch","swiftCode"].forEach(function (field) { affiliatePayoutForm.elements[field].value = savedBank[field] || ""; });
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
      var withdrawalForm = document.getElementById("affiliateWithdrawalForm");
      var withdrawalAmount = document.getElementById("affiliateWithdrawalAmount");
      var withdrawalButton = withdrawalForm.querySelector('button[type="submit"]');
      function updateWithdrawalCurrency() {
        var balance = balances.find(function (item) { return item.currency === currencySelect.value; });
        var available = balance ? Number(balance.available) : 0;
        withdrawalAmount.max = available > 0 ? String(available) : "0";
        withdrawalAmount.min = String(data.minimumWithdrawal);
        setText("affiliateWithdrawalLimit", balance ? "Available: " + affiliateMoney(available, balance.currency) + " · Minimum: " + affiliateMoney(data.minimumWithdrawal, balance.currency) : "No approved balance is available to withdraw.");
        withdrawalButton.disabled = profile.status !== "active" || available < Number(data.minimumWithdrawal);
      }
      currencySelect.onchange = updateWithdrawalCurrency;
      var renderWithdrawalCurrencies = function (currencies) {
        var balanceByCurrency = Object.fromEntries(balances.map(function (item) { return [item.currency, item]; }));
        currencySelect.innerHTML = currencies.map(function (item) {
          var code = String(item.code || item).toUpperCase(), balance = balanceByCurrency[code], available = balance ? Number(balance.available) : 0;
          return '<option value="' + escapeHtml(code) + '">' + escapeHtml(code) + ' — ' + escapeHtml(affiliateMoney(available, code)) + ' available</option>';
        }).join("");
        var eligible = balances.find(function (item) { return Number(item.available) >= Number(data.minimumWithdrawal); });
        currencySelect.value = eligible ? eligible.currency : profile.preferredCurrency || "LKR";
        updateWithdrawalCurrency();
      };
      if (window.SyncCurrencies) window.SyncCurrencies.load().then(renderWithdrawalCurrencies);
      else renderWithdrawalCurrencies(["LKR","USD","EUR","GBP","AUD","CAD","INR","JPY","CNY","SGD","AED"]);

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
        var receipt = withdrawal.receiptAvailable ? '<button type="button" class="affiliate-receipt-link" data-affiliate-receipt="' + withdrawal.id + '">Download receipt</button>' : "";
        return '<tr><td><strong>' + escapeHtml(affiliateMoney(withdrawal.amount,withdrawal.currency)) + '</strong></td><td>Bank transfer</td><td>' + affiliateStatus(withdrawal.status) + receipt + '</td><td>' + escapeHtml(formatDate(withdrawal.createdAt)) + '</td><td>' + escapeHtml(withdrawal.adminNote || "—") + '</td></tr>';
      }).join("") : '<tr><td colspan="5" class="light-empty-cell">No withdrawal requests yet.</td></tr>';
    }
    function loadUserAffiliations() { return request("/user/affiliations").then(renderUserAffiliations).catch(function (error) { affiliateNotice.hidden=false;affiliateNotice.textContent=error.message; }); }
    loadUserAffiliations();
    affiliateApplicationForm.addEventListener("submit", function (event) {
      event.preventDefault(); var button=affiliateApplicationForm.querySelector('button[type="submit"]'),fd=new FormData(affiliateApplicationForm),feedback=document.getElementById("affiliateApplicationFeedback");
      button.disabled=true;feedback.textContent="Submitting...";
      request("/user/affiliations/apply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({referralCode:fd.get("referralCode"),paymentMethod:"bank_transfer",bankDetails:{accountHolder:fd.get("accountHolder"),bankName:fd.get("bankName"),accountNumber:fd.get("accountNumber"),branch:fd.get("branch"),swiftCode:fd.get("swiftCode")}})})
        .then(function(data){feedback.textContent=data.message;loadUserAffiliations();}).catch(function(error){feedback.textContent=error.message;}).finally(function(){button.disabled=false;});
    });
    affiliatePayoutForm.addEventListener("submit",function(event){event.preventDefault();var button=affiliatePayoutForm.querySelector("button"),fd=new FormData(affiliatePayoutForm),feedback=document.getElementById("affiliatePayoutFeedback");button.disabled=true;request("/user/affiliations/payout",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paymentMethod:"bank_transfer",bankDetails:{accountHolder:fd.get("accountHolder"),bankName:fd.get("bankName"),accountNumber:fd.get("accountNumber"),branch:fd.get("branch"),swiftCode:fd.get("swiftCode")}})}).then(function(data){feedback.textContent=data.message;loadUserAffiliations();}).catch(function(error){feedback.textContent=error.message;}).finally(function(){button.disabled=false;});});
    document.getElementById("affiliateWithdrawalForm").addEventListener("submit",function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button[type="submit"]'),fd=new FormData(form),feedback=document.getElementById("affiliateWithdrawalFeedback"),amount=Number(fd.get("amount")),currency=String(fd.get("currency")||"");if(!form.checkValidity()){form.reportValidity();return;}var balance=(affiliateData.balances||[]).find(function(item){return item.currency===currency;});if(!balance||amount>Number(balance.available)||amount<Number(affiliateData.minimumWithdrawal)){feedback.textContent="Enter an amount between the minimum and your available " + currency + " balance.";return;}button.disabled=true;feedback.textContent="Submitting...";request("/user/affiliations/withdrawals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount:amount,currency:currency,note:fd.get("note")})}).then(function(data){feedback.textContent=data.message;form.reset();return loadUserAffiliations();}).catch(function(error){feedback.textContent=error.message;button.disabled=false;});});
    document.addEventListener("click",function(event){var receiptButton=event.target.closest("[data-affiliate-receipt]");if(!receiptButton)return;receiptButton.disabled=true;fetch(API+"/user/affiliations/withdrawals/"+encodeURIComponent(receiptButton.dataset.affiliateReceipt)+"/receipt",{headers:{Authorization:"Bearer "+token}}).then(function(response){if(!response.ok)return response.json().then(function(data){throw new Error(data.message||"Unable to download receipt")});return response.blob();}).then(function(blob){var url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="withdrawal-receipt";link.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);}).catch(function(error){window.alert(error.message);}).finally(function(){receiptButton.disabled=false;});});
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
    var exportEnquiriesButton = document.getElementById("exportEnquiries");
    var loadedEnquiries = [];
    if (exportEnquiriesButton) exportEnquiriesButton.addEventListener("click", function () {
      if (!loadedEnquiries.length) return;
      function enquiryCsvCell(value) {
        var safe = String(value == null ? "" : value).replace(/\r?\n/g, " ");
        if (/^[=+\-@]/.test(safe)) safe = "'" + safe;
        return '"' + safe.replace(/"/g, '""') + '"';
      }
      var csv = [["VCard", "Name", "Email", "Phone", "Company", "Message", "Submitted at"]]
        .concat(loadedEnquiries.map(function (item) {
          return [item.vcard_name || "Digital card", item.name || "", item.email || "", item.phone || "", item.company || "", item.message || "", item.contacted_at || ""];
        }))
        .map(function (row) { return row.map(enquiryCsvCell).join(","); }).join("\r\n");
      var url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
      var link = document.createElement("a");
      link.href = url;
      link.download = "all-enquiries-" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
    enquiriesBody.innerHTML = '<tr><td colspan="7" class="light-empty-cell">Loading enquiries...</td></tr>';
    request("/user/enquiries").then(function (data) {
      var rows = data.enquiries || [];
      loadedEnquiries = rows;
      if (exportEnquiriesButton) exportEnquiriesButton.disabled = !rows.length;
      setText("exportEnquiriesCount", rows.length);
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
    }).catch(function (error) { if (exportEnquiriesButton) exportEnquiriesButton.disabled = true; enquiriesBody.innerHTML = '<tr><td colspan="7" class="light-empty-cell">' + escapeHtml(error.message) + "</td></tr>"; });
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
    appointmentsBody.innerHTML = '<tr><td colspan="9" class="light-empty-cell">Loading appointments...</td></tr>';
    request("/user/appointments" + appointmentQuery()).then(function (data) {
      var rows = data.appointments || [];
      var summary = data.summary || {};
      setText("appointmentMetricTotal", summary.total == null ? rows.length : summary.total);
      setText("appointmentMetricPending", summary.pending == null ? rows.filter(function (item) { return item.status === "pending"; }).length : summary.pending);
      setText("appointmentMetricApproved", summary.approved == null ? rows.filter(function (item) { return item.status === "approved"; }).length : summary.approved);
      setText("appointmentMetricOnline", summary.online == null ? rows.filter(function (item) { return item.appointment_type === "online"; }).length : summary.online);
      appointmentsBody.innerHTML = rows.length ? rows.map(function (item) {
        var searchable = [item.vcard_name, item.name, item.email, item.phone, item.service_name, item.status, item.appointment_type].join(" ");
        var action = item.status === "pending"
          ? '<div class="client-appointment-actions"><button class="client-appointment-approve" type="button" data-appointment-status="approved" data-appointment-id="' + item.id + '"' + (item.email ? "" : " disabled title=\"Customer email is missing\"") + '>Approve</button><button class="client-appointment-reject" type="button" data-appointment-status="rejected" data-appointment-id="' + item.id + '">Reject</button></div>'
          : '<span class="client-appointment-complete">✓ ' + escapeHtml(item.status) + '</span>';
        return '<tr class="appointment-row" data-search="' + escapeHtml(searchable.toLowerCase()) + '"><td data-label="VCard Name">' + escapeHtml(item.vcard_name || "Digital card") + '</td><td data-label="Name">' + escapeHtml(item.name) + '</td><td data-label="Email">' + escapeHtml(item.email || "—") + '</td><td data-label="Phone">' + escapeHtml(item.phone || "—") + '</td><td data-label="Appointment Time"><span class="appointment-time-pill">' + escapeHtml(formatAppointmentRange(item.starts_at, item.ends_at)) + '</span></td><td data-label="Status"><span class="appointment-status-pill status-' + escapeHtml(item.status) + '">' + escapeHtml(item.status) + '</span></td><td data-label="Meeting Mode"><span class="appointment-type-pill">' + escapeHtml(formatMeetingMode(item.appointment_type)) + '</span></td><td data-label="Action">' + action + '</td></tr>';
      }).join("") : '<tr><td colspan="9" class="light-empty-cell">No appointments match the selected filters.</td></tr>';
      appointmentsBody.querySelectorAll(".appointment-row").forEach(function (row, index) {
        var serviceCell = document.createElement("td");
        serviceCell.dataset.label = "Service";
        serviceCell.textContent = rows[index].service_name || "Appointment";
        if (row.children[3]) row.children[3].after(serviceCell);
      });
      setText("appointmentsResults", "Showing " + rows.length + " result" + (rows.length === 1 ? "" : "s"));
    }).catch(function (error) {
      appointmentsBody.innerHTML = '<tr><td colspan="9" class="light-empty-cell">' + escapeHtml(error.message) + "</td></tr>";
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
  if (ordersBody && !document.getElementById("productOrdersStatus")) {
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

  if (ordersBody && document.getElementById("productOrdersStatus")) {
    (function () {
      var orderRows = [];
      var statusSelect = document.getElementById("productOrdersStatus");
      var searchInput = document.getElementById("productOrdersSearch");
      function currency(value, code) {
        try {
          return new Intl.NumberFormat(undefined, { style: "currency", currency: code || "LKR", maximumFractionDigits: 0 }).format(Number(value || 0));
        } catch (_) {
          return (code || "LKR") + " " + Number(value || 0).toLocaleString();
        }
      }
      function statusLabel(status) {
        return String(status || "pending").replace(/_/g, " ").replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
      }
      function renderOrders() {
        var term = String(searchInput.value || "").trim().toLowerCase();
        var selectedStatus = String(statusSelect.value || "").toLowerCase();
        var visible = orderRows.filter(function (item) {
          var haystack = [item.id, item.product_name, item.vcard_title, item.status, item.payment_status, item.tracking_number].join(" ").toLowerCase();
          return (!term || haystack.includes(term)) && (!selectedStatus || String(item.status).toLowerCase() === selectedStatus);
        });
        ordersBody.innerHTML = visible.length ? visible.map(function (item) {
          var status = String(item.status || "pending").toLowerCase();
          var payment = String(item.payment_status || "pending").toLowerCase();
          var productImage = item.product_image
            ? '<img src="' + escapeHtml(item.product_image) + '" alt="" />'
            : '<span class="product-order-placeholder">NFC</span>';
          var tracking = item.tracking_number
            ? '<strong class="product-order-tracking">' + escapeHtml(item.tracking_number) + '</strong>'
            : '<span class="product-order-muted">Not assigned</span>';
          return '<tr class="product-order-row" data-search="' + escapeHtml([item.id, item.product_name, item.status, item.tracking_number].join(" ").toLowerCase()) + '">' +
            '<td data-label="Order"><strong class="product-order-number">#' + escapeHtml(item.id) + '</strong><small>' + escapeHtml(item.quantity) + ' item' + (Number(item.quantity) === 1 ? "" : "s") + '</small></td>' +
            '<td data-label="Product"><div class="product-order-product">' + productImage + '<div><strong>' + escapeHtml(item.product_name || "NFC Card") + '</strong><small>' + escapeHtml(item.vcard_title || "Digital card") + '</small></div></div></td>' +
            '<td data-label="Placed"><strong class="product-order-date">' + escapeHtml(formatDate(item.ordered_at)) + '</strong></td>' +
            '<td data-label="Payment"><span class="product-order-badge payment-' + escapeHtml(payment) + '">' + escapeHtml(statusLabel(payment)) + '</span></td>' +
            '<td data-label="Total"><strong class="product-order-total">' + escapeHtml(currency(item.amount, item.currency)) + '</strong></td>' +
            '<td data-label="Fulfilment"><span class="product-order-badge status-' + escapeHtml(status) + '"><i></i>' + escapeHtml(statusLabel(status)) + '</span></td>' +
            '<td data-label="Tracking">' + tracking + '</td></tr>';
        }).join("") : '<tr><td colspan="7" class="client-product-orders-empty light-empty-cell"><div class="product-orders-empty-icon">⌁</div><strong>No matching orders</strong><span>Try a different search or status filter.</span></td></tr>';
        setText("productOrdersResults", "Showing " + visible.length + " of " + orderRows.length + " order" + (orderRows.length === 1 ? "" : "s"));
      }
      ordersBody.innerHTML = '<tr><td colspan="7" class="client-product-orders-empty light-empty-cell">Loading your orders...</td></tr>';
      request("/user/orders").then(function (data) {
        orderRows = data.orders || [];
        setText("productOrdersTotal", orderRows.length);
        setText("productOrdersProgress", orderRows.filter(function (item) { return ["pending", "processing", "shipped"].includes(String(item.status).toLowerCase()); }).length);
        setText("productOrdersCompleted", orderRows.filter(function (item) { return String(item.status).toLowerCase() === "completed"; }).length);
        setText("productOrdersSpent", currency(orderRows.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0), orderRows[0] && orderRows[0].currency));
        renderOrders();
      }).catch(function (error) {
        ordersBody.innerHTML = '<tr><td colspan="7" class="client-product-orders-empty light-empty-cell">' + escapeHtml(error.message) + "</td></tr>";
      });
      searchInput.addEventListener("input", renderOrders);
      statusSelect.addEventListener("change", renderOrders);
      var exportButton = document.getElementById("exportProductOrders");
      if (exportButton) exportButton.addEventListener("click", function () {
        var term = String(searchInput.value || "").trim().toLowerCase();
        var selectedStatus = String(statusSelect.value || "").toLowerCase();
        var exportedRows = orderRows.filter(function (item) {
          var haystack = [item.id, item.product_name, item.vcard_title, item.status, item.payment_status, item.tracking_number].join(" ").toLowerCase();
          return (!term || haystack.includes(term)) && (!selectedStatus || String(item.status).toLowerCase() === selectedStatus);
        });
        function csvCell(value) {
          var safe = String(value == null ? "" : value);
          if (/^[=+\-@]/.test(safe)) safe = "'" + safe;
          return '"' + safe.replace(/"/g, '""') + '"';
        }
        var csv = [["Order", "Product", "VCard", "Quantity", "Placed", "Payment", "Amount", "Currency", "Fulfilment", "Tracking"]]
          .concat(exportedRows.map(function (item) {
            return [item.id, item.product_name || "NFC Card", item.vcard_title || "", item.quantity, item.ordered_at, item.payment_status || "pending", item.amount, item.currency || "LKR", item.status || "pending", item.tracking_number || ""];
          }))
          .map(function (row) { return row.map(csvCell).join(","); }).join("\r\n");
        var url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
        var link = document.createElement("a");
        link.href = url;
        link.download = "product-orders.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      });
    }());
  }

  function readVcardImageInput(input) {
    var file = input && input.files && input.files[0];
    if (!file) return Promise.resolve(null);
    if (!/^image\/(?:png|jpeg|webp)$/i.test(file.type)) return Promise.reject(new Error("Choose a PNG, JPEG, or WebP image."));
    if (file.size > 2 * 1024 * 1024) return Promise.reject(new Error("Each VCard image must be 2 MB or smaller."));
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(new Error("Unable to read the selected image.")); };
      reader.readAsDataURL(file);
    });
  }

  var editor = document.getElementById("userVcardEditor");
  if (editor) {
    var cardId = new URLSearchParams(window.location.search).get("id");
    var editorStatus = document.getElementById("vcardEditorStatus");
    var savedProfileImage = null, savedCoverImage = null;
    if (!cardId) {
      editorStatus.textContent = "No card was selected.";
      editor.querySelector('button[type="submit"]').disabled = true;
    } else {
      request("/user/vcards/" + encodeURIComponent(cardId)).then(function (data) {
        var card = data.vcard;
        var entitlements = data.entitlements || {};
        editor.elements.title.value = card.title || "";
        editor.elements.qualifications.value = card.qualifications || "";
        editor.elements.email.value = card.email || "";
        editor.elements.phone.value = card.phone || "";
        editor.elements.websiteUrl.value = card.website_url || "";
        editor.elements.address.value = card.address || "";
        editor.elements.description.value = card.description || "";
        editor.elements.contactCaptureRequired.checked = card.contactCaptureRequired !== false;
        savedProfileImage = card.settings && card.settings.profileImageUrl || null;
        savedCoverImage = card.settings && card.settings.coverImageUrl || null;
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
        initializeVcardImageEditors(featureEditor);
        editorStatus.textContent = "Loaded from your account";
      }).catch(function (error) { editorStatus.textContent = error.message; });
      editor.addEventListener("submit", async function (event) {
        event.preventDefault();
        var button = editor.querySelector('button[type="submit"]');
        button.disabled = true; editorStatus.textContent = "Saving...";
        try {
          var sections = collectVcardSections(editor, "[data-vcard-section]");
          var newProfileImage = await readVcardImageInput(document.getElementById("editCardProfileImage"));
          var newCoverImage = await readVcardImageInput(document.getElementById("editCardCoverImage"));
          await request("/user/vcards/" + encodeURIComponent(cardId), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editor.elements.title.value.trim(), qualifications: editor.elements.qualifications.value.trim(), templateId: Number(editor.elements.templateId.value), email: editor.elements.email.value.trim(), phone: editor.elements.phone.value.trim(), websiteUrl: editor.elements.websiteUrl.value.trim(), address: editor.elements.address.value.trim(), description: editor.elements.description.value.trim(), sections: sections, profileImageUrl: newProfileImage || savedProfileImage, coverImageUrl: newCoverImage || savedCoverImage, contactCaptureRequired: editor.elements.contactCaptureRequired.checked, isActive: editor.elements.isActive.checked }) });
          if (newProfileImage) savedProfileImage = newProfileImage;
          if (newCoverImage) savedCoverImage = newCoverImage;
          editorStatus.textContent = "Saved successfully";
        } catch (error) { editorStatus.textContent = error.message; }
        finally { button.disabled = false; }
      });
    }
  }

  var createCardForm = document.querySelector("#newVcardPanel .client-vcard-form");
  if (createCardForm) {
    var createVcardNameInput=document.getElementById("vcardName");
    var createVcardSlugInput=document.getElementById("urlAlias");
    var slugifyVcardName=function(value){return String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100);};
    if(createVcardNameInput&&createVcardSlugInput){
      createVcardNameInput.addEventListener("input",function(){if(createVcardSlugInput.dataset.custom!=="true")createVcardSlugInput.value=slugifyVcardName(createVcardNameInput.value);});
      createVcardSlugInput.addEventListener("input",function(){createVcardSlugInput.dataset.custom="true";createVcardSlugInput.value=slugifyVcardName(createVcardSlugInput.value);});
      var generateSlugButton=createVcardSlugInput.parentElement.querySelector("button");
      if(generateSlugButton)generateSlugButton.addEventListener("click",function(){createVcardSlugInput.dataset.custom="false";createVcardSlugInput.value=slugifyVcardName(createVcardNameInput.value);createVcardSlugInput.focus();});
    }
    var qualificationsInput = document.getElementById("qualifications");
    var qualificationsCount = document.getElementById("qualificationsCount");
    var updateQualificationsCount = function () {
      if (qualificationsInput && qualificationsCount) qualificationsCount.textContent = qualificationsInput.value.length + " / 500";
    };
    if (qualificationsInput) qualificationsInput.addEventListener("input", updateQualificationsCount);
    createCardForm.addEventListener("reset", function () {
      window.setTimeout(function () {
        if (createVcardSlugInput) createVcardSlugInput.dataset.custom = "false";
        updateQualificationsCount();
      }, 0);
    });
    createCardForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!createCardForm.checkValidity()) {
        createCardForm.reportValidity();
        return;
      }
      var title = document.getElementById("vcardName");
      var description = document.getElementById("vcardDescription");
      var qualifications = document.getElementById("qualifications");
      if (!title || !title.value.trim()) return;
      var button = createCardForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      var template = document.getElementById("createVcardTemplate");
      var sections = collectVcardSections(createCardForm, "[data-create-vcard-section]");
      var occupation = document.getElementById("occupation");
      if (occupation && occupation.value.trim()) sections["basic-details"] = occupation.value.trim();
      try {
        var profileImageUrl = await readVcardImageInput(document.getElementById("createVcardProfileImage"));
        var coverImageUrl = await readVcardImageInput(document.getElementById("createVcardCoverImage"));
        var contactCapture = document.getElementById("createVcardContactCapture");
        var data = await request("/user/vcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.value.trim(), qualifications: qualifications ? qualifications.value.trim() : "", slug: createVcardSlugInput ? createVcardSlugInput.value.trim() : "", templateId: Number(template && template.value), email: document.getElementById("vcardEmail").value.trim(), phone: document.getElementById("vcardPhone").value.trim(), websiteUrl: document.getElementById("vcardWebsite").value.trim(), address: document.getElementById("vcardAddress").value.trim(), description: description ? description.value.trim() : "", sections: sections, profileImageUrl: profileImageUrl, coverImageUrl: coverImageUrl, contactCaptureRequired: !contactCapture || contactCapture.checked }) });
        window.location.href = "edit-vcard.html?id=" + encodeURIComponent(data.vcard.id);
      } catch (error) { window.alert(error.message); if (button) button.disabled = false; }
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
    button.disabled = true;
    request("/user/notifications/read", { method: "PATCH" })
      .then(refreshNotifications)
      .finally(function () { button.disabled = false; });
  });

  document.addEventListener("click", function (event) {
    var item = event.target.closest("[data-notification-id]");
    if (!item || !item.classList.contains("is-unread")) return;
    item.disabled = true;
    request("/user/notifications/" + encodeURIComponent(item.dataset.notificationId) + "/read", { method: "PATCH" })
      .then(refreshNotifications)
      .finally(function () { item.disabled = false; });
  });

  var notificationToggle = document.getElementById("notificationToggle");
  if (notificationToggle) {
    notificationToggle.addEventListener("click", function () {
      if (notificationToggle.getAttribute("aria-expanded") !== "true") refreshNotifications();
    });
    window.setInterval(function () {
      if (document.visibilityState === "visible") refreshNotifications();
    }, 30000);
  }

  var userContactList = document.getElementById("userContactList");
  if (userContactList) {
    request("/user/contacts").then(function (data) {
      setText("contactCount", data.total + " captured contact" + (data.total === 1 ? "" : "s"));
      userContactList.innerHTML = data.contacts.length ? data.contacts.map(function (contact) {
        var followup = contact.email
          ? '<a class="btn-preview" href="mailto:' + encodeURIComponent(contact.email) + '">Email</a>'
          : '<a class="btn-preview" href="tel:' + escapeHtml(contact.phone || "") + '">Call</a>';
        return '<article class="contact-row searchable-item" data-search="' + escapeHtml([contact.name, contact.email, contact.phone, contact.company, contact.vcard_name].join(" ").toLowerCase()) + '">' +
          '<div><strong>' + escapeHtml(contact.name || "Visitor") + '</strong><span>' + escapeHtml([contact.company, contact.email || contact.phone].filter(Boolean).join(" · ") || "Contact details shared") + '</span></div>' +
          '<div><strong>' + escapeHtml(contact.vcard_name || "VCard") + '</strong><span>' + escapeHtml(contact.source || "Public VCard") + '</span></div>' +
          '<div>' + escapeHtml(formatDate(contact.contacted_at)) + '</div>' + followup + '</article>';
      }).join("") : '<div class="user-empty">No contacts yet. Visitors will appear here after they consent and save your VCard.</div>';
    }).catch(function (error) {
      userContactList.innerHTML = '<div class="user-empty">' + escapeHtml(error.message) + '</div>';
    });
  }

  var userQrCardList = document.getElementById("userQrCardList");
  if (userQrCardList) {
    request("/user/vcard-engagement").then(function (data) {
      userQrCardList.innerHTML = data.cards.length ? data.cards.map(function (card) {
        var destination = card.publicUrl || (card.slug ? (window.location.origin + "/vcard/" + encodeURIComponent(card.slug)) : window.location.origin);
        var qrUrl = API + "/public/vcards/" + encodeURIComponent(card.id) + "/qrcode";
        return '<article class="feature-panel qr-live-card searchable-item" data-search="' + escapeHtml((card.title || "vcard") + " qr") + '">' +
          '<div class="feature-panel-header"><div><h3>' + escapeHtml(card.title || "Untitled VCard") + '</h3><p>Encoded to open this public VCard directly.</p></div><span class="status-pill ' + (card.is_active ? "status-live" : "status-warm") + '">' + (card.is_active ? "Active" : "Paused") + '</span></div>' +
          '<div class="qr-preview"><img src="' + escapeHtml(qrUrl) + '" alt="QR code for ' + escapeHtml(card.title || "VCard") + '"></div>' +
          '<div class="qr-live-stats"><span><strong>' + Number(card.qr_scans || 0).toLocaleString() + '</strong>QR scans</span><span><strong>' + Number(card.contact_downloads || 0).toLocaleString() + '</strong>contact saves</span><span><strong>' + Number(card.captured_contacts || 0).toLocaleString() + '</strong>leads</span></div>' +
          '<div class="action-row"><button type="button" class="btn-preview" data-copy-text="' + escapeHtml(destination) + '">Copy Link</button><button class="btn-share" type="button" data-download-qr="' + escapeHtml(qrUrl) + '" data-qr-filename="' + escapeHtml(card.slug || "vcard-"+card.id) + '-qr.svg">Download SVG</button></div></article>';
      }).join("") : '<div class="user-empty">Create a VCard to generate your first tracked QR code.</div>';
    }).catch(function (error) {
      userQrCardList.innerHTML = '<div class="user-empty">' + escapeHtml(error.message) + '</div>';
    });
  }

  if (document.getElementById("analyticsQrScans")) {
    request("/user/vcard-engagement").then(function (data) {
      var totals = data.cards.reduce(function (sum, card) {
        sum.scans += Number(card.qr_scans || 0);
        sum.views += Number(card.views || 0);
        sum.saves += Number(card.contact_downloads || 0);
        sum.leads += Number(card.captured_contacts || 0);
        return sum;
      }, { scans: 0, views: 0, saves: 0, leads: 0 });
      setText("analyticsQrScans", totals.scans.toLocaleString());
      setText("analyticsCardViews", totals.views.toLocaleString());
      setText("analyticsContactSaves", totals.saves.toLocaleString());
      setText("analyticsCapturedLeads", totals.leads.toLocaleString());
    }).catch(function () {});
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-download-qr]");
    if (!button) return;
    button.disabled = true;
    var original = button.textContent;
    button.textContent = "Downloading…";
    fetch(button.dataset.downloadQr).then(function (response) {
      if (!response.ok) throw new Error("Unable to download QR code");
      return response.blob();
    }).then(function (blob) {
      var objectUrl = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = button.dataset.qrFilename || "vcard-qr.svg";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    }).catch(function (error) {
      window.alert(error.message);
    }).finally(function () {
      button.disabled = false;
      button.textContent = original;
    });
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
