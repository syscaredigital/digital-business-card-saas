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

module.exports = router;
