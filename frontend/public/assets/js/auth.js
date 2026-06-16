document.addEventListener("DOMContentLoaded", () => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const loginScreen = document.querySelector(".login-screen");

  const languageToggle = document.querySelector(".login-language-toggle");
  const languageMenu = document.getElementById("loginLanguageMenu");
  const languageOptions = document.querySelectorAll(".login-language-option");

  if (languageToggle && languageMenu) {
    languageToggle.addEventListener("click", () => {
      const isOpen = languageToggle.getAttribute("aria-expanded") === "true";
      languageToggle.setAttribute("aria-expanded", String(!isOpen));
      languageMenu.hidden = isOpen;
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".login-language")) {
        languageToggle.setAttribute("aria-expanded", "false");
        languageMenu.hidden = true;
      }
    });
  }

  languageOptions.forEach((option) => {
    option.addEventListener("click", () => {
      languageOptions.forEach((item) => item.classList.remove("active"));
      option.classList.add("active");
      if (languageToggle) {
        const label = languageToggle.querySelector("span:nth-child(2)");
        if (label) label.textContent = option.dataset.lang || option.textContent.trim();
        languageToggle.setAttribute("aria-expanded", "false");
      }
      if (languageMenu) languageMenu.hidden = true;
    });
  });

  const themeToggle = document.querySelector(".login-theme-toggle");
  if (themeToggle && loginScreen) {
    themeToggle.addEventListener("click", () => {
      loginScreen.classList.toggle("login-theme-alt");
    });
  }

  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      const label = button.querySelector(".toggle-password-label");
      if (label) {
        label.textContent = isPassword ? "hide" : "show";
      } else {
        button.textContent = isPassword ? "hide" : "show";
      }
      button.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    });
  });

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = document.getElementById("loginEmail");
      const password = document.getElementById("passwordInput");

      if (email && !emailPattern.test(email.value.trim())) {
        alert("Please enter a valid email address.");
        return;
      }

      if (password && !password.value.trim()) {
        alert("Please enter your password.");
        return;
      }

      window.location.href = "../company-admin/dashboard.html";
    });
  }

  document.querySelectorAll(".login-social-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.dataset.provider || "social";
      alert(`${provider} sign-in is coming soon.`);
    });
  });

  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = document.getElementById("forgotEmail");

      if (!email || !emailPattern.test(email.value.trim())) {
        alert("Please enter a valid email address.");
        return;
      }

      alert("Password reset link sent successfully.");
      forgotPasswordForm.reset();
    });
  }

  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const newPassword = document.getElementById("newPassword");
  const confirmPassword = document.getElementById("confirmPassword");
  const strengthText = document.getElementById("strengthText");
  const strengthBars = document.querySelectorAll(".strength-bar span");

  const updateStrength = () => {
    if (!newPassword || !strengthText || !strengthBars.length) return;

    const value = newPassword.value;
    let score = 0;

    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    if (value.length >= 12) score += 1;

    strengthBars.forEach((bar, index) => {
      bar.style.opacity = index < Math.max(score, 1) ? "1" : "0.18";
    });

    if (score <= 2) {
      strengthText.textContent = "Weak";
      strengthText.style.color = "#ff3442";
    } else if (score <= 4) {
      strengthText.textContent = "Strong";
      strengthText.style.color = "#ffd166";
    } else {
      strengthText.textContent = "Very Strong";
      strengthText.style.color = "#31f196";
    }
  };

  if (newPassword) {
    newPassword.addEventListener("input", updateStrength);
    updateStrength();
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!newPassword || !confirmPassword || newPassword.value !== confirmPassword.value) {
        alert("Passwords do not match.");
        return;
      }

      alert("Password reset successfully.");
      resetPasswordForm.reset();
      updateStrength();
    });
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const password = document.getElementById("registerPassword");
      const passwordConfirm = document.getElementById("confirmPassword");

      if (password && passwordConfirm && password.value !== passwordConfirm.value) {
        alert("Passwords do not match.");
        return;
      }

      alert("Account created successfully.");
    });
  }
});
