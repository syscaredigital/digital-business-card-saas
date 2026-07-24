const express = require("express");
const authenticate = require("../middlewares/auth.middleware");
const controller = require("../controllers/user.controller");
const paymentSlipUpload = require("../middlewares/payment-slip-upload.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/dashboard", controller.dashboard);
router.get("/enquiries", controller.enquiries);
router.get("/appointments", controller.appointments);
router.patch("/appointments/:id/status", controller.updateAppointmentStatus);
router.get("/orders", controller.orders);
router.get("/nfc", controller.nfcStore);
router.post("/nfc/orders", paymentSlipUpload.single("slip"), controller.placeNfcOrder);
router.get("/affiliations", controller.affiliations);
router.post("/affiliations/apply", controller.applyForAffiliate);
router.patch("/affiliations/payout", controller.updateAffiliatePayout);
router.post("/affiliations/withdrawals", controller.requestAffiliateWithdrawal);
router.get("/plans", controller.plans);
router.post("/subscriptions/upgrade", controller.requestPlanUpgrade);
router.post("/subscriptions/manual-payment", paymentSlipUpload.single("slip"), controller.submitManualPayment);
router.get("/vcards/:id", controller.getVcard);
router.post("/vcards", controller.createVcard);
router.patch("/vcards/:id", controller.updateVcard);
router.delete("/vcards/:id", controller.deleteVcard);
router.patch("/notifications/read", controller.markNotificationsRead);

module.exports = router;
