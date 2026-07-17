document.addEventListener("DOMContentLoaded", function () {
  var isSuperAdminPage = /[\\/]super-admin[\\/]/.test(window.location.pathname);
  var sidebarLogo = document.querySelector(".sidebar-logo");

  if (isSuperAdminPage && sidebarLogo) {
    sidebarLogo.innerHTML =
      '<a class="super-admin-brand" href="dashboard.html" aria-label="Sync E-Card super admin dashboard">' +
      '<img class="super-admin-brand-logo" src="../../public/assets/images/logos/sync-e-logo-white-web.png" alt="Sync E-Card" />' +
      "</a>";
  }

  var adminPageSlug = isSuperAdminPage
    ? (window.location.pathname.split("/").pop() || "dashboard.html").replace(/\.html$/i, "")
    : "";

  var adminNavigation = [
    ["Overview", "dashboard.html", "OV", "main"],
    ["Users", "users.html", "US", "Workspace"],
    ["VCards", "vcards.html", "VC", ""],
    ["NFC Cards", "nfc-orders.html", "NF", ""],
    ["Subscriptions", "subscriptions.html", "SU", ""],
    ["Cash Payments", "cash-payments.html", "CP", "Finance"],
    ["Transactions", "transactions.html", "TR", ""],
    ["Withdrawals", "withdrawals.html", "WD", ""],
    ["Affiliations", "affiliations.html", "AF", "Growth"],
    ["Coupon Codes", "coupon-codes.html", "CO", ""],
    ["Analytics", "analytics.html", "AN", "Insights"],
    ["Reports", "reports.html", "RE", ""],
    ["Settings", "settings.html", "SE", "System"],
    ["System Logs", "system-logs.html", "LO", ""]
  ];

  function renderAdminNavigation(activeSlug) {
    var sidebarNav = document.querySelector(".sidebar-nav");
    if (!sidebarNav) return;

    sidebarNav.innerHTML = adminNavigation.map(function (item) {
      var section = item[3] && item[3] !== "main" ? '<div class="sidebar-section-label">' + item[3] + "</div>" : "";
      var active = item[1] === activeSlug + ".html" ? " active" : "";
      return section + '<a href="' + item[1] + '" class="nav-item' + active + '"><span class="admin-nav-mark">' + item[2] + "</span><span>" + item[0] + "</span></a>";
    }).join("");

    var sidebar = sidebarNav.closest(".sidebar");
    if (sidebar && !sidebar.querySelector(".admin-profile-card")) {
      sidebar.insertAdjacentHTML(
        "beforeend",
        '<div class="admin-profile-card">' +
          '<div class="table-user">' +
            '<span class="mini-avatar">SA</span>' +
            '<div><strong>Super Admin</strong><div class="subtle-handle">info@syncecard.lk</div></div>' +
          "</div>" +
          '<span class="admin-online"><i></i> All systems online</span>' +
          '<button class="admin-logout-btn" type="button" id="logoutButton"><span aria-hidden="true">↪</span> Sign out</button>' +
        "</div>"
      );
    }
    var profileCard = sidebar ? sidebar.querySelector(".admin-profile-card") : null;
    if (profileCard && !profileCard.querySelector("#logoutButton")) {
      profileCard.insertAdjacentHTML("beforeend", '<button class="admin-logout-btn" type="button" id="logoutButton"><span aria-hidden="true">↪</span> Sign out</button>');
    }
  }

  if (isSuperAdminPage) {
    renderAdminNavigation(adminPageSlug);
  }

  if (isSuperAdminPage && adminPageSlug !== "dashboard") {
    var adminPageConfig = {
      users: { title: "Users", eyebrow: "Identity management", stats: [["Total users", "12,543", "+12.5%"], ["Active today", "8,421", "67.1%"], ["Awaiting review", "83", "Needs action"]] },
      vcards: { title: "VCards", eyebrow: "Digital identity", stats: [["Published cards", "23,456", "+10.7%"], ["Profile views", "1.24M", "+18.4%"], ["Draft cards", "318", "In progress"]] },
      "nfc-orders": { title: "NFC Cards", eyebrow: "Physical products", stats: [["Total orders", "4,567", "+9.2%"], ["Awaiting fulfilment", "12", "Needs action"], ["Delivered", "3,890", "85.2%"]] },
      subscriptions: { title: "Subscriptions", eyebrow: "Recurring billing", stats: [["Active plans", "8,456", "+8.2%"], ["Monthly revenue", "$45,678", "+15.3%"], ["Renewing soon", "246", "Next 7 days"]] },
      transactions: { title: "Transactions", eyebrow: "Financial ledger", stats: [["Gross volume", "$68,420", "+13.8%"], ["Successful", "2,846", "98.7%"], ["Pending", "17", "Needs review"]] },
      "cash-payments": { title: "Cash Payments", eyebrow: "Manual payments", stats: [["Pending value", "$1,420", "5 payments"], ["Approved today", "$2,860", "12 payments"], ["Approval rate", "96.4%", "+2.1%"]] },
      payouts: { title: "Payouts", eyebrow: "Partner finance", stats: [["Ready to pay", "$1,470", "2 payouts"], ["Paid this month", "$18,240", "+11.6%"], ["Next payout", "Jul 15", "2 days"]] },
      withdrawals: { title: "Withdrawals", eyebrow: "Fund requests", stats: [["Pending requests", "8", "$2,780"], ["Processed", "142", "This month"], ["Average time", "1.8 days", "-12%"]] },
      affiliations: { title: "Affiliations", eyebrow: "Partner network", stats: [["Active partners", "284", "+24 this month"], ["Conversions", "1,892", "14.6%"], ["Commission due", "$6,840", "Next cycle"]] },
      "coupon-codes": { title: "Coupon Codes", eyebrow: "Promotions", stats: [["Active coupons", "—", "Loading availability"], ["Redemptions", "—", "Loading ledger"], ["Discounts granted", "—", "This month"]] },
      analytics: { title: "Analytics", eyebrow: "Platform intelligence", stats: [["Profile views", "—", "Loading database metrics"], ["Engaged clicks", "—", "Loading database metrics"], ["Contact requests", "—", "Loading database metrics"]] },
      reports: { title: "Reports", eyebrow: "Exports & insights", stats: [["Saved reports", "—", "Loading definitions"], ["Exports this month", "—", "Loading snapshots"], ["Last export", "—", "Loading history"]] },
      settings: { title: "Settings", eyebrow: "Platform controls", stats: [["System status", "—", "Loading controls"], ["Stored settings", "—", "Loading database"], ["Last updated", "—", "Loading database"]] },
      "system-logs": { title: "System Logs", eyebrow: "Audit & security", stats: [["Total events", "—", "Loading audit trail"], ["Events today", "—", "Loading audit trail"], ["Needs attention", "—", "Loading audit trail"]] }
    };
    var pageConfig = adminPageConfig[adminPageSlug];

    if (pageConfig) {
      document.body.classList.add("super-admin-management", "admin-page-" + adminPageSlug);

      var topbar = document.querySelector(".topbar");
      if (topbar) {
        topbar.classList.add("admin-management-topbar");
        topbar.insertAdjacentHTML("afterbegin", '<div class="admin-shell-context"><span>Super admin</span><strong>' + pageConfig.title + "</strong></div>");
        topbar.insertAdjacentHTML("beforeend", '<div class="admin-shell-account"><a href="settings.html" aria-label="Open settings">SA</a><span><strong>Super Admin</strong><small>Administrator</small></span></div>');
      }

      var pageContent = document.querySelector(".page-content");
      var pageHeader = pageContent ? pageContent.querySelector(".page-header") : null;
      if (!pageHeader && pageContent) {
        pageHeader = document.createElement("div");
        pageHeader.className = "page-header admin-generated-header";
        pageHeader.innerHTML = '<div><h1>' + pageConfig.title + '</h1><p>Manage ' + pageConfig.title.toLowerCase() + " across the Sync E-Card platform.</p></div>";
        pageContent.insertBefore(pageHeader, pageContent.firstChild);
      }
      if (pageHeader) {
        pageHeader.classList.add("admin-management-hero");
        var headingCopy = pageHeader.querySelector("div");
        if (headingCopy) headingCopy.insertAdjacentHTML("afterbegin", '<span class="admin-page-eyebrow">' + pageConfig.eyebrow + "</span>");
        var statsMarkup = '<section class="admin-page-stats" aria-label="' + pageConfig.title + ' summary">' + pageConfig.stats.map(function (stat, index) {
          return '<article><span>' + stat[0] + '</span><strong>' + stat[1] + '</strong><small class="' + (index === 2 ? "attention" : "") + '">' + stat[2] + "</small></article>";
        }).join("") + "</section>";
        pageHeader.insertAdjacentHTML("afterend", statsMarkup);
      }
    }
  }

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
  var userEditId = document.getElementById("userEditId");
  var userModalTitle = document.getElementById("userModalTitle");
  var userProfileInput = document.getElementById("userProfile");
  var userProfilePreview = document.getElementById("userProfilePreview");
  var superAdminUsersById = {};
  var vcardDirectory = document.getElementById("vcardDirectory");
  var vcardDirectoryCount = document.getElementById("vcardDirectoryCount");
  var vcardTemplateGrid = document.getElementById("vcardTemplateGrid");
  var vcardModal = document.getElementById("vcardModal");
  var vcardModalBackdrop = document.getElementById("vcardModalBackdrop");
  var openVCardModalButton = document.getElementById("openVCardModal");
  var closeVCardModalButton = document.getElementById("closeVCardModal");
  var resetVCardFormButton = document.getElementById("resetVCardForm");
  var vcardAdminForm = document.getElementById("vcardAdminForm");
  var vcardFormFeedback = document.getElementById("vcardFormFeedback");
  var superAdminVCardsById = {};
  var nfcRegistryBody = document.getElementById("nfcRegistryBody");
  var nfcOrdersLiveBody = document.getElementById("nfcOrdersLiveBody");
  var nfcRegistryCount = document.getElementById("nfcRegistryCount");
  var nfcOrdersLiveCount = document.getElementById("nfcOrdersLiveCount");
  var nfcPendingTabCount = document.getElementById("nfcPendingTabCount");
  var nfcRegistryModal = document.getElementById("nfcRegistryModal");
  var nfcRegistryModalBackdrop = document.getElementById("nfcRegistryModalBackdrop");
  var openNfcRegistryModalButton = document.getElementById("openNfcRegistryModal");
  var closeNfcRegistryModalButton = document.getElementById("closeNfcRegistryModal");
  var resetNfcRegistryFormButton = document.getElementById("resetNfcRegistryForm");
  var nfcRegistryForm = document.getElementById("nfcRegistryForm");
  var nfcRegistryFeedback = document.getElementById("nfcRegistryFeedback");
  var nfcRegistryModalTitle = document.getElementById("nfcRegistryModalTitle");
  var superAdminNfcCardsById = {};
  var nfcProductsGrid = document.getElementById("nfcProductsGrid");
  var nfcProductsCount = document.getElementById("nfcProductsCount");
  var nfcProductModal = document.getElementById("nfcProductModal");
  var nfcProductModalBackdrop = document.getElementById("nfcProductModalBackdrop");
  var openNfcProductModalButton = document.getElementById("openNfcProductModal");
  var closeNfcProductModalButton = document.getElementById("closeNfcProductModal");
  var resetNfcProductFormButton = document.getElementById("resetNfcProductForm");
  var nfcProductForm = document.getElementById("nfcProductForm");
  var nfcProductFeedback = document.getElementById("nfcProductFeedback");
  var nfcProductModalTitle = document.getElementById("nfcProductModalTitle");
  var nfcProductFrontPreview = document.getElementById("nfcProductFrontPreview");
  var nfcProductBackPreview = document.getElementById("nfcProductBackPreview");
  var superAdminNfcProductsById = {};
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
  var cashPaymentAdminBody = document.getElementById("cashPaymentAdminBody");
  var cashPaymentAdminCount = document.getElementById("cashPaymentAdminCount");
  var cashPaymentStatusFilter = document.getElementById("cashPaymentStatusFilter");
  var cashPaymentAdminModal = document.getElementById("cashPaymentAdminModal");
  var cashPaymentAdminModalBackdrop = document.getElementById("cashPaymentAdminModalBackdrop");
  var openCashPaymentAdminModalButton = document.getElementById("openCashPaymentAdminModal");
  var closeCashPaymentAdminModalButton = document.getElementById("closeCashPaymentAdminModal");
  var resetCashPaymentAdminFormButton = document.getElementById("resetCashPaymentAdminForm");
  var cashPaymentAdminForm = document.getElementById("cashPaymentAdminForm");
  var cashPaymentAdminFeedback = document.getElementById("cashPaymentAdminFeedback");
  var cashPaymentAdminModalTitle = document.getElementById("cashPaymentAdminModalTitle");
  var superAdminCashPaymentsById = {};
  var superAdminCashSubscriptions = [];
  var transactionAdminBody = document.getElementById("transactionAdminBody");
  var transactionAdminCount = document.getElementById("transactionAdminCount");
  var transactionTypeFilter = document.getElementById("transactionTypeFilter");
  var transactionStatusFilter = document.getElementById("transactionStatusFilter");
  var transactionAdminModal = document.getElementById("transactionAdminModal");
  var transactionAdminModalBackdrop = document.getElementById("transactionAdminModalBackdrop");
  var openTransactionAdminModalButton = document.getElementById("openTransactionAdminModal");
  var closeTransactionAdminModalButton = document.getElementById("closeTransactionAdminModal");
  var resetTransactionAdminFormButton = document.getElementById("resetTransactionAdminForm");
  var transactionAdminForm = document.getElementById("transactionAdminForm");
  var transactionAdminFeedback = document.getElementById("transactionAdminFeedback");
  var transactionAdminModalTitle = document.getElementById("transactionAdminModalTitle");
  var superAdminTransactionsById = {};
  var payoutAdminBody = document.getElementById("payoutAdminBody");
  var payoutAdminCount = document.getElementById("payoutAdminCount");
  var payoutStatusFilter = document.getElementById("payoutStatusFilter");
  var payoutAdminModal = document.getElementById("payoutAdminModal");
  var payoutAdminModalBackdrop = document.getElementById("payoutAdminModalBackdrop");
  var openPayoutAdminModalButton = document.getElementById("openPayoutAdminModal");
  var closePayoutAdminModalButton = document.getElementById("closePayoutAdminModal");
  var resetPayoutAdminFormButton = document.getElementById("resetPayoutAdminForm");
  var payoutAdminForm = document.getElementById("payoutAdminForm");
  var payoutAdminFeedback = document.getElementById("payoutAdminFeedback");
  var payoutAdminModalTitle = document.getElementById("payoutAdminModalTitle");
  var superAdminPayoutsById = {};
  var withdrawalAdminBody = document.getElementById("withdrawalAdminBody");
  var withdrawalAdminCount = document.getElementById("withdrawalAdminCount");
  var withdrawalStatusFilter = document.getElementById("withdrawalStatusFilter");
  var withdrawalAdminModal = document.getElementById("withdrawalAdminModal");
  var withdrawalAdminModalBackdrop = document.getElementById("withdrawalAdminModalBackdrop");
  var openWithdrawalAdminModalButton = document.getElementById("openWithdrawalAdminModal");
  var closeWithdrawalAdminModalButton = document.getElementById("closeWithdrawalAdminModal");
  var resetWithdrawalAdminFormButton = document.getElementById("resetWithdrawalAdminForm");
  var withdrawalAdminForm = document.getElementById("withdrawalAdminForm");
  var withdrawalAdminFeedback = document.getElementById("withdrawalAdminFeedback");
  var withdrawalAdminModalTitle = document.getElementById("withdrawalAdminModalTitle");
  var superAdminWithdrawalsById = {};
  var affiliatePartnerBody = document.getElementById("affiliatePartnerBody");
  var affiliatePartnerCount = document.getElementById("affiliatePartnerCount");
  var affiliateReferralBody = document.getElementById("affiliateReferralBody");
  var affiliateReferralCount = document.getElementById("affiliateReferralCount");
  var affiliateCommissionBody = document.getElementById("affiliateCommissionBody");
  var affiliateCommissionCount = document.getElementById("affiliateCommissionCount");
  var affiliatePartnerModal = document.getElementById("affiliatePartnerModal");
  var affiliatePartnerModalBackdrop = document.getElementById("affiliatePartnerModalBackdrop");
  var openAffiliatePartnerModalButton = document.getElementById("openAffiliatePartnerModal");
  var closeAffiliatePartnerModalButton = document.getElementById("closeAffiliatePartnerModal");
  var resetAffiliatePartnerFormButton = document.getElementById("resetAffiliatePartnerForm");
  var affiliatePartnerForm = document.getElementById("affiliatePartnerForm");
  var affiliatePartnerFeedback = document.getElementById("affiliatePartnerFeedback");
  var affiliatePartnerModalTitle = document.getElementById("affiliatePartnerModalTitle");
  var affiliateReferralModal = document.getElementById("affiliateReferralModal");
  var affiliateReferralModalBackdrop = document.getElementById("affiliateReferralModalBackdrop");
  var openAffiliateReferralModalButton = document.getElementById("openAffiliateReferralModal");
  var closeAffiliateReferralModalButton = document.getElementById("closeAffiliateReferralModal");
  var resetAffiliateReferralFormButton = document.getElementById("resetAffiliateReferralForm");
  var affiliateReferralForm = document.getElementById("affiliateReferralForm");
  var affiliateReferralFeedback = document.getElementById("affiliateReferralFeedback");
  var affiliateReferralModalTitle = document.getElementById("affiliateReferralModalTitle");
  var affiliateCommissionModal = document.getElementById("affiliateCommissionModal");
  var affiliateCommissionModalBackdrop = document.getElementById("affiliateCommissionModalBackdrop");
  var openAffiliateCommissionModalButton = document.getElementById("openAffiliateCommissionModal");
  var closeAffiliateCommissionModalButton = document.getElementById("closeAffiliateCommissionModal");
  var resetAffiliateCommissionFormButton = document.getElementById("resetAffiliateCommissionForm");
  var affiliateCommissionForm = document.getElementById("affiliateCommissionForm");
  var affiliateCommissionFeedback = document.getElementById("affiliateCommissionFeedback");
  var affiliateCommissionModalTitle = document.getElementById("affiliateCommissionModalTitle");
  var superAdminAffiliatePartnersById = {};
  var superAdminAffiliateReferralsById = {};
  var superAdminAffiliateCommissionsById = {};
  var superAdminAffiliateUsers = [];
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
  var subscriptionAdminBody = document.getElementById("subscriptionAdminBody");
  var subscriptionAdminCount = document.getElementById("subscriptionAdminCount");
  var planAdminBody = document.getElementById("planAdminBody");
  var planAdminCount = document.getElementById("planAdminCount");
  var subscriptionAdminModal = document.getElementById("subscriptionAdminModal");
  var subscriptionAdminModalBackdrop = document.getElementById("subscriptionAdminModalBackdrop");
  var openSubscriptionAdminModalButton = document.getElementById("openSubscriptionAdminModal");
  var closeSubscriptionAdminModalButton = document.getElementById("closeSubscriptionAdminModal");
  var resetSubscriptionAdminFormButton = document.getElementById("resetSubscriptionAdminForm");
  var subscriptionAdminForm = document.getElementById("subscriptionAdminForm");
  var subscriptionAdminFeedback = document.getElementById("subscriptionAdminFeedback");
  var subscriptionAdminModalTitle = document.getElementById("subscriptionAdminModalTitle");
  var planAdminModal = document.getElementById("planAdminModal");
  var planAdminModalBackdrop = document.getElementById("planAdminModalBackdrop");
  var openPlanAdminModalButton = document.getElementById("openPlanAdminModal");
  var closePlanAdminModalButton = document.getElementById("closePlanAdminModal");
  var resetPlanAdminFormButton = document.getElementById("resetPlanAdminForm");
  var planAdminForm = document.getElementById("planAdminForm");
  var planAdminFeedback = document.getElementById("planAdminFeedback");
  var planAdminModalTitle = document.getElementById("planAdminModalTitle");
  var planVcardFeatureOptions = document.getElementById("planVcardFeatureOptions");
  var planVcardTemplateOptions = document.getElementById("planVcardTemplateOptions");
  var superAdminSubscriptionsById = {};
  var superAdminPlansById = {};
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
  var couponAdminBody = document.getElementById("couponAdminBody");
  var couponAdminCount = document.getElementById("couponAdminCount");
  var couponRedemptionBody = document.getElementById("couponRedemptionBody");
  var couponRedemptionCount = document.getElementById("couponRedemptionCount");
  var couponAdminModal = document.getElementById("couponAdminModal");
  var couponAdminForm = document.getElementById("couponAdminForm");
  var couponAdminModalTitle = document.getElementById("couponAdminModalTitle");
  var couponRedemptionModal = document.getElementById("couponRedemptionModal");
  var couponRedemptionForm = document.getElementById("couponRedemptionForm");
  var superAdminCouponsById = {};
  var superAdminCouponPlans = [];
  var superAdminCouponUsers = [];
  var analyticsRange = document.getElementById("analyticsRange");
  var analyticsCardsBody = document.getElementById("analyticsCardsBody");
  var analyticsSourceList = document.getElementById("analyticsSourceList");
  var reportTabButtons = Array.from(document.querySelectorAll("[data-report-tab-target]"));
  var reportAdminBody = document.getElementById("reportAdminBody");
  var reportAdminCount = document.getElementById("reportAdminCount");
  var reportRunBody = document.getElementById("reportRunBody");
  var reportRunCount = document.getElementById("reportRunCount");
  var reportAdminModal = document.getElementById("reportAdminModal");
  var reportAdminForm = document.getElementById("reportAdminForm");
  var reportAdminModalTitle = document.getElementById("reportAdminModalTitle");
  var superAdminReportsById = {};
  var platformSettingsForm = document.getElementById("platformSettingsForm");
  var rolePermissionGrid = document.getElementById("rolePermissionGrid");
  var systemLogBody = document.getElementById("systemLogBody");
  var systemLogResource = document.getElementById("systemLogResource");
  var systemLogActor = document.getElementById("systemLogActor");
  var systemLogPage = 1;
  var systemLogPages = 1;
  var superAdminSystemLogsById = {};
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

  function updateUserDirectoryCount(total) {
    if (!userDirectoryBody || !userDirectoryCount) {
      return;
    }

    var count = Number.isFinite(Number(total)) ? Number(total) : userDirectoryBody.querySelectorAll(".searchable-item").length;
    userDirectoryCount.textContent = formatDashboardNumber(count) + (count === 1 ? " user" : " users");
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
    if (status === "Inactive" || status === "Rejected") {
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

  function renderSuperAdminUsers(users, total) {
    if (!userDirectoryBody) return;
    superAdminUsersById = {};
    if (!users.length) {
      userDirectoryBody.innerHTML = '<tr><td colspan="7"><div class="admin-data-empty"><strong>No users found</strong><span>Create the first user with the Add User button.</span></div></td></tr>';
      updateUserDirectoryCount(total);
      return;
    }

    userDirectoryBody.innerHTML = users.map(function (user) {
      superAdminUsersById[String(user.id)] = user;
      var name = user.name || user.email || "User";
      var email = user.email || "";
      var username = email.split("@")[0];
      var plan = user.plan || "Free";
      var rawStatus = String(user.status || "inactive").toLowerCase();
      var displayStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
      var joinedAt = user.joinedAt ? formatDate(new Date(user.joinedAt)) : "Not available";
      var searchTerms = [name, email, username, plan, rawStatus, user.phoneNumber || "", user.companyName || ""].join(" ").toLowerCase();
      var approveAction = '<button type="button" class="user-action-btn approve" data-user-action="status" data-user-status="active" data-user-id="' + user.id + '">Approve</button>';
      var rejectAction = '<button type="button" class="user-action-btn reject" data-user-action="status" data-user-status="rejected" data-user-id="' + user.id + '">Reject</button>';
      var reviewAction = rawStatus === "pending"
        ? approveAction + rejectAction
        : (rawStatus === "active" ? rejectAction : approveAction);
      return '<tr class="searchable-item" data-search="' + escapeDashboardHtml(searchTerms) + '">' +
        '<td><div class="table-user"><span class="mini-avatar">' + escapeDashboardHtml(avatarInitials(name) || "U") + '</span><div><strong>' + escapeDashboardHtml(name) + '</strong><div class="subtle-handle">@' + escapeDashboardHtml(username) + '</div></div></div></td>' +
        '<td>' + escapeDashboardHtml(email) + '</td>' +
        '<td><span class="plan-pill ' + planClass(plan) + '">' + escapeDashboardHtml(plan) + '</span></td>' +
        '<td>' + formatDashboardNumber(user.cards) + '</td>' +
        '<td>' + escapeDashboardHtml(joinedAt) + '</td>' +
        '<td><span class="status-badge ' + statusClass(displayStatus) + '">' + escapeDashboardHtml(displayStatus) + '</span></td>' +
        '<td><div class="user-row-actions">' +
          '<button type="button" class="user-action-btn edit" data-user-action="edit" data-user-id="' + user.id + '">Edit</button>' +
          reviewAction +
          '<button type="button" class="user-action-btn delete" data-user-action="delete" data-user-id="' + user.id + '">Delete</button>' +
        '</div></td>' +
      '</tr>';
    }).join("");
    updateUserDirectoryCount(total);
    applySearchFilter();
  }

  function updateUsersPageSummary(summary) {
    var cards = document.querySelectorAll(".admin-page-users .admin-page-stats article");
    if (cards.length < 3) return;
    cards[0].querySelector("strong").textContent = formatDashboardNumber(summary.total);
    cards[0].querySelector("small").textContent = "Database accounts";
    cards[1].querySelector("strong").textContent = formatDashboardNumber(summary.active);
    cards[1].querySelector("small").textContent = "Active accounts";
    cards[2].querySelector("strong").textContent = formatDashboardNumber(summary.pending);
    cards[2].querySelector("small").textContent = "Needs action";
  }

  async function loadSuperAdminUsers() {
    if (adminPageSlug !== "users" || !userDirectoryBody) return;
    var token = localStorage.getItem("token");
    if (!token) {
      userDirectoryBody.innerHTML = '<tr><td colspan="7"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as a super admin to view database users.</span></div></td></tr>';
      updateUserDirectoryCount(0);
      return;
    }

    try {
      var search = searchInput ? searchInput.value.trim() : "";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/users?limit=100&search=" + encodeURIComponent(search), {
        headers: { Authorization: "Bearer " + token }
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to load users");
      renderSuperAdminUsers(data.users || [], data.pagination ? data.pagination.total : 0);
      updateUsersPageSummary(data.summary || {});
    } catch (error) {
      userDirectoryBody.innerHTML = '<tr><td colspan="7"><div class="admin-data-empty"><strong>Users could not be loaded</strong><span>' + escapeDashboardHtml(error.message) + '</span></div></td></tr>';
      updateUserDirectoryCount(0);
      console.error("Super admin users:", error);
    }
  }

  function updateVCardsPageSummary(summary) {
    var cards = document.querySelectorAll(".admin-page-vcards .admin-page-stats article");
    if (cards.length < 3) return;
    cards[0].querySelector("span").textContent = "Total VCards";
    cards[0].querySelector("strong").textContent = formatDashboardNumber(summary.total);
    cards[0].querySelector("small").textContent = "Database records";
    cards[1].querySelector("span").textContent = "Active VCards";
    cards[1].querySelector("strong").textContent = formatDashboardNumber(summary.active);
    cards[1].querySelector("small").textContent = "Visible on platform";
    cards[2].querySelector("span").textContent = "Inactive VCards";
    cards[2].querySelector("strong").textContent = formatDashboardNumber(summary.inactive);
    cards[2].querySelector("small").textContent = "Hidden cards";
  }

  function renderSuperAdminVCards(vcards, total) {
    if (!vcardDirectory) return;
    superAdminVCardsById = {};
    Array.from(vcardDirectory.children).forEach(function (child) {
      if (!child.classList.contains("vcard-table-head")) child.remove();
    });
    if (!vcards.length) {
      vcardDirectory.insertAdjacentHTML("beforeend", '<div class="vcard-directory-state"><strong>No VCards found</strong><span>Create a VCard or try another search.</span></div>');
      if (vcardDirectoryCount) vcardDirectoryCount.textContent = "0 cards";
      return;
    }

    var markup = vcards.map(function (card, index) {
      superAdminVCardsById[String(card.id)] = card;
      var owner = card.owner || {};
      var template = card.template || {};
      var contactParts = [];
      if (card.email) contactParts.push('<a href="mailto:' + escapeDashboardHtml(card.email) + '">' + escapeDashboardHtml(card.email) + '</a>');
      if (card.phone) contactParts.push('<span>' + escapeDashboardHtml(card.phone) + '</span>');
      if (card.websiteUrl) contactParts.push('<a href="' + escapeDashboardHtml(card.websiteUrl) + '" target="_blank" rel="noopener noreferrer">Open website</a>');
      var initials = avatarInitials(card.title || "VCard") || "VC";
      var updatedAt = card.updatedAt ? formatDate(new Date(card.updatedAt)) : "Not available";
      var statusText = card.isActive ? "Active" : "Inactive";
      return '<div class="vcard-row" data-vcard-id="' + card.id + '">' +
        '<div class="vcard-name-cell"><div class="vcard-thumb vcard-thumb-database"><span>' + escapeDashboardHtml(initials) + '</span></div><div><strong class="vcard-title-link">' + escapeDashboardHtml(card.title) + '</strong><small>#' + card.id + (card.description ? " · " + escapeDashboardHtml(card.description) : "") + '</small></div></div>' +
        '<div class="vcard-owner-cell"><strong>' + escapeDashboardHtml(owner.name || "Unknown user") + '</strong><span>' + escapeDashboardHtml(owner.email || "No owner email") + '</span></div>' +
        '<div class="vcard-contact-cell">' + (contactParts.length ? contactParts.join("") : '<span>No contact details</span>') + '</div>' +
        '<div><span class="vcard-template-chip">' + escapeDashboardHtml(template.name || "No template") + '</span></div>' +
        '<div><span class="date-pill">' + escapeDashboardHtml(updatedAt) + '</span></div>' +
        '<div><label class="switch" title="Toggle VCard visibility"><input type="checkbox" data-vcard-admin-action="status" data-vcard-id="' + card.id + '"' + (card.isActive ? " checked" : "") + ' /><span class="switch-slider"></span></label><span class="status-badge ' + (card.isActive ? "completed" : "inactive") + '">' + statusText + '</span></div>' +
        '<div class="vcard-admin-actions"><button type="button" class="user-action-btn delete" data-vcard-admin-action="delete" data-vcard-id="' + card.id + '">Delete</button></div>' +
      '</div>';
    }).join("");
    vcardDirectory.insertAdjacentHTML("beforeend", markup);
    if (vcardDirectoryCount) vcardDirectoryCount.textContent = formatDashboardNumber(total) + (Number(total) === 1 ? " card" : " cards");
  }

  function renderVCardTemplates(templates, search) {
    if (!vcardTemplateGrid) return;
    var term = String(search || "").toLowerCase();
    var visibleTemplates = templates.filter(function (template) {
      return !term || [template.name, template.description].join(" ").toLowerCase().includes(term);
    });
    if (!visibleTemplates.length) {
      vcardTemplateGrid.innerHTML = '<div class="vcard-directory-state"><strong>No templates found</strong><span>Run the template seed or try another search.</span></div>';
      return;
    }
    vcardTemplateGrid.innerHTML = visibleTemplates.map(function (template, index) {
      var preview = template.previewUrl
        ? '<a class="btn-preview" href="' + escapeDashboardHtml(template.previewUrl) + '" target="_blank" rel="noopener noreferrer">Preview</a>'
        : '<span class="vcard-preview-unavailable">Preview not configured</span>';
      var visual = template.previewUrl ? '<iframe src="' + escapeDashboardHtml(template.previewUrl) + '" title="" loading="lazy" tabindex="-1"></iframe>' : '<span>Template ' + String(index + 1).padStart(2, "0") + '</span><strong>' + escapeDashboardHtml(template.name) + '</strong>';
      var category = template.config && template.config.category ? template.config.category : "General VCard";
      return '<article class="admin-card vcard-template-card">' +
        '<div class="vcard-template-visual tone-' + (index % 3 + 1) + '">' + visual + '</div>' +
        '<div class="admin-card-header"><div><small class="vcard-template-category">' + escapeDashboardHtml(category) + '</small><h3>' + escapeDashboardHtml(template.name) + '</h3><p>' + escapeDashboardHtml(template.description || "Reusable digital card layout") + '</p></div><span class="status-badge ' + (template.isPublic ? "active" : "pending") + '">' + (template.isPublic ? "Public" : "Private") + '</span></div>' +
        '<div class="template-actions">' + preview + '<button class="btn-share" type="button" data-vcard-admin-action="assign-template" data-template-id="' + template.id + '">Assign</button></div>' +
      '</article>';
    }).join("");
  }

  function populateVCardFormOptions(users, templates) {
    if (!vcardAdminForm) return;
    var ownerSelect = vcardAdminForm.elements.userId;
    var templateSelect = vcardAdminForm.elements.templateId;
    ownerSelect.innerHTML = '<option value="">Select active user</option>' + users.map(function (user) {
      return '<option value="' + user.id + '">' + escapeDashboardHtml(user.name || user.email) + ' · ' + escapeDashboardHtml(user.email) + '</option>';
    }).join("");
    templateSelect.innerHTML = '<option value="">No template</option>' + templates.map(function (template) {
      var category = template.config && template.config.category;
      return '<option value="' + template.id + '">' + escapeDashboardHtml(category ? category + " — " + template.name : template.name) + '</option>';
    }).join("");
  }

  async function loadSuperAdminVCards() {
    if (adminPageSlug !== "vcards" || !vcardDirectory) return;
    var token = localStorage.getItem("token");
    if (!token) {
      Array.from(vcardDirectory.children).forEach(function (child) { if (!child.classList.contains("vcard-table-head")) child.remove(); });
      vcardDirectory.insertAdjacentHTML("beforeend", '<div class="vcard-directory-state"><strong>Sign in required</strong><span>Log in as a super admin to manage VCards.</span></div>');
      return;
    }
    try {
      var search = searchInput ? searchInput.value.trim() : "";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/vcards?search=" + encodeURIComponent(search), { headers: { Authorization: "Bearer " + token } });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to load VCards");
      renderSuperAdminVCards(data.vcards || [], search ? (data.vcards || []).length : (data.summary ? data.summary.total : 0));
      renderVCardTemplates(data.templates || [], search);
      populateVCardFormOptions(data.users || [], data.templates || []);
      updateVCardsPageSummary(data.summary || {});
    } catch (error) {
      Array.from(vcardDirectory.children).forEach(function (child) { if (!child.classList.contains("vcard-table-head")) child.remove(); });
      vcardDirectory.insertAdjacentHTML("beforeend", '<div class="vcard-directory-state"><strong>VCards could not be loaded</strong><span>' + escapeDashboardHtml(error.message) + '</span></div>');
      console.error("Super admin VCards:", error);
    }
  }

  function setVCardModal(open, templateId) {
    if (!vcardModal || !vcardAdminForm) return;
    vcardModal.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      if (vcardFormFeedback) vcardFormFeedback.hidden = true;
      if (templateId) vcardAdminForm.elements.templateId.value = String(templateId);
      window.setTimeout(function () { vcardAdminForm.elements.userId.focus(); }, 30);
    }
  }

  async function updateSuperAdminVCardStatus(cardId, isActive, input) {
    var token = localStorage.getItem("token");
    try {
      if (input) input.disabled = true;
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/vcards/" + encodeURIComponent(cardId) + "/status", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: isActive })
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to update VCard");
      await loadSuperAdminVCards();
      showToast(isActive ? "VCard activated" : "VCard hidden", "Platform visibility was updated in the database.");
    } catch (error) {
      if (input) { input.checked = !isActive; input.disabled = false; }
      showToast("Update failed", error.message);
    }
  }

  async function deleteSuperAdminVCard(cardId, button) {
    var card = superAdminVCardsById[String(cardId)];
    if (!window.confirm("Permanently delete " + (card ? card.title : "this VCard") + "?")) return;
    var token = localStorage.getItem("token");
    try {
      if (button) { button.disabled = true; button.textContent = "Deleting..."; }
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/vcards/" + encodeURIComponent(cardId), { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to delete VCard");
      await loadSuperAdminVCards();
      showToast("VCard deleted", "The card was permanently removed from the database.");
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "Delete"; }
      showToast("Delete failed", error.message);
    }
  }

  function formatNfcMoney(value) {
    return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(Number(value || 0));
  }

  function updateNfcPageSummary(summary) {
    var cards = document.querySelectorAll(".admin-page-nfc-orders .admin-page-stats article");
    if (cards.length < 3) return;
    cards[0].querySelector("span").textContent = "Card products";
    cards[0].querySelector("strong").textContent = formatDashboardNumber(summary.total_products);
    cards[0].querySelector("small").textContent = "Sellable NFC designs";
    cards[1].querySelector("span").textContent = "Registered tags";
    cards[1].querySelector("strong").textContent = formatDashboardNumber(summary.total_cards);
    cards[1].querySelector("small").textContent = formatDashboardNumber(summary.active_cards) + " active / assigned";
    cards[2].querySelector("span").textContent = "Pending orders";
    cards[2].querySelector("strong").textContent = formatDashboardNumber(summary.pending_orders);
    cards[2].querySelector("small").textContent = formatNfcMoney(summary.order_value) + " open value";
    if (nfcPendingTabCount) nfcPendingTabCount.textContent = formatDashboardNumber(summary.pending_orders);
  }

  function nfcStatusClass(status) {
    if (status === "active" || status === "assigned" || status === "completed") return "active";
    if (status === "pending" || status === "processing" || status === "shipped") return "pending";
    return "inactive";
  }

  function renderNfcRegistry(cards, total) {
    if (!nfcRegistryBody) return;
    superAdminNfcCardsById = {};
    if (!cards.length) {
      nfcRegistryBody.innerHTML = '<tr><td colspan="7"><div class="admin-data-empty"><strong>No NFC cards registered</strong><span>Register the first physical tag using the button above.</span></div></td></tr>';
      if (nfcRegistryCount) nfcRegistryCount.textContent = "0 cards";
      return;
    }
    nfcRegistryBody.innerHTML = cards.map(function (card) {
      superAdminNfcCardsById[String(card.id)] = card;
      var status = String(card.status || "inactive").toLowerCase();
      var updated = card.updatedAt ? formatDate(new Date(card.updatedAt)) : "Not available";
      return '<tr class="nfc-live-row">' +
        '<td><div class="nfc-registry-card"><span class="nfc-registry-icon">NFC</span><div><strong>' + escapeDashboardHtml(card.label) + '</strong><small>#' + card.id + (card.notes ? " · " + escapeDashboardHtml(card.notes) : "") + '</small></div></div></td>' +
        '<td><div class="nfc-code-stack"><code>' + escapeDashboardHtml(card.tagIdentifier) + '</code><span>' + escapeDashboardHtml(card.serialNumber || "No serial") + '</span></div></td>' +
        '<td><div class="nfc-owner-stack"><strong>' + escapeDashboardHtml(card.owner ? card.owner.name : "Unassigned") + '</strong><span>' + escapeDashboardHtml(card.owner && card.owner.email ? card.owner.email : "No owner") + '</span></div></td>' +
        '<td>' + escapeDashboardHtml(card.businessCard ? card.businessCard.title : "Not linked") + '</td>' +
        '<td><span class="status-badge ' + nfcStatusClass(status) + '">' + escapeDashboardHtml(status.charAt(0).toUpperCase() + status.slice(1)) + '</span></td>' +
        '<td><span class="date-pill">' + escapeDashboardHtml(updated) + '</span></td>' +
        '<td><div class="user-row-actions"><button class="user-action-btn edit" type="button" data-nfc-live-action="edit" data-nfc-card-id="' + card.id + '">Edit</button><button class="user-action-btn delete" type="button" data-nfc-live-action="delete" data-nfc-card-id="' + card.id + '">Delete</button></div></td>' +
      '</tr>';
    }).join("");
    if (nfcRegistryCount) nfcRegistryCount.textContent = formatDashboardNumber(total) + (Number(total) === 1 ? " card" : " cards");
  }

  function renderNfcProducts(products, search) {
    if (!nfcProductsGrid) return;
    superAdminNfcProductsById = {};
    var term = String(search || "").toLowerCase();
    var visible = products.filter(function (product) { return !term || [product.name, product.description, product.category].join(" ").toLowerCase().includes(term); });
    if (!visible.length) {
      nfcProductsGrid.innerHTML = '<div class="admin-data-empty"><strong>No NFC products found</strong><span>Add a card product or try another search.</span></div>';
      if (nfcProductsCount) nfcProductsCount.textContent = "0 products";
      return;
    }
    nfcProductsGrid.innerHTML = visible.map(function (product) {
      superAdminNfcProductsById[String(product.id)] = product;
      return '<article class="nfc-product-directory-row">' +
        '<div class="nfc-product-name-cell"><img src="' + escapeDashboardHtml(product.frontImage) + '" alt="' + escapeDashboardHtml(product.name) + ' front" /><div><h3>' + escapeDashboardHtml(product.name) + '</h3><p>' + escapeDashboardHtml((product.category || "essential").replace(/^./, function (value) { return value.toUpperCase(); })) + ' &middot; ' + escapeDashboardHtml(product.description || "No description provided") + '</p></div></div>' +
        '<div class="nfc-product-price">' + escapeDashboardHtml(formatNfcMoney(product.price)) + '</div>' +
        '<div><span class="nfc-product-order-count">' + formatDashboardNumber(product.ordersCount) + '</span></div>' +
        '<div><span class="status-badge ' + (product.isActive ? "active" : "inactive") + '">' + (product.isActive ? "Available" : "Hidden") + '</span></div>' +
        '<div class="user-row-actions"><button class="user-action-btn edit" type="button" data-nfc-product-action="edit" data-product-id="' + product.id + '">Edit</button><button class="user-action-btn delete" type="button" data-nfc-product-action="delete" data-product-id="' + product.id + '">Delete</button></div>' +
      '</article>';
    }).join("");
    if (nfcProductsCount) nfcProductsCount.textContent = formatDashboardNumber(visible.length) + (visible.length === 1 ? " product" : " products");
  }

  function renderNfcOrders(orders) {
    if (!nfcOrdersLiveBody) return;
    if (!orders.length) {
      nfcOrdersLiveBody.innerHTML = '<tr><td colspan="10"><div class="admin-data-empty"><strong>No NFC orders found</strong><span>Customer payment submissions will appear here.</span></div></td></tr>';
      if (nfcOrdersLiveCount) nfcOrdersLiveCount.textContent = "0 orders";
      return;
    }
    var statuses = ["pending", "processing", "shipped", "completed", "cancelled"];
    nfcOrdersLiveBody.innerHTML = orders.map(function (order) {
      var options = statuses.map(function (status) { return '<option value="' + status + '"' + (status === order.status ? " selected" : "") + '>' + status.charAt(0).toUpperCase() + status.slice(1) + '</option>'; }).join("");
      var paymentClass=order.paymentStatus==="approved"?"active":order.paymentStatus==="rejected"?"inactive":"pending";
      var actions=order.paymentStatus==="pending"?'<button class="user-action-btn approve" type="button" data-nfc-payment-action="approved" data-nfc-order-id="' + order.id + '">Approve</button><button class="user-action-btn reject" type="button" data-nfc-payment-action="rejected" data-nfc-order-id="' + order.id + '">Reject</button>':'<span class="subtle-handle">Reviewed</span>';
      return '<tr class="nfc-live-row" data-nfc-order-id="' + order.id + '">' +
        '<td><strong>#' + order.id + ' · ' + escapeDashboardHtml(order.productName) + '</strong><div class="subtle-handle">' + escapeDashboardHtml(order.vcardTitle || "No VCard") + '</div></td>' +
        '<td><div class="nfc-owner-stack"><strong>' + escapeDashboardHtml(order.userName) + '</strong><span>' + escapeDashboardHtml(order.userEmail || "No email") + '</span></div></td>' +
        '<td><span class="nfc-quantity-pill">' + formatDashboardNumber(order.quantity) + '</span><div class="subtle-handle">' + escapeDashboardHtml(formatNfcMoney(order.amount)) + '</div></td>' +
        '<td><strong>' + escapeDashboardHtml(order.transactionNumber || "Not provided") + '</strong></td>' +
        '<td>' + (order.hasProof?'<button class="user-action-btn edit" type="button" data-nfc-proof-id="' + order.id + '">View slip</button>':'—') + '</td>' +
        '<td><span class="status-badge ' + paymentClass + '">' + escapeDashboardHtml(order.paymentStatus) + '</span>' + (order.adminNote?'<div class="subtle-handle">' + escapeDashboardHtml(order.adminNote) + '</div>':'') + '</td>' +
        '<td><span class="nfc-shipping-copy">' + escapeDashboardHtml(order.shippingAddress || "Not provided") + '</span></td>' +
        '<td><input class="nfc-tracking-input" type="text" maxlength="255" value="' + escapeDashboardHtml(order.trackingNumber || "") + '" placeholder="Add tracking" data-nfc-order-field="tracking" data-nfc-order-id="' + order.id + '"' + (order.paymentStatus!=="approved"?' disabled':'') + ' /></td>' +
        '<td><select class="nfc-order-status-select" data-nfc-order-field="status" data-nfc-order-id="' + order.id + '"' + (order.paymentStatus!=="approved"?' disabled':'') + '>' + options + '</select></td>' +
        '<td><div class="user-row-actions">' + actions + '</div></td>' +
      '</tr>';
    }).join("");
    if (nfcOrdersLiveCount) nfcOrdersLiveCount.textContent = formatDashboardNumber(orders.length) + (orders.length === 1 ? " order" : " orders");
  }

  function populateNfcRegistryOptions(users, businessCards) {
    if (!nfcRegistryForm) return;
    nfcRegistryForm.elements.userId.innerHTML = '<option value="">Unassigned</option>' + users.map(function (user) { return '<option value="' + user.id + '">' + escapeDashboardHtml(user.name || user.email) + ' · ' + escapeDashboardHtml(user.email) + '</option>'; }).join("");
    nfcRegistryForm.elements.businessCardId.innerHTML = '<option value="">Not linked</option>' + businessCards.map(function (card) { return '<option value="' + card.id + '">' + escapeDashboardHtml(card.title || "Untitled card") + (card.user_name ? " · " + escapeDashboardHtml(card.user_name) : "") + '</option>'; }).join("");
  }

  async function loadSuperAdminNfc() {
    if (adminPageSlug !== "nfc-orders" || !nfcRegistryBody) return;
    var token = localStorage.getItem("token");
    if (!token) {
      if (nfcProductsGrid) nfcProductsGrid.innerHTML = '<div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as a super admin to manage NFC products.</span></div>';
      nfcRegistryBody.innerHTML = '<tr><td colspan="7"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as a super admin to manage NFC cards.</span></div></td></tr>';
      return;
    }
    try {
      var search = searchInput ? searchInput.value.trim() : "";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/nfc?search=" + encodeURIComponent(search), { headers: { Authorization: "Bearer " + token } });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to load NFC management data");
      renderNfcProducts(data.products || [], search);
      renderNfcRegistry(data.cards || [], search ? (data.cards || []).length : Number(data.summary && data.summary.total_cards));
      renderNfcOrders(data.orders || []);
      populateNfcRegistryOptions(data.users || [], data.businessCards || []);
      updateNfcPageSummary(data.summary || {});
    } catch (error) {
      nfcRegistryBody.innerHTML = '<tr><td colspan="7"><div class="admin-data-empty"><strong>NFC data could not be loaded</strong><span>' + escapeDashboardHtml(error.message) + '</span></div></td></tr>';
      if (nfcOrdersLiveBody) nfcOrdersLiveBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>Orders could not be loaded</strong><span>' + escapeDashboardHtml(error.message) + '</span></div></td></tr>';
      console.error("Super admin NFC:", error);
    }
  }

  function resetNfcRegistryMode() {
    if (!nfcRegistryForm) return;
    nfcRegistryForm.reset();
    nfcRegistryForm.elements.cardId.value = "";
    if (nfcRegistryModalTitle) nfcRegistryModalTitle.textContent = "Register NFC Card";
    if (nfcRegistryFeedback) nfcRegistryFeedback.hidden = true;
  }

  function setNfcProductPreview(node, src, fallback) {
    if (!node) return;
    node.innerHTML = src ? '<img src="' + escapeDashboardHtml(src) + '" alt="NFC card preview" />' : escapeDashboardHtml(fallback);
  }

  function resetNfcProductMode() {
    if (!nfcProductForm) return;
    nfcProductForm.reset();
    nfcProductForm.elements.productId.value = "";
    nfcProductForm.elements.frontImage.required = true;
    nfcProductForm.elements.backImage.required = true;
    if (nfcProductModalTitle) nfcProductModalTitle.textContent = "Add NFC Card";
    if (nfcProductFeedback) nfcProductFeedback.hidden = true;
    setNfcProductPreview(nfcProductFrontPreview, "", "Choose front image");
    setNfcProductPreview(nfcProductBackPreview, "", "Choose back image");
  }

  function setNfcProductModal(open, product) {
    if (!nfcProductModal || !nfcProductForm) return;
    if (open) {
      resetNfcProductMode();
      if (product) {
        nfcProductForm.elements.productId.value = product.id;
        nfcProductForm.elements.name.value = product.name;
        nfcProductForm.elements.price.value = product.price;
        nfcProductForm.elements.category.value = product.category || "essential";
        nfcProductForm.elements.description.value = product.description || "";
        nfcProductForm.elements.isActive.checked = product.isActive;
        nfcProductForm.elements.frontImage.required = false;
        nfcProductForm.elements.backImage.required = false;
        setNfcProductPreview(nfcProductFrontPreview, product.frontImage, "Choose front image");
        setNfcProductPreview(nfcProductBackPreview, product.backImage, "Choose back image");
        if (nfcProductModalTitle) nfcProductModalTitle.textContent = "Edit NFC Card";
      }
    }
    nfcProductModal.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
  }

  function readNfcProductImage(input, previewNode) {
    var file = input.files && input.files[0];
    if (!file) return Promise.resolve(null);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return Promise.reject(new Error("Choose a PNG, JPG, or WebP image."));
    if (file.size > 1500000) return Promise.reject(new Error("Each card image must be smaller than 1.5 MB."));
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { setNfcProductPreview(previewNode, reader.result, ""); resolve(reader.result); };
      reader.onerror = function () { reject(new Error("The selected image could not be read.")); };
      reader.readAsDataURL(file);
    });
  }

  async function deleteNfcProduct(productId, button) {
    var product = superAdminNfcProductsById[String(productId)];
    if (!window.confirm("Permanently delete " + (product ? product.name : "this NFC product") + "?")) return;
    try {
      button.disabled = true; button.textContent = "Deleting...";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/nfc/products/" + encodeURIComponent(productId), { method: "DELETE", headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to delete NFC product");
      await loadSuperAdminNfc();
      showToast("NFC card deleted", "The product was removed from the database catalog.");
    } catch (error) {
      button.disabled = false; button.textContent = "Delete"; showToast("Delete failed", error.message);
    }
  }

  function setNfcRegistryModal(open, card) {
    if (!nfcRegistryModal || !nfcRegistryForm) return;
    if (open) {
      resetNfcRegistryMode();
      if (card) {
        nfcRegistryForm.elements.cardId.value = card.id;
        nfcRegistryForm.elements.label.value = card.label || "";
        nfcRegistryForm.elements.status.value = card.status || "inactive";
        nfcRegistryForm.elements.tagIdentifier.value = card.tagIdentifier || "";
        nfcRegistryForm.elements.serialNumber.value = card.serialNumber || "";
        nfcRegistryForm.elements.userId.value = card.owner ? String(card.owner.id) : "";
        nfcRegistryForm.elements.businessCardId.value = card.businessCard ? String(card.businessCard.id) : "";
        nfcRegistryForm.elements.expiresAt.value = card.expiresAt ? String(card.expiresAt).slice(0, 10) : "";
        nfcRegistryForm.elements.notes.value = card.notes || "";
        if (nfcRegistryModalTitle) nfcRegistryModalTitle.textContent = "Edit NFC Card";
      }
    }
    nfcRegistryModal.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
  }

  async function deleteSuperAdminNfcCard(cardId, button) {
    var card = superAdminNfcCardsById[String(cardId)];
    if (!window.confirm("Permanently delete " + (card ? card.label : "this NFC card") + " from the registry?")) return;
    try {
      if (button) { button.disabled = true; button.textContent = "Deleting..."; }
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/nfc/cards/" + encodeURIComponent(cardId), { method: "DELETE", headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to delete NFC card");
      await loadSuperAdminNfc();
      showToast("NFC card deleted", "The physical tag record was removed from PostgreSQL.");
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "Delete"; }
      showToast("Delete failed", error.message);
    }
  }

  async function updateSuperAdminNfcOrder(orderId, row, paymentStatus) {
    var statusSelect = row.querySelector('[data-nfc-order-field="status"]');
    var trackingInput = row.querySelector('[data-nfc-order-field="tracking"]');
    try {
      statusSelect.disabled = true;
      trackingInput.disabled = true;
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/nfc/orders/" + encodeURIComponent(orderId), {
        method: "PATCH",
        headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusSelect.value, trackingNumber: trackingInput.value.trim(), paymentStatus: paymentStatus || undefined, adminNote: paymentStatus === "rejected" ? (window.prompt("Reason for rejecting this payment:", "Payment evidence could not be verified") || "Payment evidence could not be verified") : undefined })
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to update NFC order");
      await loadSuperAdminNfc();
       showToast(paymentStatus ? "Payment " + paymentStatus : "Order updated", data.message || "NFC order was saved.");
    } catch (error) {
      statusSelect.disabled = false;
      trackingInput.disabled = false;
      showToast("Order update failed", error.message);
    }
  }

  async function openNfcOrderProof(orderId, button) {
    try {
      if(button){button.disabled=true;button.textContent="Opening...";}
      var response=await fetch("http://127.0.0.1:5000/api/super-admin/nfc/orders/"+encodeURIComponent(orderId)+"/proof",{headers:{Authorization:"Bearer "+localStorage.getItem("token")}});
      if(!response.ok){var data=await response.json().catch(function(){return {};});throw new Error(data.message||"Unable to open payment slip");}
      var url=URL.createObjectURL(await response.blob());window.open(url,"_blank","noopener");window.setTimeout(function(){URL.revokeObjectURL(url);},60000);
    }catch(error){showToast("Payment slip unavailable",error.message);}finally{if(button){button.disabled=false;button.textContent="View slip";}}
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

  function resetUserFormMode() {
    if (!addUserForm) return;
    addUserForm.reset();
    if (userEditId) userEditId.value = "";
    if (userModalTitle) userModalTitle.textContent = "Add User";
    var passwordField = document.getElementById("userPassword");
    var confirmPasswordField = document.getElementById("userConfirmPassword");
    if (passwordField) {
      passwordField.required = true;
      passwordField.placeholder = "Create password";
    }
    if (confirmPasswordField) {
      confirmPasswordField.required = true;
      confirmPasswordField.placeholder = "Confirm Password";
    }
  }

  function openUserEditor(user) {
    if (!addUserForm || !user) return;
    resetUserFormMode();
    var nameParts = String(user.name || "").trim().split(/\s+/);
    addUserForm.elements.firstName.value = nameParts.shift() || "";
    addUserForm.elements.lastName.value = nameParts.join(" ");
    addUserForm.elements.email.value = user.email || "";
    addUserForm.elements.status.value = String(user.status || "active").charAt(0).toUpperCase() + String(user.status || "active").slice(1);
    if (userEditId) userEditId.value = user.id;
    if (userModalTitle) userModalTitle.textContent = "Edit User";

    var phone = String(user.phoneNumber || "").trim();
    var countryCodes = ["+61", "+94", "+44", "+1"];
    var countryCode = countryCodes.find(function (code) { return phone.indexOf(code) === 0; });
    if (countryCode) {
      addUserForm.elements.countryCode.value = countryCode;
      addUserForm.elements.phone.value = phone.slice(countryCode.length).trim();
    } else if (adminPageSlug === "vcards") {
      var vcardsSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(vcardsSearchTimer);
        vcardsSearchTimer = window.setTimeout(loadSuperAdminVCards, 250);
      });
    } else {
      addUserForm.elements.phone.value = phone;
    }

    var passwordField = document.getElementById("userPassword");
    var confirmPasswordField = document.getElementById("userConfirmPassword");
    if (passwordField) {
      passwordField.required = false;
      passwordField.value = "";
      passwordField.placeholder = "Leave blank to keep current password";
    }
    if (confirmPasswordField) {
      confirmPasswordField.required = false;
      confirmPasswordField.value = "";
      confirmPasswordField.placeholder = "Confirm new password if changing";
    }
    openUserModal();
  }

  async function changeSuperAdminUserStatus(userId, status, button) {
    var token = localStorage.getItem("token");
    if (!token) return showToast("Sign in required", "Log in as a super admin to manage users.");
    var originalText = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Saving...";
    }
    try {
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/users/" + encodeURIComponent(userId) + "/status", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ status: status })
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to update user status");
      await loadSuperAdminUsers();
      showToast(status === "active" ? "User approved" : "User rejected", "The account status was updated in the database.");
    } catch (error) {
      showToast("Update failed", error.message);
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  async function deleteSuperAdminUser(userId, button) {
    var user = superAdminUsersById[String(userId)];
    var userName = user ? (user.name || user.email) : "this user";
    if (!window.confirm("Permanently delete " + userName + "? This also removes their cards and subscriptions.")) return;
    var token = localStorage.getItem("token");
    if (!token) return showToast("Sign in required", "Log in as a super admin to manage users.");
    if (button) {
      button.disabled = true;
      button.textContent = "Deleting...";
    }
    try {
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/users/" + encodeURIComponent(userId), {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to delete user");
      await loadSuperAdminUsers();
      showToast("User deleted", userName + " was permanently removed.");
    } catch (error) {
      showToast("Delete failed", error.message);
      if (button) {
        button.disabled = false;
        button.textContent = "Delete";
      }
    }
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
    if (adminPageSlug === "users") {
      var usersSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(usersSearchTimer);
        usersSearchTimer = window.setTimeout(loadSuperAdminUsers, 250);
      });
    } else if (adminPageSlug === "vcards") {
      var vcardsSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(vcardsSearchTimer);
        vcardsSearchTimer = window.setTimeout(loadSuperAdminVCards, 250);
      });
    } else if (adminPageSlug === "nfc-orders") {
      var nfcLiveSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(nfcLiveSearchTimer);
        nfcLiveSearchTimer = window.setTimeout(loadSuperAdminNfc, 250);
      });
    } else if (adminPageSlug === "subscriptions") {
      var subscriptionsLiveSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(subscriptionsLiveSearchTimer);
        subscriptionsLiveSearchTimer = window.setTimeout(loadSuperAdminSubscriptions, 250);
      });
    } else if (adminPageSlug === "cash-payments") {
      var cashPaymentsLiveSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(cashPaymentsLiveSearchTimer);
        cashPaymentsLiveSearchTimer = window.setTimeout(loadSuperAdminCashPayments, 250);
      });
    } else if (adminPageSlug === "transactions") {
      var transactionsLiveSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(transactionsLiveSearchTimer);
        transactionsLiveSearchTimer = window.setTimeout(loadSuperAdminTransactions, 250);
      });
    } else if (adminPageSlug === "payouts") {
      var payoutsLiveSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(payoutsLiveSearchTimer);
        payoutsLiveSearchTimer = window.setTimeout(loadSuperAdminPayouts, 250);
      });
    } else if (adminPageSlug === "withdrawals") {
      var withdrawalsLiveSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(withdrawalsLiveSearchTimer);
        withdrawalsLiveSearchTimer = window.setTimeout(loadSuperAdminWithdrawals, 250);
      });
    } else if (adminPageSlug === "affiliations") {
      var affiliationsLiveSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(affiliationsLiveSearchTimer);
        affiliationsLiveSearchTimer = window.setTimeout(loadSuperAdminAffiliations, 250);
      });
    } else if (adminPageSlug === "coupon-codes") {
      var couponsLiveSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(couponsLiveSearchTimer);
        couponsLiveSearchTimer = window.setTimeout(loadSuperAdminCoupons, 250);
      });
    } else if (adminPageSlug === "reports") {
      var reportsLiveSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(reportsLiveSearchTimer);
        reportsLiveSearchTimer = window.setTimeout(loadSuperAdminReports, 250);
      });
    } else if (adminPageSlug === "system-logs") {
      var systemLogsSearchTimer;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(systemLogsSearchTimer);
        systemLogPage = 1;
        systemLogsSearchTimer = window.setTimeout(loadSuperAdminSystemLogs, 250);
      });
    } else {
      searchInput.addEventListener("input", applySearchFilter);
    }
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
          if (!button.classList.contains("vcard-tab-btn")) {
            window.setTimeout(function () { targetPanel.scrollIntoView({ behavior: "smooth", block: "start" }); }, 40);
          }
        }
      });
    });
  }

  if (openVCardModalButton) openVCardModalButton.addEventListener("click", function () { setVCardModal(true); });
  if (closeVCardModalButton) closeVCardModalButton.addEventListener("click", function () { setVCardModal(false); });
  if (vcardModalBackdrop) vcardModalBackdrop.addEventListener("click", function () { setVCardModal(false); });
  if (resetVCardFormButton && vcardAdminForm) resetVCardFormButton.addEventListener("click", function () { vcardAdminForm.reset(); setVCardModal(false); });

  if (vcardAdminForm) {
    vcardAdminForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!vcardAdminForm.checkValidity()) {
        if (vcardFormFeedback) { vcardFormFeedback.hidden = false; vcardFormFeedback.textContent = "Select an owner and enter a VCard title."; }
        return;
      }
      var formData = new FormData(vcardAdminForm);
      var submitButton = vcardAdminForm.querySelector('[type="submit"]');
      try {
        if (submitButton) { submitButton.disabled = true; submitButton.textContent = "Creating..."; }
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/vcards", {
          method: "POST",
          headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: Number(formData.get("userId")),
            templateId: formData.get("templateId") ? Number(formData.get("templateId")) : null,
            title: formData.get("title").trim(),
            email: formData.get("email").trim(),
            phone: formData.get("phone").trim(),
            websiteUrl: formData.get("websiteUrl").trim(),
            description: formData.get("description").trim(),
            isActive: formData.get("isActive") === "on"
          })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to create VCard");
        vcardAdminForm.reset();
        setVCardModal(false);
        await loadSuperAdminVCards();
        showToast("VCard created", "The new card was saved to PostgreSQL.");
      } catch (error) {
        if (vcardFormFeedback) { vcardFormFeedback.hidden = false; vcardFormFeedback.textContent = error.message; }
      } finally {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = "Create VCard"; }
      }
    });
  }

  if (openNfcRegistryModalButton) openNfcRegistryModalButton.addEventListener("click", function () { setNfcRegistryModal(true); });
  if (closeNfcRegistryModalButton) closeNfcRegistryModalButton.addEventListener("click", function () { setNfcRegistryModal(false); });
  if (nfcRegistryModalBackdrop) nfcRegistryModalBackdrop.addEventListener("click", function () { setNfcRegistryModal(false); });
  if (resetNfcRegistryFormButton) resetNfcRegistryFormButton.addEventListener("click", function () { resetNfcRegistryMode(); setNfcRegistryModal(false); });
  if (openNfcProductModalButton) openNfcProductModalButton.addEventListener("click", function () { setNfcProductModal(true); });
  if (closeNfcProductModalButton) closeNfcProductModalButton.addEventListener("click", function () { setNfcProductModal(false); });
  if (nfcProductModalBackdrop) nfcProductModalBackdrop.addEventListener("click", function () { setNfcProductModal(false); });
  if (resetNfcProductFormButton) resetNfcProductFormButton.addEventListener("click", function () { resetNfcProductMode(); setNfcProductModal(false); });

  if (nfcProductForm) {
    nfcProductForm.elements.frontImage.addEventListener("change", function () {
      readNfcProductImage(nfcProductForm.elements.frontImage, nfcProductFrontPreview).catch(function (error) { nfcProductForm.elements.frontImage.value = ""; showToast("Image rejected", error.message); });
    });
    nfcProductForm.elements.backImage.addEventListener("change", function () {
      readNfcProductImage(nfcProductForm.elements.backImage, nfcProductBackPreview).catch(function (error) { nfcProductForm.elements.backImage.value = ""; showToast("Image rejected", error.message); });
    });
    nfcProductForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!nfcProductForm.checkValidity()) {
        if (nfcProductFeedback) { nfcProductFeedback.hidden = false; nfcProductFeedback.textContent = "Complete the name, price, description, front image, and back image."; }
        return;
      }
      var formData = new FormData(nfcProductForm);
      var productId = String(formData.get("productId") || "").trim();
      var submitButton = nfcProductForm.querySelector('[type="submit"]');
      try {
        submitButton.disabled = true; submitButton.textContent = "Saving...";
        var frontImage = await readNfcProductImage(nfcProductForm.elements.frontImage, nfcProductFrontPreview);
        var backImage = await readNfcProductImage(nfcProductForm.elements.backImage, nfcProductBackPreview);
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/nfc/products" + (productId ? "/" + encodeURIComponent(productId) : ""), {
          method: productId ? "PATCH" : "POST",
          headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.get("name").trim(), price: Number(formData.get("price")), category: formData.get("category"), description: formData.get("description").trim(), frontImage: frontImage, backImage: backImage, isActive: formData.get("isActive") === "on" })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to save NFC card product");
        resetNfcProductMode(); setNfcProductModal(false); await loadSuperAdminNfc();
        showToast(productId ? "NFC card updated" : "NFC card added", "Name, price, description, and both images were saved.");
      } catch (error) {
        if (nfcProductFeedback) { nfcProductFeedback.hidden = false; nfcProductFeedback.textContent = error.message; }
      } finally {
        submitButton.disabled = false; submitButton.textContent = "Save NFC Card";
      }
    });
  }

  if (nfcRegistryForm) {
    nfcRegistryForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!nfcRegistryForm.checkValidity()) {
        if (nfcRegistryFeedback) { nfcRegistryFeedback.hidden = false; nfcRegistryFeedback.textContent = "Enter the NFC tag identifier before saving."; }
        return;
      }
      var formData = new FormData(nfcRegistryForm);
      var cardId = String(formData.get("cardId") || "").trim();
      var submitButton = nfcRegistryForm.querySelector('[type="submit"]');
      try {
        if (submitButton) { submitButton.disabled = true; submitButton.textContent = "Saving..."; }
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/nfc/cards" + (cardId ? "/" + encodeURIComponent(cardId) : ""), {
          method: cardId ? "PATCH" : "POST",
          headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" },
          body: JSON.stringify({
            label: formData.get("label").trim(), status: formData.get("status"),
            tagIdentifier: formData.get("tagIdentifier").trim(), serialNumber: formData.get("serialNumber").trim(),
            userId: formData.get("userId") ? Number(formData.get("userId")) : null,
            businessCardId: formData.get("businessCardId") ? Number(formData.get("businessCardId")) : null,
            expiresAt: formData.get("expiresAt") || null, notes: formData.get("notes").trim()
          })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to save NFC card");
        resetNfcRegistryMode();
        setNfcRegistryModal(false);
        await loadSuperAdminNfc();
        showToast(cardId ? "NFC card updated" : "NFC card registered", "The physical tag record was saved to PostgreSQL.");
      } catch (error) {
        if (nfcRegistryFeedback) { nfcRegistryFeedback.hidden = false; nfcRegistryFeedback.textContent = error.message; }
      } finally {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = "Save NFC Card"; }
      }
    });
  }

  document.addEventListener("click", function (event) {
    var actionButton = event.target.closest("[data-nfc-live-action]");
    var productButton = event.target.closest("[data-nfc-product-action]");
    if (actionButton) {
      var action = actionButton.getAttribute("data-nfc-live-action");
      var cardId = actionButton.getAttribute("data-nfc-card-id");
      if (action === "edit") setNfcRegistryModal(true, superAdminNfcCardsById[String(cardId)]);
      if (action === "delete") deleteSuperAdminNfcCard(cardId, actionButton);
    }
    if (productButton) {
      var productId = productButton.getAttribute("data-product-id");
      if (productButton.getAttribute("data-nfc-product-action") === "edit") setNfcProductModal(true, superAdminNfcProductsById[String(productId)]);
      if (productButton.getAttribute("data-nfc-product-action") === "delete") deleteNfcProduct(productId, productButton);
    }
  });

  document.addEventListener("change", function (event) {
    var orderField = event.target.closest("[data-nfc-order-field]");
    if (!orderField) return;
    var row = orderField.closest("[data-nfc-order-id]");
    if (row) updateSuperAdminNfcOrder(orderField.getAttribute("data-nfc-order-id"), row);
  });

  function subscriptionMoney(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  }

  function subscriptionDate(value) {
    if (!value) return "No end date";
    var date = new Date(String(value).slice(0, 10) + "T00:00:00");
    return Number.isNaN(date.getTime()) ? "Not set" : formatDate(date);
  }

  function subscriptionStatusClass(status) {
    status = String(status || "").toLowerCase();
    if (status === "active") return "active";
    if (status === "pending" || status === "trial") return "pending";
    return "inactive";
  }

  function updateSubscriptionsPageSummary(summary) {
    var cards = document.querySelectorAll(".admin-page-subscriptions .admin-page-stats article");
    if (cards.length < 3) return;
    cards[0].querySelector("span").textContent = "Active subscriptions";
    cards[0].querySelector("strong").textContent = formatDashboardNumber(summary.active_subscriptions);
    cards[0].querySelector("small").textContent = formatDashboardNumber(summary.total_subscriptions) + " total records";
    cards[1].querySelector("span").textContent = "Monthly recurring revenue";
    cards[1].querySelector("strong").textContent = subscriptionMoney(summary.monthly_recurring_revenue);
    cards[1].querySelector("small").textContent = "From active plans";
    cards[2].querySelector("span").textContent = "Pending or trial";
    cards[2].querySelector("strong").textContent = formatDashboardNumber(summary.pending_subscriptions);
    cards[2].querySelector("small").textContent = "Needs review";
  }

  function renderSubscriptionAdmin(subscriptions) {
    if (!subscriptionAdminBody) return;
    superAdminSubscriptionsById = {};
    if (subscriptionAdminCount) subscriptionAdminCount.textContent = formatDashboardNumber(subscriptions.length) + (subscriptions.length === 1 ? " subscription" : " subscriptions");
    if (!subscriptions.length) {
      subscriptionAdminBody.innerHTML = '<tr><td colspan="6"><div class="admin-data-empty"><strong>No subscriptions found</strong><span>Use New Subscription to assign a billing plan to a user.</span></div></td></tr>';
      return;
    }
    subscriptionAdminBody.innerHTML = subscriptions.map(function (subscription) {
      superAdminSubscriptionsById[String(subscription.id)] = subscription;
      var user = subscription.user || {};
      var plan = subscription.plan || {};
      var status = String(subscription.status || "pending").toLowerCase();
      var displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
      return '<tr>' +
        '<td><div class="table-user"><span class="mini-avatar">' + escapeDashboardHtml(avatarInitials(user.name || "User") || "U") + '</span><div><strong>' + escapeDashboardHtml(user.name || "Unknown user") + '</strong><div class="subtle-handle">' + escapeDashboardHtml(user.email || "Account unavailable") + '</div></div></div></td>' +
        '<td><strong>' + escapeDashboardHtml(plan.name || "No plan") + '</strong><div class="subtle-handle">' + subscriptionMoney(plan.price) + ' / ' + escapeDashboardHtml(plan.billingInterval || "month") + '</div></td>' +
        '<td><div class="subscription-period"><strong>' + escapeDashboardHtml(subscriptionDate(subscription.startDate)) + '</strong><span>to ' + escapeDashboardHtml(subscriptionDate(subscription.endDate)) + '</span></div></td>' +
        '<td><span class="subscription-renew-pill ' + (subscription.autoRenew ? "on" : "off") + '">' + (subscription.autoRenew ? "Auto-renew" : "Manual") + '</span></td>' +
        '<td><span class="status-badge ' + subscriptionStatusClass(status) + '">' + escapeDashboardHtml(displayStatus) + '</span></td>' +
        '<td><div class="user-row-actions"><button class="user-action-btn edit" type="button" data-live-subscription-action="edit" data-subscription-id="' + subscription.id + '">Edit</button><button class="user-action-btn delete" type="button" data-live-subscription-action="delete" data-subscription-id="' + subscription.id + '">Delete</button></div></td>' +
      '</tr>';
    }).join("");
  }

  function planFeatureNames(features) {
    if (Array.isArray(features)) return features;
    if (features && typeof features === "object" && Array.isArray(features.benefits)) return features.benefits;
    return [];
  }

  function renderPlanEntitlementOptions(features, templates) {
    if (planVcardFeatureOptions) planVcardFeatureOptions.innerHTML = features.map(function (feature) {
      return '<label class="plan-entitlement-option"><input type="checkbox" name="vcardFeatures" value="' + escapeDashboardHtml(feature.key) + '"><span>' + escapeDashboardHtml(feature.label) + '</span></label>';
    }).join("");
    if (planVcardTemplateOptions) planVcardTemplateOptions.innerHTML = templates.map(function (template) {
      return '<label class="plan-entitlement-option"><input type="checkbox" name="templateIds" value="' + template.id + '"><span><strong>' + escapeDashboardHtml(template.name) + '</strong><small>' + escapeDashboardHtml(template.description || "Available VCard design") + '</small></span></label>';
    }).join("");
  }

  function renderPlanAdmin(plans) {
    if (!planAdminBody) return;
    superAdminPlansById = {};
    if (planAdminCount) planAdminCount.textContent = formatDashboardNumber(plans.length) + (plans.length === 1 ? " plan" : " plans");
    if (!plans.length) {
      planAdminBody.innerHTML = '<tr><td colspan="6"><div class="admin-data-empty"><strong>No billing plans found</strong><span>Create the first plan to begin assigning subscriptions.</span></div></td></tr>';
      return;
    }
    planAdminBody.innerHTML = plans.map(function (plan) {
      superAdminPlansById[String(plan.id)] = plan;
      var status = String(plan.status || "inactive").toLowerCase();
      var features = planFeatureNames(plan.features);
      return '<tr>' +
        '<td><div class="subscription-plan-name"><strong>' + escapeDashboardHtml(plan.name) + '</strong><span>' + escapeDashboardHtml(features.slice(0, 2).join(" · ") || "Core platform access") + '</span></div></td>' +
        '<td><strong class="subscription-plan-price">' + subscriptionMoney(plan.price) + '</strong><div class="subtle-handle">per ' + escapeDashboardHtml(plan.billingInterval) + '</div></td>' +
        '<td><div class="subscription-limit-list"><span>' + formatDashboardNumber(plan.vcardLimit) + ' VCards</span><span>' + formatDashboardNumber(plan.nfcLimit) + ' NFC</span><span>' + formatDashboardNumber(plan.analyticsLimit) + ' analytics</span></div></td>' +
        '<td><strong>' + formatDashboardNumber(plan.activeSubscribers) + ' active</strong><div class="subtle-handle">' + formatDashboardNumber(plan.subscribers) + ' total</div></td>' +
        '<td><span class="status-badge ' + subscriptionStatusClass(status) + '">' + escapeDashboardHtml(status.charAt(0).toUpperCase() + status.slice(1)) + '</span></td>' +
        '<td><div class="user-row-actions"><button class="user-action-btn edit" type="button" data-live-plan-action="edit" data-plan-id="' + plan.id + '">Edit</button><button class="user-action-btn delete" type="button" data-live-plan-action="delete" data-plan-id="' + plan.id + '">Delete</button></div></td>' +
      '</tr>';
    }).join("");
  }

  function populateSubscriptionAdminOptions(users, plans) {
    if (!subscriptionAdminForm) return;
    var userSelect = subscriptionAdminForm.elements.userId;
    var planSelect = subscriptionAdminForm.elements.planId;
    var currentUser = userSelect.value;
    var currentPlan = planSelect.value;
    userSelect.innerHTML = '<option value="">Select active user</option>' + users.map(function (user) { return '<option value="' + user.id + '">' + escapeDashboardHtml(user.name + " — " + user.email) + '</option>'; }).join("");
    planSelect.innerHTML = '<option value="">Select plan</option>' + plans.map(function (plan) { return '<option value="' + plan.id + '">' + escapeDashboardHtml(plan.name + " — " + subscriptionMoney(plan.price)) + '</option>'; }).join("");
    userSelect.value = currentUser;
    planSelect.value = currentPlan;
  }

  async function loadSuperAdminSubscriptions() {
    if (adminPageSlug !== "subscriptions" || !subscriptionAdminBody) return;
    var token = localStorage.getItem("token");
    if (!token) {
      subscriptionAdminBody.innerHTML = '<tr><td colspan="6"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as a super admin to manage subscriptions.</span></div></td></tr>';
      if (planAdminBody) planAdminBody.innerHTML = '<tr><td colspan="6"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as a super admin to manage billing plans.</span></div></td></tr>';
      if (subscriptionAdminCount) subscriptionAdminCount.textContent = "Sign in required";
      if (planAdminCount) planAdminCount.textContent = "Sign in required";
      updateSubscriptionsPageSummary({ active_subscriptions: 0, total_subscriptions: 0, monthly_recurring_revenue: 0, pending_subscriptions: 0 });
      return;
    }
    try {
      var search = searchInput ? searchInput.value.trim() : "";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/subscriptions?search=" + encodeURIComponent(search), { headers: { Authorization: "Bearer " + token } });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to load subscriptions");
      renderSubscriptionAdmin(data.subscriptions || []);
      renderPlanAdmin(data.plans || []);
      populateSubscriptionAdminOptions(data.users || [], data.plans || []);
      renderPlanEntitlementOptions(data.vcardFeatures || [], data.templates || []);
      updateSubscriptionsPageSummary(data.summary || {});
    } catch (error) {
      subscriptionAdminBody.innerHTML = '<tr><td colspan="6"><div class="admin-data-empty"><strong>Subscriptions unavailable</strong><span>' + escapeDashboardHtml(error.message) + '</span></div></td></tr>';
      if (subscriptionAdminCount) subscriptionAdminCount.textContent = "Unavailable";
      updateSubscriptionsPageSummary({ active_subscriptions: 0, total_subscriptions: 0, monthly_recurring_revenue: 0, pending_subscriptions: 0 });
      showToast("Could not load subscriptions", error.message);
    }
  }

  function setSubscriptionAdminModal(open, subscription) {
    if (!subscriptionAdminModal || !subscriptionAdminForm) return;
    if (!open) {
      subscriptionAdminModal.hidden = true;
      document.body.style.overflow = "";
      return;
    }
    subscriptionAdminForm.reset();
    subscriptionAdminForm.elements.subscriptionId.value = subscription ? subscription.id : "";
    subscriptionAdminForm.elements.startDate.value = subscription ? String(subscription.startDate || "").slice(0, 10) : new Date().toISOString().slice(0, 10);
    if (subscription) {
      subscriptionAdminForm.elements.userId.value = subscription.user ? subscription.user.id : "";
      subscriptionAdminForm.elements.planId.value = subscription.plan ? subscription.plan.id : "";
      subscriptionAdminForm.elements.endDate.value = String(subscription.endDate || "").slice(0, 10);
      subscriptionAdminForm.elements.status.value = subscription.status;
      subscriptionAdminForm.elements.autoRenew.checked = Boolean(subscription.autoRenew);
      subscriptionAdminForm.elements.cancelReason.value = subscription.cancelReason || "";
    }
    if (subscriptionAdminModalTitle) subscriptionAdminModalTitle.textContent = subscription ? "Edit Subscription" : "New Subscription";
    if (subscriptionAdminFeedback) { subscriptionAdminFeedback.hidden = true; subscriptionAdminFeedback.textContent = ""; }
    subscriptionAdminModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function setPlanAdminModal(open, plan) {
    if (!planAdminModal || !planAdminForm) return;
    if (!open) {
      planAdminModal.hidden = true;
      document.body.style.overflow = "";
      return;
    }
    planAdminForm.reset();
    planAdminForm.elements.planId.value = plan ? plan.id : "";
    if (plan) {
      planAdminForm.elements.name.value = plan.name || "";
      planAdminForm.elements.price.value = plan.price;
      planAdminForm.elements.billingInterval.value = plan.billingInterval;
      planAdminForm.elements.vcardLimit.value = plan.vcardLimit;
      planAdminForm.elements.nfcLimit.value = plan.nfcLimit;
      planAdminForm.elements.analyticsLimit.value = plan.analyticsLimit;
      planAdminForm.elements.features.value = planFeatureNames(plan.features).join(", ");
      planAdminForm.elements.status.value = plan.status;
    }
    var structuredFeatures = plan && plan.features && !Array.isArray(plan.features) ? plan.features : {};
    var selectedVcardFeatures = structuredFeatures.vcardFeatures || (plan ? ["basic-details"] : []);
    var selectedTemplateIds = structuredFeatures.templateIds || [];
    Array.from(planAdminForm.querySelectorAll('input[name="vcardFeatures"]')).forEach(function (input) { input.checked = selectedVcardFeatures.indexOf(input.value) !== -1; });
    Array.from(planAdminForm.querySelectorAll('input[name="templateIds"]')).forEach(function (input) { input.checked = selectedTemplateIds.map(String).indexOf(input.value) !== -1; });
    if (planAdminModalTitle) planAdminModalTitle.textContent = plan ? "Edit Plan" : "New Plan";
    if (planAdminFeedback) { planAdminFeedback.hidden = true; planAdminFeedback.textContent = ""; }
    planAdminModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  if (openSubscriptionAdminModalButton) openSubscriptionAdminModalButton.addEventListener("click", function () { setSubscriptionAdminModal(true); });
  if (closeSubscriptionAdminModalButton) closeSubscriptionAdminModalButton.addEventListener("click", function () { setSubscriptionAdminModal(false); });
  if (subscriptionAdminModalBackdrop) subscriptionAdminModalBackdrop.addEventListener("click", function () { setSubscriptionAdminModal(false); });
  if (resetSubscriptionAdminFormButton) resetSubscriptionAdminFormButton.addEventListener("click", function () { setSubscriptionAdminModal(false); });
  if (openPlanAdminModalButton) openPlanAdminModalButton.addEventListener("click", function () { setPlanAdminModal(true); });
  if (closePlanAdminModalButton) closePlanAdminModalButton.addEventListener("click", function () { setPlanAdminModal(false); });
  if (planAdminModalBackdrop) planAdminModalBackdrop.addEventListener("click", function () { setPlanAdminModal(false); });
  if (resetPlanAdminFormButton) resetPlanAdminFormButton.addEventListener("click", function () { setPlanAdminModal(false); });

  if (subscriptionAdminForm) {
    subscriptionAdminForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!subscriptionAdminForm.checkValidity()) {
        if (subscriptionAdminFeedback) { subscriptionAdminFeedback.hidden = false; subscriptionAdminFeedback.textContent = "Select a user and plan, then enter a valid start date."; }
        return;
      }
      var formData = new FormData(subscriptionAdminForm);
      var subscriptionId = String(formData.get("subscriptionId") || "");
      var submitButton = subscriptionAdminForm.querySelector('[type="submit"]');
      try {
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/subscriptions" + (subscriptionId ? "/" + encodeURIComponent(subscriptionId) : ""), {
          method: subscriptionId ? "PATCH" : "POST",
          headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" },
          body: JSON.stringify({ userId: Number(formData.get("userId")), planId: Number(formData.get("planId")), status: formData.get("status"), startDate: formData.get("startDate"), endDate: formData.get("endDate") || null, autoRenew: formData.get("autoRenew") === "on", cancelReason: formData.get("cancelReason").trim() })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to save subscription");
        setSubscriptionAdminModal(false);
        await loadSuperAdminSubscriptions();
        showToast(subscriptionId ? "Subscription updated" : "Subscription created", "The billing assignment was saved to PostgreSQL.");
      } catch (error) {
        if (subscriptionAdminFeedback) { subscriptionAdminFeedback.hidden = false; subscriptionAdminFeedback.textContent = error.message; }
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Save Subscription";
      }
    });
  }

  if (planAdminForm) {
    planAdminForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!planAdminForm.checkValidity()) {
        if (planAdminFeedback) { planAdminFeedback.hidden = false; planAdminFeedback.textContent = "Complete the plan name, price, and non-negative usage limits."; }
        return;
      }
      var formData = new FormData(planAdminForm);
      var planId = String(formData.get("planId") || "");
      var vcardFeatures = formData.getAll("vcardFeatures");
      var templateIds = formData.getAll("templateIds").map(Number);
      if (!vcardFeatures.length || !templateIds.length) {
        if (planAdminFeedback) { planAdminFeedback.hidden = false; planAdminFeedback.textContent = "Select at least one VCard feature and one VCard template."; }
        return;
      }
      var submitButton = planAdminForm.querySelector('[type="submit"]');
      try {
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/plans" + (planId ? "/" + encodeURIComponent(planId) : ""), {
          method: planId ? "PATCH" : "POST",
          headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.get("name").trim(), price: Number(formData.get("price")), billingInterval: formData.get("billingInterval"), vcardLimit: Number(formData.get("vcardLimit")), nfcLimit: Number(formData.get("nfcLimit")), analyticsLimit: Number(formData.get("analyticsLimit")), benefits: formData.get("features").split(",").map(function (feature) { return feature.trim(); }).filter(Boolean), vcardFeatures: vcardFeatures, templateIds: templateIds, status: formData.get("status") })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to save plan");
        setPlanAdminModal(false);
        await loadSuperAdminSubscriptions();
        showToast(planId ? "Plan updated" : "Plan created", "Pricing and limits were saved to PostgreSQL.");
      } catch (error) {
        if (planAdminFeedback) { planAdminFeedback.hidden = false; planAdminFeedback.textContent = error.message; }
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Save Plan";
      }
    });
  }

  document.addEventListener("click", async function (event) {
    var subscriptionButton = event.target.closest("[data-live-subscription-action]");
    var planButton = event.target.closest("[data-live-plan-action]");
    if (subscriptionButton) {
      var subscriptionId = subscriptionButton.getAttribute("data-subscription-id");
      if (subscriptionButton.getAttribute("data-live-subscription-action") === "edit") setSubscriptionAdminModal(true, superAdminSubscriptionsById[String(subscriptionId)]);
      if (subscriptionButton.getAttribute("data-live-subscription-action") === "delete" && window.confirm("Delete this subscription record?")) {
        try {
          subscriptionButton.disabled = true;
          var response = await fetch("http://127.0.0.1:5000/api/super-admin/subscriptions/" + encodeURIComponent(subscriptionId), { method: "DELETE", headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
          var data = await response.json().catch(function () { return {}; });
          if (!response.ok) throw new Error(data.message || "Unable to delete subscription");
          await loadSuperAdminSubscriptions();
          showToast("Subscription deleted", "The database record was removed.");
        } catch (error) { subscriptionButton.disabled = false; showToast("Delete failed", error.message); }
      }
    }
    if (planButton) {
      var planId = planButton.getAttribute("data-plan-id");
      var plan = superAdminPlansById[String(planId)];
      if (planButton.getAttribute("data-live-plan-action") === "edit") setPlanAdminModal(true, plan);
      if (planButton.getAttribute("data-live-plan-action") === "delete" && window.confirm("Delete " + (plan ? plan.name : "this plan") + "?")) {
        try {
          planButton.disabled = true;
          var planResponse = await fetch("http://127.0.0.1:5000/api/super-admin/plans/" + encodeURIComponent(planId), { method: "DELETE", headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
          var planData = await planResponse.json().catch(function () { return {}; });
          if (!planResponse.ok) throw new Error(planData.message || "Unable to delete plan");
          await loadSuperAdminSubscriptions();
          showToast("Plan deleted", "The unused billing plan was removed.");
        } catch (error) { planButton.disabled = false; showToast("Delete failed", error.message); }
      }
    }
  });

  function cashPaymentMoney(value, currency) {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency || "USD") }).format(Number(value || 0));
    } catch (error) {
      return String(currency || "USD") + " " + Number(value || 0).toFixed(2);
    }
  }

  function updateCashPaymentsPageSummary(summary) {
    var cards = document.querySelectorAll(".admin-page-cash-payments .admin-page-stats article");
    if (cards.length < 3) return;
    cards[0].querySelector("span").textContent = "Pending value";
    cards[0].querySelector("strong").textContent = cashPaymentMoney(summary.pending_value, "USD");
    cards[0].querySelector("small").textContent = formatDashboardNumber(summary.pending_count) + " awaiting review";
    cards[1].querySelector("span").textContent = "Approved today";
    cards[1].querySelector("strong").textContent = cashPaymentMoney(summary.approved_today_value, "USD");
    cards[1].querySelector("small").textContent = formatDashboardNumber(summary.approved_today_count) + " payments";
    cards[2].querySelector("span").textContent = "Approval rate";
    cards[2].querySelector("strong").textContent = Number(summary.approval_rate || 0).toFixed(1) + "%";
    cards[2].querySelector("small").textContent = formatDashboardNumber(summary.total) + " total records";
  }

  function cashPaymentDate(value, emptyText) {
    if (!value) return emptyText || "Not set";
    var date = new Date(String(value).length === 10 ? value + "T00:00:00" : value);
    return Number.isNaN(date.getTime()) ? (emptyText || "Not set") : formatDate(date);
  }

  function renderSuperAdminCashPayments(payments) {
    if (!cashPaymentAdminBody) return;
    superAdminCashPaymentsById = {};
    if (cashPaymentAdminCount) cashPaymentAdminCount.textContent = formatDashboardNumber(payments.length) + (payments.length === 1 ? " payment" : " payments");
    if (!payments.length) {
      cashPaymentAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>No cash payments found</strong><span>Record a payment or change the current search and status filter.</span></div></td></tr>';
      return;
    }
    cashPaymentAdminBody.innerHTML = payments.map(function (payment) {
      superAdminCashPaymentsById[String(payment.id)] = payment;
      var user = payment.user || {};
      var status = String(payment.status || "pending").toLowerCase();
      var statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      var plan = payment.plan;
      var localProof = payment.proofUrl && /^\/uploads\/payment-slips\//.test(payment.proofUrl);
      var evidence = localProof
        ? '<button class="cash-proof-link" type="button" data-payment-proof-id="' + payment.id + '">Open proof</button>'
        : payment.proofUrl && /^https?:\/\//i.test(payment.proofUrl)
        ? '<a class="cash-proof-link" href="' + escapeDashboardHtml(payment.proofUrl) + '" target="_blank" rel="noopener noreferrer">Open proof</a>'
        : '<span class="cash-proof-missing">No attachment</span>';
      var quickActions = status === "pending"
        ? '<button class="user-action-btn approve" type="button" data-live-cash-action="approve" data-payment-id="' + payment.id + '">Approve</button><button class="user-action-btn reject" type="button" data-live-cash-action="reject" data-payment-id="' + payment.id + '">Reject</button>'
        : "";
      return '<tr>' +
        '<td><div class="table-user"><span class="mini-avatar">' + escapeDashboardHtml(avatarInitials(user.name || "User") || "U") + '</span><div><strong>' + escapeDashboardHtml(user.name || "Unknown user") + '</strong><div class="subtle-handle">' + escapeDashboardHtml(user.email || payment.reference || "Manual payment") + '</div></div></div></td>' +
        '<td><div class="cash-plan-cell"><strong>' + escapeDashboardHtml(plan ? plan.name : "Standalone") + '</strong><span>' + (plan ? cashPaymentMoney(plan.price, payment.currency) : "No subscription linked") + '</span></div></td>' +
        '<td><strong class="cash-amount-value">' + cashPaymentMoney(payment.amount, payment.currency) + '</strong><div class="subtle-handle">' + escapeDashboardHtml(payment.reference || "No reference") + '</div></td>' +
        '<td><div class="cash-period-cell"><strong>' + escapeDashboardHtml(cashPaymentDate(payment.startDate, cashPaymentDate(payment.createdAt))) + '</strong><span>' + escapeDashboardHtml(payment.endDate ? "to " + cashPaymentDate(payment.endDate) : "Recorded " + cashPaymentDate(payment.createdAt)) + '</span></div></td>' +
        '<td><div class="cash-evidence-cell">' + evidence + '<span>' + escapeDashboardHtml(payment.notes || "No notes") + '</span></div></td>' +
        '<td><span class="cash-status-badge ' + escapeDashboardHtml(status) + '">' + escapeDashboardHtml(statusLabel) + '</span></td>' +
        '<td><div class="cash-reviewer-cell"><strong>' + escapeDashboardHtml(payment.reviewerName || "Not reviewed") + '</strong><span>' + escapeDashboardHtml(cashPaymentDate(payment.reviewedAt, "Awaiting action")) + '</span></div></td>' +
        '<td><div class="user-row-actions cash-row-actions">' + quickActions + '<button class="user-action-btn edit" type="button" data-live-cash-action="edit" data-payment-id="' + payment.id + '">Edit</button><button class="user-action-btn delete" type="button" data-live-cash-action="delete" data-payment-id="' + payment.id + '">Delete</button></div></td>' +
      '</tr>';
    }).join("");
  }

  function populateCashPaymentUsers(users) {
    if (!cashPaymentAdminForm) return;
    var select = cashPaymentAdminForm.elements.userId;
    var current = select.value;
    select.innerHTML = '<option value="">Select user</option>' + users.map(function (user) {
      return '<option value="' + user.id + '">' + escapeDashboardHtml(user.name + " — " + user.email) + '</option>';
    }).join("");
    select.value = current;
  }

  function filterCashPaymentSubscriptions(selectedId) {
    if (!cashPaymentAdminForm) return;
    var userId = Number(cashPaymentAdminForm.elements.userId.value);
    var select = cashPaymentAdminForm.elements.subscriptionId;
    var desired = selectedId === undefined ? select.value : String(selectedId || "");
    var choices = superAdminCashSubscriptions.filter(function (subscription) { return Number(subscription.userId) === userId; });
    select.innerHTML = '<option value="">No linked subscription</option>' + choices.map(function (subscription) {
      return '<option value="' + subscription.id + '">' + escapeDashboardHtml(subscription.planName + " — " + cashPaymentMoney(subscription.planPrice, "USD") + " (" + subscription.status + ")") + '</option>';
    }).join("");
    select.value = desired;
  }

  async function loadSuperAdminCashPayments() {
    if (adminPageSlug !== "cash-payments" || !cashPaymentAdminBody) return;
    var token = localStorage.getItem("token");
    if (!token) {
      cashPaymentAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as a super admin to review cash payments.</span></div></td></tr>';
      if (cashPaymentAdminCount) cashPaymentAdminCount.textContent = "Sign in required";
      updateCashPaymentsPageSummary({});
      return;
    }
    try {
      var search = searchInput ? searchInput.value.trim() : "";
      var status = cashPaymentStatusFilter ? cashPaymentStatusFilter.value : "";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/cash-payments?search=" + encodeURIComponent(search) + "&status=" + encodeURIComponent(status), { headers: { Authorization: "Bearer " + token } });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to load cash payments");
      superAdminCashSubscriptions = data.subscriptions || [];
      populateCashPaymentUsers(data.users || []);
      filterCashPaymentSubscriptions();
      renderSuperAdminCashPayments(data.payments || []);
      updateCashPaymentsPageSummary(data.summary || {});
    } catch (error) {
      cashPaymentAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>Cash payments unavailable</strong><span>' + escapeDashboardHtml(error.message) + '</span></div></td></tr>';
      if (cashPaymentAdminCount) cashPaymentAdminCount.textContent = "Unavailable";
      updateCashPaymentsPageSummary({});
      showToast("Could not load cash payments", error.message);
    }
  }

  function setCashPaymentAdminModal(open, payment) {
    if (!cashPaymentAdminModal || !cashPaymentAdminForm) return;
    if (!open) {
      cashPaymentAdminModal.hidden = true;
      document.body.style.overflow = "";
      return;
    }
    cashPaymentAdminForm.reset();
    cashPaymentAdminForm.elements.paymentId.value = payment ? payment.id : "";
    if (payment) {
      cashPaymentAdminForm.elements.userId.value = payment.user ? payment.user.id : "";
      filterCashPaymentSubscriptions(payment.subscriptionId);
      cashPaymentAdminForm.elements.amount.value = payment.amount;
      cashPaymentAdminForm.elements.currency.value = payment.currency || "USD";
      cashPaymentAdminForm.elements.status.value = payment.status;
      cashPaymentAdminForm.elements.reference.value = payment.reference || "";
      cashPaymentAdminForm.elements.proofUrl.value = payment.proofUrl || "";
      cashPaymentAdminForm.elements.notes.value = payment.notes || "";
    } else {
      filterCashPaymentSubscriptions();
    }
    if (cashPaymentAdminModalTitle) cashPaymentAdminModalTitle.textContent = payment ? "Edit Cash Payment" : "Record Cash Payment";
    if (cashPaymentAdminFeedback) { cashPaymentAdminFeedback.hidden = true; cashPaymentAdminFeedback.textContent = ""; }
    cashPaymentAdminModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function cashPaymentPayload(payment, status) {
    return {
      userId: payment.user ? payment.user.id : null,
      subscriptionId: payment.subscriptionId || null,
      amount: payment.amount, currency: payment.currency, status: status || payment.status,
      reference: payment.reference || "", proofUrl: payment.proofUrl || "", notes: payment.notes || ""
    };
  }

  async function updateCashPaymentStatus(payment, status, button) {
    if (!payment) return;
    try {
      button.disabled = true;
      button.textContent = status === "approved" ? "Approving..." : "Rejecting...";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/cash-payments/" + encodeURIComponent(payment.id), {
        method: "PATCH", headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" }, body: JSON.stringify(cashPaymentPayload(payment, status))
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to review payment");
      await loadSuperAdminCashPayments();
      showToast(status === "approved" ? "Payment approved" : "Payment rejected", status === "approved" ? "Revenue, transaction, and subscription records were synchronized." : "The payment was marked as rejected.");
    } catch (error) {
      button.disabled = false;
      button.textContent = status === "approved" ? "Approve" : "Reject";
      showToast("Review failed", error.message);
    }
  }

  if (openCashPaymentAdminModalButton) openCashPaymentAdminModalButton.addEventListener("click", function () { setCashPaymentAdminModal(true); });
  if (closeCashPaymentAdminModalButton) closeCashPaymentAdminModalButton.addEventListener("click", function () { setCashPaymentAdminModal(false); });
  if (cashPaymentAdminModalBackdrop) cashPaymentAdminModalBackdrop.addEventListener("click", function () { setCashPaymentAdminModal(false); });
  if (resetCashPaymentAdminFormButton) resetCashPaymentAdminFormButton.addEventListener("click", function () { setCashPaymentAdminModal(false); });
  if (cashPaymentStatusFilter) cashPaymentStatusFilter.addEventListener("change", loadSuperAdminCashPayments);
  if (cashPaymentAdminForm) cashPaymentAdminForm.elements.userId.addEventListener("change", function () { filterCashPaymentSubscriptions(); });

  if (cashPaymentAdminForm) {
    cashPaymentAdminForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!cashPaymentAdminForm.checkValidity()) {
        if (cashPaymentAdminFeedback) { cashPaymentAdminFeedback.hidden = false; cashPaymentAdminFeedback.textContent = "Select a user and enter a valid payment amount."; }
        return;
      }
      var formData = new FormData(cashPaymentAdminForm);
      var paymentId = String(formData.get("paymentId") || "");
      var submitButton = cashPaymentAdminForm.querySelector('[type="submit"]');
      try {
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/cash-payments" + (paymentId ? "/" + encodeURIComponent(paymentId) : ""), {
          method: paymentId ? "PATCH" : "POST",
          headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: Number(formData.get("userId")), subscriptionId: formData.get("subscriptionId") ? Number(formData.get("subscriptionId")) : null,
            amount: Number(formData.get("amount")), currency: formData.get("currency"), status: formData.get("status"),
            reference: formData.get("reference").trim(), proofUrl: formData.get("proofUrl").trim(), notes: formData.get("notes").trim()
          })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to save cash payment");
        setCashPaymentAdminModal(false);
        await loadSuperAdminCashPayments();
        showToast(paymentId ? "Payment updated" : "Payment recorded", "The manual payment and transaction ledger were saved to PostgreSQL.");
      } catch (error) {
        if (cashPaymentAdminFeedback) { cashPaymentAdminFeedback.hidden = false; cashPaymentAdminFeedback.textContent = error.message; }
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Save Payment";
      }
    });
  }

  document.addEventListener("click", async function (event) {
    var proofButton = event.target.closest("[data-payment-proof-id]");
    if (proofButton) {
      try {
        proofButton.disabled = true;
        var proofResponse = await fetch("http://127.0.0.1:5000/api/super-admin/cash-payments/" + encodeURIComponent(proofButton.dataset.paymentProofId) + "/proof", { headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
        if (!proofResponse.ok) { var proofError = await proofResponse.json().catch(function () { return {}; }); throw new Error(proofError.message || "Unable to open payment proof"); }
        var proofObjectUrl = URL.createObjectURL(await proofResponse.blob());
        window.open(proofObjectUrl, "_blank", "noopener,noreferrer");
        setTimeout(function () { URL.revokeObjectURL(proofObjectUrl); }, 60000);
      } catch (error) { showToast("Proof unavailable", error.message); }
      finally { proofButton.disabled = false; }
      return;
    }
    var button = event.target.closest("[data-live-cash-action]");
    if (!button) return;
    var paymentId = button.getAttribute("data-payment-id");
    var payment = superAdminCashPaymentsById[String(paymentId)];
    var action = button.getAttribute("data-live-cash-action");
    if (action === "edit") setCashPaymentAdminModal(true, payment);
    if (action === "approve") updateCashPaymentStatus(payment, "approved", button);
    if (action === "reject") updateCashPaymentStatus(payment, "rejected", button);
    if (action === "delete" && window.confirm("Permanently delete this cash payment and its linked transaction record?")) {
      try {
        button.disabled = true;
        button.textContent = "Deleting...";
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/cash-payments/" + encodeURIComponent(paymentId), { method: "DELETE", headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to delete cash payment");
        await loadSuperAdminCashPayments();
        showToast("Payment deleted", "The payment and linked transaction were removed.");
      } catch (error) {
        button.disabled = false;
        button.textContent = "Delete";
        showToast("Delete failed", error.message);
      }
    }
  });

  function transactionTypeLabel(type) {
    return String(type || "other").split("_").map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); }).join(" ");
  }

  function transactionStatusClass(status) {
    status = String(status || "").toLowerCase();
    if (status === "completed") return "completed";
    if (status === "pending") return "pending";
    if (status === "refunded") return "info";
    return "inactive";
  }

  function updateTransactionsPageSummary(summary) {
    var cards = document.querySelectorAll(".admin-page-transactions .admin-page-stats article");
    if (cards.length < 3) return;
    var volumes = summary.volumeByCurrency || [];
    var primary = volumes.find(function (entry) { return entry.currency === "USD"; }) || volumes[0] || { currency: "USD", amount: 0 };
    cards[0].querySelector("span").textContent = "Completed volume";
    cards[0].querySelector("strong").textContent = cashPaymentMoney(primary.amount, primary.currency);
    cards[0].querySelector("small").textContent = volumes.length > 1 ? volumes.length + " currencies in ledger" : primary.currency + " settled volume";
    cards[1].querySelector("span").textContent = "Successful";
    cards[1].querySelector("strong").textContent = formatDashboardNumber(summary.successful);
    cards[1].querySelector("small").textContent = Number(summary.success_rate || 0).toFixed(1) + "% completion rate";
    cards[2].querySelector("span").textContent = "Pending";
    cards[2].querySelector("strong").textContent = formatDashboardNumber(summary.pending);
    cards[2].querySelector("small").textContent = formatDashboardNumber(summary.total) + " total records";
  }

  function renderSuperAdminTransactions(transactions) {
    if (!transactionAdminBody) return;
    superAdminTransactionsById = {};
    if (transactionAdminCount) transactionAdminCount.textContent = formatDashboardNumber(transactions.length) + (transactions.length === 1 ? " transaction" : " transactions");
    if (!transactions.length) {
      transactionAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>No transactions found</strong><span>Create an adjustment or change the current search and filters.</span></div></td></tr>';
      return;
    }
    transactionAdminBody.innerHTML = transactions.map(function (transaction) {
      superAdminTransactionsById[String(transaction.id)] = transaction;
      var user = transaction.user || {};
      var status = String(transaction.status || "pending").toLowerCase();
      var sourceLabel = transaction.sourceType === "payout" ? "Payout #" + transaction.sourceId : (transaction.sourceManaged ? "Payment #" + transaction.sourceId : transaction.gateway || "Manual");
      var sourceDetail = transaction.reference || (transaction.sourceManaged ? "System-managed" : "No reference");
      var actions = transaction.sourceManaged
        ? '<span class="transaction-locked-action" title="Manage this record from its source payment">Source managed</span>'
        : '<div class="user-row-actions"><button class="user-action-btn edit" type="button" data-live-transaction-action="edit" data-transaction-id="' + transaction.id + '">Edit</button><button class="user-action-btn delete" type="button" data-live-transaction-action="delete" data-transaction-id="' + transaction.id + '">Delete</button></div>';
      return '<tr>' +
        '<td><div class="transaction-id-cell"><strong>#TRX' + String(transaction.id).padStart(8, "0") + '</strong><span>' + escapeDashboardHtml(transaction.reference || "No external reference") + '</span></div></td>' +
        '<td><div class="table-user"><span class="mini-avatar">' + escapeDashboardHtml(avatarInitials(user.name || "User") || "U") + '</span><div><strong>' + escapeDashboardHtml(user.name || "Unknown user") + '</strong><div class="subtle-handle">' + escapeDashboardHtml(user.email || "Account unavailable") + '</div></div></div></td>' +
        '<td><span class="transaction-type-pill type-' + escapeDashboardHtml(transaction.type) + '">' + escapeDashboardHtml(transactionTypeLabel(transaction.type)) + '</span></td>' +
        '<td><strong class="transaction-amount ' + (Number(transaction.amount) < 0 ? "negative" : "positive") + '">' + cashPaymentMoney(transaction.amount, transaction.currency) + '</strong></td>' +
        '<td><div class="transaction-source-cell"><strong>' + escapeDashboardHtml(sourceLabel) + '</strong><span>' + escapeDashboardHtml(sourceDetail) + '</span></div></td>' +
        '<td><div class="transaction-date-cell"><strong>' + escapeDashboardHtml(cashPaymentDate(transaction.createdAt)) + '</strong><span>Updated ' + escapeDashboardHtml(cashPaymentDate(transaction.updatedAt)) + '</span></div></td>' +
        '<td><span class="status-badge ' + transactionStatusClass(status) + '">' + escapeDashboardHtml(transactionTypeLabel(status)) + '</span></td>' +
        '<td>' + actions + '</td>' +
      '</tr>';
    }).join("");
  }

  function populateTransactionUsers(users) {
    if (!transactionAdminForm) return;
    var select = transactionAdminForm.elements.userId;
    var current = select.value;
    select.innerHTML = '<option value="">Select user</option>' + users.map(function (user) {
      return '<option value="' + user.id + '">' + escapeDashboardHtml(user.name + " — " + user.email) + '</option>';
    }).join("");
    select.value = current;
  }

  async function loadSuperAdminTransactions() {
    if (adminPageSlug !== "transactions" || !transactionAdminBody) return;
    var token = localStorage.getItem("token");
    if (!token) {
      transactionAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as a super admin to view the financial ledger.</span></div></td></tr>';
      if (transactionAdminCount) transactionAdminCount.textContent = "Sign in required";
      updateTransactionsPageSummary({});
      return;
    }
    try {
      var search = searchInput ? searchInput.value.trim() : "";
      var status = transactionStatusFilter ? transactionStatusFilter.value : "";
      var type = transactionTypeFilter ? transactionTypeFilter.value : "";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/transactions?search=" + encodeURIComponent(search) + "&status=" + encodeURIComponent(status) + "&type=" + encodeURIComponent(type), { headers: { Authorization: "Bearer " + token } });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to load transactions");
      populateTransactionUsers(data.users || []);
      renderSuperAdminTransactions(data.transactions || []);
      updateTransactionsPageSummary(data.summary || {});
    } catch (error) {
      transactionAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>Transactions unavailable</strong><span>' + escapeDashboardHtml(error.message) + '</span></div></td></tr>';
      if (transactionAdminCount) transactionAdminCount.textContent = "Unavailable";
      updateTransactionsPageSummary({});
      showToast("Could not load transactions", error.message);
    }
  }

  function setTransactionAdminModal(open, transaction) {
    if (!transactionAdminModal || !transactionAdminForm) return;
    if (!open) {
      transactionAdminModal.hidden = true;
      document.body.style.overflow = "";
      return;
    }
    transactionAdminForm.reset();
    transactionAdminForm.elements.transactionId.value = transaction ? transaction.id : "";
    if (transaction) {
      transactionAdminForm.elements.userId.value = transaction.user ? transaction.user.id : "";
      transactionAdminForm.elements.type.value = transaction.type;
      transactionAdminForm.elements.amount.value = transaction.amount;
      transactionAdminForm.elements.currency.value = transaction.currency;
      transactionAdminForm.elements.status.value = transaction.status;
      transactionAdminForm.elements.gateway.value = transaction.gateway || "manual";
      transactionAdminForm.elements.reference.value = transaction.reference || "";
      transactionAdminForm.elements.note.value = transaction.note || "";
    }
    if (transactionAdminModalTitle) transactionAdminModalTitle.textContent = transaction ? "Edit Transaction" : "New Transaction";
    if (transactionAdminFeedback) { transactionAdminFeedback.hidden = true; transactionAdminFeedback.textContent = ""; }
    transactionAdminModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  if (openTransactionAdminModalButton) openTransactionAdminModalButton.addEventListener("click", function () { setTransactionAdminModal(true); });
  if (closeTransactionAdminModalButton) closeTransactionAdminModalButton.addEventListener("click", function () { setTransactionAdminModal(false); });
  if (transactionAdminModalBackdrop) transactionAdminModalBackdrop.addEventListener("click", function () { setTransactionAdminModal(false); });
  if (resetTransactionAdminFormButton) resetTransactionAdminFormButton.addEventListener("click", function () { setTransactionAdminModal(false); });
  if (transactionTypeFilter) transactionTypeFilter.addEventListener("change", loadSuperAdminTransactions);
  if (transactionStatusFilter) transactionStatusFilter.addEventListener("change", loadSuperAdminTransactions);

  if (transactionAdminForm) {
    transactionAdminForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!transactionAdminForm.checkValidity() || Number(transactionAdminForm.elements.amount.value) === 0) {
        if (transactionAdminFeedback) { transactionAdminFeedback.hidden = false; transactionAdminFeedback.textContent = "Select a user and enter a non-zero transaction amount."; }
        return;
      }
      var formData = new FormData(transactionAdminForm);
      var transactionId = String(formData.get("transactionId") || "");
      var submitButton = transactionAdminForm.querySelector('[type="submit"]');
      try {
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/transactions" + (transactionId ? "/" + encodeURIComponent(transactionId) : ""), {
          method: transactionId ? "PATCH" : "POST",
          headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" },
          body: JSON.stringify({ userId: Number(formData.get("userId")), type: formData.get("type"), amount: Number(formData.get("amount")), currency: formData.get("currency"), status: formData.get("status"), gateway: formData.get("gateway").trim(), reference: formData.get("reference").trim(), note: formData.get("note").trim() })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to save transaction");
        setTransactionAdminModal(false);
        await loadSuperAdminTransactions();
        showToast(transactionId ? "Transaction updated" : "Transaction created", "The standalone ledger entry was saved to PostgreSQL.");
      } catch (error) {
        if (transactionAdminFeedback) { transactionAdminFeedback.hidden = false; transactionAdminFeedback.textContent = error.message; }
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Save Transaction";
      }
    });
  }

  document.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-live-transaction-action]");
    if (!button) return;
    var transactionId = button.getAttribute("data-transaction-id");
    var transaction = superAdminTransactionsById[String(transactionId)];
    var action = button.getAttribute("data-live-transaction-action");
    if (action === "edit") setTransactionAdminModal(true, transaction);
    if (action === "delete" && window.confirm("Permanently delete this standalone ledger entry?")) {
      try {
        button.disabled = true;
        button.textContent = "Deleting...";
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/transactions/" + encodeURIComponent(transactionId), { method: "DELETE", headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to delete transaction");
        await loadSuperAdminTransactions();
        showToast("Transaction deleted", "The standalone ledger entry was removed.");
      } catch (error) {
        button.disabled = false;
        button.textContent = "Delete";
        showToast("Delete failed", error.message);
      }
    }
  });

  function payoutPrimaryVolume(volumes) {
    return (volumes || []).find(function (entry) { return entry.currency === "USD"; }) || (volumes || [])[0] || { currency: "USD", amount: 0 };
  }

  function updatePayoutsPageSummary(summary) {
    var cards = document.querySelectorAll(".admin-page-payouts .admin-page-stats article");
    if (cards.length < 3) return;
    var ready = payoutPrimaryVolume(summary.readyByCurrency);
    var paid = payoutPrimaryVolume(summary.paidByCurrency);
    cards[0].querySelector("span").textContent = "Ready to pay";
    cards[0].querySelector("strong").textContent = cashPaymentMoney(ready.amount, ready.currency);
    cards[0].querySelector("small").textContent = formatDashboardNumber(summary.ready_count) + " pending or processing";
    cards[1].querySelector("span").textContent = "Paid this month";
    cards[1].querySelector("strong").textContent = cashPaymentMoney(paid.amount, paid.currency);
    cards[1].querySelector("small").textContent = formatDashboardNumber(summary.paid_month_count) + " completed payouts";
    cards[2].querySelector("span").textContent = "Next payout";
    cards[2].querySelector("strong").textContent = summary.next_payout ? cashPaymentDate(summary.next_payout) : "Not scheduled";
    cards[2].querySelector("small").textContent = formatDashboardNumber(summary.total) + " total records";
  }

  function payoutStatusClass(status) {
    if (status === "paid") return "completed";
    if (status === "pending" || status === "processing") return "pending";
    return "inactive";
  }

  function renderSuperAdminPayouts(payouts) {
    if (!payoutAdminBody) return;
    superAdminPayoutsById = {};
    if (payoutAdminCount) payoutAdminCount.textContent = formatDashboardNumber(payouts.length) + (payouts.length === 1 ? " payout" : " payouts");
    if (!payouts.length) {
      payoutAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>No payouts found</strong><span>Create a payout or change the current search and status filter.</span></div></td></tr>';
      return;
    }
    payoutAdminBody.innerHTML = payouts.map(function (payout) {
      superAdminPayoutsById[String(payout.id)] = payout;
      var status = String(payout.status || "pending").toLowerCase();
      var quickActions = "";
      if (status === "pending") quickActions = '<button class="user-action-btn approve" type="button" data-live-payout-action="processing" data-payout-id="' + payout.id + '">Process</button>';
      if (status === "pending" || status === "processing") quickActions += '<button class="user-action-btn approve" type="button" data-live-payout-action="paid" data-payout-id="' + payout.id + '">Mark Paid</button><button class="user-action-btn reject" type="button" data-live-payout-action="failed" data-payout-id="' + payout.id + '">Fail</button>';
      var payoutActions = payout.sourceManaged
        ? '<a class="transaction-locked-action" href="withdrawals.html" title="Manage this payout from its source withdrawal">Managed by withdrawal</a>'
        : '<div class="user-row-actions payout-row-actions">' + quickActions + '<button class="user-action-btn edit" type="button" data-live-payout-action="edit" data-payout-id="' + payout.id + '">Edit</button><button class="user-action-btn delete" type="button" data-live-payout-action="delete" data-payout-id="' + payout.id + '">Delete</button></div>';
      return '<tr>' +
        '<td><div class="table-user"><span class="mini-avatar">' + escapeDashboardHtml(avatarInitials(payout.payeeName || "Payee") || "P") + '</span><div><strong>' + escapeDashboardHtml(payout.payeeName) + '</strong><div class="subtle-handle">' + escapeDashboardHtml(payout.payeeEmail || (payout.user ? payout.user.email : "External payee")) + '</div></div></div></td>' +
        '<td><div class="payout-method-cell"><strong>' + escapeDashboardHtml(transactionTypeLabel(payout.method)) + '</strong><span>' + escapeDashboardHtml(payout.accountName || "No account label") + '</span></div></td>' +
        '<td><strong class="payout-amount">' + cashPaymentMoney(payout.amount, payout.currency) + '</strong><div class="subtle-handle">' + escapeDashboardHtml(payout.reference || "No reference") + '</div></td>' +
        '<td><div class="payout-schedule-cell"><strong>' + escapeDashboardHtml(cashPaymentDate(payout.scheduledAt, "Not scheduled")) + '</strong><span>' + escapeDashboardHtml(payout.paidAt ? "Paid " + cashPaymentDate(payout.paidAt) : "Created " + cashPaymentDate(payout.createdAt)) + '</span></div></td>' +
        '<td><span class="status-badge ' + payoutStatusClass(status) + '">' + escapeDashboardHtml(transactionTypeLabel(status)) + '</span></td>' +
        '<td><div class="payout-reviewer-cell"><strong>' + escapeDashboardHtml(payout.reviewerName || "Not reviewed") + '</strong><span>' + escapeDashboardHtml(cashPaymentDate(payout.reviewedAt, "Awaiting action")) + '</span></div></td>' +
        '<td><div class="payout-ledger-cell"><strong>#TRX' + String(payout.transactionId || 0).padStart(8, "0") + '</strong><span>Auto-synced</span></div></td>' +
        '<td>' + payoutActions + '</td>' +
      '</tr>';
    }).join("");
  }

  function populatePayoutUsers(users) {
    if (!payoutAdminForm) return;
    var select = payoutAdminForm.elements.userId;
    var current = select.value;
    select.innerHTML = '<option value="">External vendor / no user</option>' + users.map(function (user) { return '<option value="' + user.id + '">' + escapeDashboardHtml(user.name + " — " + user.email) + '</option>'; }).join("");
    select.value = current;
  }

  async function loadSuperAdminPayouts() {
    if (adminPageSlug !== "payouts" || !payoutAdminBody) return;
    var token = localStorage.getItem("token");
    if (!token) {
      payoutAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as a super admin to manage payouts.</span></div></td></tr>';
      if (payoutAdminCount) payoutAdminCount.textContent = "Sign in required";
      updatePayoutsPageSummary({});
      return;
    }
    try {
      var search = searchInput ? searchInput.value.trim() : "";
      var status = payoutStatusFilter ? payoutStatusFilter.value : "";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/payouts?search=" + encodeURIComponent(search) + "&status=" + encodeURIComponent(status), { headers: { Authorization: "Bearer " + token } });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to load payouts");
      populatePayoutUsers(data.users || []);
      renderSuperAdminPayouts(data.payouts || []);
      updatePayoutsPageSummary(data.summary || {});
    } catch (error) {
      payoutAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>Payouts unavailable</strong><span>' + escapeDashboardHtml(error.message) + '</span></div></td></tr>';
      if (payoutAdminCount) payoutAdminCount.textContent = "Unavailable";
      updatePayoutsPageSummary({});
      showToast("Could not load payouts", error.message);
    }
  }

  function payoutDatetimeInput(value) {
    if (!value) return "";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  function setPayoutAdminModal(open, payout) {
    if (!payoutAdminModal || !payoutAdminForm) return;
    if (!open) {
      payoutAdminModal.hidden = true;
      document.body.style.overflow = "";
      return;
    }
    payoutAdminForm.reset();
    payoutAdminForm.elements.payoutId.value = payout ? payout.id : "";
    if (payout) {
      payoutAdminForm.elements.userId.value = payout.user ? payout.user.id : "";
      payoutAdminForm.elements.payeeName.value = payout.payeeName || "";
      payoutAdminForm.elements.payeeEmail.value = payout.payeeEmail || "";
      payoutAdminForm.elements.accountName.value = payout.accountName || "";
      payoutAdminForm.elements.amount.value = payout.amount;
      payoutAdminForm.elements.currency.value = payout.currency;
      payoutAdminForm.elements.method.value = payout.method;
      payoutAdminForm.elements.status.value = payout.status;
      payoutAdminForm.elements.scheduledAt.value = payoutDatetimeInput(payout.scheduledAt);
      payoutAdminForm.elements.reference.value = payout.reference || "";
      payoutAdminForm.elements.notes.value = payout.notes || "";
    }
    if (payoutAdminModalTitle) payoutAdminModalTitle.textContent = payout ? "Edit Payout" : "New Payout";
    if (payoutAdminFeedback) { payoutAdminFeedback.hidden = true; payoutAdminFeedback.textContent = ""; }
    payoutAdminModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function payoutPayload(payout, status) {
    return { userId: payout.user ? payout.user.id : null, payeeName: payout.payeeName, payeeEmail: payout.payeeEmail || "", accountName: payout.accountName || "", amount: payout.amount, currency: payout.currency, method: payout.method, status: status || payout.status, scheduledAt: payout.scheduledAt || null, reference: payout.reference || "", notes: payout.notes || "" };
  }

  async function updatePayoutStatus(payout, status, button) {
    if (!payout) return;
    var originalLabel = button.textContent;
    try {
      button.disabled = true;
      button.textContent = "Saving...";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/payouts/" + encodeURIComponent(payout.id), { method: "PATCH", headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" }, body: JSON.stringify(payoutPayload(payout, status)) });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to update payout status");
      await loadSuperAdminPayouts();
      showToast(status === "paid" ? "Payout completed" : "Payout updated", status === "paid" ? "The linked ledger transaction is now completed." : "The payout status was saved to PostgreSQL.");
    } catch (error) {
      button.disabled = false;
      button.textContent = originalLabel;
      showToast("Update failed", error.message);
    }
  }

  if (openPayoutAdminModalButton) openPayoutAdminModalButton.addEventListener("click", function () { setPayoutAdminModal(true); });
  if (closePayoutAdminModalButton) closePayoutAdminModalButton.addEventListener("click", function () { setPayoutAdminModal(false); });
  if (payoutAdminModalBackdrop) payoutAdminModalBackdrop.addEventListener("click", function () { setPayoutAdminModal(false); });
  if (resetPayoutAdminFormButton) resetPayoutAdminFormButton.addEventListener("click", function () { setPayoutAdminModal(false); });
  if (payoutStatusFilter) payoutStatusFilter.addEventListener("change", loadSuperAdminPayouts);

  if (payoutAdminForm) {
    payoutAdminForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!payoutAdminForm.checkValidity()) {
        if (payoutAdminFeedback) { payoutAdminFeedback.hidden = false; payoutAdminFeedback.textContent = "Enter the payee name and a valid positive payout amount."; }
        return;
      }
      var formData = new FormData(payoutAdminForm);
      var payoutId = String(formData.get("payoutId") || "");
      var submitButton = payoutAdminForm.querySelector('[type="submit"]');
      try {
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/payouts" + (payoutId ? "/" + encodeURIComponent(payoutId) : ""), {
          method: payoutId ? "PATCH" : "POST",
          headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" },
          body: JSON.stringify({ userId: formData.get("userId") ? Number(formData.get("userId")) : null, payeeName: formData.get("payeeName").trim(), payeeEmail: formData.get("payeeEmail").trim(), accountName: formData.get("accountName").trim(), amount: Number(formData.get("amount")), currency: formData.get("currency"), method: formData.get("method"), status: formData.get("status"), scheduledAt: formData.get("scheduledAt") || null, reference: formData.get("reference").trim(), notes: formData.get("notes").trim() })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to save payout");
        setPayoutAdminModal(false);
        await loadSuperAdminPayouts();
        showToast(payoutId ? "Payout updated" : "Payout created", "The payout and linked ledger transaction were saved.");
      } catch (error) {
        if (payoutAdminFeedback) { payoutAdminFeedback.hidden = false; payoutAdminFeedback.textContent = error.message; }
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Save Payout";
      }
    });
  }

  document.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-live-payout-action]");
    if (!button) return;
    var payoutId = button.getAttribute("data-payout-id");
    var payout = superAdminPayoutsById[String(payoutId)];
    var action = button.getAttribute("data-live-payout-action");
    if (action === "edit") setPayoutAdminModal(true, payout);
    if (["processing", "paid", "failed"].indexOf(action) !== -1) updatePayoutStatus(payout, action, button);
    if (action === "delete" && window.confirm("Permanently delete this payout and its linked ledger transaction?")) {
      try {
        button.disabled = true;
        button.textContent = "Deleting...";
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/payouts/" + encodeURIComponent(payoutId), { method: "DELETE", headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to delete payout");
        await loadSuperAdminPayouts();
        showToast("Payout deleted", "The payout and its linked transaction were removed.");
      } catch (error) {
        button.disabled = false;
        button.textContent = "Delete";
        showToast("Delete failed", error.message);
      }
    }
  });

  function updateWithdrawalsPageSummary(summary) {
    var cards = document.querySelectorAll(".admin-page-withdrawals .admin-page-stats article");
    if (cards.length < 3) return;
    var pending = payoutPrimaryVolume(summary.pendingByCurrency);
    var processed = payoutPrimaryVolume(summary.processedByCurrency);
    cards[0].querySelector("span").textContent = "Pending requests";
    cards[0].querySelector("strong").textContent = formatDashboardNumber(summary.pending_count);
    cards[0].querySelector("small").textContent = cashPaymentMoney(pending.amount, pending.currency) + " requested";
    cards[1].querySelector("span").textContent = "Processed this month";
    cards[1].querySelector("strong").textContent = formatDashboardNumber(summary.processed_month_count);
    cards[1].querySelector("small").textContent = cashPaymentMoney(processed.amount, processed.currency) + " completed";
    cards[2].querySelector("span").textContent = "Average review time";
    cards[2].querySelector("strong").textContent = Number(summary.average_review_days || 0).toFixed(1) + " days";
    cards[2].querySelector("small").textContent = formatDashboardNumber(summary.total) + " total requests";
  }

  function withdrawalStatusClass(status) {
    if (status === "completed") return "completed";
    if (["pending", "approved", "processing"].indexOf(status) !== -1) return "pending";
    return "inactive";
  }

  function renderSuperAdminWithdrawals(withdrawals) {
    if (!withdrawalAdminBody) return;
    superAdminWithdrawalsById = {};
    if (withdrawalAdminCount) withdrawalAdminCount.textContent = formatDashboardNumber(withdrawals.length) + (withdrawals.length === 1 ? " request" : " requests");
    if (!withdrawals.length) {
      withdrawalAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>No withdrawals found</strong><span>Create a request or change the current search and status filter.</span></div></td></tr>';
      return;
    }
    withdrawalAdminBody.innerHTML = withdrawals.map(function (withdrawal) {
      superAdminWithdrawalsById[String(withdrawal.id)] = withdrawal;
      var status = String(withdrawal.status || "pending").toLowerCase();
      var quickActions = "";
      if (status === "pending") quickActions = '<button class="user-action-btn approve" type="button" data-live-withdrawal-action="approved" data-withdrawal-id="' + withdrawal.id + '">Approve</button><button class="user-action-btn reject" type="button" data-live-withdrawal-action="rejected" data-withdrawal-id="' + withdrawal.id + '">Reject</button><button class="user-action-btn" type="button" data-live-withdrawal-action="cancelled" data-withdrawal-id="' + withdrawal.id + '">Cancel</button>';
      if (status === "approved") quickActions = '<button class="user-action-btn approve" type="button" data-live-withdrawal-action="processing" data-withdrawal-id="' + withdrawal.id + '">Process</button><button class="user-action-btn approve" type="button" data-live-withdrawal-action="completed" data-withdrawal-id="' + withdrawal.id + '">Complete</button><button class="user-action-btn" type="button" data-live-withdrawal-action="cancelled" data-withdrawal-id="' + withdrawal.id + '">Cancel</button>';
      if (status === "processing") quickActions = '<button class="user-action-btn approve" type="button" data-live-withdrawal-action="completed" data-withdrawal-id="' + withdrawal.id + '">Complete</button><button class="user-action-btn reject" type="button" data-live-withdrawal-action="rejected" data-withdrawal-id="' + withdrawal.id + '">Reject</button>';
      var financeLinks = withdrawal.payoutId
        ? '<div class="withdrawal-finance-cell"><a href="transactions.html">Payout #' + withdrawal.payoutId + '</a><span>#TRX' + String(withdrawal.transactionId || 0).padStart(8, "0") + '</span></div>'
        : '<span class="withdrawal-awaiting-link">Created after approval</span>';
      var editAction = ["completed", "rejected", "cancelled"].indexOf(status) === -1 ? '<button class="user-action-btn edit" type="button" data-live-withdrawal-action="edit" data-withdrawal-id="' + withdrawal.id + '">Edit</button>' : '';
      var deleteAction = !withdrawal.payoutId && ["pending", "rejected", "cancelled"].indexOf(status) !== -1 ? '<button class="user-action-btn delete" type="button" data-live-withdrawal-action="delete" data-withdrawal-id="' + withdrawal.id + '">Delete</button>' : '';
      return '<tr>' +
        '<td><div class="table-user"><span class="mini-avatar">' + escapeDashboardHtml(avatarInitials(withdrawal.user.name || "User") || "U") + '</span><div><strong>' + escapeDashboardHtml(withdrawal.user.name) + '</strong><div class="subtle-handle">' + escapeDashboardHtml(withdrawal.user.email) + '</div></div></div></td>' +
        '<td><strong class="withdrawal-amount">' + cashPaymentMoney(withdrawal.amount, withdrawal.currency) + '</strong><div class="subtle-handle">Request #WDL' + String(withdrawal.id).padStart(8, "0") + '</div></td>' +
        '<td><div class="withdrawal-method-cell"><strong>' + escapeDashboardHtml(transactionTypeLabel(withdrawal.method)) + '</strong><span>' + escapeDashboardHtml(withdrawal.accountName || "No account label") + '</span></div></td>' +
        '<td><div class="withdrawal-date-cell"><strong>' + escapeDashboardHtml(cashPaymentDate(withdrawal.createdAt)) + '</strong><span>' + escapeDashboardHtml(withdrawal.processedAt ? "Processed " + cashPaymentDate(withdrawal.processedAt) : withdrawal.requestNote || "No request note") + '</span></div></td>' +
        '<td><span class="status-badge ' + withdrawalStatusClass(status) + '">' + escapeDashboardHtml(transactionTypeLabel(status)) + '</span></td>' +
        '<td><div class="withdrawal-reviewer-cell"><strong>' + escapeDashboardHtml(withdrawal.reviewerName || "Not reviewed") + '</strong><span>' + escapeDashboardHtml(cashPaymentDate(withdrawal.reviewedAt, "Awaiting action")) + '</span></div></td>' +
        '<td>' + financeLinks + '</td>' +
        '<td><div class="user-row-actions withdrawal-row-actions">' + quickActions + editAction + deleteAction + '</div></td>' +
      '</tr>';
    }).join("");
  }

  function populateWithdrawalUsers(users) {
    if (!withdrawalAdminForm) return;
    var select = withdrawalAdminForm.elements.userId;
    var current = select.value;
    select.innerHTML = '<option value="">Select active user</option>' + users.map(function (user) { return '<option value="' + user.id + '">' + escapeDashboardHtml(user.name + " — " + user.email) + '</option>'; }).join("");
    select.value = current;
  }

  async function loadSuperAdminWithdrawals() {
    if (adminPageSlug !== "withdrawals" || !withdrawalAdminBody) return;
    var token = localStorage.getItem("token");
    if (!token) {
      withdrawalAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as a super admin to review withdrawals.</span></div></td></tr>';
      if (withdrawalAdminCount) withdrawalAdminCount.textContent = "Sign in required";
      updateWithdrawalsPageSummary({});
      return;
    }
    try {
      var search = searchInput ? searchInput.value.trim() : "";
      var status = withdrawalStatusFilter ? withdrawalStatusFilter.value : "";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/withdrawals?search=" + encodeURIComponent(search) + "&status=" + encodeURIComponent(status), { headers: { Authorization: "Bearer " + token } });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to load withdrawals");
      populateWithdrawalUsers(data.users || []);
      renderSuperAdminWithdrawals(data.withdrawals || []);
      updateWithdrawalsPageSummary(data.summary || {});
    } catch (error) {
      withdrawalAdminBody.innerHTML = '<tr><td colspan="8"><div class="admin-data-empty"><strong>Withdrawals unavailable</strong><span>' + escapeDashboardHtml(error.message) + '</span></div></td></tr>';
      if (withdrawalAdminCount) withdrawalAdminCount.textContent = "Unavailable";
      updateWithdrawalsPageSummary({});
      showToast("Could not load withdrawals", error.message);
    }
  }

  function setWithdrawalAdminModal(open, withdrawal) {
    if (!withdrawalAdminModal || !withdrawalAdminForm) return;
    if (!open) {
      withdrawalAdminModal.hidden = true;
      document.body.style.overflow = "";
      return;
    }
    withdrawalAdminForm.reset();
    withdrawalAdminForm.elements.withdrawalId.value = withdrawal ? withdrawal.id : "";
    withdrawalAdminForm.elements.status.innerHTML = '<option value="' + escapeDashboardHtml(withdrawal ? withdrawal.status : "pending") + '">' + escapeDashboardHtml(transactionTypeLabel(withdrawal ? withdrawal.status : "pending")) + '</option>';
    if (withdrawal) {
      withdrawalAdminForm.elements.userId.value = withdrawal.user.id;
      withdrawalAdminForm.elements.status.value = withdrawal.status;
      withdrawalAdminForm.elements.amount.value = withdrawal.amount;
      withdrawalAdminForm.elements.currency.value = withdrawal.currency;
      withdrawalAdminForm.elements.method.value = withdrawal.method;
      withdrawalAdminForm.elements.accountName.value = withdrawal.accountName || "";
      withdrawalAdminForm.elements.requestNote.value = withdrawal.requestNote || "";
      withdrawalAdminForm.elements.adminNote.value = withdrawal.adminNote || "";
    }
    if (withdrawalAdminModalTitle) withdrawalAdminModalTitle.textContent = withdrawal ? "Edit Withdrawal" : "New Withdrawal";
    if (withdrawalAdminFeedback) { withdrawalAdminFeedback.hidden = true; withdrawalAdminFeedback.textContent = ""; }
    withdrawalAdminModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function withdrawalPayload(withdrawal, status) {
    return { userId: withdrawal.user.id, amount: withdrawal.amount, currency: withdrawal.currency, method: withdrawal.method, status: status || withdrawal.status, accountName: withdrawal.accountName || "", requestNote: withdrawal.requestNote || "", adminNote: withdrawal.adminNote || "" };
  }

  async function updateWithdrawalStatus(withdrawal, status, button) {
    if (!withdrawal) return;
    var reviewNote = withdrawal.adminNote || "";
    if (["rejected", "cancelled"].indexOf(status) !== -1) {
      reviewNote = window.prompt("Enter the reason for " + status.slice(0, -2) + "ing this withdrawal:", reviewNote);
      if (!reviewNote || !reviewNote.trim()) return;
    }
    if (status === "approved" && withdrawal.method !== "cash" && !withdrawal.accountName) {
      showToast("Account details required", "Edit the withdrawal and add the destination account before approval."); return;
    }
    if (["approved", "completed"].indexOf(status) !== -1 && !window.confirm(status === "approved" ? "Approve this withdrawal and create its payout ledger entry?" : "Confirm that the funds were sent and complete this withdrawal?")) return;
    var originalLabel = button.textContent;
    try {
      button.disabled = true;
      button.textContent = "Saving...";
      var payload = withdrawalPayload(withdrawal, status); payload.adminNote = reviewNote.trim();
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/withdrawals/" + encodeURIComponent(withdrawal.id), { method: "PATCH", headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to update withdrawal");
      await loadSuperAdminWithdrawals();
      showToast(status === "completed" ? "Withdrawal completed" : "Withdrawal updated", status === "approved" ? "A protected payout and transaction were created." : "The request and linked finance records were synchronized.");
    } catch (error) {
      button.disabled = false;
      button.textContent = originalLabel;
      showToast("Update failed", error.message);
    }
  }

  if (openWithdrawalAdminModalButton) openWithdrawalAdminModalButton.addEventListener("click", function () { setWithdrawalAdminModal(true); });
  if (closeWithdrawalAdminModalButton) closeWithdrawalAdminModalButton.addEventListener("click", function () { setWithdrawalAdminModal(false); });
  if (withdrawalAdminModalBackdrop) withdrawalAdminModalBackdrop.addEventListener("click", function () { setWithdrawalAdminModal(false); });
  if (resetWithdrawalAdminFormButton) resetWithdrawalAdminFormButton.addEventListener("click", function () { setWithdrawalAdminModal(false); });
  if (withdrawalStatusFilter) withdrawalStatusFilter.addEventListener("change", loadSuperAdminWithdrawals);

  if (withdrawalAdminForm) {
    withdrawalAdminForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!withdrawalAdminForm.checkValidity()) {
        if (withdrawalAdminFeedback) { withdrawalAdminFeedback.hidden = false; withdrawalAdminFeedback.textContent = "Select a user and enter a valid positive amount."; }
        return;
      }
      var formData = new FormData(withdrawalAdminForm);
      var withdrawalId = String(formData.get("withdrawalId") || "");
      var submitButton = withdrawalAdminForm.querySelector('[type="submit"]');
      try {
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/withdrawals" + (withdrawalId ? "/" + encodeURIComponent(withdrawalId) : ""), {
          method: withdrawalId ? "PATCH" : "POST",
          headers: { Authorization: "Bearer " + localStorage.getItem("token"), "Content-Type": "application/json" },
          body: JSON.stringify({ userId: Number(formData.get("userId")), amount: Number(formData.get("amount")), currency: formData.get("currency"), method: formData.get("method"), status: formData.get("status"), accountName: formData.get("accountName").trim(), requestNote: formData.get("requestNote").trim(), adminNote: formData.get("adminNote").trim() })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to save withdrawal");
        setWithdrawalAdminModal(false);
        await loadSuperAdminWithdrawals();
        showToast(withdrawalId ? "Withdrawal updated" : "Withdrawal created", "The request and any linked finance records were saved.");
      } catch (error) {
        if (withdrawalAdminFeedback) { withdrawalAdminFeedback.hidden = false; withdrawalAdminFeedback.textContent = error.message; }
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Save Withdrawal";
      }
    });
  }

  document.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-live-withdrawal-action]");
    if (!button) return;
    var withdrawalId = button.getAttribute("data-withdrawal-id");
    var withdrawal = superAdminWithdrawalsById[String(withdrawalId)];
    var action = button.getAttribute("data-live-withdrawal-action");
    if (action === "edit") setWithdrawalAdminModal(true, withdrawal);
    if (["approved", "processing", "completed", "rejected", "cancelled"].indexOf(action) !== -1) updateWithdrawalStatus(withdrawal, action, button);
    if (action === "delete" && window.confirm("Permanently delete this withdrawal and all linked payout and transaction records?")) {
      try {
        button.disabled = true;
        button.textContent = "Deleting...";
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/withdrawals/" + encodeURIComponent(withdrawalId), { method: "DELETE", headers: { Authorization: "Bearer " + localStorage.getItem("token") } });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to delete withdrawal");
        await loadSuperAdminWithdrawals();
        showToast("Withdrawal deleted", "The request and linked finance records were removed.");
      } catch (error) {
        button.disabled = false;
        button.textContent = "Delete";
        showToast("Delete failed", error.message);
      }
    }
  });

  function updateAffiliationsPageSummary(summary) {
    var cards = document.querySelectorAll(".admin-page-affiliations .admin-page-stats article");
    if (cards.length < 3) return;
    var due = payoutPrimaryVolume(summary.dueByCurrency);
    cards[0].querySelector("span").textContent = "Active partners";
    cards[0].querySelector("strong").textContent = formatDashboardNumber(summary.active_partners);
    cards[0].querySelector("small").textContent = "Enabled affiliate profiles";
    cards[1].querySelector("span").textContent = "Qualified conversions";
    cards[1].querySelector("strong").textContent = formatDashboardNumber(summary.qualified_conversions);
    cards[1].querySelector("small").textContent = "Attributed referred users";
    cards[2].querySelector("span").textContent = "Commission due";
    cards[2].querySelector("strong").textContent = cashPaymentMoney(due.amount, due.currency);
    cards[2].querySelector("small").textContent = formatDashboardNumber(summary.pending_commissions) + " awaiting review";
  }

  function renderAffiliatePartners(partners) {
    if (!affiliatePartnerBody) return;
    superAdminAffiliatePartnersById = {};
    if (affiliatePartnerCount) affiliatePartnerCount.textContent = formatDashboardNumber(partners.length) + (partners.length === 1 ? " partner" : " partners");
    if (!partners.length) {
      affiliatePartnerBody.innerHTML = '<tr><td colspan="7"><div class="admin-data-empty"><strong>No affiliate partners found</strong><span>Create a partner profile to start tracking referrals.</span></div></td></tr>';
      return;
    }
    affiliatePartnerBody.innerHTML = partners.map(function (partner) {
      superAdminAffiliatePartnersById[String(partner.id)] = partner;
      var commission = partner.commissionType === "percentage" ? Number(partner.commissionValue).toFixed(2) + "%" : cashPaymentMoney(partner.commissionValue, "USD");
      var partnerQuick = partner.status === "pending" ? '<button class="user-action-btn approve" type="button" data-live-affiliate-partner-action="activate" data-affiliate-id="' + partner.id + '">Approve</button><button class="user-action-btn reject" type="button" data-live-affiliate-partner-action="suspend" data-affiliate-id="' + partner.id + '">Reject</button>' : partner.status === "active" ? '<button class="user-action-btn reject" type="button" data-live-affiliate-partner-action="suspend" data-affiliate-id="' + partner.id + '">Suspend</button>' : '<button class="user-action-btn approve" type="button" data-live-affiliate-partner-action="activate" data-affiliate-id="' + partner.id + '">Activate</button>';
      return '<tr>' +
        '<td><div class="table-user"><span class="mini-avatar">' + escapeDashboardHtml(avatarInitials(partner.user.name) || "A") + '</span><div><strong>' + escapeDashboardHtml(partner.user.name) + '</strong><div class="subtle-handle">' + escapeDashboardHtml(partner.user.email) + '</div></div></div></td>' +
        '<td><span class="affiliate-code-pill">' + escapeDashboardHtml(partner.referralCode) + '</span></td>' +
        '<td><div class="affiliate-rule-cell"><strong>' + escapeDashboardHtml(commission) + '</strong><span>' + escapeDashboardHtml(transactionTypeLabel(partner.commissionType)) + '</span></div></td>' +
        '<td><div class="affiliate-conversion-cell"><strong>' + formatDashboardNumber(partner.qualified) + ' qualified</strong><span>' + formatDashboardNumber(partner.referrals) + ' total referrals</span></div></td>' +
        '<td><div class="affiliate-rule-cell"><strong>' + escapeDashboardHtml(transactionTypeLabel(partner.paymentMethod)) + '</strong><span>' + escapeDashboardHtml(partner.payoutDetails || "No account label") + '</span></div></td>' +
        '<td><span class="status-badge ' + (partner.status === "active" ? "active" : "inactive") + '">' + escapeDashboardHtml(transactionTypeLabel(partner.status)) + '</span></td>' +
        '<td><div class="user-row-actions">' + partnerQuick + '<button class="user-action-btn edit" type="button" data-live-affiliate-partner-action="edit" data-affiliate-id="' + partner.id + '">Edit</button><button class="user-action-btn delete" type="button" data-live-affiliate-partner-action="delete" data-affiliate-id="' + partner.id + '">Delete</button></div></td>' +
      '</tr>';
    }).join("");
  }

  function renderAffiliateReferrals(referrals) {
    if (!affiliateReferralBody) return;
    superAdminAffiliateReferralsById = {};
    if (affiliateReferralCount) affiliateReferralCount.textContent = formatDashboardNumber(referrals.length) + (referrals.length === 1 ? " referral" : " referrals");
    if (!referrals.length) {
      affiliateReferralBody.innerHTML = '<tr><td colspan="6"><div class="admin-data-empty"><strong>No referred users found</strong><span>Connect a registered user to an affiliate partner.</span></div></td></tr>';
      return;
    }
    affiliateReferralBody.innerHTML = referrals.map(function (referral) {
      superAdminAffiliateReferralsById[String(referral.id)] = referral;
      var quick = referral.status === "pending" ? '<button class="user-action-btn approve" type="button" data-live-affiliate-referral-action="qualified" data-referral-id="' + referral.id + '">Qualify</button><button class="user-action-btn reject" type="button" data-live-affiliate-referral-action="rejected" data-referral-id="' + referral.id + '">Reject</button>' : "";
      return '<tr>' +
        '<td><div class="table-user"><span class="mini-avatar">' + escapeDashboardHtml(avatarInitials(referral.affiliate.name) || "A") + '</span><div><strong>' + escapeDashboardHtml(referral.affiliate.name) + '</strong><div class="subtle-handle">' + escapeDashboardHtml(referral.affiliate.email) + '</div></div></div></td>' +
        '<td><div class="table-user"><span class="mini-avatar referral-avatar">' + escapeDashboardHtml(avatarInitials(referral.user.name) || "U") + '</span><div><strong>' + escapeDashboardHtml(referral.user.name) + '</strong><div class="subtle-handle">' + escapeDashboardHtml(referral.user.email) + '</div></div></div></td>' +
        '<td><span class="affiliate-code-pill">' + escapeDashboardHtml(referral.affiliate.code) + '</span></td>' +
        '<td>' + escapeDashboardHtml(cashPaymentDate(referral.joinedAt)) + '</td>' +
        '<td><span class="status-badge ' + (referral.status === "qualified" ? "completed" : referral.status === "pending" ? "pending" : "inactive") + '">' + escapeDashboardHtml(transactionTypeLabel(referral.status)) + '</span></td>' +
        '<td><div class="user-row-actions">' + quick + '<button class="user-action-btn edit" type="button" data-live-affiliate-referral-action="edit" data-referral-id="' + referral.id + '">Edit</button>' + (!referral.commissions ? '<button class="user-action-btn delete" type="button" data-live-affiliate-referral-action="delete" data-referral-id="' + referral.id + '">Delete</button>' : '') + '</div></td>' +
      '</tr>';
    }).join("");
  }

  function renderAffiliateCommissions(commissions) {
    if (!affiliateCommissionBody) return;
    superAdminAffiliateCommissionsById = {};
    if (affiliateCommissionCount) affiliateCommissionCount.textContent = formatDashboardNumber(commissions.length) + (commissions.length === 1 ? " commission" : " commissions");
    if (!commissions.length) {
      affiliateCommissionBody.innerHTML = '<tr><td colspan="7"><div class="admin-data-empty"><strong>No commissions found</strong><span>Create an earning record for an affiliate partner.</span></div></td></tr>';
      return;
    }
    affiliateCommissionBody.innerHTML = commissions.map(function (commission) {
      superAdminAffiliateCommissionsById[String(commission.id)] = commission;
      var quick = commission.status === "pending" ? '<button class="user-action-btn approve" type="button" data-live-affiliate-commission-action="approved" data-commission-id="' + commission.id + '">Approve</button><button class="user-action-btn reject" type="button" data-live-affiliate-commission-action="rejected" data-commission-id="' + commission.id + '">Reject</button>' : "";
      var commissionEdit = commission.status !== "rejected" ? '<button class="user-action-btn edit" type="button" data-live-affiliate-commission-action="edit" data-commission-id="' + commission.id + '">Edit</button>' : '';
      var commissionDelete = commission.status !== "approved" ? '<button class="user-action-btn delete" type="button" data-live-affiliate-commission-action="delete" data-commission-id="' + commission.id + '">Delete</button>' : '';
      return '<tr>' +
        '<td><strong>' + escapeDashboardHtml(commission.affiliate.name) + '</strong><div class="subtle-handle">' + escapeDashboardHtml(commission.affiliate.email) + '</div></td>' +
        '<td>' + escapeDashboardHtml(commission.referredName || "General commission") + '</td>' +
        '<td><strong class="affiliate-commission-amount">' + cashPaymentMoney(commission.amount, commission.currency) + '</strong></td>' +
        '<td><div class="affiliate-description-cell"><strong>' + escapeDashboardHtml(commission.description || "Affiliate earning") + '</strong><span>' + escapeDashboardHtml(cashPaymentDate(commission.createdAt)) + '</span></div></td>' +
        '<td><span class="status-badge ' + (commission.status === "approved" || commission.status === "paid" ? "completed" : commission.status === "pending" ? "pending" : "inactive") + '">' + escapeDashboardHtml(transactionTypeLabel(commission.status)) + '</span></td>' +
        '<td><div class="affiliate-description-cell"><strong>' + escapeDashboardHtml(commission.approverName || "Not approved") + '</strong><span>' + escapeDashboardHtml(cashPaymentDate(commission.approvedAt, "Awaiting review")) + '</span></div></td>' +
        '<td><div class="user-row-actions">' + quick + commissionEdit + commissionDelete + '</div></td>' +
      '</tr>';
    }).join("");
  }

  function populateAffiliateFormOptions(partners, referrals, users) {
    superAdminAffiliateUsers = users;
    var userOptions = users.map(function (user) { return '<option value="' + user.id + '">' + escapeDashboardHtml(user.name + " — " + user.email) + '</option>'; }).join("");
    var partnerOptions = partners.map(function (partner) { return '<option value="' + partner.id + '">' + escapeDashboardHtml(partner.user.name + " — " + partner.referralCode) + '</option>'; }).join("");
    if (affiliatePartnerForm) { var currentPartnerUser = affiliatePartnerForm.elements.userId.value; affiliatePartnerForm.elements.userId.innerHTML = '<option value="">Select active user</option>' + userOptions; affiliatePartnerForm.elements.userId.value = currentPartnerUser; }
    if (affiliateReferralForm) {
      var currentAffiliate = affiliateReferralForm.elements.affiliateId.value; var currentUser = affiliateReferralForm.elements.userId.value;
      affiliateReferralForm.elements.affiliateId.innerHTML = '<option value="">Select partner</option>' + partnerOptions;
      affiliateReferralForm.elements.userId.innerHTML = '<option value="">Select registered user</option>' + userOptions;
      affiliateReferralForm.elements.affiliateId.value = currentAffiliate; affiliateReferralForm.elements.userId.value = currentUser;
    }
    if (affiliateCommissionForm) {
      var currentCommissionAffiliate = affiliateCommissionForm.elements.affiliateId.value;
      affiliateCommissionForm.elements.affiliateId.innerHTML = '<option value="">Select partner</option>' + partnerOptions;
      affiliateCommissionForm.elements.affiliateId.value = currentCommissionAffiliate;
      filterAffiliateCommissionReferrals();
    }
  }

  function filterAffiliateCommissionReferrals(selectedId) {
    if (!affiliateCommissionForm) return;
    var affiliateId = Number(affiliateCommissionForm.elements.affiliateId.value);
    var select = affiliateCommissionForm.elements.referralId;
    var desired = selectedId === undefined ? select.value : String(selectedId || "");
    var referrals = Object.keys(superAdminAffiliateReferralsById).map(function (id) { return superAdminAffiliateReferralsById[id]; }).filter(function (referral) { return Number(referral.affiliateId) === affiliateId; });
    select.innerHTML = '<option value="">No specific referral</option>' + referrals.map(function (referral) { return '<option value="' + referral.id + '">' + escapeDashboardHtml(referral.user.name + " — " + referral.status) + '</option>'; }).join("");
    select.value = desired;
  }

  async function loadSuperAdminAffiliations() {
    if (adminPageSlug !== "affiliations" || !affiliatePartnerBody) return;
    var token = localStorage.getItem("token");
    if (!token) {
      affiliatePartnerBody.innerHTML = '<tr><td colspan="7"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as a super admin to manage affiliates.</span></div></td></tr>';
      if (affiliatePartnerCount) affiliatePartnerCount.textContent = "Sign in required";
      updateAffiliationsPageSummary({}); return;
    }
    try {
      var search = searchInput ? searchInput.value.trim() : "";
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/affiliations?search=" + encodeURIComponent(search), { headers: { Authorization: "Bearer " + token } });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Unable to load affiliations");
      renderAffiliatePartners(data.partners || []); renderAffiliateReferrals(data.referrals || []); renderAffiliateCommissions(data.commissions || []);
      populateAffiliateFormOptions(data.partners || [], data.referrals || [], data.users || []); updateAffiliationsPageSummary(data.summary || {});
    } catch (error) {
      affiliatePartnerBody.innerHTML = '<tr><td colspan="7"><div class="admin-data-empty"><strong>Affiliations unavailable</strong><span>' + escapeDashboardHtml(error.message) + '</span></div></td></tr>';
      if (affiliatePartnerCount) affiliatePartnerCount.textContent = "Unavailable"; updateAffiliationsPageSummary({}); showToast("Could not load affiliations", error.message);
    }
  }

  function setAffiliateModal(modal, form, titleElement, open, record, kind) {
    if (!modal || !form) return;
    if (!open) { modal.hidden = true; document.body.style.overflow = ""; return; }
    form.reset();
    if (kind === "partner") {
      form.elements.affiliateId.value = record ? record.id : "";
      if (record) { form.elements.userId.value=record.user.id; form.elements.referralCode.value=record.referralCode; form.elements.commissionType.value=record.commissionType; form.elements.commissionValue.value=record.commissionValue; form.elements.paymentMethod.value=record.paymentMethod; form.elements.payoutDetails.value=record.payoutDetails||""; form.elements.status.value=record.status; }
      if (titleElement) titleElement.textContent = record ? "Edit Affiliate Partner" : "New Affiliate Partner";
    } else if (kind === "referral") {
      form.elements.referralId.value = record ? record.id : "";
      if (record) { form.elements.affiliateId.value=record.affiliateId; form.elements.userId.value=record.user.id; form.elements.status.value=record.status; }
      if (titleElement) titleElement.textContent = record ? "Edit Referred User" : "Add Referred User";
    } else {
      form.elements.commissionId.value = record ? record.id : "";
      form.elements.status.innerHTML = '<option value="' + escapeDashboardHtml(record ? record.status : "pending") + '">' + escapeDashboardHtml(transactionTypeLabel(record ? record.status : "pending")) + '</option>';
      if (record) { form.elements.affiliateId.value=record.affiliateId; filterAffiliateCommissionReferrals(record.referralId); form.elements.amount.value=record.amount; form.elements.currency.value=record.currency; form.elements.status.value=record.status; form.elements.description.value=record.description||""; }
      if (titleElement) titleElement.textContent = record ? "Edit Commission" : "New Commission";
    }
    var feedback = form.querySelector(".form-feedback"); if (feedback) { feedback.hidden=true; feedback.textContent=""; }
    modal.hidden=false; document.body.style.overflow="hidden";
  }

  if (openAffiliatePartnerModalButton) openAffiliatePartnerModalButton.addEventListener("click", function(){setAffiliateModal(affiliatePartnerModal,affiliatePartnerForm,affiliatePartnerModalTitle,true,null,"partner");});
  if (closeAffiliatePartnerModalButton) closeAffiliatePartnerModalButton.addEventListener("click", function(){setAffiliateModal(affiliatePartnerModal,affiliatePartnerForm,affiliatePartnerModalTitle,false);});
  if (affiliatePartnerModalBackdrop) affiliatePartnerModalBackdrop.addEventListener("click", function(){setAffiliateModal(affiliatePartnerModal,affiliatePartnerForm,affiliatePartnerModalTitle,false);});
  if (resetAffiliatePartnerFormButton) resetAffiliatePartnerFormButton.addEventListener("click", function(){setAffiliateModal(affiliatePartnerModal,affiliatePartnerForm,affiliatePartnerModalTitle,false);});
  if (openAffiliateReferralModalButton) openAffiliateReferralModalButton.addEventListener("click", function(){setAffiliateModal(affiliateReferralModal,affiliateReferralForm,affiliateReferralModalTitle,true,null,"referral");});
  if (closeAffiliateReferralModalButton) closeAffiliateReferralModalButton.addEventListener("click", function(){setAffiliateModal(affiliateReferralModal,affiliateReferralForm,affiliateReferralModalTitle,false);});
  if (affiliateReferralModalBackdrop) affiliateReferralModalBackdrop.addEventListener("click", function(){setAffiliateModal(affiliateReferralModal,affiliateReferralForm,affiliateReferralModalTitle,false);});
  if (resetAffiliateReferralFormButton) resetAffiliateReferralFormButton.addEventListener("click", function(){setAffiliateModal(affiliateReferralModal,affiliateReferralForm,affiliateReferralModalTitle,false);});
  if (openAffiliateCommissionModalButton) openAffiliateCommissionModalButton.addEventListener("click", function(){setAffiliateModal(affiliateCommissionModal,affiliateCommissionForm,affiliateCommissionModalTitle,true,null,"commission");});
  if (closeAffiliateCommissionModalButton) closeAffiliateCommissionModalButton.addEventListener("click", function(){setAffiliateModal(affiliateCommissionModal,affiliateCommissionForm,affiliateCommissionModalTitle,false);});
  if (affiliateCommissionModalBackdrop) affiliateCommissionModalBackdrop.addEventListener("click", function(){setAffiliateModal(affiliateCommissionModal,affiliateCommissionForm,affiliateCommissionModalTitle,false);});
  if (resetAffiliateCommissionFormButton) resetAffiliateCommissionFormButton.addEventListener("click", function(){setAffiliateModal(affiliateCommissionModal,affiliateCommissionForm,affiliateCommissionModalTitle,false);});
  if (affiliateCommissionForm) affiliateCommissionForm.elements.affiliateId.addEventListener("change", function(){filterAffiliateCommissionReferrals();});

  async function submitAffiliateForm(form, basePath, idField, modal, kind) {
    if (!form.checkValidity()) { var invalidFeedback=form.querySelector(".form-feedback"); if(invalidFeedback){invalidFeedback.hidden=false;invalidFeedback.textContent="Complete all required fields with valid values.";} return; }
    var fd=new FormData(form); var id=String(fd.get(idField)||""); var payload;
    if(kind==="partner") payload={userId:Number(fd.get("userId")),referralCode:fd.get("referralCode").trim(),commissionType:fd.get("commissionType"),commissionValue:Number(fd.get("commissionValue")),paymentMethod:fd.get("paymentMethod"),payoutDetails:fd.get("payoutDetails").trim(),status:fd.get("status")};
    if(kind==="referral") payload={affiliateId:Number(fd.get("affiliateId")),userId:Number(fd.get("userId")),status:fd.get("status")};
    if(kind==="commission") payload={affiliateId:Number(fd.get("affiliateId")),referralId:fd.get("referralId")?Number(fd.get("referralId")):null,amount:Number(fd.get("amount")),currency:fd.get("currency"),status:fd.get("status"),description:fd.get("description").trim()};
    var button=form.querySelector('[type="submit"]');
    try { button.disabled=true;button.textContent="Saving...";var response=await fetch("http://127.0.0.1:5000/api/super-admin/affiliations/"+basePath+(id?"/"+encodeURIComponent(id):""),{method:id?"PATCH":"POST",headers:{Authorization:"Bearer "+localStorage.getItem("token"),"Content-Type":"application/json"},body:JSON.stringify(payload)});var data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to save record");setAffiliateModal(modal,form,null,false);await loadSuperAdminAffiliations();showToast(id?"Record updated":"Record created","The affiliate program data was saved to PostgreSQL."); }
    catch(error){var feedback=form.querySelector(".form-feedback");if(feedback){feedback.hidden=false;feedback.textContent=error.message;}}
    finally{button.disabled=false;button.textContent=kind==="partner"?"Save Partner":kind==="referral"?"Save Referral":"Save Commission";}
  }

  if(affiliatePartnerForm)affiliatePartnerForm.addEventListener("submit",function(event){event.preventDefault();submitAffiliateForm(affiliatePartnerForm,"partners","affiliateId",affiliatePartnerModal,"partner");});
  if(affiliateReferralForm)affiliateReferralForm.addEventListener("submit",function(event){event.preventDefault();submitAffiliateForm(affiliateReferralForm,"referrals","referralId",affiliateReferralModal,"referral");});
  if(affiliateCommissionForm)affiliateCommissionForm.addEventListener("submit",function(event){event.preventDefault();submitAffiliateForm(affiliateCommissionForm,"commissions","commissionId",affiliateCommissionModal,"commission");});

  document.addEventListener("click",async function(event){
    var partnerButton=event.target.closest("[data-live-affiliate-partner-action]");var referralButton=event.target.closest("[data-live-affiliate-referral-action]");var commissionButton=event.target.closest("[data-live-affiliate-commission-action]");
    if(partnerButton){var affiliateId=partnerButton.getAttribute("data-affiliate-id");var partner=superAdminAffiliatePartnersById[String(affiliateId)];var partnerAction=partnerButton.getAttribute("data-live-affiliate-partner-action");if(partnerAction==="edit")setAffiliateModal(affiliatePartnerModal,affiliatePartnerForm,affiliatePartnerModalTitle,true,partner,"partner");if(["activate","suspend"].indexOf(partnerAction)!==-1)await quickUpdateAffiliateRecord("partners",affiliateId,{userId:partner.user.id,referralCode:partner.referralCode,commissionType:partner.commissionType,commissionValue:partner.commissionValue,paymentMethod:partner.paymentMethod,payoutDetails:partner.payoutDetails||"",status:partnerAction==="activate"?"active":"suspended"},partnerButton);if(partnerAction==="delete"&&window.confirm("Delete this affiliate partner? Referrals and commissions must be removed first."))await deleteAffiliateRecord("partners",affiliateId,partnerButton);}
    if(referralButton){var referralId=referralButton.getAttribute("data-referral-id");var referral=superAdminAffiliateReferralsById[String(referralId)];var referralAction=referralButton.getAttribute("data-live-affiliate-referral-action");if(referralAction==="edit")setAffiliateModal(affiliateReferralModal,affiliateReferralForm,affiliateReferralModalTitle,true,referral,"referral");if(["qualified","rejected"].indexOf(referralAction)!==-1)await quickUpdateAffiliateRecord("referrals",referralId,{affiliateId:referral.affiliateId,userId:referral.user.id,status:referralAction},referralButton);if(referralAction==="delete"&&window.confirm("Delete this referral attribution?"))await deleteAffiliateRecord("referrals",referralId,referralButton);}
    if(commissionButton){var commissionId=commissionButton.getAttribute("data-commission-id");var commission=superAdminAffiliateCommissionsById[String(commissionId)];var commissionAction=commissionButton.getAttribute("data-live-affiliate-commission-action");if(commissionAction==="edit")setAffiliateModal(affiliateCommissionModal,affiliateCommissionForm,affiliateCommissionModalTitle,true,commission,"commission");if(["approved","rejected"].indexOf(commissionAction)!==-1)await quickUpdateAffiliateRecord("commissions",commissionId,{affiliateId:commission.affiliateId,referralId:commission.referralId,amount:commission.amount,currency:commission.currency,status:commissionAction,description:commission.description||""},commissionButton);if(commissionAction==="delete"&&window.confirm("Delete this commission record?"))await deleteAffiliateRecord("commissions",commissionId,commissionButton);}
  });

  async function quickUpdateAffiliateRecord(path,id,payload,button){var original=button.textContent;try{button.disabled=true;button.textContent="Saving...";var response=await fetch("http://127.0.0.1:5000/api/super-admin/affiliations/"+path+"/"+encodeURIComponent(id),{method:"PATCH",headers:{Authorization:"Bearer "+localStorage.getItem("token"),"Content-Type":"application/json"},body:JSON.stringify(payload)});var data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to update record");await loadSuperAdminAffiliations();showToast("Record updated","The affiliate status was saved.");}catch(error){button.disabled=false;button.textContent=original;showToast("Update failed",error.message);}}
  async function deleteAffiliateRecord(path,id,button){try{button.disabled=true;button.textContent="Deleting...";var response=await fetch("http://127.0.0.1:5000/api/super-admin/affiliations/"+path+"/"+encodeURIComponent(id),{method:"DELETE",headers:{Authorization:"Bearer "+localStorage.getItem("token")}});var data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to delete record");await loadSuperAdminAffiliations();showToast("Record deleted","The affiliate record was removed.");}catch(error){button.disabled=false;button.textContent="Delete";showToast("Delete failed",error.message);}}

  function couponMoney(value, currency) { return cashPaymentMoney(Number(value || 0), currency || "USD"); }
  function couponDate(value) { return value ? cashPaymentDate(value) : "No limit"; }
  function updateCouponsPageSummary(summary) {
    var cards=document.querySelectorAll(".admin-page-coupon-codes .admin-page-stats article");if(cards.length<3)return;
    var discounts=payoutPrimaryVolume(summary.discountsByCurrency);
    cards[0].querySelector("span").textContent="Active coupons";cards[0].querySelector("strong").textContent=formatDashboardNumber(summary.active_coupons);cards[0].querySelector("small").textContent=formatDashboardNumber(summary.ending_soon)+" ending within 7 days";
    cards[1].querySelector("span").textContent="Redemptions";cards[1].querySelector("strong").textContent=formatDashboardNumber(summary.total_redemptions);cards[1].querySelector("small").textContent="Verified promotion uses";
    cards[2].querySelector("span").textContent="Discounts granted";cards[2].querySelector("strong").textContent=couponMoney(discounts.amount,discounts.currency);cards[2].querySelector("small").textContent="This month";
  }
  function couponStatusClass(status){return status==="active"?"active":status==="scheduled"?"pending":status==="exhausted"?"inactive":status==="expired"?"inactive":"inactive";}
  function renderSuperAdminCoupons(coupons){
    if(!couponAdminBody)return;superAdminCouponsById={};if(couponAdminCount)couponAdminCount.textContent=formatDashboardNumber(coupons.length)+(coupons.length===1?" coupon":" coupons");
    if(!coupons.length){couponAdminBody.innerHTML='<tr><td colspan="7"><div class="admin-data-empty"><strong>No coupons found</strong><span>Create a promotion or try another search.</span></div></td></tr>';return;}
    couponAdminBody.innerHTML=coupons.map(function(c){superAdminCouponsById[String(c.id)]=c;var discount=c.discountType==="percentage"?Number(c.discountValue).toFixed(2)+"%":couponMoney(c.discountValue,c.currency);var usage=formatDashboardNumber(c.usedCount)+(c.usageLimit===null?" used · unlimited":" / "+formatDashboardNumber(c.usageLimit));var minimum=Number(c.minimumAmount)>0?"Min. "+couponMoney(c.minimumAmount,c.currency):"No minimum";var windowText=(c.startsAt?couponDate(c.startsAt):"Immediately")+" → "+(c.expiresAt?couponDate(c.expiresAt):"No expiry");return '<tr><td><div class="coupon-identity"><span>'+escapeDashboardHtml(c.code)+'</span><div><strong>'+escapeDashboardHtml(c.name)+'</strong><small>#'+c.id+'</small></div></div></td><td><strong class="coupon-discount">'+escapeDashboardHtml(discount)+'</strong><div class="subtle-handle">'+escapeDashboardHtml(transactionTypeLabel(c.discountType))+'</div></td><td><strong>'+escapeDashboardHtml(c.planName||"All plans")+'</strong><div class="subtle-handle">'+escapeDashboardHtml(minimum)+'</div></td><td><strong>'+escapeDashboardHtml(usage)+'</strong><div class="coupon-usage-track"><i style="width:'+(c.usageLimit?Math.min(100,c.usedCount/c.usageLimit*100):0)+'%"></i></div><div class="subtle-handle">'+c.perUserLimit+' per customer</div></td><td><div class="coupon-window">'+escapeDashboardHtml(windowText)+'</div></td><td><span class="status-badge '+couponStatusClass(c.effectiveStatus)+'">'+escapeDashboardHtml(transactionTypeLabel(c.effectiveStatus))+'</span></td><td><div class="user-row-actions"><button class="user-action-btn edit" type="button" data-live-coupon-action="edit" data-coupon-id="'+c.id+'">Edit</button><button class="user-action-btn '+(c.status==="active"?"reject":"approve")+'" type="button" data-live-coupon-action="toggle" data-coupon-id="'+c.id+'">'+(c.status==="active"?"Pause":"Activate")+'</button><button class="user-action-btn delete" type="button" data-live-coupon-action="delete" data-coupon-id="'+c.id+'">Delete</button></div></td></tr>';}).join("");
  }
  function renderCouponRedemptions(redemptions){
    if(!couponRedemptionBody)return;if(couponRedemptionCount)couponRedemptionCount.textContent=formatDashboardNumber(redemptions.length)+(redemptions.length===1?" redemption":" redemptions");
    if(!redemptions.length){couponRedemptionBody.innerHTML='<tr><td colspan="8"><div class="admin-data-empty"><strong>No redemptions found</strong><span>Applied coupons will appear here with their calculated totals.</span></div></td></tr>';return;}
    couponRedemptionBody.innerHTML=redemptions.map(function(r){var user=r.user||{name:"Deleted user",email:"Account unavailable"};return '<tr><td><div class="table-user"><span class="mini-avatar">'+escapeDashboardHtml(avatarInitials(user.name)||"U")+'</span><div><strong>'+escapeDashboardHtml(user.name)+'</strong><div class="subtle-handle">'+escapeDashboardHtml(user.email)+'</div></div></div></td><td><span class="coupon-code-pill">'+escapeDashboardHtml(r.coupon.code)+'</span><div class="subtle-handle">'+escapeDashboardHtml(r.coupon.name)+'</div></td><td>'+escapeDashboardHtml(r.planName||"No plan")+'</td><td>'+couponMoney(r.originalAmount,r.currency)+'</td><td><strong class="coupon-discount">−'+couponMoney(r.discountAmount,r.currency)+'</strong></td><td><strong>'+couponMoney(r.finalAmount,r.currency)+'</strong></td><td>'+escapeDashboardHtml(couponDate(r.redeemedAt))+'</td><td><button class="user-action-btn delete" type="button" data-live-redemption-action="delete" data-redemption-id="'+r.id+'">Remove</button></td></tr>';}).join("");
  }
  function populateCouponOptions(coupons,plans,users){
    superAdminCouponPlans=plans;superAdminCouponUsers=users;var planOptions=plans.map(function(p){return '<option value="'+p.id+'">'+escapeDashboardHtml(p.name)+'</option>';}).join("");var userOptions=users.map(function(u){return '<option value="'+u.id+'">'+escapeDashboardHtml(u.name+" — "+u.email)+'</option>';}).join("");
    if(couponAdminForm){var selected=couponAdminForm.elements.planId.value;couponAdminForm.elements.planId.innerHTML='<option value="">All plans</option>'+planOptions;couponAdminForm.elements.planId.value=selected;}
    if(couponRedemptionForm){couponRedemptionForm.elements.couponId.innerHTML='<option value="">Select available coupon</option>'+coupons.filter(function(c){return c.effectiveStatus==="active";}).map(function(c){return '<option value="'+c.id+'">'+escapeDashboardHtml(c.code+" — "+c.name)+'</option>';}).join("");couponRedemptionForm.elements.userId.innerHTML='<option value="">Select active user</option>'+userOptions;couponRedemptionForm.elements.planId.innerHTML='<option value="">No plan</option>'+planOptions;}
  }
  async function loadSuperAdminCoupons(){
    if(adminPageSlug!=="coupon-codes"||!couponAdminBody)return;var token=localStorage.getItem("token");if(!token){couponAdminBody.innerHTML='<tr><td colspan="7"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as a super admin to manage coupon codes.</span></div></td></tr>';updateCouponsPageSummary({});return;}
    try{var search=searchInput?searchInput.value.trim():"";var response=await fetch("http://127.0.0.1:5000/api/super-admin/coupons?search="+encodeURIComponent(search),{headers:{Authorization:"Bearer "+token}});var data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to load coupons");renderSuperAdminCoupons(data.coupons||[]);renderCouponRedemptions(data.redemptions||[]);populateCouponOptions(data.coupons||[],data.plans||[],data.users||[]);updateCouponsPageSummary(data.summary||{});}catch(error){couponAdminBody.innerHTML='<tr><td colspan="7"><div class="admin-data-empty"><strong>Coupons unavailable</strong><span>'+escapeDashboardHtml(error.message)+'</span></div></td></tr>';if(couponAdminCount)couponAdminCount.textContent="Unavailable";updateCouponsPageSummary({});showToast("Could not load coupons",error.message);}
  }
  function setCouponModal(open,coupon){if(!couponAdminModal||!couponAdminForm)return;if(!open){couponAdminModal.hidden=true;document.body.style.overflow="";return;}couponAdminForm.reset();couponAdminForm.elements.couponId.value=coupon?coupon.id:"";if(coupon){couponAdminForm.elements.name.value=coupon.name;couponAdminForm.elements.code.value=coupon.code;couponAdminForm.elements.discountType.value=coupon.discountType;couponAdminForm.elements.discountValue.value=coupon.discountValue;couponAdminForm.elements.currency.value=coupon.currency;couponAdminForm.elements.usageLimit.value=coupon.usageLimit===null?"":coupon.usageLimit;couponAdminForm.elements.perUserLimit.value=coupon.perUserLimit;couponAdminForm.elements.minimumAmount.value=coupon.minimumAmount;couponAdminForm.elements.planId.value=coupon.planId||"";couponAdminForm.elements.startsAt.value=payoutDatetimeInput(coupon.startsAt);couponAdminForm.elements.expiresAt.value=payoutDatetimeInput(coupon.expiresAt);couponAdminForm.elements.status.value=coupon.status;}if(couponAdminModalTitle)couponAdminModalTitle.textContent=coupon?"Edit Coupon":"New Coupon";var feedback=couponAdminForm.querySelector(".form-feedback");if(feedback)feedback.hidden=true;couponAdminModal.hidden=false;document.body.style.overflow="hidden";}
  function setCouponRedemptionModal(open){if(!couponRedemptionModal||!couponRedemptionForm)return;if(!open){couponRedemptionModal.hidden=true;document.body.style.overflow="";return;}couponRedemptionForm.reset();var feedback=couponRedemptionForm.querySelector(".form-feedback");if(feedback)feedback.hidden=true;couponRedemptionModal.hidden=false;document.body.style.overflow="hidden";}
  [document.getElementById("openCouponAdminModal")].forEach(function(b){if(b)b.addEventListener("click",function(){setCouponModal(true,null);});});
  [document.getElementById("closeCouponAdminModal"),document.getElementById("resetCouponAdminForm"),document.getElementById("couponAdminModalBackdrop")].forEach(function(b){if(b)b.addEventListener("click",function(){setCouponModal(false);});});
  [document.getElementById("openCouponRedemptionModal")].forEach(function(b){if(b)b.addEventListener("click",function(){setCouponRedemptionModal(true);});});
  [document.getElementById("closeCouponRedemptionModal"),document.getElementById("resetCouponRedemptionForm"),document.getElementById("couponRedemptionModalBackdrop")].forEach(function(b){if(b)b.addEventListener("click",function(){setCouponRedemptionModal(false);});});
  function couponPayload(c,statusOverride){return {code:c.code,name:c.name,discountType:c.discountType,discountValue:c.discountValue,currency:c.currency,usageLimit:c.usageLimit,perUserLimit:c.perUserLimit,minimumAmount:c.minimumAmount,planId:c.planId,startsAt:c.startsAt,expiresAt:c.expiresAt,status:statusOverride||c.status};}
  if(couponAdminForm)couponAdminForm.addEventListener("submit",async function(event){event.preventDefault();var feedback=couponAdminForm.querySelector(".form-feedback");if(!couponAdminForm.checkValidity()){feedback.hidden=false;feedback.textContent="Complete all required fields with valid values.";return;}var fd=new FormData(couponAdminForm),id=fd.get("couponId"),button=couponAdminForm.querySelector('[type="submit"]'),payload={name:fd.get("name").trim(),code:fd.get("code").trim(),discountType:fd.get("discountType"),discountValue:Number(fd.get("discountValue")),currency:fd.get("currency"),usageLimit:fd.get("usageLimit")?Number(fd.get("usageLimit")):null,perUserLimit:Number(fd.get("perUserLimit")),minimumAmount:Number(fd.get("minimumAmount")||0),planId:fd.get("planId")?Number(fd.get("planId")):null,startsAt:fd.get("startsAt")||null,expiresAt:fd.get("expiresAt")||null,status:fd.get("status")};try{button.disabled=true;button.textContent="Saving...";var response=await fetch("http://127.0.0.1:5000/api/super-admin/coupons"+(id?"/"+encodeURIComponent(id):""),{method:id?"PATCH":"POST",headers:{Authorization:"Bearer "+localStorage.getItem("token"),"Content-Type":"application/json"},body:JSON.stringify(payload)});var data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to save coupon");setCouponModal(false);await loadSuperAdminCoupons();showToast(id?"Coupon updated":"Coupon created","Promotion rules were saved to PostgreSQL.");}catch(error){feedback.hidden=false;feedback.textContent=error.message;}finally{button.disabled=false;button.textContent="Save Coupon";}});
  if(couponRedemptionForm)couponRedemptionForm.addEventListener("submit",async function(event){event.preventDefault();var feedback=couponRedemptionForm.querySelector(".form-feedback");if(!couponRedemptionForm.checkValidity()){feedback.hidden=false;feedback.textContent="Select a coupon and customer, then enter an amount.";return;}var fd=new FormData(couponRedemptionForm),button=couponRedemptionForm.querySelector('[type="submit"]'),selectedCoupon=superAdminCouponsById[String(fd.get("couponId"))],currency=selectedCoupon?selectedCoupon.currency:"USD";try{button.disabled=true;button.textContent="Calculating...";var response=await fetch("http://127.0.0.1:5000/api/super-admin/coupon-redemptions",{method:"POST",headers:{Authorization:"Bearer "+localStorage.getItem("token"),"Content-Type":"application/json"},body:JSON.stringify({couponId:Number(fd.get("couponId")),userId:Number(fd.get("userId")),planId:fd.get("planId")?Number(fd.get("planId")):null,originalAmount:Number(fd.get("originalAmount"))})});var data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to apply coupon");setCouponRedemptionModal(false);await loadSuperAdminCoupons();showToast("Coupon applied","Discount: "+couponMoney(data.redemption.discountAmount,currency)+" · Final: "+couponMoney(data.redemption.finalAmount,currency));}catch(error){feedback.hidden=false;feedback.textContent=error.message;}finally{button.disabled=false;button.textContent="Apply & Record";}});
  document.addEventListener("click",async function(event){var button=event.target.closest("[data-live-coupon-action]");var redemptionButton=event.target.closest("[data-live-redemption-action]");if(button){var id=button.getAttribute("data-coupon-id"),coupon=superAdminCouponsById[String(id)],action=button.getAttribute("data-live-coupon-action");if(action==="edit")setCouponModal(true,coupon);if(action==="toggle"&&coupon){try{button.disabled=true;button.textContent="Saving...";var response=await fetch("http://127.0.0.1:5000/api/super-admin/coupons/"+encodeURIComponent(id),{method:"PATCH",headers:{Authorization:"Bearer "+localStorage.getItem("token"),"Content-Type":"application/json"},body:JSON.stringify(couponPayload(coupon,coupon.status==="active"?"inactive":"active"))});var data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to update coupon");await loadSuperAdminCoupons();showToast("Coupon updated","Availability was changed.");}catch(error){button.disabled=false;button.textContent="Retry";showToast("Update failed",error.message);}}if(action==="delete"&&window.confirm("Delete this unused coupon? Coupons with redemption history should be deactivated instead.")){await deleteCouponRecord("coupons",id,button);}}if(redemptionButton&&window.confirm("Remove this redemption record? This is intended only for correcting administrative entries.")){await deleteCouponRecord("coupon-redemptions",redemptionButton.getAttribute("data-redemption-id"),redemptionButton);}});
  async function deleteCouponRecord(path,id,button){try{button.disabled=true;button.textContent="Deleting...";var response=await fetch("http://127.0.0.1:5000/api/super-admin/"+path+"/"+encodeURIComponent(id),{method:"DELETE",headers:{Authorization:"Bearer "+localStorage.getItem("token")}});var data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to delete record");await loadSuperAdminCoupons();showToast("Record removed","The database record was deleted.");}catch(error){button.disabled=false;button.textContent="Delete";showToast("Delete failed",error.message);}}

  function updateAnalyticsPageSummary(metrics) {
    var cards=document.querySelectorAll(".admin-page-analytics .admin-page-stats article"),items=[{label:"Profile views",metric:metrics.pageViews},{label:"Engaged clicks",metric:metrics.clicks},{label:"Contact requests",metric:metrics.contactRequests}];if(cards.length<3)return;
    items.forEach(function(item,index){var metric=item.metric||{};cards[index].querySelector("span").textContent=item.label;cards[index].querySelector("strong").textContent=formatDashboardNumber(metric.value);cards[index].querySelector("small").textContent=(Number(metric.change)>0?"+":"")+Number(metric.change||0).toFixed(1)+"% vs prior period";});
  }
  function renderAnalyticsChart(series){var canvas=document.getElementById("analyticsLiveChart");if(!canvas||typeof Chart==="undefined")return;if(chartRefs.analyticsLive)chartRefs.analyticsLive.destroy();chartRefs.analyticsLive=new Chart(canvas,{type:"line",data:{labels:series.map(function(p){return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(new Date(p.date));}),datasets:[{label:"Views",data:series.map(function(p){return p.pageViews;}),borderColor:"#ff5968",backgroundColor:"rgba(255,89,104,.12)",fill:true,tension:.35,borderWidth:2,pointRadius:0},{label:"Clicks",data:series.map(function(p){return p.clicks;}),borderColor:"#8ebcff",backgroundColor:"transparent",tension:.35,borderWidth:2,pointRadius:0},{label:"Contacts",data:series.map(function(p){return p.contacts;}),borderColor:"#55daa3",backgroundColor:"transparent",tension:.35,borderWidth:2,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{labels:{color:"#aab3c7",usePointStyle:true,boxWidth:8}},tooltip:{backgroundColor:"#151820",borderColor:"rgba(255,255,255,.1)",borderWidth:1}},scales:{x:{grid:{display:false},ticks:{color:"#707a90",maxTicksLimit:10}},y:{beginAtZero:true,grid:{color:"rgba(255,255,255,.045)"},ticks:{color:"#707a90"}}}}});}
  function renderAnalyticsSources(sources){if(!analyticsSourceList)return;var total=sources.reduce(function(sum,item){return sum+Number(item.count||0);},0);if(!sources.length){analyticsSourceList.innerHTML='<div class="admin-data-empty"><strong>No contact sources yet</strong><span>Contact submissions in this period will be grouped here.</span></div>';return;}analyticsSourceList.innerHTML=sources.map(function(item,index){var percent=total?item.count/total*100:0;return '<div><span class="analytics-source-rank">'+(index+1)+'</span><div><strong>'+escapeDashboardHtml(item.source)+'</strong><i><b style="width:'+percent.toFixed(1)+'%"></b></i></div><span>'+formatDashboardNumber(item.count)+'</span></div>';}).join("");}
  function renderAnalyticsCards(cards){if(!analyticsCardsBody)return;var count=document.getElementById("analyticsCardCount");if(count)count.textContent=formatDashboardNumber(cards.length)+" ranked";if(!cards.length){analyticsCardsBody.innerHTML='<tr><td colspan="6"><div class="admin-data-empty"><strong>No card analytics found</strong><span>Daily business-card analytics will appear here once collected.</span></div></td></tr>';return;}analyticsCardsBody.innerHTML=cards.map(function(card){var rate=card.views?card.contacts/card.views*100:0;return '<tr><td><div class="analytics-card-name"><span>'+escapeDashboardHtml(avatarInitials(card.title)||"BC")+'</span><div><strong>'+escapeDashboardHtml(card.title)+'</strong><small>Card #'+card.id+'</small></div></div></td><td>'+escapeDashboardHtml(card.owner)+'</td><td><strong>'+formatDashboardNumber(card.views)+'</strong></td><td>'+formatDashboardNumber(card.clicks)+'</td><td>'+formatDashboardNumber(card.contacts)+'</td><td><span class="analytics-rate-pill">'+rate.toFixed(1)+'%</span></td></tr>';}).join("");}
  function renderAnalyticsHealth(data){var metrics=data.metrics||{},clickRate=Number(metrics.clickRate||0),contactRate=Number(metrics.contactRate||0),clickNode=document.getElementById("analyticsClickRate"),contactNode=document.getElementById("analyticsContactRate"),clickBar=document.getElementById("analyticsClickRateBar"),contactBar=document.getElementById("analyticsContactRateBar");if(clickNode)clickNode.textContent=clickRate.toFixed(1)+"%";if(contactNode)contactNode.textContent=contactRate.toFixed(1)+"%";if(clickBar)clickBar.style.width=Math.min(100,clickRate)+"%";if(contactBar)contactBar.style.width=Math.min(100,contactRate)+"%";var p=data.platform||{},list=document.getElementById("analyticsPlatformList");if(list)list.innerHTML='<div><strong>'+formatDashboardNumber(p.new_users)+'</strong><span>New users</span></div><div><strong>'+formatDashboardNumber(p.new_vcards)+'</strong><span>New VCards</span></div><div><strong>'+formatDashboardNumber(p.contacts)+'</strong><span>Saved contacts</span></div><div><strong>'+formatDashboardNumber(p.qr_codes_created)+'</strong><span>QR codes created</span></div>';}
  async function loadSuperAdminAnalytics(){if(adminPageSlug!=="analytics"||!analyticsCardsBody)return;var token=localStorage.getItem("token");if(!token){analyticsCardsBody.innerHTML='<tr><td colspan="6"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as super admin to view analytics.</span></div></td></tr>';return;}try{var days=analyticsRange?analyticsRange.value:"30",response=await fetch("http://127.0.0.1:5000/api/super-admin/analytics?days="+encodeURIComponent(days),{headers:{Authorization:"Bearer "+token}}),data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to load analytics");updateAnalyticsPageSummary(data.metrics||{});renderAnalyticsChart(data.series||[]);renderAnalyticsSources(data.sources||[]);renderAnalyticsCards(data.topCards||[]);renderAnalyticsHealth(data);var updated=document.getElementById("analyticsUpdatedAt");if(updated)updated.textContent="Updated "+new Date(data.generatedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}catch(error){analyticsCardsBody.innerHTML='<tr><td colspan="6"><div class="admin-data-empty"><strong>Analytics unavailable</strong><span>'+escapeDashboardHtml(error.message)+'</span></div></td></tr>';showToast("Could not load analytics",error.message);}}
  if(analyticsRange)analyticsRange.addEventListener("change",loadSuperAdminAnalytics);var refreshAnalytics=document.getElementById("refreshAnalytics");if(refreshAnalytics)refreshAnalytics.addEventListener("click",loadSuperAdminAnalytics);

  function updateReportsPageSummary(summary){var cards=document.querySelectorAll(".admin-page-reports .admin-page-stats article");if(cards.length<3)return;cards[0].querySelector("span").textContent="Saved reports";cards[0].querySelector("strong").textContent=formatDashboardNumber(summary.saved_reports);cards[0].querySelector("small").textContent=formatDashboardNumber(summary.active_reports)+" active definitions";cards[1].querySelector("span").textContent="Exports this month";cards[1].querySelector("strong").textContent=formatDashboardNumber(summary.exports_this_month);cards[1].querySelector("small").textContent="Database snapshots";cards[2].querySelector("span").textContent="Last export";cards[2].querySelector("strong").textContent=summary.last_export_at?cashPaymentDate(summary.last_export_at):"Never";cards[2].querySelector("small").textContent=summary.last_export_at?"Most recent generation":"Generate your first report";}
  function reportTypeLabel(type){var labels={revenue:"Revenue ledger",subscriptions:"Subscriptions",platform:"Platform activity",coupons:"Coupon performance",affiliates:"Affiliate performance"};return labels[type]||transactionTypeLabel(type);}
  function renderSavedReports(reports){if(!reportAdminBody)return;superAdminReportsById={};if(reportAdminCount)reportAdminCount.textContent=formatDashboardNumber(reports.length)+(reports.length===1?" report":" reports");if(!reports.length){reportAdminBody.innerHTML='<tr><td colspan="7"><div class="admin-data-empty"><strong>No saved reports found</strong><span>Create a report definition to generate a reusable CSV export.</span></div></td></tr>';return;}reportAdminBody.innerHTML=reports.map(function(report){superAdminReportsById[String(report.id)]=report;return '<tr><td><div class="report-name-cell"><span>'+escapeDashboardHtml(reportTypeLabel(report.reportType).slice(0,2).toUpperCase())+'</span><div><strong>'+escapeDashboardHtml(report.name)+'</strong><small>Report #'+report.id+'</small></div></div></td><td><span class="report-type-pill">'+escapeDashboardHtml(reportTypeLabel(report.reportType))+'</span></td><td>Last '+formatDashboardNumber(report.dateRangeDays)+' days</td><td><strong>'+formatDashboardNumber(report.runCount)+'</strong></td><td>'+escapeDashboardHtml(report.lastRunAt?cashPaymentDate(report.lastRunAt):"Not generated")+'</td><td><span class="status-badge '+(report.status==="active"?"active":"inactive")+'">'+escapeDashboardHtml(transactionTypeLabel(report.status))+'</span></td><td><div class="user-row-actions"><button class="user-action-btn approve" type="button" data-live-report-action="run" data-report-id="'+report.id+'" '+(report.status!=="active"?"disabled":"")+'>Export CSV</button><button class="user-action-btn edit" type="button" data-live-report-action="edit" data-report-id="'+report.id+'">Edit</button><button class="user-action-btn delete" type="button" data-live-report-action="delete" data-report-id="'+report.id+'">Delete</button></div></td></tr>';}).join("");}
  function renderReportRuns(runs){if(!reportRunBody)return;if(reportRunCount)reportRunCount.textContent=formatDashboardNumber(runs.length)+(runs.length===1?" export":" exports");if(!runs.length){reportRunBody.innerHTML='<tr><td colspan="7"><div class="admin-data-empty"><strong>No export history</strong><span>Generate a saved report to store its first snapshot.</span></div></td></tr>';return;}reportRunBody.innerHTML=runs.map(function(run){return '<tr><td><strong>'+escapeDashboardHtml(run.reportName)+'</strong><div class="subtle-handle">Run #'+run.id+'</div></td><td>'+escapeDashboardHtml(reportTypeLabel(run.reportType))+'</td><td>'+formatDashboardNumber(run.rowCount)+'</td><td><span class="report-format-pill">'+escapeDashboardHtml(run.format.toUpperCase())+'</span></td><td>'+escapeDashboardHtml(run.generatedBy)+'</td><td>'+escapeDashboardHtml(cashPaymentDate(run.generatedAt))+'</td><td><button class="user-action-btn edit" type="button" data-report-run-download="'+run.id+'" data-report-name="'+escapeDashboardHtml(run.reportName)+'">Download</button></td></tr>';}).join("");}
  async function loadSuperAdminReports(){if(adminPageSlug!=="reports"||!reportAdminBody)return;var token=localStorage.getItem("token");if(!token){reportAdminBody.innerHTML='<tr><td colspan="7"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as super admin to manage reports.</span></div></td></tr>';return;}try{var search=searchInput?searchInput.value.trim():"",response=await fetch("http://127.0.0.1:5000/api/super-admin/reports?search="+encodeURIComponent(search),{headers:{Authorization:"Bearer "+token}}),data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to load reports");renderSavedReports(data.reports||[]);renderReportRuns(data.runs||[]);updateReportsPageSummary(data.summary||{});}catch(error){reportAdminBody.innerHTML='<tr><td colspan="7"><div class="admin-data-empty"><strong>Reports unavailable</strong><span>'+escapeDashboardHtml(error.message)+'</span></div></td></tr>';showToast("Could not load reports",error.message);}}
  function setReportModal(open,report){if(!reportAdminModal||!reportAdminForm)return;if(!open){reportAdminModal.hidden=true;document.body.style.overflow="";return;}reportAdminForm.reset();reportAdminForm.elements.reportId.value=report?report.id:"";if(report){reportAdminForm.elements.name.value=report.name;reportAdminForm.elements.reportType.value=report.reportType;reportAdminForm.elements.dateRangeDays.value=String(report.dateRangeDays);reportAdminForm.elements.status.value=report.status;}if(reportAdminModalTitle)reportAdminModalTitle.textContent=report?"Edit Report":"New Report";var feedback=reportAdminForm.querySelector(".form-feedback");if(feedback)feedback.hidden=true;reportAdminModal.hidden=false;document.body.style.overflow="hidden";}
  [document.getElementById("openReportAdminModal")].forEach(function(b){if(b)b.addEventListener("click",function(){setReportModal(true,null);});});[document.getElementById("closeReportAdminModal"),document.getElementById("resetReportAdminForm"),document.getElementById("reportAdminModalBackdrop")].forEach(function(b){if(b)b.addEventListener("click",function(){setReportModal(false);});});
  if(reportAdminForm)reportAdminForm.addEventListener("submit",async function(event){event.preventDefault();var feedback=reportAdminForm.querySelector(".form-feedback");if(!reportAdminForm.checkValidity()){feedback.hidden=false;feedback.textContent="Enter a valid report name and reporting period.";return;}var fd=new FormData(reportAdminForm),id=fd.get("reportId"),button=reportAdminForm.querySelector('[type="submit"]');try{button.disabled=true;button.textContent="Saving...";var response=await fetch("http://127.0.0.1:5000/api/super-admin/reports"+(id?"/"+encodeURIComponent(id):""),{method:id?"PATCH":"POST",headers:{Authorization:"Bearer "+localStorage.getItem("token"),"Content-Type":"application/json"},body:JSON.stringify({name:fd.get("name").trim(),reportType:fd.get("reportType"),dateRangeDays:Number(fd.get("dateRangeDays")),status:fd.get("status")})}),data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to save report");setReportModal(false);await loadSuperAdminReports();showToast(id?"Report updated":"Report created","The reusable report definition was saved.");}catch(error){feedback.hidden=false;feedback.textContent=error.message;}finally{button.disabled=false;button.textContent="Save Report";}});
  async function downloadReportRun(id,name){try{var response=await fetch("http://127.0.0.1:5000/api/super-admin/report-runs/"+encodeURIComponent(id)+"/download",{headers:{Authorization:"Bearer "+localStorage.getItem("token")}});if(!response.ok){var errorData=await response.json().catch(function(){return{};});throw new Error(errorData.message||"Unable to download report");}var blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement("a"),disposition=response.headers.get("content-disposition")||"",match=disposition.match(/filename="?([^";]+)"?/i);link.href=url;link.download=match?match[1]:String(name||"report").replace(/[^a-z0-9_-]+/gi,"-")+".csv";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);showToast("Report downloaded","The stored CSV snapshot is ready.");}catch(error){showToast("Download failed",error.message);}}
  document.addEventListener("click",async function(event){var button=event.target.closest("[data-live-report-action]"),download=event.target.closest("[data-report-run-download]");if(download)downloadReportRun(download.getAttribute("data-report-run-download"),download.getAttribute("data-report-name"));if(!button)return;var id=button.getAttribute("data-report-id"),report=superAdminReportsById[String(id)],action=button.getAttribute("data-live-report-action");if(action==="edit")setReportModal(true,report);if(action==="run"){try{button.disabled=true;button.textContent="Generating...";var response=await fetch("http://127.0.0.1:5000/api/super-admin/reports/"+encodeURIComponent(id)+"/run",{method:"POST",headers:{Authorization:"Bearer "+localStorage.getItem("token")}}),data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to generate report");await loadSuperAdminReports();await downloadReportRun(data.run.id,report.name);}catch(error){button.disabled=false;button.textContent="Export CSV";showToast("Export failed",error.message);}}if(action==="delete"&&window.confirm("Delete this saved report and all of its export history?")){try{button.disabled=true;button.textContent="Deleting...";var deleteResponse=await fetch("http://127.0.0.1:5000/api/super-admin/reports/"+encodeURIComponent(id),{method:"DELETE",headers:{Authorization:"Bearer "+localStorage.getItem("token")}}),deleteData=await deleteResponse.json().catch(function(){return{};});if(!deleteResponse.ok)throw new Error(deleteData.message||"Unable to delete report");await loadSuperAdminReports();showToast("Report deleted","The definition and its snapshots were removed.");}catch(error){button.disabled=false;button.textContent="Delete";showToast("Delete failed",error.message);}}});
  if(reportTabButtons.length)reportTabButtons.forEach(function(button){button.addEventListener("click",function(){var id=button.getAttribute("data-report-tab-target");reportTabButtons.forEach(function(item){item.classList.remove("active");item.setAttribute("aria-selected","false");});Array.from(document.querySelectorAll("#savedReportsPanel,#reportRunsPanel")).forEach(function(panel){panel.classList.remove("active");});button.classList.add("active");button.setAttribute("aria-selected","true");var panel=document.getElementById(id);if(panel)panel.classList.add("active");});});

  function updateSettingsPageSummary(summary,settings){var cards=document.querySelectorAll(".admin-page-settings .admin-page-stats article");if(cards.length<3)return;var maintenance=(settings||[]).find(function(item){return item.key==="maintenance_mode";}),last=summary.last_updated?new Date(summary.last_updated):null;cards[0].querySelector("span").textContent="System status";cards[0].querySelector("strong").textContent=maintenance&&maintenance.value==="true"?"Maintenance":"Operational";cards[0].querySelector("small").textContent=maintenance&&maintenance.value==="true"?"Public access restricted":"Platform access enabled";cards[1].querySelector("span").textContent="Stored settings";cards[1].querySelector("strong").textContent=formatDashboardNumber(summary.stored_settings);cards[1].querySelector("small").textContent="Validated database values";cards[2].querySelector("span").textContent="Last updated";cards[2].querySelector("strong").textContent=last?cashPaymentDate(last):"Defaults";cards[2].querySelector("small").textContent=last?"Latest persisted change":"Using application defaults";}
  function fillPlatformSettings(settings){if(!platformSettingsForm)return;settings.forEach(function(setting){var field=platformSettingsForm.elements[setting.key];if(!field)return;if(field.type==="checkbox")field.checked=setting.value==="true";else field.value=setting.value;});}
  function renderRolePermissions(roles){if(!rolePermissionGrid)return;var count=document.getElementById("settingsRoleCount");if(count)count.textContent=formatDashboardNumber(roles.length)+" roles";if(!roles.length){rolePermissionGrid.innerHTML='<div class="admin-data-empty"><strong>No roles configured</strong><span>Seed roles and permissions to manage access.</span></div>';return;}rolePermissionGrid.innerHTML=roles.map(function(role){return '<article class="role-permission-card" data-role-id="'+role.id+'"><div class="role-permission-header"><div><span>'+escapeDashboardHtml(role.name.split("_").map(function(p){return p.charAt(0).toUpperCase();}).join(""))+'</span><div><strong>'+escapeDashboardHtml(transactionTypeLabel(role.name))+'</strong><small>'+escapeDashboardHtml(role.description||"Platform role")+'</small></div></div><span class="status-badge '+(role.locked?"completed":"active")+'">'+(role.locked?"Always enabled":"Editable")+'</span></div><div class="role-permission-options">'+role.permissions.map(function(permission){return '<label><input type="checkbox" value="'+permission.id+'" '+(permission.granted?"checked":"")+' '+(role.locked?"disabled":"")+' /><span><strong>'+escapeDashboardHtml(permission.name)+'</strong><small>'+escapeDashboardHtml(permission.description||permission.key)+'</small></span></label>';}).join("")+'</div>'+(role.locked?'<p class="role-lock-note">Super administrators retain every capability.</p>':'<button class="btn-preview" type="button" data-save-role-permissions="'+role.id+'">Save '+escapeDashboardHtml(transactionTypeLabel(role.name))+'</button>')+'</article>';}).join("");}
  async function loadSuperAdminSettings(){if(adminPageSlug!=="settings"||!platformSettingsForm)return;var token=localStorage.getItem("token"),state=document.getElementById("settingsSaveState");if(!token){if(state)state.textContent="Sign in required";return;}try{var response=await fetch("http://127.0.0.1:5000/api/super-admin/settings",{headers:{Authorization:"Bearer "+token}}),data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to load settings");fillPlatformSettings(data.settings||[]);renderRolePermissions(data.roles||[]);updateSettingsPageSummary(data.summary||{},data.settings||[]);if(state)state.textContent="Synced with PostgreSQL";}catch(error){if(state)state.textContent="Settings unavailable";showToast("Could not load settings",error.message);}}
  var savePlatformSettingsButton=document.getElementById("savePlatformSettings");if(savePlatformSettingsButton)savePlatformSettingsButton.addEventListener("click",async function(){if(!platformSettingsForm.checkValidity()){platformSettingsForm.reportValidity();return;}var settings={};Array.from(platformSettingsForm.elements).forEach(function(field){if(!field.name)return;settings[field.name]=field.type==="checkbox"?String(field.checked):String(field.value).trim();});var state=document.getElementById("settingsSaveState");try{savePlatformSettingsButton.disabled=true;savePlatformSettingsButton.textContent="Saving...";if(state)state.textContent="Validating changes...";var response=await fetch("http://127.0.0.1:5000/api/super-admin/settings",{method:"PUT",headers:{Authorization:"Bearer "+localStorage.getItem("token"),"Content-Type":"application/json"},body:JSON.stringify({settings:settings})}),data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to save settings");await loadSuperAdminSettings();showToast("Settings saved","Platform controls were updated in PostgreSQL.");}catch(error){if(state)state.textContent="Save failed";showToast("Settings not saved",error.message);}finally{savePlatformSettingsButton.disabled=false;savePlatformSettingsButton.textContent="Save Changes";}});
  document.addEventListener("click",async function(event){var button=event.target.closest("[data-save-role-permissions]");if(!button)return;var roleId=button.getAttribute("data-save-role-permissions"),card=button.closest("[data-role-id]"),permissionIds=Array.from(card.querySelectorAll('input[type="checkbox"]:checked')).map(function(input){return Number(input.value);});try{button.disabled=true;button.textContent="Saving...";var response=await fetch("http://127.0.0.1:5000/api/super-admin/settings/roles/"+encodeURIComponent(roleId)+"/permissions",{method:"PUT",headers:{Authorization:"Bearer "+localStorage.getItem("token"),"Content-Type":"application/json"},body:JSON.stringify({permissionIds:permissionIds})}),data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to update permissions");await loadSuperAdminSettings();showToast("Permissions updated","Role capabilities were saved to the database.");}catch(error){button.disabled=false;button.textContent="Retry save";showToast("Update failed",error.message);}});

  function updateSystemLogsSummary(summary){var cards=document.querySelectorAll(".admin-page-system-logs .admin-page-stats article");if(cards.length<3)return;cards[0].querySelector("span").textContent="Total events";cards[0].querySelector("strong").textContent=formatDashboardNumber(summary.total);cards[0].querySelector("small").textContent=formatDashboardNumber(summary.actors)+" recorded actors";cards[1].querySelector("span").textContent="Events today";cards[1].querySelector("strong").textContent=formatDashboardNumber(summary.today);cards[1].querySelector("small").textContent="Since local database midnight";cards[2].querySelector("span").textContent="Needs attention";cards[2].querySelector("strong").textContent=formatDashboardNumber(summary.attention);cards[2].querySelector("small").textContent="Failed, rejected, or deleted events";}
  function logActionLabel(action){return String(action||"event").split(".").map(function(part){return transactionTypeLabel(part);}).join(" · ");}
  function renderSystemLogs(logs,pagination){if(!systemLogBody)return;superAdminSystemLogsById={};var count=document.getElementById("systemLogCount"),label=document.getElementById("systemLogPageLabel"),previous=document.getElementById("systemLogPrevious"),next=document.getElementById("systemLogNext");systemLogPage=pagination.page||1;systemLogPages=pagination.pages||1;if(count)count.textContent=formatDashboardNumber(pagination.total)+(pagination.total===1?" event":" events");if(label)label.textContent="Page "+systemLogPage+" of "+systemLogPages;if(previous)previous.disabled=systemLogPage<=1;if(next)next.disabled=systemLogPage>=systemLogPages;if(!logs.length){systemLogBody.innerHTML='<tr><td colspan="6"><div class="admin-data-empty"><strong>No audit events found</strong><span>Adjust the search or date filters.</span></div></td></tr>';return;}systemLogBody.innerHTML=logs.map(function(log){superAdminSystemLogsById[String(log.id)]=log;var actor=log.actor||{name:"System",email:"Automated or deleted actor"};return '<tr><td><div class="log-event-cell"><span class="log-severity '+log.severity+'"></span><div><strong>'+escapeDashboardHtml(logActionLabel(log.action))+'</strong><small>Event #'+log.id+'</small></div></div></td><td><strong>'+escapeDashboardHtml(actor.name)+'</strong><div class="subtle-handle">'+escapeDashboardHtml(actor.email)+'</div></td><td><span class="log-resource-pill">'+escapeDashboardHtml(log.resourceType||"system")+'</span><div class="subtle-handle">'+(log.resourceId?"ID "+log.resourceId:"No resource ID")+'</div></td><td><span>'+escapeDashboardHtml(log.ipAddress||"Not captured")+'</span><div class="subtle-handle log-agent">'+escapeDashboardHtml(log.userAgent||"No user agent")+'</div></td><td>'+escapeDashboardHtml(cashPaymentDate(log.createdAt))+'</td><td><button class="user-action-btn edit" type="button" data-system-log-detail="'+log.id+'">Inspect</button></td></tr>';}).join("");}
  function populateSystemLogFilters(actors,types){if(systemLogActor){var current=systemLogActor.value;systemLogActor.innerHTML='<option value="">All actors</option>'+actors.map(function(actor){return '<option value="'+actor.id+'">'+escapeDashboardHtml(actor.name+" — "+actor.email)+'</option>';}).join("");systemLogActor.value=current;}if(systemLogResource){var selected=systemLogResource.value;systemLogResource.innerHTML='<option value="">All resources</option>'+types.map(function(type){return '<option value="'+escapeDashboardHtml(type)+'">'+escapeDashboardHtml(transactionTypeLabel(type))+'</option>';}).join("");systemLogResource.value=selected;}}
  async function loadSuperAdminSystemLogs(){if(adminPageSlug!=="system-logs"||!systemLogBody)return;var token=localStorage.getItem("token");if(!token){systemLogBody.innerHTML='<tr><td colspan="6"><div class="admin-data-empty"><strong>Sign in required</strong><span>Log in as super admin to review audit activity.</span></div></td></tr>';return;}try{var params=new URLSearchParams({page:String(systemLogPage),limit:"25"});if(searchInput&&searchInput.value.trim())params.set("search",searchInput.value.trim());if(systemLogResource&&systemLogResource.value)params.set("resourceType",systemLogResource.value);if(systemLogActor&&systemLogActor.value)params.set("actorId",systemLogActor.value);var from=document.getElementById("systemLogFrom"),to=document.getElementById("systemLogTo");if(from&&from.value)params.set("from",from.value);if(to&&to.value)params.set("to",to.value);var response=await fetch("http://127.0.0.1:5000/api/super-admin/system-logs?"+params.toString(),{headers:{Authorization:"Bearer "+token}}),data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.message||"Unable to load system logs");renderSystemLogs(data.logs||[],data.pagination||{});populateSystemLogFilters(data.actors||[],data.resourceTypes||[]);updateSystemLogsSummary(data.summary||{});}catch(error){systemLogBody.innerHTML='<tr><td colspan="6"><div class="admin-data-empty"><strong>Audit logs unavailable</strong><span>'+escapeDashboardHtml(error.message)+'</span></div></td></tr>';showToast("Could not load logs",error.message);}}
  function setSystemLogModal(open,log){var modal=document.getElementById("systemLogModal"),detail=document.getElementById("systemLogDetail"),title=document.getElementById("systemLogModalTitle");if(!modal)return;if(!open){modal.hidden=true;document.body.style.overflow="";return;}var actor=log.actor||{name:"System",email:"Automated or deleted actor"};if(title)title.textContent=logActionLabel(log.action);if(detail)detail.innerHTML='<dl><div><dt>Event ID</dt><dd>#'+log.id+'</dd></div><div><dt>Timestamp</dt><dd>'+escapeDashboardHtml(cashPaymentDate(log.createdAt))+'</dd></div><div><dt>Actor</dt><dd>'+escapeDashboardHtml(actor.name+" · "+actor.email)+'</dd></div><div><dt>Resource</dt><dd>'+escapeDashboardHtml((log.resourceType||"system")+(log.resourceId?" #"+log.resourceId:""))+'</dd></div><div><dt>IP address</dt><dd>'+escapeDashboardHtml(log.ipAddress||"Not captured")+'</dd></div><div><dt>User agent</dt><dd>'+escapeDashboardHtml(log.userAgent||"Not captured")+'</dd></div></dl><div class="log-metadata-block"><span>Metadata</span><pre>'+escapeDashboardHtml(JSON.stringify(log.metadata||{},null,2))+'</pre></div>';modal.hidden=false;document.body.style.overflow="hidden";}
  document.addEventListener("click",function(event){var detailButton=event.target.closest("[data-system-log-detail]");if(detailButton)setSystemLogModal(true,superAdminSystemLogsById[String(detailButton.getAttribute("data-system-log-detail"))]);});[document.getElementById("closeSystemLogModal"),document.getElementById("systemLogModalBackdrop")].forEach(function(b){if(b)b.addEventListener("click",function(){setSystemLogModal(false);});});var applyLogs=document.getElementById("applySystemLogFilters"),clearLogs=document.getElementById("clearSystemLogFilters"),refreshLogs=document.getElementById("refreshSystemLogs"),previousLogs=document.getElementById("systemLogPrevious"),nextLogs=document.getElementById("systemLogNext");if(applyLogs)applyLogs.addEventListener("click",function(){systemLogPage=1;loadSuperAdminSystemLogs();});if(refreshLogs)refreshLogs.addEventListener("click",loadSuperAdminSystemLogs);if(clearLogs)clearLogs.addEventListener("click",function(){if(systemLogResource)systemLogResource.value="";if(systemLogActor)systemLogActor.value="";var from=document.getElementById("systemLogFrom"),to=document.getElementById("systemLogTo");if(from)from.value="";if(to)to.value="";if(searchInput)searchInput.value="";systemLogPage=1;loadSuperAdminSystemLogs();});if(previousLogs)previousLogs.addEventListener("click",function(){if(systemLogPage>1){systemLogPage-=1;loadSuperAdminSystemLogs();}});if(nextLogs)nextLogs.addEventListener("click",function(){if(systemLogPage<systemLogPages){systemLogPage+=1;loadSuperAdminSystemLogs();}});

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

        Array.from(document.querySelectorAll("#affiliateUsersPanel, #affiliateTransactionsPanel, #affiliateCommissionsPanel, #affiliateWithdrawalsPanel")).forEach(function (panel) {
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

        Array.from(document.querySelectorAll("#nfcCardsPanel, #nfcProductsPanel, #nfcRegistryPanel, #nfcOrdersPanel")).forEach(function (panel) {
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

  if (nfcOrderForm && !nfcOrderForm.hasAttribute("data-live-nfc-order")) {
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
      resetUserFormMode();
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
      resetUserFormMode();
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
    var vcardAdminAction = event.target.closest("[data-vcard-admin-action]");

    if (vcardAdminAction && vcardAdminAction.tagName !== "INPUT") {
      var vcardAction = vcardAdminAction.getAttribute("data-vcard-admin-action");
      if (vcardAction === "delete") deleteSuperAdminVCard(vcardAdminAction.getAttribute("data-vcard-id"), vcardAdminAction);
      if (vcardAction === "assign-template") {
        if (vcardAdminForm) vcardAdminForm.reset();
        setVCardModal(true, vcardAdminAction.getAttribute("data-template-id"));
      }
    }

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

  document.addEventListener("change", function (event) {
    var statusInput = event.target.closest('input[data-vcard-admin-action="status"]');
    if (statusInput) updateSuperAdminVCardStatus(statusInput.getAttribute("data-vcard-id"), statusInput.checked, statusInput);
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

    var userActionButton = event.target.closest("[data-user-action]");
    if (userActionButton) {
      var userId = userActionButton.getAttribute("data-user-id");
      var action = userActionButton.getAttribute("data-user-action");
      if (action === "edit") openUserEditor(superAdminUsersById[String(userId)]);
      if (action === "status") changeSuperAdminUserStatus(userId, userActionButton.getAttribute("data-user-status"), userActionButton);
      if (action === "delete") deleteSuperAdminUser(userId, userActionButton);
    }
    var nfcPaymentButton=event.target.closest("[data-nfc-payment-action]");
    if(nfcPaymentButton){var nfcPaymentRow=nfcPaymentButton.closest("[data-nfc-order-id]");if(nfcPaymentRow)updateSuperAdminNfcOrder(nfcPaymentButton.getAttribute("data-nfc-order-id"),nfcPaymentRow,nfcPaymentButton.getAttribute("data-nfc-payment-action"));}
    var nfcProofButton=event.target.closest("[data-nfc-proof-id]");if(nfcProofButton)openNfcOrderProof(nfcProofButton.getAttribute("data-nfc-proof-id"),nfcProofButton);
  });

  if (addUserForm && userDirectoryBody) {
    addUserForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!addUserForm.checkValidity()) {
        setUserFormFeedback("Please complete all required user fields before saving the account.", false);
        return;
      }

      var passwordField = document.getElementById("userPassword");
      var confirmPasswordField = document.getElementById("userConfirmPassword");

      if (passwordField && confirmPasswordField && passwordField.value !== confirmPasswordField.value) {
        setUserFormFeedback("Password and confirm password must match before saving the user.", false);
        return;
      }

      var formData = new FormData(addUserForm);
      var editingUserId = String(formData.get("userId") || "").trim();
      var fullName = (formData.get("firstName").trim() + " " + formData.get("lastName").trim()).trim();
      var phone = String(formData.get("phone") || "").trim();
      var submitButton = addUserForm.querySelector('[type="submit"]');
      var token = localStorage.getItem("token");
      if (!token) {
        setUserFormFeedback("Please sign in as a super admin before creating a user.", false);
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
      }

      try {
        var response = await fetch("http://127.0.0.1:5000/api/super-admin/users" + (editingUserId ? "/" + encodeURIComponent(editingUserId) : ""), {
          method: editingUserId ? "PATCH" : "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            firstName: formData.get("firstName").trim(),
            lastName: formData.get("lastName").trim(),
            email: formData.get("email").trim(),
            password: formData.get("password"),
            phoneNumber: phone ? (String(formData.get("countryCode") || "") + " " + phone).trim() : null,
            status: String(formData.get("status") || "active").toLowerCase()
          })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.message || "Unable to create user");

        await loadSuperAdminUsers();
        showToast(editingUserId ? "User updated" : "User created", fullName + " has been saved to the database.");
        addUserForm.reset();
        resetProfilePreview();
        closeUserModal();
      } catch (error) {
        setUserFormFeedback(error.message, false);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Save";
        }
      }
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
    logoutButton.addEventListener("click", async function () {
      var token = localStorage.getItem("token");
      logoutButton.disabled = true;
      logoutButton.classList.add("is-signing-out");
      logoutButton.innerHTML = '<span class="admin-logout-spinner" aria-hidden="true"></span> Signing out...';
      try {
        if (token) {
          var response = await fetch("http://127.0.0.1:5000/api/auth/logout", {
            method: "POST",
            headers: { Authorization: "Bearer " + token }
          });
          if (!response.ok && response.status !== 401) {
            var data = await response.json().catch(function () { return {}; });
            throw new Error(data.message || "The server could not close this session");
          }
        }
      } catch (error) {
        console.error("Server logout failed:", error);
      } finally {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        sessionStorage.clear();
        window.location.replace("../auth/login.html?loggedOut=1");
      }
    });
  }

  if (periodButton && periodOptions) {
    periodButton.addEventListener("click", function () {
      periodOptions.hidden = !periodOptions.hidden;
    });
  }

  function escapeDashboardHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDashboardNumber(value) {
    return new Intl.NumberFormat("en-US").format(Number(value || 0));
  }

  function formatDashboardMoney(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  function setDashboardMetric(name, value, growth, note) {
    var card = document.querySelector('[data-dashboard-metric="' + name + '"]');
    if (!card) return;
    var valueNode = card.querySelector(":scope > strong");
    var changeNode = card.querySelector(".admin-change");
    var noteNode = card.querySelector(":scope > small");
    if (valueNode) valueNode.textContent = value;
    if (changeNode) {
      var numericGrowth = Number(growth || 0);
      changeNode.textContent = (numericGrowth > 0 ? "+" : "") + numericGrowth.toFixed(1) + "%";
      changeNode.classList.toggle("up", numericGrowth >= 0);
    }
    if (noteNode) noteNode.textContent = note;
  }

  function renderDashboardUsers(users) {
    var body = document.getElementById("dashboardRecentUsers");
    if (!body) return;
    if (!users.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="admin-data-empty"><strong>No users yet</strong><span>New database users will appear here.</span></div></td></tr>';
      return;
    }

    body.innerHTML = users.map(function (user) {
      var initials = String(user.name || user.email || "U").split(/\s+/).map(function (part) { return part.charAt(0); }).join("").slice(0, 2).toUpperCase();
      var joined = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(user.joinedAt));
      var status = String(user.status || "inactive").toLowerCase();
      return '<tr class="searchable-item" data-search="' + escapeDashboardHtml([user.name, user.email, user.plan, status].join(" ").toLowerCase()) + '">' +
        '<td><div class="table-user"><span class="mini-avatar">' + escapeDashboardHtml(initials) + '</span><div><strong>' + escapeDashboardHtml(user.name) + '</strong><div class="subtle-handle">' + escapeDashboardHtml(user.email) + '</div></div></div></td>' +
        '<td><span class="admin-plan-tag">' + escapeDashboardHtml(user.plan) + '</span></td>' +
        '<td>' + formatDashboardNumber(user.cards) + '</td>' +
        '<td>' + escapeDashboardHtml(joined) + '</td>' +
        '<td><span class="admin-status ' + (status === "active" ? "active" : "pending") + '"><i></i>' + escapeDashboardHtml(status.charAt(0).toUpperCase() + status.slice(1)) + '</span></td>' +
        '<td><a href="users.html" aria-label="Open ' + escapeDashboardHtml(user.name) + '">•••</a></td>' +
      "</tr>";
    }).join("");
  }

  function renderDashboardPlans(plans) {
    var bar = document.getElementById("dashboardPlanBar");
    var legend = document.getElementById("dashboardPlanLegend");
    if (!bar || !legend) return;
    if (!plans.length) {
      bar.innerHTML = "";
      legend.innerHTML = '<span><strong>No active subscriptions</strong><em>Create plans and subscriptions to populate this chart.</em></span>';
      return;
    }

    var classes = ["pro", "business", "enterprise"];
    bar.innerHTML = plans.slice(0, 3).map(function (plan, index) {
      return '<span class="' + classes[index] + '" style="width:' + Math.max(0, Number(plan.percentage || 0)) + '%"></span>';
    }).join("");
    legend.innerHTML = plans.slice(0, 3).map(function (plan, index) {
      return '<span><i class="' + classes[index] + '"></i><strong>' + escapeDashboardHtml(plan.name) + '</strong><em>' + formatDashboardNumber(plan.count) + ' · ' + Number(plan.percentage || 0).toFixed(1) + "%</em></span>";
    }).join("");
  }

  async function loadSuperAdminDashboard() {
    if (adminPageSlug !== "dashboard") return;
    var statusNode = document.getElementById("dashboardDataStatus");
    var token = localStorage.getItem("token");
    if (!token) {
      if (statusNode) statusNode.innerHTML = "<i></i> Sign in to load live platform data";
      return;
    }

    try {
      var response = await fetch("http://127.0.0.1:5000/api/super-admin/dashboard", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) {
        var failure = await response.json().catch(function () { return {}; });
        throw new Error(failure.message || "Unable to load dashboard data");
      }
      var data = await response.json();
      var metrics = data.metrics || {};
      var growth = metrics.growth || {};

      setDashboardMetric("revenue", formatDashboardMoney(metrics.monthlyRevenue), growth.revenue, "Revenue recorded this month");
      setDashboardMetric("users", formatDashboardNumber(metrics.totalUsers), growth.users, formatDashboardNumber(metrics.activeUsers) + " active accounts");
      setDashboardMetric("subscriptions", formatDashboardNumber(metrics.activeSubscriptions), growth.subscriptions, "Active database subscriptions");
      setDashboardMetric("cards", formatDashboardNumber(metrics.publishedCards), growth.cards, "Published database VCards");

      var revenueTotal = document.getElementById("dashboardRevenueTotal");
      var revenueGrowth = document.getElementById("dashboardRevenueGrowth");
      if (revenueTotal) revenueTotal.textContent = formatDashboardMoney(metrics.monthlyRevenue);
      if (revenueGrowth) revenueGrowth.textContent = (growth.revenue > 0 ? "+" : "") + Number(growth.revenue || 0).toFixed(1) + "%";

      var pendingNfc = document.getElementById("dashboardPendingNfc");
      var pendingPayments = document.getElementById("dashboardPendingPayments");
      var pendingTotal = document.getElementById("dashboardPendingTotal");
      if (pendingNfc) pendingNfc.textContent = formatDashboardNumber(metrics.pendingNfcOrders);
      if (pendingPayments) pendingPayments.textContent = formatDashboardNumber(metrics.pendingPayments);
      if (pendingTotal) pendingTotal.textContent = formatDashboardNumber(Number(metrics.pendingNfcOrders || 0) + Number(metrics.pendingPayments || 0)) + " total";

      renderDashboardUsers(data.recentUsers || []);
      renderDashboardPlans(data.planDistribution || []);

      if (Array.isArray(data.revenueSeries) && data.revenueSeries.length) {
        analyticsSeries["30"] = {
          label: "Last 30 Days",
          labels: data.revenueSeries.map(function (point) {
            return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(point.date));
          }),
          data: data.revenueSeries.map(function (point) { return Number(point.amount || 0); }),
        };
        buildAnalyticsChart("30");
      }

      var databaseLatency = document.getElementById("dashboardDatabaseLatency");
      if (databaseLatency) databaseLatency.textContent = formatDashboardNumber(data.system && data.system.databaseLatencyMs) + " ms";
      if (statusNode) {
        var generatedAt = new Date(data.generatedAt);
        statusNode.innerHTML = "<i></i> Live database data · updated " + generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
    } catch (error) {
      if (statusNode) statusNode.innerHTML = "<i></i> " + escapeDashboardHtml(error.message);
      console.error("Super admin dashboard:", error);
    }
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
  loadSuperAdminDashboard();
  loadSuperAdminUsers();
  loadSuperAdminVCards();
  loadSuperAdminNfc();
  loadSuperAdminSubscriptions();
  loadSuperAdminCashPayments();
  loadSuperAdminTransactions();
  loadSuperAdminPayouts();
  loadSuperAdminWithdrawals();
  loadSuperAdminAffiliations();
  loadSuperAdminCoupons();
  loadSuperAdminAnalytics();
  loadSuperAdminReports();
  loadSuperAdminSettings();
  loadSuperAdminSystemLogs();
});
