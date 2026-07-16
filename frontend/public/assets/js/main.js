document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".site-header");
  const contactForms = document.querySelectorAll(".contact-form, .newsletter-form");
  const counters = document.querySelectorAll(".count-up");
  const featuredVcardsRow = document.querySelector("[data-featured-templates]");
  const templatePreviousButton = document.querySelector("[data-template-prev]");
  const templateNextButton = document.querySelector("[data-template-next]");
  const templateCount = document.querySelector("[data-template-count]");
  const templateProgress = document.querySelector(".gallery-progress span");
  const publicTemplateGrid = document.querySelector("[data-public-template-grid]");
  const publicTemplateFilters = document.querySelector("[data-template-filters]");

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
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      alert("Thank you. We will get back to you shortly.");
      form.reset();
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
    if (window.location.protocol === "file:") return "http://localhost:5000";
    if (window.location.port && window.location.port !== "5000") return "http://localhost:5000";
    return window.location.origin;
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
    {
      name: "Corporate & Business",
      description: "Executive and professional template",
      previewUrl: "../public-vcard/industry-template.html?category=corporate-business",
    },
    {
      name: "Creative & Media",
      description: "Portfolio-focused creative template",
      previewUrl: "../public-vcard/industry-template.html?category=creative-media",
    },
    {
      name: "Technology & IT",
      description: "Modern technology professional template",
      previewUrl: "../public-vcard/industry-template.html?category=technology-it",
    },
  ]);

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

  loadFeaturedVcards();
});
