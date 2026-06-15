document.addEventListener("DOMContentLoaded", () => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.textContent = isPassword ? "hide" : "show";
      button.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    });
  });

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = document.getElementById("loginEmail");

      if (email && !emailPattern.test(email.value.trim())) {
        alert("Please enter a valid email address.");
        return;
      }

      alert("Login submitted successfully.");
    });
  }

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
