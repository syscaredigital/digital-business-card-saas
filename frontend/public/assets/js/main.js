document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".site-header");
  const contactForms = document.querySelectorAll(".contact-form, .newsletter-form");

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
});
