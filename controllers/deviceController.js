const Device = require("../models/Device");
const traccarAPI = require("../services/traccarAPI");
const Geofence = require("../models/Geofence");
const User = require("../models/User");
const mongoose = require("mongoose");
const Position = require("../models/Position");

function hasDevicePermission(
  device,
  userId,
  permission
) {

  const p =
    device.devicePermissions?.find(
      p =>
        String(p.userId) ===
        String(userId)
    );

  return p?.[permission] === true;
}

exports.createDevice = async (req, res, next) => {

  const {
    name,
    uniqueId,
    speedLimit,
    fuelEfficiency,
    oilChangeLimit,
    oilChangeReading,
    registrationNumber,
    trackerModelId,
    deviceSimNumber,
    callReceiverNumber
  } = req.body;

  const user = req.user;

  try {

    const { logAudit } = require("../services/auditService");

    if (user.role === "owner" && !req.body.adminId) {
      return res.status(400).json({
        error: "adminId is required when owner creates device"
      });
    }

    if (user.role === "owner") {
      const adminExists = await User.findOne({
        _id: req.body.adminId,
        role: "admin"
      });

      if (!adminExists) {
        return res.status(400).json({
          error: "Invalid adminId"
        });
      }
    }

    const existingMongo = await Device.findOne({ uniqueId });
    if (trackerModelId) {

      const TrackerModel =
        require("../models/TrackerModel");

      const trackerModel =
        await TrackerModel.findById(
          trackerModelId
        );

      if (!trackerModel) {

        return res.status(400).json({
          error:
            "Invalid tracker model"
        });
      }
    }
    if (existingMongo) {
      return res.status(400).json({
        error: "Device already exists in system"
      });
    }

    const traccarDevices = await traccarAPI.apiGet("/api/devices");

    let traccarDevice = traccarDevices.find(d => d.uniqueId === uniqueId);

    if (!traccarDevice) {
      traccarDevice = await traccarAPI.apiPost("/api/devices", {
        name,
        uniqueId
      });
    }

    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const device = await Device.create({

      name,

      uniqueId,

      traccarId: traccarDevice.id,

      registrationNumber,

      trackerModelId,

      adminId:
        user.role === "admin"
          ? user.id
          : new mongoose.Types.ObjectId(
            req.body.adminId
          ),

      createdBy: user.id,

      assignedUsers: [],

      speedLimit: speedLimit || 70,

      fuelEfficiency: fuelEfficiency || 12,

      oilChangeLimit: oilChangeLimit || 3000,

      oilChangeReading: oilChangeReading || 0,

      expiryDate: oneYearLater,

      deviceSimNumber: deviceSimNumber || null,

      callReceiverNumber: callReceiverNumber || null,

      isActive: true
    });

    // 🔥 AUDIT LOG (ADD HERE)
    try {
      await logAudit({
        userId: user.id,
        action: "CREATE_DEVICE",
        entity: "Device",
        entityId: device._id,
        metadata: {
          name,
          uniqueId,
          adminId: device.adminId
        }
      });
    } catch (e) {
      console.error("Audit failed:", e);
    }

    res.json(device);

  } catch (err) {
    console.error("❌ DEVICE ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: err.response?.data?.message || err.message
    });
  }
};
exports.updateDevice = async (
  req,
  res
) => {

  try {

    const device =
      await Device.findById(
        req.params.id
      );

    if (!device) {
      return res.status(404).json({
        error: "Device not found"
      });
    }

    // 🔒 ADMIN OWNERSHIP CHECK
    if (
      req.user.role === "admin" &&
      String(device.adminId) !==
      String(req.user.id)
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    const {
      name,
      registrationNumber,
      deviceSimNumber,
      speedLimit,
      trackerModelId,
      adminId,
    } = req.body;

    // 🔐 PERMISSIONS

    const canEditTrackerSim =
      req.user.role === "owner" ||
      req.user.role === "admin";

    const canEditSpeed =
      req.user.role === "owner" ||
      req.user.role === "admin";

    // ✅ FULL ACCESS
    if (canEditTrackerSim) {

      if (name !== undefined) {
        device.name = name;
      }

      if (
        registrationNumber !== undefined
      ) {
        device.registrationNumber =
          registrationNumber;
      }

      if (
        deviceSimNumber !== undefined
      ) {
        device.deviceSimNumber =
          deviceSimNumber;
      }

      if (
        trackerModelId !== undefined
      ) {

        const TrackerModel =
          require("../models/TrackerModel");

        const trackerExists =
          await TrackerModel.findById(
            trackerModelId
          );

        if (!trackerExists) {

          return res.status(400).json({
            error:
              "Invalid tracker model"
          });
        }

        device.trackerModelId =
          trackerModelId;
      }
    }

    if (
      canEditSpeed &&
      speedLimit !== undefined
    ) {
      device.speedLimit =
        speedLimit;
    }


    // 👑 OWNER ONLY
    if (
      req.user.role === "owner" &&
      adminId
    ) {
      device.adminId = adminId;
    }

    await device.save();

    res.json({
      message:
        "Device updated successfully",
      device
    });

  } catch (err) {

    console.error(
      "❌ UPDATE DEVICE ERROR:",
      err
    );

    res.status(500).json({
      error: err.message
    });
  }
};
exports.getDevices = async (req, res) => {
  try {
    const user = req.user;

    let devices;

    if (user.role === "owner") {

      devices = await Device.find()

        .populate(
          "assignedUsers",
          "name phoneNumber"
        )

        .populate(
          "ownerUserId",
          "name phoneNumber"
        )

        .populate(
          "devicePermissions.userId",
          "name phoneNumber"
        )

        .populate("trackerModelId");

    }
    else if (user.role === "admin") {

      const mongoose = require("mongoose");

      devices = await Device.find({
        adminId:
          new mongoose.Types.ObjectId(
            user.id
          )
      })

        .populate(
          "assignedUsers",
          "name phoneNumber"
        )

        .populate(
          "ownerUserId",
          "name phoneNumber"
        )

        .populate(
          "devicePermissions.userId",
          "name phoneNumber"
        )

        .populate("trackerModelId");

    }
    else {

      devices = await Device.find({
        assignedUsers: user.id
      })

        .populate(
          "assignedUsers",
          "name phoneNumber"
        )

        .populate(
          "ownerUserId",
          "name phoneNumber"
        )

        .populate(
          "devicePermissions.userId",
          "name phoneNumber"
        )

        .populate("trackerModelId");

    }

    const latestPositions =
      await Position.aggregate([

        {
          $match: {
            deviceId: {
              $in: devices.map(
                d => d.traccarId
              )
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

    const merged = devices.map(d => {

      const latest =
        latestPositions.find(
          p => p._id === d.traccarId
        )?.latest;

      const isOnline =
        latest &&
        (
          Date.now() -
          new Date(latest.deviceTime)
        ) < 120000;

      return {

        ...d._doc,

        online: isOnline,

        position: latest
          ? {
            speed:
              latest.speed || 0,

            latitude:
              latest.latitude,

            longitude:
              latest.longitude,

            course:
              latest.course || 0,

            deviceTime:
              latest.deviceTime,

            attributes:
              latest.attributes || {},
          }
          : null,
      };
    });

    res.json(merged);

  } catch (err) {
    console.error("❌ getDevices error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
// DELETE DEVICE
exports.deleteDevice = async (req, res) => {
  try {
    const { logAudit } = require("../services/auditService");

    const device = await Device.findById(req.params.id);

    if (!device) return res.status(404).json({ error: "Not found" });

    if (
      req.user.role === "admin" &&
      String(device.adminId) !== String(req.user.id)
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }
    const deviceData = {
      name: device.name,
      uniqueId: device.uniqueId,
      traccarId: device.traccarId,
      adminId: device.adminId
    };

    await traccarAPI.apiDelete(`/api/devices/${device.traccarId}`);
    await Geofence.deleteMany({
      deviceId: device.traccarId
    });


    await device.deleteOne();


    try {
      await logAudit({
        userId: req.user.id,
        action: "DELETE_DEVICE",
        entity: "Device",
        entityId: device._id,
        metadata: deviceData
      });
    } catch (e) {
      console.error("Audit failed:", e);
    }

    res.json({ message: "Device deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// ASSIGN DEVICE
exports.assignDevice = async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const { logAudit } = require("../services/auditService");

    const { userId } = req.body;
    const deviceId = req.params.id;

    console.log("📥 Device ID:", deviceId);
    console.log("📥 Assign Body:", req.body);

    // ✅ VALIDATION
    if (!mongoose.Types.ObjectId.isValid(deviceId)) {
      return res.status(400).json({ error: "Invalid deviceId" });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const device = await Device.findById(deviceId);
    const user = await User.findById(userId);

    if (!device || !user) {
      return res.status(404).json({ error: "Not found" });
    }

    if (
      String(device.adminId) !==
      String(user.adminId)
    ) {
      return res.status(400).json({
        error:
          "User and device belong to different admins"
      });
    }

    // 🔒 Admin ownership validation
    if (
      req.user.role === "admin" &&
      String(device.adminId) !==
      String(req.user.id)
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    if (
      !device.assignedUsers.some(
        id =>
          String(id) === String(userId)
      )
    ) {

      device.assignedUsers.push(userId);

      device.devicePermissions.push({

        userId,
        dashboard: true,
        engineControl: false,
        editSpeedLimit: false,
        editFuelAverage: false,
        editOilChangeReading: false,
        editOilChangeLimit: false,
        editCallNumber: false,

      });
    }


    if (!device.callReceiverNumber) {
      device.callReceiverNumber = user.phoneNumber;
    }
    await device.save();

    // 🔥 AUDIT LOG (ADD HERE)
    try {
      await logAudit({
        userId: req.user.id,
        action: "ASSIGN_DEVICE",
        entity: "Device",
        entityId: device._id,
        metadata: {
          assignedTo: userId
        }
      });
    } catch (e) {
      console.error("Audit failed:", e);
    }

    res.json({
      message: "Device assigned successfully",
      assignedUsers: device.assignedUsers
    });

  } catch (err) {
    console.error("❌ ASSIGN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
// UNASSIGN DEVICE
exports.unassignDevice = async (req, res) => {
  try {
    const { logAudit } = require("../services/auditService"); // 🔥 add

    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    if (
      req.user.role === "admin" &&
      String(device.adminId) !==
      String(req.user.id)
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    if (
      !device.assignedUsers.some(
        id =>
          String(id) === String(userId)
      )
    ) {
      return res.json({
        message: "User already unassigned"
      });
    }

    console.log("🔄 Unassigning device:", device._id);

    const previousUser = userId; // 🔥 capture before removing

    device.assignedUsers = device.assignedUsers.filter(
      id => String(id) !== String(req.body.userId)
    );
    device.devicePermissions =
      device.devicePermissions.filter(
        p =>
          String(p.userId) !==
          String(userId)
      );
    if (
      device.ownerUserId &&
      String(device.ownerUserId) ===
      String(userId)
    ) {
      device.ownerUserId = null;
    }
    await device.save();

    // 🔥 AUDIT LOG
    try {
      await logAudit({
        userId: req.user.id,
        action: "UNASSIGN_DEVICE",
        entity: "Device",
        entityId: device._id,
        metadata: {
          previousAssignedTo: previousUser
        }
      });
    } catch (e) {
      console.error("Audit failed:", e);
    }

    res.json({ message: "Device unassigned successfully" });

  } catch (err) {
    console.error("❌ UNASSIGN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateDevicePermissions = async (req, res) => {
  try {

    const device = await Device.findById(
      req.params.id
    );

    if (!device) {
      return res.status(404).json({
        error: "Device not found"
      });
    }

    // OWNER OR DEVICE ADMIN ONLY

    if (
      req.user.role === "admin" &&
      String(device.adminId) !==
      String(req.user.id)
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    const {
      ownerUserId,
      permissions,

      callReceiverNumber,
      speedLimit,
      fuelEfficiency,
      oilChangeReading,
      oilChangeLimit
    } = req.body;

    // OWNER USER MUST BE ASSIGNED
    if (
      ownerUserId &&
      !device.assignedUsers.some(
        id =>
          String(id) ===
          String(ownerUserId)
      )
    ) {
      return res.status(400).json({
        error:
          "Owner user must already be assigned to device"
      });
    }

    if (
      ownerUserId &&
      permissions &&
      !permissions.some(
        p =>
          String(p.userId) ===
          String(ownerUserId)
      )
    ) {
      return res.status(400).json({
        error:
          "Owner user must exist in permissions list"
      });
    }
    device.ownerUserId =
      ownerUserId || null;

    if (permissions) {

      const normalized =
        permissions.map(p => {

          if (
            ownerUserId &&
            String(p.userId) ===
            String(ownerUserId)
          ) {
            return {
              ...p,

              dashboard:
                p.dashboard ?? true,

              engineControl:
                p.engineControl ?? true,

              editSpeedLimit:
                p.editSpeedLimit ?? true,

              editFuelAverage:
                p.editFuelAverage ?? true,

              editOilChangeReading:
                p.editOilChangeReading ?? true,

              editOilChangeLimit:
                p.editOilChangeLimit ?? true,

              editCallNumber:
                p.editCallNumber ?? true,
            };
          }

          return p;
        });

      const assignedIds =
        device.assignedUsers.map(
          id => String(id)
        );

      for (const p of normalized) {

        if (
          !assignedIds.includes(
            String(p.userId)
          )
        ) {
          return res.status(400).json({
            error:
              "Permission user must be assigned to device"
          });
        }
      }
      device.devicePermissions =
        normalized;
    }
    if (callReceiverNumber !== undefined) {
      device.callReceiverNumber =
        callReceiverNumber;
    }

    if (speedLimit !== undefined) {
      device.speedLimit =
        Number(speedLimit);
    }

    if (fuelEfficiency !== undefined) {
      device.fuelEfficiency =
        Number(fuelEfficiency);
    }

    if (oilChangeReading !== undefined) {
      device.oilChangeReading =
        Number(oilChangeReading);
    }

    if (oilChangeLimit !== undefined) {
      device.oilChangeLimit =
        Number(oilChangeLimit);
    }
    await device.save();

    res.json({
      message:
        "Device permissions updated",
      device
    });

  } catch (err) {

    console.error(
      "❌ DEVICE PERMISSION ERROR:",
      err
    );

    res.status(500).json({
      error: err.message
    });
  }
};