(function () {
  "use strict";
  var root = document.getElementById("publicPricingPlans");
  if (!root) return;
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>'"]/g, function (char) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]; }); }
  function apiBase() { if (location.protocol === "file:") return "http://localhost:5000"; if (location.port && location.port !== "5000") return location.protocol + "//" + location.hostname + ":5000"; return location.origin; }
  function money(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value || 0)); }
  function interval(value) { return value === "lifetime" ? "one-time" : "per " + String(value || "monthly").replace(/ly$/, ""); }
  function benefits(plan) { return [plan.vcardLimit + " digital card" + (plan.vcardLimit === 1 ? "" : "s"), plan.nfcLimit + " NFC card allowance", plan.analyticsLimit + " analytics allowance"].concat(plan.features || []); }
  function render(plan, index) {
    var modern = root.dataset.pricingVariant === "modern", featured = index === 1;
    var items = benefits(plan).map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("");
    var href = "../auth/register.html?plan=" + encodeURIComponent(plan.id);
    if (modern) return '<article class="modern-price-card' + (featured ? ' recommended' : '') + '">' + (featured ? '<div class="popular-label">Most popular</div>' : '') + '<div class="plan-top"><span class="plan-icon">' + escapeHtml(plan.name.charAt(0).toUpperCase()) + '</span><div><h3>' + escapeHtml(plan.name) + '</h3><p>' + (plan.price === 0 ? "Start free" : "Grow your account") + '</p></div></div><div class="plan-price"><strong>' + money(plan.price) + '</strong><span>' + escapeHtml(plan.price === 0 ? "Free forever" : interval(plan.billingInterval)) + '</span></div><ul>' + items + '</ul><a href="' + href + '" class="btn plan-button">' + (plan.price === 0 ? "Create free account" : "Choose plan") + ' <span>&rarr;</span></a></article>';
    return '<article class="price-card' + (featured ? ' featured' : '') + '"><h3>' + escapeHtml(plan.name) + '</h3><p>' + (plan.price === 0 ? "Start free and upgrade later" : "For growing professionals and teams") + '</p><strong>' + money(plan.price) + ' <small>' + escapeHtml(plan.price === 0 ? "free" : interval(plan.billingInterval)) + '</small></strong><ul>' + items + '</ul><a href="' + href + '" class="btn ' + (featured ? "btn-red" : "btn-outline-custom") + ' w-100">' + (plan.price === 0 ? "Get Started" : "Choose " + escapeHtml(plan.name)) + '</a></article>';
  }
  fetch(apiBase() + "/api/public/plans").then(function (response) { if (!response.ok) throw new Error(); return response.json(); }).then(function (payload) { var plans = Array.isArray(payload.data) ? payload.data : []; root.innerHTML = plans.length ? plans.map(render).join("") : '<div class="pricing-live-state">No plans are currently available.</div>'; }).catch(function () { root.innerHTML = '<div class="pricing-live-state is-error">Pricing could not be loaded. Please try again shortly.</div>'; });
})();
