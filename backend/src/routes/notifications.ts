import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import NotificationService from "../services/notificationService";

const router = express.Router();

// Apply verifyToken middleware to all routes
router.use(verifyToken);

// Get user's notifications (both push and in-app)
router.get("/", async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await NotificationService.getUserNotificationsByRole(
      parseInt(req.user.id.toString()),
      req.user.role,
      limit,
      offset
    );

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      error: "Failed to fetch notifications",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Mark notification as read
router.put("/:id/read", async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const notificationId = parseInt(req.params.id);
    const result = await NotificationService.markNotificationAsRead(
      notificationId,
      parseInt(req.user.id.toString())
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      error: "Failed to mark notification as read",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get unread notification count
router.get("/unread-count", async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const count = await NotificationService.getUnreadNotificationCount(
      parseInt(req.user.id.toString())
    );
    res.json({ count });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({
      error: "Failed to get unread count",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Send group notification (Group Admin only)
router.post("/group", async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id || req.user.role !== "group-admin") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const { title, message, type = "group", groupId } = req.body;

    if (!title || !message || !groupId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    await NotificationService.sendGroupNotification(
      parseInt(req.user.id.toString()),
      groupId,
      {
        title,
        message,
        type,
        priority: "high",
        data: { screen: "/(dashboard)/employee/notifications" },
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error sending group notification:", error);
    res.status(500).json({
      error: "Failed to send group notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Send role notification (Management only)
router.post("/role", async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id || req.user.role !== "management") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const { title, message, type = "management", targetRole } = req.body;

    if (!title || !message || !targetRole) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    await NotificationService.sendRoleNotification(
      parseInt(req.user.id.toString()),
      targetRole,
      {
        title,
        message,
        type,
        priority: "high",
        data: { screen: `/(dashboard)/${targetRole}/notifications` },
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error sending role notification:", error);
    res.status(500).json({
      error: "Failed to send role notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Register device token
router.post("/register-device", async (req: CustomRequest, res: Response) => {
  try {
    const { token, deviceType, deviceName } = req.body;

    if (!req.user?.id || !token) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const result = await NotificationService.saveDeviceToken(
      req.user.id.toString(),
      token,
      deviceType || "unknown",
      deviceName || "unknown"
    );

    res.json({ success: true, device: result.rows[0] });
  } catch (error) {
    console.error("Error registering device:", error);
    res.status(500).json({
      error: "Failed to register device",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Unregister device token
router.delete(
  "/unregister-device",
  async (req: CustomRequest, res: Response) => {
    try {
      const { token } = req.body;

      if (!req.user?.id || !token) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      await NotificationService.removeDeviceToken(
        req.user.id.toString(),
        token
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error unregistering device:", error);
      res.status(500).json({
        error: "Failed to unregister device",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Send test notification (for development)
router.post("/test", async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const notification = {
      id: 0, // Will be assigned by DB
      user_id: req.user.id.toString(),
      title: req.body.title,
      message: req.body.message,
      type: "test",
      priority: "high",
      data: {
        screen: "/(dashboard)/employee/notifications",
      },
    };

    await NotificationService.sendPushNotification(notification, [
      req.user.id.toString(),
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error sending test notification:", error);
    res.status(500).json({
      error: "Failed to send test notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Send notification to specific users (requires admin/management role)
router.post("/send", async (req: CustomRequest, res: Response) => {
  try {
    if (
      !req.user?.id ||
      !["management", "super-admin"].includes(req.user.role)
    ) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const {
      title,
      message,
      userIds,
      type = "general",
      priority = "default",
      data,
    } = req.body;

    if (!title || !message || !userIds) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const notification = {
      id: 0, // Will be assigned by DB
      user_id: req.user.id.toString(),
      title,
      message,
      type,
      priority,
      data: data || {},
    };

    await NotificationService.sendPushNotification(
      notification,
      userIds.map(String)
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({
      error: "Failed to send notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router; 