const router = require("express").Router();
const ctrl = require("../controllers/deviceController");
const auth = require("../middleware/authMiddleware");

router.post("/", auth, ctrl.createDevice);
router.get("/", auth, ctrl.getDevices);
router.delete("/:id", auth, ctrl.deleteDevice);

router.post("/:id/assign", auth, ctrl.assignDevice);
router.post("/:id/unassign", auth, ctrl.unassignDevice);

module.exports = router;