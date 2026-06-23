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
    loginForm.addEventListener("submit", async (event) => {
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

      try {
        const apiBase = "http://127.0.0.1:5000";
        const res = await fetch(`${apiBase}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.value.trim(), password: password.value }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.message || "Login failed");
          return;
        }

        const data = await res.json();
        if (data.token) localStorage.setItem("token", data.token);
        if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

        const role = (data.user && data.user.role) || "user";
        let dest = "../user/dashboard.html";
        const r = String(role).toLowerCase();
        if (r.includes("company") || (r.includes("admin") && r.includes("company"))) dest = "../company-admin/dashboard.html";
        if (r === "super_admin" || r === "super-admin" || r === "superadmin" || r === "super" || r === "admin") dest = "../super-admin/dashboard.html";

        window.location.href = dest;
      } catch (err) {
        console.error(err);
        alert("Unable to contact server on http://127.0.0.1:5000. Please ensure the backend is running.");
      }
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
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const firstName = document.getElementById("firstName");
      const lastName = document.getElementById("lastName");
      const email = document.getElementById("registerEmail");
      const password = document.getElementById("registerPassword");
      const passwordConfirm = document.getElementById("confirmPassword");
      const phoneNumber = document.getElementById("phoneNumber");
      const companyName = document.getElementById("companyName");

      if (!firstName || !lastName || !email || !password) {
        alert("Please fill required fields.");
        return;
      }

      if (password && passwordConfirm && password.value !== passwordConfirm.value) {
        alert("Passwords do not match.");
        return;
      }

      const payload = {
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        email: email.value.trim(),
        password: password.value,
        phoneNumber: phoneNumber ? phoneNumber.value.trim() : undefined,
        companyName: companyName ? companyName.value.trim() : undefined,
      };

      try {
        const apiBase = `${window.location.protocol}//${window.location.hostname}:5000`;
        const res = await fetch(`${apiBase}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.token) localStorage.setItem("token", data.token);
          window.location.href = "../user/dashboard.html";
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.message || "Registration failed. Please try again.");
        }
      } catch (err) {
        console.error(err);
        alert("Unable to contact server. Please try again later.");
      }
    });
  }
});
