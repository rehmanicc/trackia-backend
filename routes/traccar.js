const express = require("express");
const router = express.Router();
const Device = require("../models/Device");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getPositions,
  getRoute,
  sendCommand,
  getTrips,
  getHistory
} = require("../controllers/traccarController");

const webhookController =
  require("../controllers/traccarWebhookController");


console.log("Traccar routes loaded");

router.get("/positions", authMiddleware, getPositions);


router.get("/route", authMiddleware, getRoute);

router.get("/trips", authMiddleware, getTrips);

router.post(
  "/webhook",
  webhookController.receiveWebhook
);

router.post(
  "/command",
  authMiddleware,
  sendCommand
);

router.get(
  "/history",
  authMiddleware,
  getHistory
);

router.get(
  "/positions/latest",
  authMiddleware,
  async (req, res) => {

    try {

      const Position =
        require("../models/Position");

      const user = req.user;

      let devices = [];

      // OWNER
      if (user.role === "owner") {

        devices = await Device.find();

      }

      // ADMIN
      else if (user.role === "admin") {

        devices = await Device.find({
          adminId: user.id
        });

      }

      // USER
      else {

        devices = await Device.find({
          assignedUsers: user.id
        });
      }

      const deviceIds =
        devices.map(d => d.traccarId);

      const positions =
        await Position.aggregate([

          {
            $match: {
              deviceId: {
                $in: deviceIds
              }
            }
          },

          {
            $sort: {
              deviceTime: -1
            }
          },

          {
            $group: {
              _id: "$deviceId",
              latest: {
                $first: "$$ROOT"
              }
            }
          }

        ]);

      const formatted =
        positions.map((p) => {

          const pos = p.latest;

          const device =
            devices.find(
              d =>
                d.traccarId === pos.deviceId
            );

          const isOnline =
            (
              Date.now() -
              new Date(pos.deviceTime)
            ) < 120000;

          return {

            deviceId: pos.deviceId,

            online: isOnline,

            latitude: pos.latitude,

            longitude: pos.longitude,

            speed: pos.speed,

            attributes:
              pos.attributes || {},

            course:
              pos.course || 0,

            deviceTime:
              pos.deviceTime,

            name:
              device?.name || "",

            registrationNumber:
              device?.registrationNumber || ""

          };
        });

      res.json(formatted);

    } catch (err) {

      console.error(
        "❌ Latest positions error:",
        err.message
      );

      res.status(500).json({
        error:
          "Failed to fetch positions"
      });
    }
  }
);
module.exports = router;