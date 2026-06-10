document.addEventListener("DOMContentLoaded", () => {
  console.log("Sync Card Home Page Loaded");

  const header = document.querySelector(".site-header");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      header.classList.add("header-scrolled");
    } else {
      header.classList.remove("header-scrolled");
    }
  });

  const contactForm = document.querySelector(".contact-section form");

  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      alert("Thank you! Your message has been submitted.");
      contactForm.reset();
    });
  }
});