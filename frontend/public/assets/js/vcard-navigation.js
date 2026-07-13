(function () {
  if (window.self !== window.top) {
    document.documentElement.classList.add("vcard-embedded");
    return;
  }

  var menuButton = document.querySelector("[data-vcard-menu]");
  var menuPanel = document.querySelector("[data-vcard-menu-panel]");

  if (menuButton && menuPanel) {
    menuButton.addEventListener("click", function () {
      var isOpen = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!isOpen));
      menuPanel.classList.toggle("is-open", !isOpen);
    });

    menuPanel.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        menuButton.setAttribute("aria-expanded", "false");
        menuPanel.classList.remove("is-open");
      });
    });
  }
}());
