const router = require("express").Router();
const ctrl = require("../controllers/deviceController");
const auth = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../config/permissions");

router.get("/", auth, ctrl.getDevices);
router.post("/:id/assign", auth, ctrl.assignDevice);
router.post("/:id/unassign", auth, ctrl.unassignDevice);
router.post("/",
  auth,
  checkPermission(PERMISSIONS.EDIT_DEVICE),
  ctrl.createDevice
);
router.delete("/:id",
  auth,
  checkPermission(PERMISSIONS.EDIT_DEVICE),
  ctrl.deleteDevice
);

module.exports = router;