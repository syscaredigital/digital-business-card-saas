document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("passwordInput");
  const togglePassword = document.getElementById("togglePassword");

  if (togglePassword) {
    togglePassword.addEventListener("click", () => {
      passwordInput.type =
        passwordInput.type === "password" ? "text" : "password";
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      alert("Login submitted successfully!");

      // Later connect this to:
      // POST /api/auth/login
    });
  }
});


/*Registerpage*/
document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const password = document.getElementById("registerPassword");
  const confirmPassword = document.getElementById("confirmPassword");
  const togglePassword = document.getElementById("toggleRegisterPassword");

  if (togglePassword) {
    togglePassword.addEventListener("click", () => {
      password.type = password.type === "password" ? "text" : "password";
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (password.value !== confirmPassword.value) {
        alert("Passwords do not match!");
        return;
      }

      alert("Account created successfully!");

      // Later connect to:
      // POST /api/auth/register
    });
  }
});

/*Fogetpasswordpage*/
document.addEventListener("DOMContentLoaded", () => {
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const email = document.getElementById("forgotEmail").value.trim();

      if (!email) {
        alert("Please enter your email address.");
        return;
      }

      if (!validateEmail(email)) {
        alert("Please enter a valid email address.");
        return;
      }

      alert("Password reset link sent successfully!");

      forgotPasswordForm.reset();

      // Later:
      // POST /api/auth/forgot-password
    });
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
});

/*ResetPasswordpage*/
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("resetPasswordForm");
  const password = document.getElementById("newPassword");
  const confirmPassword = document.getElementById("confirmPassword");
  const strengthText = document.getElementById("strengthText");
  const bars = document.querySelectorAll(".strength-bar span");
  const toggles = document.querySelectorAll(".toggle-password");

  toggles.forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);

      input.type = input.type === "password" ? "text" : "password";
      btn.textContent = input.type === "password" ? "👁" : "🙈";
    });
  });

  password.addEventListener("input", () => {
    const value = password.value;
    let score = 0;

    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    if (value.length >= 12) score++;

    bars.forEach((bar, index) => {
      bar.style.opacity = index < score ? "1" : "0.18";
    });

    if (score <= 2) {
      strengthText.textContent = "Weak";
      strengthText.style.color = "#ff313d";
    } else if (score <= 4) {
      strengthText.textContent = "Strong";
      strengthText.style.color = "#ffc857";
    } else {
      strengthText.textContent = "Very Strong";
      strengthText.style.color = "#2cff91";
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (password.value !== confirmPassword.value) {
      alert("Passwords do not match.");
      return;
    }

    alert("Password reset successfully!");
    form.reset();
  });
});