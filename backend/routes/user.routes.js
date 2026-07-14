const express = require("express");
const authenticate = require("../middlewares/auth.middleware");
const controller = require("../controllers/user.controller");

const router = express.Router();

router.use(authenticate);
router.get("/dashboard", controller.dashboard);
router.get("/enquiries", controller.enquiries);
router.get("/appointments", controller.appointments);
router.get("/orders", controller.orders);
router.get("/plans", controller.plans);
router.post("/subscriptions/upgrade", controller.requestPlanUpgrade);
router.get("/vcards/:id", controller.getVcard);
router.post("/vcards", controller.createVcard);
router.patch("/vcards/:id", controller.updateVcard);
router.delete("/vcards/:id", controller.deleteVcard);
router.patch("/notifications/read", controller.markNotificationsRead);

module.exports = router;
