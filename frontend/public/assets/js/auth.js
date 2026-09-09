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
        const apiBase = window.SyncVCardApiOrigin;
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
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
          if (data.user.preferredCurrency) localStorage.setItem("preferredCurrency", data.user.preferredCurrency);
        }

        const role = (data.user && data.user.role) || "user";
        let dest = "../user/dashboard.html";
        const r = String(role).toLowerCase();
        if (r.includes("company") || (r.includes("admin") && r.includes("company"))) dest = "../company-admin/dashboard.html";
        if (r === "super_admin" || r === "super-admin" || r === "superadmin" || r === "super" || r === "admin") dest = "../super-admin/dashboard.html";

        window.location.href = dest;
      } catch (err) {
        console.error(err);
        alert("Unable to contact the server. Please try again.");
      }
    });
  }

  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.getElementById("forgotEmail");

      if (!email || !emailPattern.test(email.value.trim())) {
        alert("Please enter a valid email address.");
        return;
      }

      const button = forgotPasswordForm.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      try {
        const response = await fetch(window.SyncVCardApiOrigin + "/api/auth/forgot-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.value.trim() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to request password recovery.");
        alert(data.message);
        forgotPasswordForm.reset();
      } catch (error) { alert(error.message || "Unable to contact the server."); }
      finally { if (button) button.disabled = false; }
    });
  }

  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const resetToken = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
  if (resetToken) window.history.replaceState(null, "", window.location.pathname + window.location.search);
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
    resetPasswordForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!newPassword || !confirmPassword || newPassword.value !== confirmPassword.value) {
        alert("Passwords do not match.");
        return;
      }

      if (!resetToken) { alert("Open the reset link from your email, or request a new link."); return; }
      if (newPassword.value.length < 12 || new TextEncoder().encode(newPassword.value).length > 72) {
        alert("Use at least 12 characters and no more than 72 bytes for your password."); return;
      }
      const button = resetPasswordForm.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      try {
        const response = await fetch(window.SyncVCardApiOrigin + "/api/auth/reset-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, password: newPassword.value }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to reset password.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        alert(data.message);
        window.location.replace("login.html");
      } catch (error) { alert(error.message || "Unable to contact the server."); }
      finally { if (button) button.disabled = false; }
    });
  }

  const registerForm = document.getElementById("registerForm");
  const registerPasswordInput = document.getElementById("registerPassword");
  const registerStrength = document.querySelector(".register-v2-strength");
  const registerStrengthText = document.getElementById("registerStrengthText");

  const updateRegisterStrength = () => {
    if (!registerPasswordInput || !registerStrength || !registerStrengthText) return;

    const value = registerPasswordInput.value;
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;

    registerStrength.dataset.score = String(score);
    if (!value) registerStrengthText.textContent = "Use 8+ characters, a number, and a symbol";
    else if (score <= 1) registerStrengthText.textContent = "Weak — add more character variety";
    else if (score === 2) registerStrengthText.textContent = "Fair — add a number or symbol";
    else if (score === 3) registerStrengthText.textContent = "Strong password";
    else registerStrengthText.textContent = "Excellent password";
  };

  if (registerPasswordInput) {
    registerPasswordInput.addEventListener("input", updateRegisterStrength);
    updateRegisterStrength();
  }

  if (registerForm) {
    const referralCode = new URLSearchParams(window.location.search).get("ref") || sessionStorage.getItem("affiliate_referral_code") || "";
    const requestedPlan = new URLSearchParams(window.location.search).get("plan") || "";
    const requestedCurrency = String(new URLSearchParams(window.location.search).get("currency") || localStorage.getItem("preferredCurrency") || "LKR").toUpperCase();
    const registerCurrency = document.getElementById("registerCurrency");
    if (registerCurrency && /^[A-Z]{3}$/.test(requestedCurrency)) {
      registerCurrency.value = requestedCurrency;
      window.addEventListener("sync:currencies-ready", function () { registerCurrency.value = requestedCurrency; }, { once: true });
    }
    if (registerCurrency) registerCurrency.addEventListener("change", function () { localStorage.setItem("preferredCurrency", registerCurrency.value); });
    if (referralCode) sessionStorage.setItem("affiliate_referral_code", referralCode);
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const firstName = document.getElementById("firstName");
      const lastName = document.getElementById("lastName");
      const email = document.getElementById("registerEmail");
      const password = document.getElementById("registerPassword");
      const passwordConfirm = document.getElementById("confirmPassword");
      const phoneNumber = document.getElementById("phoneNumber");
      const companyName = document.getElementById("companyName");
      const terms = document.getElementById("registerTerms");

      if (!firstName || !lastName || !email || !password) {
        alert("Please fill required fields.");
        return;
      }

      if (!emailPattern.test(email.value.trim())) {
        alert("Please enter a valid email address.");
        return;
      }

      if (password.value.length < 8) {
        alert("Your password must contain at least 8 characters.");
        return;
      }

      if (password && passwordConfirm && password.value !== passwordConfirm.value) {
        alert("Passwords do not match.");
        return;
      }

      if (terms && !terms.checked) {
        alert("Please agree to the Terms of Service and Privacy Policy.");
        return;
      }

      const payload = {
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        email: email.value.trim(),
        password: password.value,
        phoneNumber: phoneNumber ? phoneNumber.value.trim() : undefined,
        companyName: companyName ? companyName.value.trim() : undefined,
        currency: registerCurrency ? registerCurrency.value : "LKR",
        referralCode: referralCode || undefined,
      };

      try {
        const apiBase = window.SyncVCardApiOrigin;
        const res = await fetch(`${apiBase}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.requiresReview) {
            localStorage.removeItem("token");
            alert(data.message || "Your account is waiting for administrator approval.");
            window.location.href = "login.html?review=pending";
            return;
          }
          if (data.token) localStorage.setItem("token", data.token);
          if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("preferredCurrency", payload.currency);
          sessionStorage.removeItem("affiliate_referral_code");
          window.location.href = requestedPlan
            ? "../user/payments.html?plan=" + encodeURIComponent(requestedPlan)
            : "../user/dashboard.html";
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
