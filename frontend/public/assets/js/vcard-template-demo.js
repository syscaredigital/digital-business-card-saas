(function () {
  "use strict";
  if (new URLSearchParams(window.location.search).get("id") || !window.SyncVCardFeatures) return;

  document.querySelectorAll(".industry-card .industry-showcase,.industry-card .industry-hours").forEach(function (section) { section.remove(); });
  var demoHeadings = /expertise|services|programs|projects|listings|pricing|packages|clients say|testimonial|business hours|areas? of impact|property highlights|engagement packages/i;
  document.querySelectorAll(".section-title h2").forEach(function (heading) {
    if (demoHeadings.test(heading.textContent || "")) {
      var section = heading.closest("section");
      if (section) section.remove();
    }
  });

  var categoryNode = document.querySelector("[data-industry-label]");
  var category = categoryNode ? categoryNode.textContent.trim() : (document.title.split("-")[0].trim() || "Professional");
  var destination = window.location.protocol === "file:" ? "https://syncecard.com/template-preview" : window.location.href.split("#")[0];
  var sections = {
    "social-links": "LinkedIn | https://www.linkedin.com\nInstagram | https://www.instagram.com\nFacebook | https://www.facebook.com\nYouTube | https://www.youtube.com",
    services: "Professional consultation | Personal guidance designed around your goals\nProject support | Reliable help from planning through delivery\nPriority service | Direct communication and responsive support",
    products: "Signature package | $120 | A complete " + category + " starter package | https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=700&q=80\nPremium package | $240 | Extended support with priority access | https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=700&q=80",
    galleries: "Recent project | https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80\nBehind the scenes | https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80\nClient experience | https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80",
    blogs: "How to choose the right professional | Practical questions to ask before you begin | https://example.com/insights/choose-a-professional\nA better way to plan your next project | Five useful steps for a confident result | https://example.com/insights/project-planning",
    testimonials: "Professional, thoughtful, and easy to work with from the first conversation. | Maya Fernando | Client\nThe process was clear and the final result exceeded our expectations. | Daniel Perera | Business owner",
    "qrcode-customize": destination
  };
  var rendered = window.SyncVCardFeatures.renderAll(sections);
  rendered.classList.add("vfeature-template-demo");
  var shell = document.querySelector(".vcard-shell") || document.body;
  var before = shell.querySelector("#message,.message-panel,.action-grid");
  shell.insertBefore(rendered, before || null);
}());
