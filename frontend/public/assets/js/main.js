document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".site-header");
  const contactForms = document.querySelectorAll(".contact-form");
  const newsletterForms = document.querySelectorAll(".newsletter-form");
  const counters = document.querySelectorAll(".count-up");
  const featuredVcardsRow = document.querySelector("[data-featured-templates]");
  const templatePreviousButton = document.querySelector("[data-template-prev]");
  const templateNextButton = document.querySelector("[data-template-next]");
  const templateCount = document.querySelector("[data-template-count]");
  const templateProgress = document.querySelector(".gallery-progress span");
  const publicTemplateGrid = document.querySelector("[data-public-template-grid]");
  const publicTemplateFilters = document.querySelector("[data-template-filters]");

  let websiteCurrency = String(localStorage.getItem("preferredCurrency") || "LKR").toUpperCase();
  if (!/^[A-Z]{3}$/.test(websiteCurrency)) websiteCurrency = "LKR";
  const navActions = document.querySelector(".nav-actions");
  if (navActions) {
    const currencyWrap = document.createElement("label");
    currencyWrap.className = "website-currency-switcher";
    currencyWrap.setAttribute("aria-label", "Billing currency");
    currencyWrap.innerHTML = '<span>Currency</span><select><option value="LKR">LKR</option></select>';
    const select = currencyWrap.querySelector("select");
    select.value = websiteCurrency;
    const currencyApiOrigin = window.SyncVCardApiOrigin;
    fetch(currencyApiOrigin + "/api/public/currencies").then((response) => response.ok ? response.json() : Promise.reject()).then((payload) => {
      const currencies = Array.isArray(payload.data) ? payload.data : [];
      if (!currencies.length) return;
      select.innerHTML = currencies.map((item) => '<option value="' + item.code + '">' + item.code + ' — ' + item.name + '</option>').join("");
      select.value = currencies.some((item) => item.code === websiteCurrency) ? websiteCurrency : "LKR";
    }).catch(() => {});
    navActions.prepend(currencyWrap);
    select.addEventListener("change", () => {
      websiteCurrency = select.value;
      localStorage.setItem("preferredCurrency", websiteCurrency);
      document.querySelectorAll('a[href*="../auth/register.html"],a[href*="auth/register.html"]').forEach((link) => {
        const target = new URL(link.href, window.location.href);
        target.searchParams.set("currency", websiteCurrency);
        link.href = target.href;
      });
      window.dispatchEvent(new CustomEvent("sync:currency-change", { detail: { currency: websiteCurrency } }));
      const token = localStorage.getItem("token");
      if (token) {
        const apiOrigin = window.SyncVCardApiOrigin;
        fetch(apiOrigin + "/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ currency: websiteCurrency }),
        }).catch(() => {});
      }
    });
  }
  document.querySelectorAll('a[href*="../auth/register.html"],a[href*="auth/register.html"]').forEach((link) => {
    const target = new URL(link.href, window.location.href);
    target.searchParams.set("currency", websiteCurrency);
    link.href = target.href;
  });

  const updateHeader = () => {
    if (!header) return;
    header.classList.toggle("header-scrolled", window.scrollY > 40);
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader);

  document.querySelectorAll(".navbar-collapse .nav-link, .navbar-collapse .dropdown-item").forEach((link) => {
    link.addEventListener("click", () => {
      const menu = document.querySelector(".navbar-collapse.show");
      if (!menu || typeof bootstrap === "undefined") return;
      bootstrap.Collapse.getOrCreateInstance(menu).hide();
    });
  });

  contactForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const button = form.querySelector('[type="submit"]');
      let feedback = form.querySelector(".contact-form-feedback");
      if (!feedback) {
        feedback = document.createElement("p");
        feedback.className = "contact-form-feedback";
        feedback.setAttribute("aria-live", "polite");
        form.appendChild(feedback);
      }
      const originalLabel = button ? button.innerHTML : "";
      const fields = new FormData(form);
      const payload = Object.fromEntries(fields.entries());
      payload.sourcePage = window.location.pathname || window.location.href;
      try {
        if (button) { button.disabled = true; button.textContent = "Sending..."; }
        feedback.className = "contact-form-feedback is-pending";
        feedback.textContent = "Sending your message securely...";
        const response = await fetch(getApiBaseUrl() + "/api/public/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to send your message");
        feedback.className = "contact-form-feedback is-success";
        feedback.textContent = data.message || "Thank you. Your message was sent successfully.";
        form.reset();
      } catch (error) {
        feedback.className = "contact-form-feedback is-error";
        feedback.textContent = error.message;
      } finally {
        if (button) { button.disabled = false; button.innerHTML = originalLabel; }
      }
    });
  });

  newsletterForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      alert("Newsletter subscriptions are coming soon.");
    });
  });

  const animateCounter = (counter) => {
    if (counter.dataset.counted === "true") return;

    const target = Number(counter.dataset.count || 0);
    const suffix = counter.dataset.suffix || "";
    const duration = 1400;
    const startTime = performance.now();

    counter.dataset.counted = "true";
    counter.classList.add("is-counting");

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * easedProgress);

      counter.textContent = `${value}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(tick);
        return;
      }

      counter.textContent = `${target}${suffix}`;
      counter.classList.remove("is-counting");
      counter.classList.add("has-counted");
    };

    requestAnimationFrame(tick);
  };

  if (counters.length) {
    if ("IntersectionObserver" in window) {
      const counterObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.55 });

      counters.forEach((counter) => counterObserver.observe(counter));
    } else {
      counters.forEach(animateCounter);
    }
  }

  const getApiBaseUrl = () => {
    return window.SyncVCardApiOrigin;
  };

  const getInitials = (name) => {
    return String(name || "VC")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "VC";
  };

  const getTemplateClass = (index) => {
    return ["red-template", "light-template", "blue-template active", "violet-template", "light-template", "teal-template"][index % 6];
  };

  const escapeMarkup = (value) => String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const safePreviewUrl = (value) => {
    try { const url = new URL(String(value || ""), window.location.href); return /^(https?:|file:)$/.test(url.protocol) ? url.href : ""; }
    catch (_) { return ""; }
  };
  const templateGroup = (template) => {
    const value = `${template.name || ""} ${template.description || ""}`.toLowerCase();
    if (/creative|media|event|entertainment/.test(value)) return "creative";
    if (/technology|\bit\b|automotive|construction|engineering/.test(value)) return "technology";
    if (/health|wellness|hospitality|food|personal|lifestyle|travel|tourism|sustainability/.test(value)) return "lifestyle";
    if (/finance|legal|education|training|real estate|property/.test(value)) return "services";
    return "business";
  };
  const renderPublicTemplates = (templates, filter = "all") => {
    if (!publicTemplateGrid) return;
    const visible = templates.filter((template) => filter === "all" || templateGroup(template) === filter);
    publicTemplateGrid.innerHTML = visible.length ? visible.map((template) => {
      const preview = safePreviewUrl(template.previewUrl);
      const category = template.config && template.config.category || "VCard design";
      return `<article class="industry-template-tile" data-template-group="${templateGroup(template)}"><div class="industry-template-frame">${preview ? `<iframe src="${escapeMarkup(preview)}" title="${escapeMarkup(template.name)} preview" loading="lazy" tabindex="-1"></iframe>` : ""}</div><div class="industry-template-info"><span>${escapeMarkup(category)}</span><h3>${escapeMarkup(template.name)}</h3><p>${escapeMarkup(template.description || "Modern digital business card template.")}</p><a href="${escapeMarkup(preview || "../auth/register.html")}" target="${preview ? "_blank" : "_self"}" rel="noopener noreferrer">Preview design <b>↗</b></a></div></article>`;
    }).join("") : '<div class="template-catalog-state">No templates found in this category.</div>';
  };

  if (publicTemplateGrid) {
    fetch(`${getApiBaseUrl()}/api/public/vcard-templates`)
      .then((response) => { if (!response.ok) throw new Error("Unable to load templates"); return response.json(); })
      .then((data) => {
        const templates = data.data || [];
        renderPublicTemplates(templates);
        if (publicTemplateFilters) publicTemplateFilters.addEventListener("click", (event) => {
          const button = event.target.closest("[data-template-filter]");
          if (!button) return;
          publicTemplateFilters.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
          renderPublicTemplates(templates, button.dataset.templateFilter);
        });
      })
      .catch(() => { publicTemplateGrid.innerHTML = '<div class="template-catalog-state">Templates will appear when the API is available.</div>'; });
  }

  const getStaticFeaturedVcards = () => ([
    ["Style Boutique", "Fashion and retail profile", "final-01-boutique.html"],
    ["Creative Studio", "Designer and media portfolio", "final-02-creative.html"],
    ["Technology Expert", "Technology professional profile", "final-03-technology.html"],
    ["Medical Professional", "Healthcare professional profile", "final-04-medical.html"],
    ["Legal Counsel", "Legal practice and counsel profile", "final-05-legal.html"],
    ["Event Planner", "Events and wedding planner profile", "final-06-events.html"],
    ["Real Estate Professional", "Property and real estate profile", "final-07-property.html"],
    ["Corporate Trainer", "Training and coaching profile", "final-08-trainer.html"],
    ["Automotive Showroom", "Vehicle sales and showroom profile", "final-09-automotive.html"],
    ["Corporate Executive", "Executive and business profile", "final-10-corporate.html"],
  ].map(([name, description, file]) => ({ name, description, previewUrl: `../public-vcard/${file}` })));

  const createVcardPreview = (card, index) => {
    const article = document.createElement("article");
    article.className = `vcard-template ${getTemplateClass(index)}`;

    const previewUrl = card.previewUrl || card.preview_url || "";
    if (previewUrl) {
      article.className = "vcard-template vcard-live-preview";

      const frame = document.createElement("iframe");
      frame.src = previewUrl;
      frame.title = `${card.title || card.name || "VCard"} preview`;
      frame.loading = "lazy";
      frame.tabIndex = -1;

      article.appendChild(frame);
    } else {
      const avatar = document.createElement("div");
      avatar.className = `avatar ${index % 2 === 0 ? "avatar-man" : "avatar-woman"}`;

      if (card.avatar_url) {
        const image = document.createElement("img");
        image.src = card.avatar_url;
        image.alt = "";
        avatar.appendChild(image);
      } else {
        avatar.textContent = getInitials(card.name);
      }

      const title = document.createElement("h3");
      title.textContent = card.name || "Untitled VCard";

      const meta = document.createElement("p");
      const role = card.title || "Digital Business Card";
      const company = card.company || card.description || "Independent Professional";
      meta.append(document.createTextNode(role));
      meta.append(document.createElement("br"));
      meta.append(document.createTextNode(company));

      const icons = document.createElement("div");
      icons.className = "vcard-icons";
      for (let i = 0; i < 4; i += 1) {
        icons.appendChild(document.createElement("span"));
      }

      article.append(avatar, title, meta, icons);
    }

    if (previewUrl) {
      article.dataset.url = previewUrl;
      article.addEventListener("click", () => {
        window.open(previewUrl, "_blank", "noopener,noreferrer");
      });
    }

    return article;
  };

  const scrollTemplates = (direction) => {
    if (!featuredVcardsRow) return;
    const card = featuredVcardsRow.querySelector(".vcard-template");
    const distance = card ? card.getBoundingClientRect().width + 20 : featuredVcardsRow.clientWidth * 0.8;
    featuredVcardsRow.scrollBy({ left: distance * direction, behavior: "smooth" });
  };

  templatePreviousButton?.addEventListener("click", () => scrollTemplates(-1));
  templateNextButton?.addEventListener("click", () => scrollTemplates(1));

  const updateTemplateProgress = () => {
    if (!featuredVcardsRow || !templateProgress) return;
    const availableScroll = featuredVcardsRow.scrollWidth - featuredVcardsRow.clientWidth;
    const progress = availableScroll > 0 ? featuredVcardsRow.scrollLeft / availableScroll : 1;
    templateProgress.style.width = `${Math.max(18, 18 + progress * 82)}%`;
  };

  featuredVcardsRow?.addEventListener("scroll", updateTemplateProgress, { passive: true });

  const loadFeaturedVcards = async () => {
    if (!featuredVcardsRow) return;

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/public/vcard-templates`);
      if (!response.ok) return;

      const payload = await response.json();
      const cards = Array.isArray(payload.data) && payload.data.length ? payload.data : getStaticFeaturedVcards();

      featuredVcardsRow.replaceChildren(...cards.map(createVcardPreview));
      featuredVcardsRow.classList.add("is-loaded");
      if (templateCount) templateCount.textContent = `${cards.length}+`;
      requestAnimationFrame(updateTemplateProgress);
    } catch (error) {
      const cards = getStaticFeaturedVcards();
      featuredVcardsRow.replaceChildren(...cards.map(createVcardPreview));
      featuredVcardsRow.classList.add("is-loaded");
      if (templateCount) templateCount.textContent = `${cards.length}+`;
      requestAnimationFrame(updateTemplateProgress);
    }
  };

  const autoScrollPreview = (frame, index) => {
    if (frame.dataset.autoScrollReady === "true") return;
    frame.dataset.autoScrollReady = "true";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let direction = 1;
    let previousTime = 0;
    let pauseUntil = performance.now() + 1200 + index * 180;
    let pausedByHover = false;
    const panel = frame.closest(".vcard-template, .industry-template-frame");

    panel?.addEventListener("mouseenter", () => { pausedByHover = true; });
    panel?.addEventListener("mouseleave", () => { pausedByHover = false; });
    frame.addEventListener("load", () => {
      direction = 1;
      previousTime = 0;
      pauseUntil = performance.now() + 1400 + index * 180;
      try { frame.contentWindow.scrollTo(0, 0); } catch (_) {}
    });

    const animate = (time) => {
      if (!frame.isConnected) return;
      const rect = frame.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
      if (!document.hidden && visible && !pausedByHover && !reduceMotion.matches && time >= pauseUntil) {
        try {
          const documentRoot = frame.contentDocument && frame.contentDocument.scrollingElement;
          if (documentRoot) {
            const maxScroll = Math.max(0, documentRoot.scrollHeight - documentRoot.clientHeight);
            const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
            if (maxScroll > 8 && elapsed) {
              documentRoot.scrollTop += direction * elapsed * 0.055;
              if (documentRoot.scrollTop >= maxScroll - 2) {
                documentRoot.scrollTop = maxScroll;
                direction = -1;
                pauseUntil = time + 1600;
              } else if (documentRoot.scrollTop <= 2 && direction < 0) {
                documentRoot.scrollTop = 0;
                direction = 1;
                pauseUntil = time + 1600;
              }
            }
          }
        } catch (_) {
          // A remotely hosted preview cannot be controlled by the parent page.
        }
      }
      previousTime = time;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  };

  const connectPreviewAutoScroll = (root = document) => {
    root.querySelectorAll?.(".vcard-live-preview iframe, .industry-template-frame iframe").forEach((frame, index) => autoScrollPreview(frame, index));
  };

  connectPreviewAutoScroll();
  new MutationObserver(() => connectPreviewAutoScroll()).observe(document.body, { childList: true, subtree: true });

  loadFeaturedVcards();
});
