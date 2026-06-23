document.addEventListener("DOMContentLoaded", function () {
  var searchInput = document.getElementById("dashboardSearch");
  var emptySearchState = document.getElementById("emptySearchState");
  var toastStack = document.getElementById("toastStack");
  var notificationToggle = document.getElementById("notificationToggle");
  var notificationPanel = document.getElementById("notificationPanel");
  var notificationList = document.getElementById("notificationList");
  var notificationCount = document.getElementById("notificationCount");
  var logoutButton = document.getElementById("logoutButton");
  var periodButton = document.getElementById("overviewPeriodButton");
  var periodLabel = document.getElementById("overviewPeriodLabel");
  var periodOptions = document.getElementById("periodOptions");
  var completionValue = document.getElementById("completionValue");
  var completionTitle = document.getElementById("completionTitle");
  var ringFill = document.querySelector(".ring-fill");
  var addUserForm = document.getElementById("addUserForm");
  var userModal = document.getElementById("userModal");
  var userModalBackdrop = document.getElementById("userModalBackdrop");
  var toggleUserForm = document.getElementById("toggleUserForm");
  var closeUserForm = document.getElementById("closeUserForm");
  var resetUserForm = document.getElementById("resetUserForm");
  var userFormFeedback = document.getElementById("userFormFeedback");
  var userDirectoryBody = document.getElementById("userDirectoryBody");
  var userDirectoryCount = document.getElementById("userDirectoryCount");
  var userProfileInput = document.getElementById("userProfile");
  var userProfilePreview = document.getElementById("userProfilePreview");
  var nfcCatalogSearch = document.getElementById("nfcCatalogSearch");
  var vcardTabButtons = Array.from(document.querySelectorAll("[data-vcard-tab-target]"));
  var nfcTabButtons = Array.from(document.querySelectorAll("[data-nfc-tab-target]"));
  var openNfcModalButton = document.getElementById("openNfcModal");
  var nfcCardModal = document.getElementById("nfcCardModal");
  var closeNfcModalButton = document.getElementById("closeNfcModal");
  var nfcCardModalBackdrop = document.getElementById("nfcCardModalBackdrop");
  var nfcCardForm = document.getElementById("nfcCardForm");
  var resetNfcCardFormButton = document.getElementById("resetNfcCardForm");
  var nfcCardFormFeedback = document.getElementById("nfcCardFormFeedback");
  var nfcCardFrontInput = document.getElementById("nfcCardFront");
  var nfcCardBackInput = document.getElementById("nfcCardBack");
  var nfcFrontPreview = document.getElementById("nfcFrontPreview");
  var nfcBackPreview = document.getElementById("nfcBackPreview");
  var nfcCatalogList = document.getElementById("nfcCatalogList");
  var nfcGuideModal = document.getElementById("nfcGuideModal");
  var nfcGuideModalBackdrop = document.getElementById("nfcGuideModalBackdrop");
  var closeNfcGuideModalButton = document.getElementById("closeNfcGuideModal");
  var nfcOrderSearch = document.getElementById("nfcOrderSearch");
  var nfcOrdersTableBody = document.getElementById("nfcOrdersTableBody");
  var nfcOrdersResults = document.getElementById("nfcOrdersResults");
  var cashPaymentSearch = document.getElementById("cashPaymentSearch");
  var cashPaymentsTableBody = document.getElementById("cashPaymentsTableBody");
  var cashPaymentsResults = document.getElementById("cashPaymentsResults");
  var subscriptionSearch = document.getElementById("subscriptionSearch");
  var subscriptionsTabButtons = Array.from(document.querySelectorAll("[data-subscriptions-tab-target]"));
  var subscriptionsTableBody = document.getElementById("subscriptionsTableBody");
  var subscriptionsResults = document.getElementById("subscriptionsResults");
  var subscriptionModal = document.getElementById("subscriptionModal");
  var subscriptionModalBackdrop = document.getElementById("subscriptionModalBackdrop");
  var closeSubscriptionModalButton = document.getElementById("closeSubscriptionModal");
  var subscriptionForm = document.getElementById("subscriptionForm");
  var resetSubscriptionFormButton = document.getElementById("resetSubscriptionForm");
  var subscriptionFormFeedback = document.getElementById("subscriptionFormFeedback");
  var subscriptionEndDateInput = document.getElementById("subscriptionEndDate");
  var subscriptionEditRowIndexInput = document.getElementById("subscriptionEditRowIndex");
  var planSearch = document.getElementById("planSearch");
  var plansTableBody = document.getElementById("plansTableBody");
  var openPlanModalButton = document.getElementById("openPlanModal");
  var planModal = document.getElementById("planModal");
  var planModalBackdrop = document.getElementById("planModalBackdrop");
  var closePlanModalButton = document.getElementById("closePlanModal");
  var planForm = document.getElementById("planForm");
  var resetPlanFormButton = document.getElementById("resetPlanForm");
  var planFormFeedback = document.getElementById("planFormFeedback");
  var planSelectAllTemplates = document.getElementById("planSelectAllTemplates");
  var plansResults = document.getElementById("plansResults");
  var planModalTitle = document.getElementById("planModalTitle");
  var planSubmitButton = document.getElementById("planSubmitButton");
  var planEditRowIndexInput = document.getElementById("planEditRowIndex");
  var affiliationsTabButtons = Array.from(document.querySelectorAll("[data-affiliations-tab-target]"));
  var couponTabButtons = Array.from(document.querySelectorAll("[data-coupon-tab-target]"));
  var settingsTabButtons = Array.from(document.querySelectorAll("[data-settings-tab-target]"));
  var affiliateUsersSearch = document.getElementById("affiliateUsersSearch");
  var affiliateUsersTableBody = document.getElementById("affiliateUsersTableBody");
  var affiliateUsersResults = document.getElementById("affiliateUsersResults");
  var affiliateTransactionsSearch = document.getElementById("affiliateTransactionsSearch");
  var affiliateTransactionsTableBody = document.getElementById("affiliateTransactionsTableBody");
  var affiliateTransactionsResults = document.getElementById("affiliateTransactionsResults");
  var affiliateWithdrawalsSearch = document.getElementById("affiliateWithdrawalsSearch");
  var affiliateWithdrawalsTableBody = document.getElementById("affiliateWithdrawalsTableBody");
  var affiliateWithdrawalsResults = document.getElementById("affiliateWithdrawalsResults");
  var affiliateGuideModal = document.getElementById("affiliateGuideModal");
  var affiliateGuideModalBackdrop = document.getElementById("affiliateGuideModalBackdrop");
  var openAffiliateGuideModalButton = document.getElementById("openAffiliateGuideModal");
  var closeAffiliateGuideModalButton = document.getElementById("closeAffiliateGuideModal");
  var couponCodeSearch = document.getElementById("couponCodeSearch");
  var couponCodesTableBody = document.getElementById("couponCodesTableBody");
  var couponCodesResults = document.getElementById("couponCodesResults");
  var usedCouponCodeSearch = document.getElementById("usedCouponCodeSearch");
  var usedCouponCodesTableBody = document.getElementById("usedCouponCodesTableBody");
  var usedCouponCodesResults = document.getElementById("usedCouponCodesResults");
  var enquiriesSearch = document.getElementById("enquiriesSearch");
  var enquiriesTableBody = document.getElementById("enquiriesTableBody");
  var enquiriesResults = document.getElementById("enquiriesResults");
  var nfcCardSearch = document.getElementById("nfcCardSearch");
  var nfcTableSearch = document.getElementById("nfcTableSearch");
  var nfcCardsTableBody = document.getElementById("nfcCardsTableBody");
  var nfcCardsResults = document.getElementById("nfcCardsResults");
  var nfcFilterToggle = document.getElementById("nfcFilterToggle");
  var openNfcHowItWorksModal = document.getElementById("openNfcHowItWorksModal");
  var openNfcOrderModal = document.getElementById("openNfcOrderModal");
  var openNfcGuideModal = document.getElementById("openNfcGuideModal");
  var orderNfcButton = document.getElementById("orderNfcButton");
  var nfcHowItWorksModal = document.getElementById("nfcHowItWorksModal");
  var nfcHowItWorksModalBackdrop = document.getElementById("nfcHowItWorksModalBackdrop");
  var closeNfcHowItWorksModal = document.getElementById("closeNfcHowItWorksModal");
  var nfcOrderModal = document.getElementById("nfcOrderModal");
  var nfcOrderModalBackdrop = document.getElementById("nfcOrderModalBackdrop");
  var closeNfcOrderModal = document.getElementById("closeNfcOrderModal");
  var nfcOrderForm = document.getElementById("nfcOrderForm");
  var cancelNfcOrder = document.getElementById("cancelNfcOrder");
  var appointmentsSearch = document.getElementById("appointmentsSearch");
  var appointmentsTableBody = document.getElementById("appointmentsTableBody");
  var appointmentsResults = document.getElementById("appointmentsResults");
  var productOrdersSearch = document.getElementById("productOrdersSearch");
  var productOrdersTableBody = document.getElementById("productOrdersTableBody");
  var productOrdersResults = document.getElementById("productOrdersResults");
  var openCouponModalButton = document.getElementById("openCouponModal");
  var couponModal = document.getElementById("couponModal");
  var couponModalBackdrop = document.getElementById("couponModalBackdrop");
  var closeCouponModalButton = document.getElementById("closeCouponModal");
  var couponForm = document.getElementById("couponForm");
  var resetCouponFormButton = document.getElementById("resetCouponForm");
  var couponFormFeedback = document.getElementById("couponFormFeedback");
  var couponModalTitle = document.getElementById("couponModalTitle");
  var couponSubmitButton = document.getElementById("couponSubmitButton");
  var couponEditRowIndexInput = document.getElementById("couponEditRowIndex");

  var state = {
    profileCompletion: 85,
    notifications: [
      { title: "New contact saved", description: "Sarah Johnson saved your card." },
      { title: "Card shared", description: "Your Event Card was shared by email." },
      { title: "QR scan detected", description: "A new scan came from San Francisco." }
    ]
  };

  var chartRefs = {
    analytics: null,
    engagement: null,
    revenueBreakdown: null,
    revenueBar: null
  };

  var analyticsSeries = {
    "30": {
      label: "Last 30 Days",
      labels: ["May 10", "May 12", "May 14", "May 16", "May 18", "May 20", "May 22", "May 24", "May 26", "May 28", "Jun 3", "Jun 9"],
      data: [420, 910, 680, 1504, 1180, 1218, 1540, 890, 1380, 1124, 1725, 2184]
    },
    "90": {
      label: "Last 90 Days",
      labels: ["Mar 12", "Mar 22", "Apr 1", "Apr 11", "Apr 21", "May 1", "May 11", "May 21", "May 31", "Jun 5", "Jun 8", "Jun 12"],
      data: [320, 470, 760, 840, 990, 1110, 1260, 1420, 1560, 1805, 1940, 2250]
    },
    "365": {
      label: "This Year",
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      data: [280, 620, 980, 1220, 1360, 1710, 1640, 1820, 2080, 2140, 2260, 2440]
    }
  };

  var engagementData = {
    labels: ["Email", "Direct", "QR", "NFC", "Social", "Teams"],
    values: [42, 28, 31, 18, 23, 15]
  };

  var activityFeed = [
    { icon: "view", title: "Your card was viewed", sub: "by Sarah Johnson", time: "2m ago" },
    { icon: "share", title: "Card shared via email", sub: "to alex@email.com", time: "15m ago" },
    { icon: "contact", title: "New contact saved", sub: "Michael Brown", time: "1h ago" },
    { icon: "qr", title: "QR code scanned", sub: "San Francisco, CA", time: "2h ago" },
    { icon: "view", title: "Your card was viewed", sub: "by David Lee", time: "3h ago" }
  ];

  function iconMarkup(type) {
    if (type === "share") {
      return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
    }

    if (type === "contact") {
      return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
    }

    if (type === "qr") {
      return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>';
    }

    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  }

  function renderActivity() {
    var activityList = document.getElementById("activityList");

    if (!activityList) {
      return;
    }

    activityList.innerHTML = activityFeed.map(function (item) {
      return [
        '<div class="activity-item searchable-item" data-search="' + (item.title + " " + item.sub).toLowerCase() + '">',
        '  <div class="activity-icon">' + iconMarkup(item.icon) + '</div>',
        '  <div class="activity-text">',
        '    <div class="activity-title">' + item.title + "</div>",
        '    <div class="activity-sub">' + item.sub + "</div>",
        "  </div>",
        '  <div class="activity-time">' + item.time + "</div>",
        "</div>"
      ].join("");
    }).join("");
  }

  function renderNotifications() {
    if (!notificationList || !notificationCount) {
      return;
    }

    notificationCount.textContent = String(state.notifications.length);

    if (!state.notifications.length) {
      notificationList.innerHTML = '<div class="notification-item"><strong>All clear</strong><span>No new notifications right now.</span></div>';
      return;
    }

    notificationList.innerHTML = state.notifications.map(function (item) {
      return [
        '<div class="notification-item">',
        "  <strong>" + item.title + "</strong>",
        "  <span>" + item.description + "</span>",
        "</div>"
      ].join("");
    }).join("");
  }

  function showToast(title, message) {
    if (!toastStack) {
      return;
    }

    var toast = document.createElement("div");
    toast.className = "toast-item";
    toast.innerHTML = '<div class="toast-title">' + title + '</div><div class="toast-message">' + message + "</div>";
    toastStack.appendChild(toast);

    window.setTimeout(function () {
      toast.remove();
    }, 2800);
  }

  function applySearchFilter() {
    var term = searchInput ? searchInput.value.trim().toLowerCase() : "";
    var candidates = Array.from(document.querySelectorAll(".searchable-item"));
    var hasMatches = false;

    if (!term) {
      candidates.forEach(function (item) {
        item.classList.remove("search-hidden");
      });
      if (emptySearchState) {
        emptySearchState.hidden = true;
      }
      return;
    }

    candidates.forEach(function (item) {
      var haystack = (item.getAttribute("data-search") || item.textContent || "").toLowerCase();
      var matched = haystack.indexOf(term) !== -1;
      item.classList.toggle("search-hidden", !matched);
      if (matched) {
        hasMatches = true;
      }
    });

    if (emptySearchState) {
      emptySearchState.hidden = hasMatches;
    }
  }

  function updateCompletion(progress) {
    state.profileCompletion = Math.min(100, progress);

    if (completionValue) {
      completionValue.textContent = state.profileCompletion + "%";
    }

    if (completionTitle) {
      completionTitle.textContent = state.profileCompletion >= 100 ? "Profile complete!" : "Almost there!";
    }

    if (ringFill) {
      var dash = 245;
      var offset = dash - (dash * state.profileCompletion) / 100;
      ringFill.style.strokeDashoffset = String(offset);
    }
  }

  function drawSparkline(canvasId, dataPoints, color) {
    var canvas = document.getElementById(canvasId);

    if (!canvas) {
      return;
    }

    var ctx = canvas.getContext("2d");
    var width = canvas.width;
    var height = canvas.height;
    var max = Math.max.apply(null, dataPoints);
    var min = Math.min.apply(null, dataPoints);
    var range = max - min || 1;
    var points = dataPoints.map(function (value, index) {
      return {
        x: (index / (dataPoints.length - 1)) * width,
        y: height - ((value - min) / range) * (height - 8) - 4
      };
    });
    var gradient = ctx.createLinearGradient(0, 0, 0, height);

    gradient.addColorStop(0, color + "66");
    gradient.addColorStop(1, color + "00");

    ctx.clearRect(0, 0, width, height);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i += 1) {
      var controlX = (points[i - 1].x + points[i].x) / 2;
      ctx.bezierCurveTo(controlX, points[i - 1].y, controlX, points[i].y, points[i].x, points[i].y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var j = 1; j < points.length; j += 1) {
      var segmentX = (points[j - 1].x + points[j].x) / 2;
      ctx.bezierCurveTo(segmentX, points[j - 1].y, segmentX, points[j].y, points[j].x, points[j].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function createGradient(ctx, height) {
    var gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(230, 57, 70, 0.38)");
    gradient.addColorStop(1, "rgba(230, 57, 70, 0)");
    return gradient;
  }

  function buildAnalyticsChart(periodKey) {
    var canvas = document.getElementById("analyticsChart");
    var period = analyticsSeries[periodKey];

    if (!canvas || typeof Chart === "undefined" || !period) {
      return;
    }

    if (chartRefs.analytics) {
      chartRefs.analytics.destroy();
    }

    chartRefs.analytics = new Chart(canvas, {
      type: "line",
      data: {
        labels: period.labels,
        datasets: [{
          label: "Views",
          data: period.data,
          borderColor: "#ff5968",
          borderWidth: 2.5,
          backgroundColor: createGradient(canvas.getContext("2d"), 240),
          pointBackgroundColor: "#ff5968",
          pointBorderColor: "#0d0d0d",
          pointBorderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.38
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#161619",
            borderColor: "rgba(230,57,70,0.24)",
            borderWidth: 1,
            titleColor: "#ffffff",
            bodyColor: "#d1d5db",
            displayColors: false
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.04)" },
            ticks: { color: "#7d8590" }
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255,255,255,0.04)" },
            ticks: {
              color: "#7d8590",
              callback: function (value) {
                return value >= 1000 ? (value / 1000).toFixed(1) + "K" : value;
              }
            }
          }
        }
      }
    });

    if (periodLabel) {
      periodLabel.textContent = period.label;
    }
  }

  function buildEngagementChart() {
    var canvas = document.getElementById("engagementChart");

    if (!canvas || typeof Chart === "undefined") {
      return;
    }

    if (chartRefs.engagement) {
      chartRefs.engagement.destroy();
    }

    chartRefs.engagement = new Chart(canvas, {
      type: "bar",
      data: {
        labels: engagementData.labels,
        datasets: [{
          data: engagementData.values,
          borderRadius: 10,
          backgroundColor: ["#ff5968", "#f87171", "#fb7185", "#ef4444", "#fb923c", "#f59e0b"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#9ca3af" }
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255,255,255,0.04)" },
            ticks: {
              color: "#9ca3af",
              callback: function (value) {
                return value + "%";
              }
            }
          }
        }
      }
    });
  }

  function buildRevenueBreakdownChart() {
    var canvas = document.getElementById("revenueBreakdownChart");

    if (!canvas || typeof Chart === "undefined") {
      return;
    }

    if (chartRefs.revenueBreakdown) {
      chartRefs.revenueBreakdown.destroy();
    }

    chartRefs.revenueBreakdown = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Pro Plan", "Business Plan", "Enterprise Plan", "Other Revenue"],
        datasets: [{
          data: [18456, 14258, 8765, 4199],
          backgroundColor: ["#ff5563", "#7c5cff", "#ffbe55", "#ff7d6d"],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        cutout: "76%",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#161619",
            borderColor: "rgba(230,57,70,0.24)",
            borderWidth: 1,
            titleColor: "#ffffff",
            bodyColor: "#d1d5db"
          }
        }
      }
    });
  }

  function buildRevenueBarChart() {
    var canvas = document.getElementById("revenueBarChart");

    if (!canvas || typeof Chart === "undefined") {
      return;
    }

    if (chartRefs.revenueBar) {
      chartRefs.revenueBar.destroy();
    }

    chartRefs.revenueBar = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        datasets: [{
          data: [7000, 8500, 7600, 11300, 13600, 16000, 19800, 14800, 18760, 20400, 24100, 27800],
          borderRadius: 10,
          backgroundColor: [
            "#ff4858", "#ff4858", "#ff4858", "#ff4858",
            "#ff4858", "#ff4858", "#ff4858", "#ff4858",
            "#ff4858", "#ff4858", "#ff4858", "#ff4858"
          ],
          maxBarThickness: 28
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#161619",
            borderColor: "rgba(230,57,70,0.24)",
            borderWidth: 1,
            titleColor: "#ffffff",
            bodyColor: "#d1d5db",
            displayColors: false,
            callbacks: {
              label: function (context) {
                return "$" + context.raw.toLocaleString();
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#9ca3af" }
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255,255,255,0.04)" },
            ticks: {
              color: "#9ca3af",
              callback: function (value) {
                return value >= 1000 ? (value / 1000) + "K" : value;
              }
            }
          }
        }
      }
    });
  }

  function handleAction(action) {
    var messages = {
      "customize-dashboard": ["Dashboard updated", "You can now personalize widgets and focus areas."],
      "upgrade-plan": ["Plan options", "Upgrade flow is ready to connect to your billing page."],
      "help-support": ["Support opened", "Connect this button to your help center or chat widget."],
      "edit-card": ["Card editor", "Open your card editor page or modal from this action."],
      "preview-card": ["Preview ready", "Previewing your digital card layout."],
      "share-card": ["Share action", "Your share flow can now hook into email or native share."],
      "download-qr": ["QR download", "Generate and download the QR asset from your backend."],
      "add-contact": ["Contact form", "Open a contact creation form or CRM sync flow here."],
      "setup-nfc": ["NFC setup", "Move the user into your NFC assignment workflow."],
      "create-card": ["Card creation", "Start a new business card template from here."],
      "download-background": ["Virtual background ready", "Generate and download the selected background asset from here."],
      "quick-action": ["Quick actions", "Connect this button to your admin shortcuts modal."],
      "contact-followup": ["Follow-up created", "This contact is ready for your outreach sequence."],
      "copy-link": ["Link copied", "Replace this toast with navigator.clipboard in production."],
      "export-report": ["Export started", "This is where CSV or PDF export should begin."],
      "save-settings": ["Settings saved", "Your dashboard preferences were updated."],
      "social-linkedin": ["LinkedIn", "Attach your public LinkedIn URL here."],
      "social-twitter": ["Social link", "Attach your X or Twitter profile here."],
      "social-instagram": ["Instagram", "Attach your Instagram profile here."],
      "clear-notifications": ["Notifications cleared", "The notification list has been reset."]
    };

    if (action === "complete-profile") {
      updateCompletion(state.profileCompletion + 5);
    }

    if (action === "clear-notifications") {
      state.notifications = [];
      renderNotifications();
    }

    var content = messages[action] || ["Action triggered", "Connect this button to your backend or modal flow."];
    showToast(content[0], content[1]);
  }

  function applyNfcCatalogFilter() {
    if (!nfcCatalogSearch) {
      return;
    }

    var term = nfcCatalogSearch.value.trim().toLowerCase();
    var nfcRows = Array.from(document.querySelectorAll(".nfc-row"));

    nfcRows.forEach(function (row) {
      var haystack = (row.getAttribute("data-search") || row.textContent || "").toLowerCase();
      var matched = !term || haystack.indexOf(term) !== -1;
      row.classList.toggle("search-hidden", !matched);
    });
  }

  function applyNfcOrdersFilter() {
    if (!nfcOrdersTableBody) {
      return;
    }

    var rows = Array.from(nfcOrdersTableBody.querySelectorAll(".nfc-order-row"));
    var term = nfcOrderSearch ? nfcOrderSearch.value.trim().toLowerCase() : "";
    var visibleCount = 0;

    rows.forEach(function (row) {
      var haystack = (row.getAttribute("data-search") || row.textContent || "").toLowerCase();
      var matched = !term || haystack.indexOf(term) !== -1;
      row.classList.toggle("search-hidden", !matched);
      if (matched) {
        visibleCount += 1;
      }
    });

    if (nfcOrdersResults) {
      nfcOrdersResults.textContent = "Showing " + visibleCount + " results";
    }
  }

  function applyCashPaymentsFilter() {
    if (!cashPaymentsTableBody) {
      return;
    }

    var rows = Array.from(cashPaymentsTableBody.querySelectorAll(".cash-payment-row"));
    var term = cashPaymentSearch ? cashPaymentSearch.value.trim().toLowerCase() : "";
    var visibleCount = 0;

    rows.forEach(function (row) {
      var haystack = (row.getAttribute("data-search") || row.textContent || "").toLowerCase();
      var matched = !term || haystack.indexOf(term) !== -1;
      row.classList.toggle("search-hidden", !matched);
      if (matched) {
        visibleCount += 1;
      }
    });

    if (cashPaymentsResults) {
      cashPaymentsResults.textContent = "Showing " + visibleCount + " results";
    }
  }

  function applySubscriptionsFilter() {
    if (!subscriptionsTableBody) {
      return;
    }

    var rows = Array.from(subscriptionsTableBody.querySelectorAll(".subscription-row"));
    var term = subscriptionSearch ? subscriptionSearch.value.trim().toLowerCase() : "";
    var visibleCount = 0;

    rows.forEach(function (row) {
      var haystack = (row.getAttribute("data-search") || row.textContent || "").toLowerCase();
      var matched = !term || haystack.indexOf(term) !== -1;
      row.classList.toggle("search-hidden", !matched);
      if (matched) {
        visibleCount += 1;
      }
    });

    if (subscriptionsResults) {
      subscriptionsResults.textContent = visibleCount ? "Showing 1 to " + visibleCount + " of 8652 results" : "Showing 0 results";
    }
  }

  function applyPlansFilter() {
    if (!plansTableBody) {
      return;
    }

    var rows = Array.from(plansTableBody.querySelectorAll(".plan-row"));
    var term = planSearch ? planSearch.value.trim().toLowerCase() : "";
    var visibleCount = 0;

    rows.forEach(function (row) {
      var haystack = (row.getAttribute("data-search") || row.textContent || "").toLowerCase();
      var matched = !term || haystack.indexOf(term) !== -1;
      row.classList.toggle("search-hidden", !matched);
      if (matched) {
        visibleCount += 1;
      }
    });

    if (plansResults) {
      plansResults.textContent = visibleCount ? "Showing 1 to " + visibleCount + " of " + rows.length + " results" : "Showing 0 results";
    }
  }

  function filterLightRows(tableBody, searchInputElement, resultsElement, rowSelector) {
    if (!tableBody) {
      return;
    }

    var rows = Array.from(tableBody.querySelectorAll(rowSelector));
    var emptyRow = tableBody.querySelector(".light-empty-cell");
    var term = searchInputElement ? searchInputElement.value.trim().toLowerCase() : "";
    var visibleCount = 0;

    rows.forEach(function (row) {
      var haystack = (row.getAttribute("data-search") || row.textContent || "").toLowerCase();
      var matched = !term || haystack.indexOf(term) !== -1;
      row.classList.toggle("search-hidden", !matched);
      if (matched) {
        visibleCount += 1;
      }
    });

    if (emptyRow) {
      emptyRow.parentElement.hidden = rows.length > 0 && visibleCount > 0;
    }

    if (resultsElement) {
      resultsElement.textContent = visibleCount ? "Showing " + visibleCount + " results" : "Showing 0 results";
    }
  }

  function applyAffiliateUsersFilter() {
    filterLightRows(affiliateUsersTableBody, affiliateUsersSearch, affiliateUsersResults, ".affiliate-user-row");
  }

  function applyAffiliateTransactionsFilter() {
    filterLightRows(affiliateTransactionsTableBody, affiliateTransactionsSearch, affiliateTransactionsResults, ".affiliate-transaction-row");
  }

  function applyAffiliateWithdrawalsFilter() {
    filterLightRows(affiliateWithdrawalsTableBody, affiliateWithdrawalsSearch, affiliateWithdrawalsResults, ".affiliate-withdrawal-row");
  }

  function applyCouponCodesFilter() {
    filterLightRows(couponCodesTableBody, couponCodeSearch, couponCodesResults, ".coupon-code-row");
  }

  function applyUsedCouponCodesFilter() {
    filterLightRows(usedCouponCodesTableBody, usedCouponCodeSearch, usedCouponCodesResults, ".used-coupon-code-row");
  }

  function applyEnquiriesFilter() {
    filterLightRows(enquiriesTableBody, enquiriesSearch, enquiriesResults, ".enquiry-row");
  }

  function applyAppointmentsFilter() {
    filterLightRows(appointmentsTableBody, appointmentsSearch, appointmentsResults, ".appointment-row");
  }

  function applyProductOrdersFilter() {
    filterLightRows(productOrdersTableBody, productOrdersSearch, productOrdersResults, ".product-order-row");
  }

  function setSubscriptionFormFeedback(message, isSuccess) {
    if (!subscriptionFormFeedback) {
      return;
    }

    subscriptionFormFeedback.hidden = false;
    subscriptionFormFeedback.classList.toggle("success", Boolean(isSuccess));
    subscriptionFormFeedback.textContent = message;
  }

  function closeSubscriptionModal() {
    if (!subscriptionModal) {
      return;
    }

    subscriptionModal.hidden = true;
    document.body.style.overflow = "";
  }

  function openSubscriptionModal(row, endDateText) {
    if (!subscriptionModal || !row) {
      return;
    }

    var rows = Array.from(document.querySelectorAll(".subscription-row"));
    var rowIndex = rows.indexOf(row);

    if (subscriptionFormFeedback) {
      subscriptionFormFeedback.hidden = true;
      subscriptionFormFeedback.textContent = "";
      subscriptionFormFeedback.classList.remove("success");
    }

    if (subscriptionEndDateInput) {
      subscriptionEndDateInput.value = endDateText || "";
    }

    if (subscriptionEditRowIndexInput) {
      subscriptionEditRowIndexInput.value = String(rowIndex);
    }

    subscriptionModal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(function () {
      if (subscriptionEndDateInput) {
        subscriptionEndDateInput.focus();
      }
    }, 50);
  }

  function setPlanFormFeedback(message, isSuccess) {
    if (!planFormFeedback) {
      return;
    }

    planFormFeedback.hidden = false;
    planFormFeedback.classList.toggle("success", Boolean(isSuccess));
    planFormFeedback.textContent = message;
  }

  function resetPlanFormState() {
    if (!planForm) {
      return;
    }

    planForm.reset();

    if (planEditRowIndexInput) {
      planEditRowIndexInput.value = "-1";
    }

    if (planModalTitle) {
      planModalTitle.textContent = "New Plan";
    }

    if (planSubmitButton) {
      planSubmitButton.textContent = "Save";
    }

    syncPlanTemplateSelection();

    if (planFormFeedback) {
      planFormFeedback.hidden = true;
      planFormFeedback.textContent = "";
      planFormFeedback.classList.remove("success");
    }
  }

  function closePlanModal() {
    if (!planModal) {
      return;
    }

    planModal.hidden = true;
    document.body.style.overflow = "";
  }

  function openPlanModal() {
    if (!planModal) {
      return;
    }

    resetPlanFormState();

    planModal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(function () {
      var firstInput = planModal.querySelector("input, select");
      if (firstInput) {
        firstInput.focus();
      }
    }, 50);
  }

  function getPlanDataFromRow(row) {
    if (!row) {
      return null;
    }

    var cells = row.querySelectorAll("td");
    var name = cells[0] ? cells[0].textContent.trim() : "";
    var priceText = cells[1] ? cells[1].textContent.replace(/[^0-9.]/g, "") : "0";
    var durationText = row.querySelector(".plan-duration-pill") ? row.querySelector(".plan-duration-pill").textContent.trim() : "Monthly";

    return {
      name: name,
      price: priceText,
      frequency: durationText === "Yearly" ? "Year" : (durationText === "Unlimited" ? "Unlimited" : "Month"),
      currency: row.getAttribute("data-plan-currency") || "USD",
      vcards: row.getAttribute("data-plan-vcards") || "0",
      trialDays: row.getAttribute("data-plan-trial-days") || "0",
      storageLimit: row.getAttribute("data-plan-storage-limit") || "200",
      customSelect: row.getAttribute("data-plan-custom-select") === "true",
      features: (row.getAttribute("data-plan-features") || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean),
      templates: (row.getAttribute("data-plan-templates") || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean)
    };
  }

  function populatePlanForm(data, rowIndex) {
    if (!planForm || !data) {
      return;
    }

    resetPlanFormState();

    if (planModalTitle) {
      planModalTitle.textContent = "Edit Plan";
    }

    if (planSubmitButton) {
      planSubmitButton.textContent = "Update Plan";
    }

    if (planEditRowIndexInput) {
      planEditRowIndexInput.value = String(rowIndex);
    }

    var planNameInput = document.getElementById("planName");
    var planFrequencyInput = document.getElementById("planFrequency");
    var planCurrencyInput = document.getElementById("planCurrency");
    var planPriceInput = document.getElementById("planPrice");
    var planVcardsInput = document.getElementById("planVcards");
    var planTrialDaysInput = document.getElementById("planTrialDays");
    var planStorageLimitInput = document.getElementById("planStorageLimit");
    var planCustomSelectInput = document.getElementById("planCustomSelect");

    if (planNameInput) {
      planNameInput.value = data.name;
    }
    if (planFrequencyInput) {
      planFrequencyInput.value = data.frequency;
    }
    if (planCurrencyInput) {
      planCurrencyInput.value = data.currency;
    }
    if (planPriceInput) {
      planPriceInput.value = data.price;
    }
    if (planVcardsInput) {
      planVcardsInput.value = data.vcards;
    }
    if (planTrialDaysInput) {
      planTrialDaysInput.value = data.trialDays;
    }
    if (planStorageLimitInput) {
      planStorageLimitInput.value = data.storageLimit;
    }
    if (planCustomSelectInput) {
      planCustomSelectInput.checked = Boolean(data.customSelect);
    }

    Array.from(planForm.querySelectorAll('input[name="features"]')).forEach(function (checkbox) {
      checkbox.checked = data.features.indexOf(checkbox.value) !== -1;
    });

    Array.from(planForm.querySelectorAll('input[name="templates"]')).forEach(function (checkbox) {
      checkbox.checked = data.templates.indexOf(checkbox.value) !== -1;
    });

    syncPlanTemplateSelection();
  }

  function createPlanRowMarkup(planData) {
    var durationClass = planData.frequency.toLowerCase() === "year" ? "yearly" : (planData.frequency.toLowerCase() === "unlimited" ? "unlimited" : "monthly");
    var durationLabel = planData.frequency === "Month" ? "Monthly" : (planData.frequency === "Year" ? "Yearly" : "Unlimited");

    return [
      "<td>" + planData.name + "</td>",
      "<td>$" + Number(planData.price || 0).toFixed(2) + "</td>",
      '<td><label class="switch plan-status-switch" aria-label="Status for ' + planData.name + ' plan"><input type="checkbox" checked /><span class="switch-slider"></span></label></td>',
      '<td><span class="plan-duration-pill ' + durationClass + '">' + durationLabel + "</span></td>",
      '<td><label class="switch plan-default-switch" aria-label="Default for ' + planData.name + ' plan"><input type="checkbox" /><span class="switch-slider"></span></label></td>',
      '<td><div class="subscription-action-cell"><button class="subscription-icon-btn edit" type="button" data-plan-action="edit" data-plan-name="' + planData.name + '" aria-label="Edit ' + planData.name + ' plan"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><path d="M16.5 3.5A2.12 2.12 0 0 1 19.5 6.5L8 18L4 19L5 15L16.5 3.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path></svg></button><button class="subscription-icon-btn delete" type="button" data-plan-action="delete" data-plan-name="' + planData.name + '" aria-label="Delete ' + planData.name + ' plan"><svg viewBox="0 0 24 24" fill="none"><path d="M3 6H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><path d="M8 6V4.5C8 3.67 8.67 3 9.5 3H14.5C15.33 3 16 3.67 16 4.5V6" stroke="currentColor" stroke-width="2"></path><path d="M19 6L18.13 18.14C18.05 19.27 17.11 20.14 15.98 20.14H8.02C6.89 20.14 5.95 19.27 5.87 18.14L5 6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path><path d="M10 10V16" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><path d="M14 10V16" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg></button></div></td>'
    ].join("");
  }

  function applyPlanDataToRow(row, planData) {
    if (!row) {
      return;
    }

    row.className = "searchable-item plan-row";
    row.setAttribute("data-search", [planData.name, Number(planData.price || 0).toFixed(2), planData.frequency, "active"].join(" ").toLowerCase());
    row.setAttribute("data-plan-currency", planData.currency);
    row.setAttribute("data-plan-vcards", planData.vcards);
    row.setAttribute("data-plan-trial-days", planData.trialDays);
    row.setAttribute("data-plan-storage-limit", planData.storageLimit);
    row.setAttribute("data-plan-custom-select", planData.customSelect ? "true" : "false");
    row.setAttribute("data-plan-features", planData.features.join(","));
    row.setAttribute("data-plan-templates", planData.templates.join(","));
    row.innerHTML = createPlanRowMarkup(planData);
  }

  function closeAffiliateGuideModal() {
    if (!affiliateGuideModal) {
      return;
    }

    affiliateGuideModal.hidden = true;
    document.body.style.overflow = "";
  }

  function openAffiliateGuideModal() {
    if (!affiliateGuideModal) {
      return;
    }

    affiliateGuideModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function setCouponFormFeedback(message, isSuccess) {
    if (!couponFormFeedback) {
      return;
    }

    couponFormFeedback.hidden = false;
    couponFormFeedback.classList.toggle("success", Boolean(isSuccess));
    couponFormFeedback.textContent = message;
  }

  function resetCouponFormState() {
    if (!couponForm) {
      return;
    }

    couponForm.reset();

    if (couponEditRowIndexInput) {
      couponEditRowIndexInput.value = "-1";
    }

    if (couponModalTitle) {
      couponModalTitle.textContent = "Add Coupon Code";
    }

    if (couponSubmitButton) {
      couponSubmitButton.textContent = "Save";
    }

    if (couponFormFeedback) {
      couponFormFeedback.hidden = true;
      couponFormFeedback.textContent = "";
      couponFormFeedback.classList.remove("success");
    }
  }

  function closeCouponModal() {
    if (!couponModal) {
      return;
    }

    couponModal.hidden = true;
    document.body.style.overflow = "";
  }

  function openCouponModal() {
    if (!couponModal) {
      return;
    }

    resetCouponFormState();
    couponModal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(function () {
      var nameInput = document.getElementById("couponName");
      if (nameInput) {
        nameInput.focus();
      }
    }, 50);
  }

  function formatCouponDate(value) {
    if (!value) {
      return "";
    }

    var date = new Date(value + "T00:00:00");
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(",", "");
  }

  function parseCouponDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toISOString().slice(0, 10);
  }

  function getCouponDataFromRow(row) {
    if (!row) {
      return null;
    }

    var cells = row.querySelectorAll("td");
    var typeText = cells[1] ? cells[1].textContent.trim() : "Percentage";
    var discountText = cells[2] ? cells[2].textContent.replace(/[^0-9.]/g, "") : "0";
    var statusInput = row.querySelector(".coupon-status-switch input");

    return {
      name: cells[0] ? cells[0].textContent.trim() : "",
      type: typeText,
      discount: discountText,
      limit: cells[3] ? cells[3].textContent.trim() : "0",
      expireAt: cells[4] ? cells[4].textContent.trim() : "",
      active: statusInput ? statusInput.checked : false
    };
  }

  function populateCouponForm(data, rowIndex) {
    if (!couponForm || !data) {
      return;
    }

    resetCouponFormState();

    if (couponModalTitle) {
      couponModalTitle.textContent = "Edit Coupon Code";
    }

    if (couponSubmitButton) {
      couponSubmitButton.textContent = "Update";
    }

    if (couponEditRowIndexInput) {
      couponEditRowIndexInput.value = String(rowIndex);
    }

    var couponNameInput = document.getElementById("couponName");
    var couponTypeInput = document.getElementById("couponType");
    var couponDiscountInput = document.getElementById("couponDiscount");
    var couponLimitInput = document.getElementById("couponLimitLeft");
    var couponExpireInput = document.getElementById("couponExpireAt");
    var couponActiveInput = document.getElementById("couponActive");

    if (couponNameInput) {
      couponNameInput.value = data.name;
    }
    if (couponTypeInput) {
      couponTypeInput.value = data.type;
    }
    if (couponDiscountInput) {
      couponDiscountInput.value = data.discount;
    }
    if (couponLimitInput) {
      couponLimitInput.value = data.limit;
    }
    if (couponExpireInput) {
      couponExpireInput.value = parseCouponDate(data.expireAt);
    }
    if (couponActiveInput) {
      couponActiveInput.checked = Boolean(data.active);
    }
  }

  function createCouponRowMarkup(couponData) {
    var discountLabel = couponData.type === "Percentage" ? couponData.discount + "%" : "$" + Number(couponData.discount || 0).toFixed(2);
    return [
      "<td>" + couponData.name + "</td>",
      '<td><span class="plan-duration-pill monthly">' + couponData.type + "</span></td>",
      "<td>" + discountLabel + "</td>",
      "<td>" + couponData.limit + "</td>",
      '<td><span class="expiry-pill">' + formatCouponDate(couponData.expireAt) + "</span></td>",
      '<td><label class="switch coupon-status-switch" aria-label="Status for ' + couponData.name + ' coupon"><input type="checkbox"' + (couponData.active ? " checked" : "") + ' /><span class="switch-slider"></span></label></td>',
      '<td><div class="subscription-action-cell"><button class="subscription-icon-btn edit" type="button" data-coupon-action="edit" data-coupon-name="' + couponData.name + '" aria-label="Edit ' + couponData.name + ' coupon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><path d="M16.5 3.5A2.12 2.12 0 0 1 19.5 6.5L8 18L4 19L5 15L16.5 3.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path></svg></button><button class="subscription-icon-btn delete" type="button" data-coupon-action="delete" data-coupon-name="' + couponData.name + '" aria-label="Delete ' + couponData.name + ' coupon"><svg viewBox="0 0 24 24" fill="none"><path d="M3 6H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><path d="M8 6V4.5C8 3.67 8.67 3 9.5 3H14.5C15.33 3 16 3.67 16 4.5V6" stroke="currentColor" stroke-width="2"></path><path d="M19 6L18.13 18.14C18.05 19.27 17.11 20.14 15.98 20.14H8.02C6.89 20.14 5.95 19.27 5.87 18.14L5 6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path><path d="M10 10V16" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><path d="M14 10V16" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg></button></div></td>'
    ].join("");
  }

  function applyCouponDataToRow(row, couponData) {
    if (!row) {
      return;
    }

    row.className = "searchable-item coupon-code-row";
    row.setAttribute("data-search", [couponData.name, couponData.type, couponData.discount, couponData.limit, formatCouponDate(couponData.expireAt), couponData.active ? "active" : "inactive"].join(" ").toLowerCase());
    row.innerHTML = createCouponRowMarkup(couponData);
  }

  function syncPlanTemplateSelection() {
    if (!planForm) {
      return;
    }

    var templateCheckboxes = Array.from(planForm.querySelectorAll('input[name="templates"]'));
    var checkedCount = 0;

    templateCheckboxes.forEach(function (checkbox) {
      var card = checkbox.closest(".plan-template-card");
      if (card) {
        card.classList.toggle("selected", checkbox.checked);
      }
      if (checkbox.checked) {
        checkedCount += 1;
      }
    });

    if (planSelectAllTemplates) {
      planSelectAllTemplates.checked = templateCheckboxes.length > 0 && checkedCount === templateCheckboxes.length;
      planSelectAllTemplates.indeterminate = checkedCount > 0 && checkedCount < templateCheckboxes.length;
    }
  }

  function defaultNfcPreviewMarkup() {
    return '<span class="nfc-upload-placeholder"><span class="nfc-upload-bar"></span><span class="nfc-upload-bar short"></span></span>';
  }

  function resetNfcPreview(target) {
    if (!target) {
      return;
    }

    target.innerHTML = defaultNfcPreviewMarkup();
  }

  function setNfcFormFeedback(message, isSuccess) {
    if (!nfcCardFormFeedback) {
      return;
    }

    nfcCardFormFeedback.hidden = false;
    nfcCardFormFeedback.classList.toggle("success", Boolean(isSuccess));
    nfcCardFormFeedback.textContent = message;
  }

  function closeNfcModal() {
    if (!nfcCardModal) {
      return;
    }

    nfcCardModal.hidden = true;
    document.body.style.overflow = "";
  }

  function closeNfcGuideModal() {
    if (!nfcGuideModal) {
      return;
    }

    nfcGuideModal.hidden = true;
    document.body.style.overflow = "";
  }

  function openNfcModal() {
    if (!nfcCardModal) {
      return;
    }

    if (nfcCardFormFeedback) {
      nfcCardFormFeedback.hidden = true;
      nfcCardFormFeedback.textContent = "";
      nfcCardFormFeedback.classList.remove("success");
    }

    nfcCardModal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(function () {
      var firstInput = nfcCardModal.querySelector("input, textarea");
      if (firstInput) {
        firstInput.focus();
      }
    }, 50);
  }

  function openNfcGuideModal() {
    if (!nfcGuideModal) {
      return;
    }

    nfcGuideModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function readPreviewImage(input, target) {
    if (!input || !target) {
      return;
    }

    var file = input.files && input.files[0];
    if (!file) {
      resetNfcPreview(target);
      return;
    }

    var reader = new FileReader();
    reader.onload = function (loadEvent) {
      target.innerHTML = '<img src="' + loadEvent.target.result + '" alt="NFC card preview" />';
    };
    reader.readAsDataURL(file);
  }

  function buildNfcThumbClass(name) {
    var value = name.toLowerCase();
    if (value.indexOf("gold") !== -1) {
      return "nfc-gold-thumb";
    }

    if (value.indexOf("silver") !== -1 || value.indexOf("steel") !== -1) {
      return "nfc-silver-thumb";
    }

    return "nfc-rose-thumb";
  }

  function buildNfcCardRow(formData) {
    var cardName = formData.get("cardName").trim();
    var price = Number(formData.get("price") || 0).toFixed(2);
    var description = formData.get("description").trim();
    var cardToneClass = buildNfcThumbClass(cardName);
    var article = document.createElement("article");

    article.className = "nfc-row searchable-item";
    article.setAttribute("data-search", [cardName, description, price, "nfc card"].join(" ").toLowerCase());
    article.innerHTML = [
      '<div class="nfc-name-cell">',
      '  <div class="nfc-product-thumb ' + cardToneClass + '">',
      '    <div class="nfc-chip-mark">NFC</div>',
      '    <div class="nfc-thumb-brand">SYNC</div>',
      '    <div class="nfc-thumb-copy">',
      '      <strong>NEW CARD</strong>',
      '      <span>Digital Business</span>',
      '      <span>Custom NFC Collection</span>',
      "    </div>",
      "  </div>",
      '  <div class="nfc-product-meta">',
      '    <h3>' + cardName + "</h3>",
      "  </div>",
      "</div>",
      '<div class="nfc-orders-cell"><span class="nfc-order-badge">0</span></div>',
      '<div class="nfc-price-cell">$' + price + "</div>",
      '<div class="nfc-action-cell">',
      '  <button class="nfc-action-btn edit" type="button" aria-label="Edit ' + cardName + '" data-nfc-action="edit-card" data-card-name="' + cardName + '">',
      '    <svg viewBox="0 0 24 24" fill="none"><path d="M12 20H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><path d="M16.5 3.5A2.12 2.12 0 0 1 19.5 6.5L8 18L4 19L5 15L16.5 3.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path></svg>',
      "  </button>",
      '  <button class="nfc-action-btn delete" type="button" aria-label="Delete ' + cardName + '" data-nfc-action="delete-card" data-card-name="' + cardName + '">',
      '    <svg viewBox="0 0 24 24" fill="none"><path d="M3 6H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><path d="M8 6V4.5C8 3.67 8.67 3 9.5 3H14.5C15.33 3 16 3.67 16 4.5V6" stroke="currentColor" stroke-width="2"></path><path d="M19 6L18.13 18.14C18.05 19.27 17.11 20.14 15.98 20.14H8.02C6.89 20.14 5.95 19.27 5.87 18.14L5 6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path><path d="M10 10V16" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><path d="M14 10V16" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>',
      "  </button>",
      "</div>"
    ].join("");

    return article;
  }

  function updateUserDirectoryCount() {
    if (!userDirectoryBody || !userDirectoryCount) {
      return;
    }

    userDirectoryCount.textContent = userDirectoryBody.children.length + " users";
  }

  function avatarInitials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join("");
  }

  function planClass(plan) {
    if (plan === "Business Plan") {
      return "business";
    }

    if (plan === "Enterprise") {
      return "enterprise";
    }

    return "pro";
  }

  function statusClass(status) {
    if (status === "Inactive") {
      return "inactive";
    }

    if (status === "Pending") {
      return "pending";
    }

    return "active";
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function setUserFormFeedback(message, isSuccess) {
    if (!userFormFeedback) {
      return;
    }

    userFormFeedback.hidden = false;
    userFormFeedback.classList.toggle("success", Boolean(isSuccess));
    userFormFeedback.textContent = message;
  }

  function buildUserRow(formData) {
    var firstName = formData.get("firstName").trim();
    var lastName = formData.get("lastName").trim();
    var fullName = (firstName + " " + lastName).trim();
    var email = formData.get("email").trim();
    var username = (firstName + lastName).toLowerCase().replace(/[^a-z0-9]/g, "");
    var plan = "Pending Purchase";
    var cards = "1";
    var status = formData.get("status");
    var row = document.createElement("tr");
    var searchTerms = [
      fullName,
      username,
      email,
      plan,
      status,
      formData.get("phone") || ""
    ].join(" ").toLowerCase();

    row.className = "searchable-item";
    row.setAttribute("data-search", searchTerms);
    row.innerHTML = [
      '<td><div class="table-user"><span class="mini-avatar">' + avatarInitials(fullName) + '</span><div><strong>' + fullName + '</strong><div class="subtle-handle">@' + username + '</div></div></div></td>',
      "<td>" + email + "</td>",
      '<td><span class="plan-pill ' + planClass(plan) + '">' + plan + "</span></td>",
      "<td>" + cards + "</td>",
      "<td>" + formatDate(new Date()) + "</td>",
      '<td><span class="status-badge ' + statusClass(status) + '">' + status + "</span></td>"
    ].join("");

    return row;
  }

  function closeUserModal() {
    if (!userModal) {
      return;
    }

    userModal.hidden = true;
    document.body.style.overflow = "";
  }

  function openUserModal() {
    if (!userModal) {
      return;
    }

    if (userFormFeedback) {
      userFormFeedback.hidden = true;
      userFormFeedback.textContent = "";
      userFormFeedback.classList.remove("success");
    }

    userModal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(function () {
      var firstInput = userModal.querySelector("input, select, textarea");
      if (firstInput) {
        firstInput.focus();
      }
    }, 50);
  }

  function resetProfilePreview() {
    if (!userProfilePreview) {
      return;
    }

    userProfilePreview.innerHTML = [
      '<svg width="72" height="72" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '<circle cx="32" cy="21" r="11" fill="#A9A9A9"/>',
      '<path d="M16 52c2.8-8.4 9.2-13 16-13s13.2 4.6 16 13" fill="#A9A9A9"/>',
      "</svg>"
    ].join("");
  }

  if (searchInput) {
    searchInput.addEventListener("input", applySearchFilter);
  }

  if (nfcCatalogSearch) {
    nfcCatalogSearch.addEventListener("input", applyNfcCatalogFilter);
  }

  if (vcardTabButtons.length) {
    vcardTabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var targetId = button.getAttribute("data-vcard-tab-target");
        var targetPanel = document.getElementById(targetId);

        vcardTabButtons.forEach(function (item) {
          item.classList.remove("active");
          item.setAttribute("aria-selected", "false");
        });

        Array.from(document.querySelectorAll("[data-vcard-tab-target]")).forEach(function (tabButton) {
          var panelId = tabButton.getAttribute("data-vcard-tab-target");
          var panel = panelId ? document.getElementById(panelId) : null;

          if (panel) {
            panel.classList.remove("active");
          }
        });

        Array.from(document.querySelectorAll("#vcardListPanel, #vcardTemplatesPanel")).forEach(function (panel) {
          panel.classList.remove("active");
        });

        if (button.classList.contains("vcard-tab-btn")) {
          button.classList.add("active");
          button.setAttribute("aria-selected", "true");
        } else {
          Array.from(document.querySelectorAll('.vcard-tab-btn[data-vcard-tab-target="' + targetId + '"]')).forEach(function (matchingButton) {
            matchingButton.classList.add("active");
            matchingButton.setAttribute("aria-selected", "true");
          });
        }

        if (targetPanel) {
          targetPanel.classList.add("active");
        }
      });
    });
  }

  if (nfcOrderSearch) {
    nfcOrderSearch.addEventListener("input", applyNfcOrdersFilter);
  }

  if (cashPaymentSearch) {
    cashPaymentSearch.addEventListener("input", applyCashPaymentsFilter);
  }

  if (subscriptionSearch) {
    subscriptionSearch.addEventListener("input", applySubscriptionsFilter);
  }

  if (planSearch) {
    planSearch.addEventListener("input", applyPlansFilter);
  }

  if (affiliateUsersSearch) {
    affiliateUsersSearch.addEventListener("input", applyAffiliateUsersFilter);
  }

  if (affiliateTransactionsSearch) {
    affiliateTransactionsSearch.addEventListener("input", applyAffiliateTransactionsFilter);
  }

  if (affiliateWithdrawalsSearch) {
    affiliateWithdrawalsSearch.addEventListener("input", applyAffiliateWithdrawalsFilter);
  }

  if (couponCodeSearch) {
    couponCodeSearch.addEventListener("input", applyCouponCodesFilter);
  }

  if (usedCouponCodeSearch) {
    usedCouponCodeSearch.addEventListener("input", applyUsedCouponCodesFilter);
  }

  if (enquiriesSearch) {
    enquiriesSearch.addEventListener("input", applyEnquiriesFilter);
  }

  if (appointmentsSearch) {
    appointmentsSearch.addEventListener("input", applyAppointmentsFilter);
  }

  if (productOrdersSearch) {
    productOrdersSearch.addEventListener("input", applyProductOrdersFilter);
  }

  if (settingsTabButtons.length) {
    settingsTabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var targetId = button.getAttribute("data-settings-tab-target");
        var targetPanel = document.getElementById(targetId);

        settingsTabButtons.forEach(function (item) {
          item.classList.remove("active");
          item.setAttribute("aria-selected", "false");
        });

        Array.from(document.querySelectorAll(".client-settings-panel")).forEach(function (panel) {
          panel.classList.remove("active");
        });

        button.classList.add("active");
        button.setAttribute("aria-selected", "true");

        if (targetPanel) {
          targetPanel.classList.add("active");
        }
      });
    });
  }

  if (affiliationsTabButtons.length) {
    affiliationsTabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var targetId = button.getAttribute("data-affiliations-tab-target");
        var targetPanel = document.getElementById(targetId);

        affiliationsTabButtons.forEach(function (item) {
          item.classList.remove("active");
          item.setAttribute("aria-selected", "false");
        });

        Array.from(document.querySelectorAll("#affiliateUsersPanel, #affiliateTransactionsPanel")).forEach(function (panel) {
          panel.classList.remove("active");
        });

        button.classList.add("active");
        button.setAttribute("aria-selected", "true");

        if (targetPanel) {
          targetPanel.classList.add("active");
        }
      });
    });
  }

  if (couponTabButtons.length) {
    couponTabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var targetId = button.getAttribute("data-coupon-tab-target");
        var targetPanel = document.getElementById(targetId);

        couponTabButtons.forEach(function (item) {
          item.classList.remove("active");
          item.setAttribute("aria-selected", "false");
        });

        Array.from(document.querySelectorAll("#couponCodeListPanel, #usedCouponCodeListPanel")).forEach(function (panel) {
          panel.classList.remove("active");
        });

        button.classList.add("active");
        button.setAttribute("aria-selected", "true");

        if (targetPanel) {
          targetPanel.classList.add("active");
        }
      });
    });
  }

  if (subscriptionsTabButtons.length) {
    subscriptionsTabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var targetId = button.getAttribute("data-subscriptions-tab-target");
        var targetPanel = document.getElementById(targetId);

        subscriptionsTabButtons.forEach(function (item) {
          item.classList.remove("active");
          item.setAttribute("aria-selected", "false");
        });

        Array.from(document.querySelectorAll("#subscribedPlansPanel, #plansPanel")).forEach(function (panel) {
          panel.classList.remove("active");
        });

        button.classList.add("active");
        button.setAttribute("aria-selected", "true");

        if (targetPanel) {
          targetPanel.classList.add("active");
        }
      });
    });
  }

  if (nfcTabButtons.length) {
    nfcTabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var targetId = button.getAttribute("data-nfc-tab-target");
        var targetPanel = document.getElementById(targetId);

        nfcTabButtons.forEach(function (item) {
          item.classList.remove("active");
          item.setAttribute("aria-selected", "false");
        });

        Array.from(document.querySelectorAll("#nfcCardsPanel, #nfcOrdersPanel")).forEach(function (panel) {
          panel.classList.remove("active");
        });

        button.classList.add("active");
        button.setAttribute("aria-selected", "true");

        if (targetPanel) {
          targetPanel.classList.add("active");
        }
      });
    });
  }

  if (openNfcModalButton) {
    openNfcModalButton.addEventListener("click", function () {
      openNfcModal();
    });
  }

  if (closeNfcModalButton) {
    closeNfcModalButton.addEventListener("click", function () {
      closeNfcModal();
    });
  }

  if (nfcCardModalBackdrop) {
    nfcCardModalBackdrop.addEventListener("click", function () {
      closeNfcModal();
    });
  }

  if (closeSubscriptionModalButton) {
    closeSubscriptionModalButton.addEventListener("click", function () {
      closeSubscriptionModal();
    });
  }

  if (subscriptionModalBackdrop) {
    subscriptionModalBackdrop.addEventListener("click", function () {
      closeSubscriptionModal();
    });
  }

  if (openPlanModalButton) {
    openPlanModalButton.addEventListener("click", function () {
      openPlanModal();
    });
  }

  if (closePlanModalButton) {
    closePlanModalButton.addEventListener("click", function () {
      closePlanModal();
    });
  }

  if (planModalBackdrop) {
    planModalBackdrop.addEventListener("click", function () {
      closePlanModal();
    });
  }

  if (openAffiliateGuideModalButton) {
    openAffiliateGuideModalButton.addEventListener("click", function () {
      openAffiliateGuideModal();
    });
  }

  if (closeAffiliateGuideModalButton) {
    closeAffiliateGuideModalButton.addEventListener("click", function () {
      closeAffiliateGuideModal();
    });
  }

  if (affiliateGuideModalBackdrop) {
    affiliateGuideModalBackdrop.addEventListener("click", function () {
      closeAffiliateGuideModal();
    });
  }

  if (openCouponModalButton) {
    openCouponModalButton.addEventListener("click", function () {
      openCouponModal();
    });
  }

  if (closeCouponModalButton) {
    closeCouponModalButton.addEventListener("click", function () {
      closeCouponModal();
    });
  }

  if (couponModalBackdrop) {
    couponModalBackdrop.addEventListener("click", function () {
      closeCouponModal();
    });
  }

  if (planSelectAllTemplates && planForm) {
    planSelectAllTemplates.addEventListener("change", function () {
      Array.from(planForm.querySelectorAll('input[name="templates"]')).forEach(function (checkbox) {
        checkbox.checked = planSelectAllTemplates.checked;
      });
      syncPlanTemplateSelection();
    });
  }

  if (planForm) {
    Array.from(planForm.querySelectorAll('input[name="templates"]')).forEach(function (checkbox) {
      checkbox.addEventListener("change", syncPlanTemplateSelection);
    });
  }

  if (closeNfcGuideModalButton) {
    closeNfcGuideModalButton.addEventListener("click", function () {
      closeNfcGuideModal();
    });
  }

  if (nfcGuideModalBackdrop) {
    nfcGuideModalBackdrop.addEventListener("click", function () {
      closeNfcGuideModal();
    });
  }

  // NFC Cards Page Handlers
  if (openNfcHowItWorksModal) {
    openNfcHowItWorksModal.addEventListener("click", function () {
      if (nfcHowItWorksModal) {
        nfcHowItWorksModal.hidden = false;
        document.body.style.overflow = "hidden";
      }
    });
  }

  if (closeNfcHowItWorksModal) {
    closeNfcHowItWorksModal.addEventListener("click", function () {
      if (nfcHowItWorksModal) {
        nfcHowItWorksModal.hidden = true;
        document.body.style.overflow = "";
      }
    });
  }

  if (nfcHowItWorksModalBackdrop) {
    nfcHowItWorksModalBackdrop.addEventListener("click", function () {
      if (nfcHowItWorksModal) {
        nfcHowItWorksModal.hidden = true;
        document.body.style.overflow = "";
      }
    });
  }

  if (openNfcGuideModal) {
    openNfcGuideModal.addEventListener("click", function () {
      if (nfcHowItWorksModal) {
        nfcHowItWorksModal.hidden = false;
        document.body.style.overflow = "hidden";
      }
    });
  }

  if (openNfcOrderModal) {
    openNfcOrderModal.addEventListener("click", function () {
      if (nfcOrderModal) {
        nfcOrderModal.hidden = false;
        document.body.style.overflow = "hidden";
      }
    });
  }

  if (orderNfcButton) {
    orderNfcButton.addEventListener("click", function () {
      if (nfcOrderModal) {
        nfcOrderModal.hidden = false;
        document.body.style.overflow = "hidden";
      }
    });
  }

  if (closeNfcOrderModal) {
    closeNfcOrderModal.addEventListener("click", function () {
      if (nfcOrderModal) {
        nfcOrderModal.hidden = true;
        document.body.style.overflow = "";
      }
    });
  }

  if (nfcOrderModalBackdrop) {
    nfcOrderModalBackdrop.addEventListener("click", function () {
      if (nfcOrderModal) {
        nfcOrderModal.hidden = true;
        document.body.style.overflow = "";
      }
    });
  }

  if (cancelNfcOrder) {
    cancelNfcOrder.addEventListener("click", function () {
      if (nfcOrderModal) {
        nfcOrderModal.hidden = true;
        document.body.style.overflow = "";
      }
      if (nfcOrderForm) {
        nfcOrderForm.reset();
      }
    });
  }

  if (nfcOrderForm) {
    nfcOrderForm.addEventListener("submit", function (event) {
      event.preventDefault();
      showToast("NFC Order Placed", "Your NFC card order has been successfully submitted. You'll receive a confirmation email shortly.");
      if (nfcOrderModal) {
        nfcOrderModal.hidden = true;
        document.body.style.overflow = "";
      }
      nfcOrderForm.reset();
    });
  }

  if (nfcTableSearch) {
    nfcTableSearch.addEventListener("input", function () {
      var term = nfcTableSearch.value.trim().toLowerCase();
      var rows = Array.from(document.querySelectorAll(".nfc-card-row"));
      var visibleCount = 0;

      rows.forEach(function (row) {
        var haystack = (row.getAttribute("data-search") || row.textContent || "").toLowerCase();
        var matched = !term || haystack.indexOf(term) !== -1;
        row.classList.toggle("search-hidden", !matched);
        if (matched) {
          visibleCount += 1;
        }
      });

      if (nfcCardsResults) {
        nfcCardsResults.textContent = "Showing " + visibleCount + " results";
      }
    });
  }

  if (toggleUserForm) {
    toggleUserForm.addEventListener("click", function () {
      openUserModal();
    });
  }

  if (closeUserForm) {
    closeUserForm.addEventListener("click", function () {
      closeUserModal();
    });
  }

  if (userModalBackdrop) {
    userModalBackdrop.addEventListener("click", function () {
      closeUserModal();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && userModal && !userModal.hidden) {
      closeUserModal();
    }

    if (event.key === "Escape" && nfcCardModal && !nfcCardModal.hidden) {
      closeNfcModal();
    }

    if (event.key === "Escape" && nfcGuideModal && !nfcGuideModal.hidden) {
      closeNfcGuideModal();
    }

    if (event.key === "Escape" && subscriptionModal && !subscriptionModal.hidden) {
      closeSubscriptionModal();
    }

    if (event.key === "Escape" && planModal && !planModal.hidden) {
      closePlanModal();
    }

    if (event.key === "Escape" && affiliateGuideModal && !affiliateGuideModal.hidden) {
      closeAffiliateGuideModal();
    }

    if (event.key === "Escape" && couponModal && !couponModal.hidden) {
      closeCouponModal();
    }
  });

  if (resetSubscriptionFormButton && subscriptionForm) {
    resetSubscriptionFormButton.addEventListener("click", function () {
      subscriptionForm.reset();
      if (subscriptionFormFeedback) {
        subscriptionFormFeedback.hidden = true;
        subscriptionFormFeedback.textContent = "";
        subscriptionFormFeedback.classList.remove("success");
      }
      closeSubscriptionModal();
    });
  }

  if (resetPlanFormButton && planForm) {
    resetPlanFormButton.addEventListener("click", function () {
      resetPlanFormState();
      closePlanModal();
    });
  }

  if (resetCouponFormButton && couponForm) {
    resetCouponFormButton.addEventListener("click", function () {
      resetCouponFormState();
      closeCouponModal();
    });
  }

  if (resetNfcCardFormButton && nfcCardForm) {
    resetNfcCardFormButton.addEventListener("click", function () {
      nfcCardForm.reset();
      resetNfcPreview(nfcFrontPreview);
      resetNfcPreview(nfcBackPreview);
      if (nfcCardFormFeedback) {
        nfcCardFormFeedback.hidden = true;
        nfcCardFormFeedback.textContent = "";
        nfcCardFormFeedback.classList.remove("success");
      }
      closeNfcModal();
    });
  }

  if (resetUserForm && addUserForm) {
    resetUserForm.addEventListener("click", function () {
      addUserForm.reset();
      resetProfilePreview();
      if (userFormFeedback) {
        userFormFeedback.hidden = true;
        userFormFeedback.textContent = "";
        userFormFeedback.classList.remove("success");
      }
      closeUserModal();
    });
  }

  if (userProfileInput && userProfilePreview) {
    userProfileInput.addEventListener("change", function () {
      var file = userProfileInput.files && userProfileInput.files[0];
      if (!file) {
        resetProfilePreview();
        return;
      }

      var reader = new FileReader();
      reader.onload = function (loadEvent) {
        userProfilePreview.innerHTML = '<img src="' + loadEvent.target.result + '" alt="Profile preview" />';
      };
      reader.readAsDataURL(file);
    });
  }

  if (nfcCardFrontInput && nfcFrontPreview) {
    nfcCardFrontInput.addEventListener("change", function () {
      readPreviewImage(nfcCardFrontInput, nfcFrontPreview);
    });
  }

  if (nfcCardBackInput && nfcBackPreview) {
    nfcCardBackInput.addEventListener("change", function () {
      readPreviewImage(nfcCardBackInput, nfcBackPreview);
    });
  }

  document.addEventListener("click", function (event) {
    var copyButton = event.target.closest("[data-copy-text]");
    var cloneButton = event.target.closest("[data-clone-name]");
    var nfcActionButton = event.target.closest("[data-nfc-action]");
    var nfcOrderViewButton = event.target.closest("[data-nfc-order-action]");
    var cashActionButton = event.target.closest("[data-cash-action]");
    var subscriptionActionButton = event.target.closest("[data-subscription-action]");
    var planActionButton = event.target.closest("[data-plan-action]");
    var couponActionButton = event.target.closest("[data-coupon-action]");

    if (copyButton) {
      var copyText = copyButton.getAttribute("data-copy-text");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copyText);
      }
      showToast("Link copied", copyText);
    }

    if (cloneButton) {
      showToast("Clone queued", cloneButton.getAttribute("data-clone-name") + " is ready to clone to another user.");
    }

    if (nfcActionButton) {
      var nfcAction = nfcActionButton.getAttribute("data-nfc-action");
      var nfcCardName = nfcActionButton.getAttribute("data-card-name") || "This NFC card";

      if (nfcAction === "how-it-works") {
        openNfcGuideModal();
      }

      if (nfcAction === "add-card") {
        showToast("Add NFC card", "Open your NFC card creation form from this action.");
      }

      if (nfcAction === "edit-card") {
        showToast("Edit NFC card", nfcCardName + " is ready for updates.");
      }

      if (nfcAction === "delete-card") {
        showToast("Delete NFC card", "Connect " + nfcCardName + " to your delete confirmation flow.");
      }
    }

    if (nfcOrderViewButton) {
      showToast("Order preview", nfcOrderViewButton.getAttribute("data-order-name") + " order details are ready to open.");
    }

    if (cashActionButton) {
      showToast("Attachment download", cashActionButton.getAttribute("data-payment-name") + " receipt is ready to download.");
    }

    if (subscriptionActionButton) {
      var subscriptionAction = subscriptionActionButton.getAttribute("data-subscription-action");
      var subscriptionName = subscriptionActionButton.getAttribute("data-subscription-name") || "This subscription";
      var subscriptionRow = subscriptionActionButton.closest(".subscription-row");

      if (subscriptionAction === "view") {
        showToast("Subscription preview", subscriptionName + " subscription details are ready to open.");
      }

      if (subscriptionAction === "edit") {
        openSubscriptionModal(subscriptionRow, subscriptionActionButton.getAttribute("data-end-date") || "");
      }
    }

    if (planActionButton) {
      var planAction = planActionButton.getAttribute("data-plan-action");
      var planName = planActionButton.getAttribute("data-plan-name") || "This plan";
      var planRow = planActionButton.closest(".plan-row");

      if (planAction === "edit") {
        var rowIndex = Array.from(plansTableBody ? plansTableBody.querySelectorAll(".plan-row") : []).indexOf(planRow);
        populatePlanForm(getPlanDataFromRow(planRow), rowIndex);
        if (planModal) {
          planModal.hidden = false;
          document.body.style.overflow = "hidden";
        }
      }

      if (planAction === "delete") {
        showToast("Delete plan", "Connect " + planName + " to your delete confirmation flow.");
      }
    }

    if (couponActionButton) {
      var couponAction = couponActionButton.getAttribute("data-coupon-action");
      var couponName = couponActionButton.getAttribute("data-coupon-name") || "This coupon";
      var couponRow = couponActionButton.closest(".coupon-code-row");

      if (couponAction === "edit") {
        var couponRowIndex = Array.from(couponCodesTableBody ? couponCodesTableBody.querySelectorAll(".coupon-code-row") : []).indexOf(couponRow);
        populateCouponForm(getCouponDataFromRow(couponRow), couponRowIndex);
        if (couponModal) {
          couponModal.hidden = false;
          document.body.style.overflow = "hidden";
        }
      }

      if (couponAction === "delete") {
        showToast("Delete coupon", "Connect " + couponName + " to your delete confirmation flow.");
      }
    }
  });

  document.addEventListener("click", function (event) {
    var passwordToggle = event.target.closest(".password-toggle");
    if (passwordToggle) {
      var targetId = passwordToggle.getAttribute("data-password-target");
      var passwordInput = document.getElementById(targetId);
      if (passwordInput) {
        passwordInput.type = passwordInput.type === "password" ? "text" : "password";
        passwordToggle.textContent = passwordInput.type === "password" ? "Show" : "Hide";
      }
    }
  });

  if (addUserForm && userDirectoryBody) {
    addUserForm.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!addUserForm.checkValidity()) {
        setUserFormFeedback("Please complete the required user fields before creating the account.", false);
        return;
      }

      var passwordField = document.getElementById("userPassword");
      var confirmPasswordField = document.getElementById("userConfirmPassword");

      if (passwordField && confirmPasswordField && passwordField.value !== confirmPasswordField.value) {
        setUserFormFeedback("Password and confirm password must match before saving the user.", false);
        return;
      }

      var formData = new FormData(addUserForm);
      var fullName = (formData.get("firstName").trim() + " " + formData.get("lastName").trim()).trim();
      var row = buildUserRow(formData);
      userDirectoryBody.insertBefore(row, userDirectoryBody.firstChild);
      updateUserDirectoryCount();
      applySearchFilter();

      setUserFormFeedback("User created successfully. The account has been added to the directory" + (formData.get("sendInvite") ? " and the invite is marked for sending." : "."), true);
      showToast("User created", fullName + " has been added to the directory.");
      addUserForm.reset();
      resetProfilePreview();
      closeUserModal();
    });
  }

  if (nfcCardForm && nfcCatalogList) {
    nfcCardForm.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!nfcCardForm.checkValidity()) {
        setNfcFormFeedback("Please complete the required NFC card details before saving.", false);
        return;
      }

      var formData = new FormData(nfcCardForm);
      var newRow = buildNfcCardRow(formData);
      nfcCatalogList.insertBefore(newRow, nfcCatalogList.firstChild);
      nfcCardForm.reset();
      resetNfcPreview(nfcFrontPreview);
      resetNfcPreview(nfcBackPreview);
      setNfcFormFeedback("NFC card saved to the catalog layout.", true);
      applyNfcCatalogFilter();

      window.setTimeout(function () {
        closeNfcModal();
      }, 600);
    });
  }

  if (subscriptionForm && subscriptionsTableBody) {
    subscriptionForm.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!subscriptionForm.checkValidity()) {
        setSubscriptionFormFeedback("Please provide the updated subscription end date before saving.", false);
        return;
      }

      var rowIndex = Number(subscriptionEditRowIndexInput ? subscriptionEditRowIndexInput.value : -1);
      var rows = Array.from(subscriptionsTableBody.querySelectorAll(".subscription-row"));
      var targetRow = rows[rowIndex];
      var newDate = subscriptionEndDateInput ? subscriptionEndDateInput.value.trim() : "";

      if (!targetRow || !newDate) {
        setSubscriptionFormFeedback("Unable to update this subscription row. Please try again.", false);
        return;
      }

      var dateCell = targetRow.querySelector(".subscription-end-date");
      var editButton = targetRow.querySelector('[data-subscription-action="edit"]');

      if (dateCell) {
        dateCell.textContent = newDate.replace(",", "");
      }

      if (editButton) {
        editButton.setAttribute("data-end-date", newDate);
      }

      setSubscriptionFormFeedback("Subscription end date updated successfully.", true);

      window.setTimeout(function () {
        closeSubscriptionModal();
      }, 600);
    });
  }

  if (planForm && plansTableBody) {
    planForm.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!planForm.checkValidity()) {
        setPlanFormFeedback("Please complete the required plan details before saving.", false);
        return;
      }

      var formData = new FormData(planForm);
      var rowIndex = Number(planEditRowIndexInput ? planEditRowIndexInput.value : -1);
      var planName = (formData.get("planName") || "").trim();
      var selectedTemplates = formData.getAll("templates");
      var selectedFeatures = formData.getAll("features");
      var planData = {
        name: planName,
        frequency: (formData.get("frequency") || "Month").trim(),
        currency: (formData.get("currency") || "").trim(),
        price: Number(formData.get("price") || 0),
        vcards: String(formData.get("vcards") || "0").trim(),
        trialDays: String(formData.get("trialDays") || "0").trim(),
        storageLimit: String(formData.get("storageLimit") || "0").trim(),
        customSelect: formData.get("customSelect") === "on",
        features: selectedFeatures,
        templates: selectedTemplates
      };

      if (!selectedTemplates.length) {
        setPlanFormFeedback("Please select at least one template for this plan.", false);
        return;
      }

      if (!selectedFeatures.length) {
        setPlanFormFeedback("Please select at least one feature for this plan.", false);
        return;
      }

      if (rowIndex >= 0) {
        var existingRow = Array.from(plansTableBody.querySelectorAll(".plan-row"))[rowIndex];
        if (!existingRow) {
          setPlanFormFeedback("Unable to update this plan. Please try again.", false);
          return;
        }
        applyPlanDataToRow(existingRow, planData);
        setPlanFormFeedback("Plan updated successfully.", true);
      } else {
        var row = document.createElement("tr");

        applyPlanDataToRow(row, planData);
        plansTableBody.insertBefore(row, plansTableBody.firstChild);
        setPlanFormFeedback("Plan saved to the plans list successfully.", true);
      }

      applyPlansFilter();

      window.setTimeout(function () {
        closePlanModal();
        resetPlanFormState();
      }, 600);
    });
  }

  if (couponForm && couponCodesTableBody) {
    couponForm.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!couponForm.checkValidity()) {
        setCouponFormFeedback("Please complete the required coupon details before saving.", false);
        return;
      }

      var formData = new FormData(couponForm);
      var rowIndex = Number(couponEditRowIndexInput ? couponEditRowIndexInput.value : -1);
      var couponData = {
        name: (formData.get("couponName") || "").trim(),
        type: (formData.get("couponType") || "Percentage").trim(),
        discount: Number(formData.get("couponDiscount") || 0),
        limit: String(formData.get("couponLimitLeft") || "0").trim(),
        expireAt: (formData.get("couponExpireAt") || "").trim(),
        active: formData.get("couponActive") === "on"
      };

      if (rowIndex >= 0) {
        var existingRow = Array.from(couponCodesTableBody.querySelectorAll(".coupon-code-row"))[rowIndex];

        if (!existingRow) {
          setCouponFormFeedback("Unable to update this coupon. Please try again.", false);
          return;
        }

        applyCouponDataToRow(existingRow, couponData);
        setCouponFormFeedback("Coupon updated successfully.", true);
      } else {
        var row = document.createElement("tr");
        applyCouponDataToRow(row, couponData);
        couponCodesTableBody.insertBefore(row, couponCodesTableBody.firstChild);
        setCouponFormFeedback("Coupon code saved successfully.", true);
      }

      applyCouponCodesFilter();

      window.setTimeout(function () {
        closeCouponModal();
        resetCouponFormState();
      }, 600);
    });
  }

  document.addEventListener("click", function (event) {
    var actionButton = event.target.closest("[data-action]");
    var periodOption = event.target.closest(".period-option");

    if (actionButton) {
      handleAction(actionButton.getAttribute("data-action"));
    }

    if (periodOption) {
      var periodKey = periodOption.getAttribute("data-period");
      Array.from(document.querySelectorAll(".period-option")).forEach(function (button) {
        button.classList.toggle("active", button === periodOption);
      });
      buildAnalyticsChart(periodKey);
      if (periodOptions) {
        periodOptions.hidden = true;
      }
    }

    if (notificationPanel && notificationToggle) {
      var clickedInsideNotification = notificationPanel.contains(event.target);
      var clickedToggle = notificationToggle.contains(event.target);

      if (!clickedInsideNotification && !clickedToggle) {
        notificationPanel.hidden = true;
        notificationToggle.setAttribute("aria-expanded", "false");
      }
    }
  });

  if (notificationToggle && notificationPanel) {
    notificationToggle.addEventListener("click", function () {
      var isHidden = notificationPanel.hidden;
      notificationPanel.hidden = !isHidden;
      notificationToggle.setAttribute("aria-expanded", String(isHidden));
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "../auth/login.html";
    });
  }

  if (periodButton && periodOptions) {
    periodButton.addEventListener("click", function () {
      periodOptions.hidden = !periodOptions.hidden;
    });
  }

  renderActivity();
  renderNotifications();
  resetProfilePreview();
  updateUserDirectoryCount();
  syncPlanTemplateSelection();
  applyPlansFilter();
  applyAffiliateUsersFilter();
  applyAffiliateTransactionsFilter();
  applyAffiliateWithdrawalsFilter();
  applyCouponCodesFilter();
  applyUsedCouponCodesFilter();
  applyEnquiriesFilter();
  applyAppointmentsFilter();
  applyProductOrdersFilter();
  updateCompletion(state.profileCompletion);
  drawSparkline("spark1", [40, 55, 45, 70, 60, 80, 75, 95, 85, 110, 90, 120], "#ff5968");
  drawSparkline("spark2", [30, 50, 40, 60, 55, 75, 65, 90, 80, 100, 95, 115], "#ff5968");
  drawSparkline("spark3", [50, 45, 60, 55, 70, 65, 80, 75, 90, 85, 100, 95], "#ff5968");
  drawSparkline("spark4", [35, 55, 45, 65, 60, 75, 70, 90, 85, 105, 100, 120], "#ff5968");
  drawSparkline("spark5", [25, 35, 28, 42, 40, 52, 49, 58, 56, 70, 68, 82], "#8f72ff");
  buildAnalyticsChart("30");
  buildEngagementChart();
  buildRevenueBreakdownChart();
  buildRevenueBarChart();
});
