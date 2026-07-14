const express = require("express");
const authenticate = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/role.middleware");
const superAdminController = require("../controllers/superAdmin.controller");

const router = express.Router();

router.get(
  "/dashboard",
  authenticate,
  authorize("super_admin"),
  superAdminController.getDashboard
);

router.get(
  "/users",
  authenticate,
  authorize("super_admin"),
  superAdminController.listUsers
);

router.post(
  "/users",
  authenticate,
  authorize("super_admin"),
  superAdminController.createUser
);

router.patch(
  "/users/:id",
  authenticate,
  authorize("super_admin"),
  superAdminController.updateUser
);

router.patch(
  "/users/:id/status",
  authenticate,
  authorize("super_admin"),
  superAdminController.updateUserStatus
);

router.delete(
  "/users/:id",
  authenticate,
  authorize("super_admin"),
  superAdminController.deleteUser
);

router.get(
  "/vcards",
  authenticate,
  authorize("super_admin"),
  superAdminController.listVCards
);

router.post(
  "/vcards",
  authenticate,
  authorize("super_admin"),
  superAdminController.createVCard
);

router.patch(
  "/vcards/:id/status",
  authenticate,
  authorize("super_admin"),
  superAdminController.updateVCardStatus
);

router.delete(
  "/vcards/:id",
  authenticate,
  authorize("super_admin"),
  superAdminController.deleteVCard
);

router.get(
  "/nfc",
  authenticate,
  authorize("super_admin"),
  superAdminController.listNfcManagement
);

router.post(
  "/nfc/products",
  authenticate,
  authorize("super_admin"),
  superAdminController.createNfcProduct
);

router.patch(
  "/nfc/products/:id",
  authenticate,
  authorize("super_admin"),
  superAdminController.updateNfcProduct
);

router.delete(
  "/nfc/products/:id",
  authenticate,
  authorize("super_admin"),
  superAdminController.deleteNfcProduct
);

router.post(
  "/nfc/cards",
  authenticate,
  authorize("super_admin"),
  superAdminController.createNfcCard
);

router.patch(
  "/nfc/cards/:id",
  authenticate,
  authorize("super_admin"),
  superAdminController.updateNfcCard
);

router.delete(
  "/nfc/cards/:id",
  authenticate,
  authorize("super_admin"),
  superAdminController.deleteNfcCard
);

router.patch(
  "/nfc/orders/:id",
  authenticate,
  authorize("super_admin"),
  superAdminController.updateNfcOrder
);

router.get("/subscriptions", authenticate, authorize("super_admin"), superAdminController.listSubscriptionManagement);
router.post("/subscriptions", authenticate, authorize("super_admin"), superAdminController.createSubscription);
router.patch("/subscriptions/:id", authenticate, authorize("super_admin"), superAdminController.updateSubscription);
router.delete("/subscriptions/:id", authenticate, authorize("super_admin"), superAdminController.deleteSubscription);
router.post("/plans", authenticate, authorize("super_admin"), superAdminController.createPlan);
router.patch("/plans/:id", authenticate, authorize("super_admin"), superAdminController.updatePlan);
router.delete("/plans/:id", authenticate, authorize("super_admin"), superAdminController.deletePlan);
router.get("/cash-payments", authenticate, authorize("super_admin"), superAdminController.listCashPayments);
router.post("/cash-payments", authenticate, authorize("super_admin"), superAdminController.createCashPayment);
router.patch("/cash-payments/:id", authenticate, authorize("super_admin"), superAdminController.updateCashPayment);
router.delete("/cash-payments/:id", authenticate, authorize("super_admin"), superAdminController.deleteCashPayment);
router.get("/transactions", authenticate, authorize("super_admin"), superAdminController.listTransactions);
router.post("/transactions", authenticate, authorize("super_admin"), superAdminController.createTransaction);
router.patch("/transactions/:id", authenticate, authorize("super_admin"), superAdminController.updateTransaction);
router.delete("/transactions/:id", authenticate, authorize("super_admin"), superAdminController.deleteTransaction);
router.get("/payouts", authenticate, authorize("super_admin"), superAdminController.listPayouts);
router.post("/payouts", authenticate, authorize("super_admin"), superAdminController.createPayout);
router.patch("/payouts/:id", authenticate, authorize("super_admin"), superAdminController.updatePayout);
router.delete("/payouts/:id", authenticate, authorize("super_admin"), superAdminController.deletePayout);
router.get("/withdrawals", authenticate, authorize("super_admin"), superAdminController.listWithdrawals);
router.post("/withdrawals", authenticate, authorize("super_admin"), superAdminController.createWithdrawal);
router.patch("/withdrawals/:id", authenticate, authorize("super_admin"), superAdminController.updateWithdrawal);
router.delete("/withdrawals/:id", authenticate, authorize("super_admin"), superAdminController.deleteWithdrawal);
router.get("/affiliations", authenticate, authorize("super_admin"), superAdminController.listAffiliations);
router.post("/affiliations/partners", authenticate, authorize("super_admin"), superAdminController.createAffiliatePartner);
router.patch("/affiliations/partners/:id", authenticate, authorize("super_admin"), superAdminController.updateAffiliatePartner);
router.delete("/affiliations/partners/:id", authenticate, authorize("super_admin"), superAdminController.deleteAffiliatePartner);
router.post("/affiliations/referrals", authenticate, authorize("super_admin"), superAdminController.createAffiliateReferral);
router.patch("/affiliations/referrals/:id", authenticate, authorize("super_admin"), superAdminController.updateAffiliateReferral);
router.delete("/affiliations/referrals/:id", authenticate, authorize("super_admin"), superAdminController.deleteAffiliateReferral);
router.post("/affiliations/commissions", authenticate, authorize("super_admin"), superAdminController.createAffiliateCommission);
router.patch("/affiliations/commissions/:id", authenticate, authorize("super_admin"), superAdminController.updateAffiliateCommission);
router.delete("/affiliations/commissions/:id", authenticate, authorize("super_admin"), superAdminController.deleteAffiliateCommission);
router.get("/coupons", authenticate, authorize("super_admin"), superAdminController.listCoupons);
router.post("/coupons", authenticate, authorize("super_admin"), superAdminController.createCoupon);
router.patch("/coupons/:id", authenticate, authorize("super_admin"), superAdminController.updateCoupon);
router.delete("/coupons/:id", authenticate, authorize("super_admin"), superAdminController.deleteCoupon);
router.post("/coupon-redemptions", authenticate, authorize("super_admin"), superAdminController.createCouponRedemption);
router.delete("/coupon-redemptions/:id", authenticate, authorize("super_admin"), superAdminController.deleteCouponRedemption);
router.get("/analytics", authenticate, authorize("super_admin"), superAdminController.getAnalytics);
router.get("/reports", authenticate, authorize("super_admin"), superAdminController.listReports);
router.post("/reports", authenticate, authorize("super_admin"), superAdminController.createReport);
router.patch("/reports/:id", authenticate, authorize("super_admin"), superAdminController.updateReport);
router.delete("/reports/:id", authenticate, authorize("super_admin"), superAdminController.deleteReport);
router.post("/reports/:id/run", authenticate, authorize("super_admin"), superAdminController.runReport);
router.get("/report-runs/:id/download", authenticate, authorize("super_admin"), superAdminController.downloadReportRun);
router.get("/settings", authenticate, authorize("super_admin"), superAdminController.getSettings);
router.put("/settings", authenticate, authorize("super_admin"), superAdminController.updateSettings);
router.put("/settings/roles/:id/permissions", authenticate, authorize("super_admin"), superAdminController.updateRolePermissions);
router.get("/system-logs", authenticate, authorize("super_admin"), superAdminController.listSystemLogs);

module.exports = router;
