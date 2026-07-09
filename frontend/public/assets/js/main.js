document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".site-header");
  const contactForms = document.querySelectorAll(".contact-form, .newsletter-form");
  const counters = document.querySelectorAll(".count-up");
  const featuredVcardsRow = document.querySelector("[data-featured-vcards]");

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

  const getStaticFeaturedVcards = () => ([
    {
      name: "Michael Carter",
      title: "Retail & E-Commerce Consultant",
      company: "Carter & Morgan Retail Solutions",
      website_url: "../public-vcard/template-one.html",
      preview_url: "../public-vcard/template-one.html",
    },
    {
      name: "Michael Carter",
      title: "Real Estate Consultant",
      company: "Carter & Morgan Realty",
      website_url: "../public-vcard/template-two.html",
      preview_url: "../public-vcard/template-two.html",
    },
    {
      name: "Michael Carter",
      title: "Healthcare & Wellness Consultant",
      company: "Carter & Morgan Health Solutions",
      website_url: "../public-vcard/template-three.html",
      preview_url: "../public-vcard/template-three.html",
    },
  ]);

  const createVcardPreview = (card, index) => {
    const article = document.createElement("article");
    article.className = `vcard-template ${getTemplateClass(index)}`;

    if (card.preview_url) {
      article.className = "vcard-template vcard-live-preview";

      const frame = document.createElement("iframe");
      frame.src = card.preview_url;
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

    if (card.website_url) {
      article.dataset.url = card.website_url;
      article.addEventListener("click", () => {
        window.open(card.website_url, "_blank", "noopener,noreferrer");
      });
    }

    return article;
  };

  const loadFeaturedVcards = async () => {
    if (!featuredVcardsRow) return;

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/public/vcards/featured?limit=6`);
      if (!response.ok) return;

      const payload = await response.json();
      const cards = Array.isArray(payload.data) && payload.data.length ? payload.data : getStaticFeaturedVcards();

      featuredVcardsRow.replaceChildren(...cards.map(createVcardPreview));
      featuredVcardsRow.classList.add("is-loaded");
    } catch (error) {
      featuredVcardsRow.replaceChildren(...getStaticFeaturedVcards().map(createVcardPreview));
      featuredVcardsRow.classList.add("is-loaded");
    }
  };

  loadFeaturedVcards();
});
