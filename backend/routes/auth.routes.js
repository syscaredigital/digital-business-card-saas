const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authenticate = require("../middlewares/auth.middleware");
const recovery = require("../controllers/password-recovery.controller");
const recoveryRateLimit = require("../middlewares/recovery-rate-limit.middleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authenticate, authController.logout);
router.post("/forgot-password", recoveryRateLimit, recovery.forgotPassword);
router.post("/reset-password", recoveryRateLimit, recovery.resetPassword);

module.exports = router;
