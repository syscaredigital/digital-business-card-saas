document.addEventListener("DOMContentLoaded", function () {
  var searchInput = document.getElementById("dashboardSearch");
  var emptySearchState = document.getElementById("emptySearchState");
  var toastStack = document.getElementById("toastStack");
  var notificationToggle = document.getElementById("notificationToggle");
  var notificationPanel = document.getElementById("notificationPanel");
  var notificationList = document.getElementById("notificationList");
  var notificationCount = document.getElementById("notificationCount");
  var periodButton = document.getElementById("overviewPeriodButton");
  var periodLabel = document.getElementById("overviewPeriodLabel");
  var periodOptions = document.getElementById("periodOptions");
  var completionValue = document.getElementById("completionValue");
  var completionTitle = document.getElementById("completionTitle");
  var ringFill = document.querySelector(".ring-fill");

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

  if (searchInput) {
    searchInput.addEventListener("input", applySearchFilter);
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

  if (periodButton && periodOptions) {
    periodButton.addEventListener("click", function () {
      periodOptions.hidden = !periodOptions.hidden;
    });
  }

  renderActivity();
  renderNotifications();
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
