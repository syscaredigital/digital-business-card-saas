const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authenticate = require("../middlewares/auth.middleware");
const recovery = require("../controllers/password-recovery.controller");
const recoveryRateLimit = require("../middlewares/recovery-rate-limit.middleware");
const { validateRegistration, validateLogin } = require('../middlewares/auth-validation.middleware');
const rateLimit = require('../middlewares/rate-limit.middleware');

router.post("/register", rateLimit({ limit: 10 }), validateRegistration, authController.register);
router.post("/login", rateLimit(), validateLogin, authController.login);
router.post("/logout", authenticate, authController.logout);
router.post("/forgot-password", recoveryRateLimit, recovery.forgotPassword);
router.post("/reset-password", recoveryRateLimit, recovery.resetPassword);

module.exports = router;
