import express, { Response } from "express";
import { verifyToken } from "../middleware/auth";
import { CustomRequest } from "../types";
import NotificationService from "../services/notificationService";
import { pool } from "../config/database";

const router = express.Router();

// Apply verifyToken middleware to all routes
router.use(verifyToken);

// Middleware to ensure management role
const ensureManagement = (
  req: CustomRequest,
  res: Response,
  next: Function
) => {
  if (!req.user?.id || req.user.role !== "management") {
    return res.status(403).json({ error: "Access restricted to management" });
  }
  next();
};

router.use(ensureManagement);

// Get management's notifications
router.get("/", async (req: CustomRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await NotificationService.getUserNotificationsByRole(
      parseInt(req.user!.id.toString()),
      "management",
      limit,
      offset
    );

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching management notifications:", error);
    res.status(500).json({
      error: "Failed to fetch notifications",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Send role-based notification
router.post("/send-role", async (req: CustomRequest, res: Response) => {
  try {
    const { title, message, type = "management", targetRole } = req.body;

    if (!title || !message || !targetRole) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Get current user's ID
    const currentUserId = req.user!.id;

    // Modify the notification service call to exclude current user
    await NotificationService.sendRoleNotification(
      parseInt(currentUserId.toString()),
      targetRole,
      {
        title,
        message,
        type,
        priority: "high",
        data: { screen: `/(dashboard)/${targetRole}/notifications` },
      },
      true // Add new parameter to exclude sender
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

// Send notification to specific users
router.post("/send-users", async (req: CustomRequest, res: Response) => {
  try {
    const {
      title,
      message,
      userIds,
      type = "management",
      priority = "default",
      data,
    } = req.body;

    if (!title || !message || !userIds) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const notification = {
      id: 0,
      user_id: req.user!.id.toString(),
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

// Mark notification as read
router.put("/:id/read", async (req: CustomRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);
    const userId = parseInt(req.user!.id.toString());

    console.log("[MarkAsRead] Request details:", {
      notificationId,
      userId,
      userRole: req.user?.role
    });

    const client = await pool.connect();
    try {
      // First check in notifications table (in-app notifications)
      const inAppResult = await client.query(
        `SELECT id, user_id, read 
         FROM notifications 
         WHERE id = $1 AND user_id = $2`,
        [notificationId, userId]
      );

      // Then check in push_notifications table
      const pushResult = await client.query(
        `SELECT id, user_id, sent 
         FROM push_notifications 
         WHERE id = $1 AND user_id = $2`,
        [notificationId, userId]
      );

      console.log("[MarkAsRead] Search results:", {
        inAppFound: inAppResult.rows.length > 0,
        pushFound: pushResult.rows.length > 0
      });

      // If notification found in in-app notifications
      if (inAppResult.rows.length > 0) {
        // Update in-app notification
        const updateResult = await client.query(
          `UPDATE notifications 
           SET read = true 
           WHERE id = $1 AND user_id = $2 
           RETURNING id, user_id, title, message, type, read, created_at`,
          [notificationId, userId]
        );

        console.log("[MarkAsRead] In-app notification marked as read:", updateResult.rows[0]);
        return res.json(updateResult.rows[0]);
      }

      // If notification found in push notifications
      if (pushResult.rows.length > 0) {
        // Create an in-app notification record for the read status
        const createInAppResult = await client.query(
          `INSERT INTO notifications 
           (user_id, title, message, type, read, created_at)
           SELECT 
             user_id, 
             title, 
             message, 
             type, 
             true as read,
             CURRENT_TIMESTAMP as created_at
           FROM push_notifications 
           WHERE id = $1 AND user_id = $2
           RETURNING id, user_id, title, message, type, read, created_at`,
          [notificationId, userId]
        );

        console.log("[MarkAsRead] Push notification marked as read:", createInAppResult.rows[0]);
        return res.json(createInAppResult.rows[0]);
      }

      // If notification not found in either table
      console.log("[MarkAsRead] Notification not found:", notificationId);
      return res.status(404).json({
        error: "Notification not found",
        details: "No notification found with the given ID for this user"
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[MarkAsRead] Error:", error);
    res.status(500).json({
      error: "Failed to mark notification as read",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get unread notification count
router.get("/unread-count", async (req: CustomRequest, res: Response) => {
  try {
    const count = await NotificationService.getUnreadNotificationCount(
      parseInt(req.user!.id.toString())
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

// Register device token
router.post("/register-device", async (req: CustomRequest, res: Response) => {
  try {
    const { token, deviceType, deviceName } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const result = await NotificationService.saveDeviceToken(
      req.user!.id.toString(),
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

      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      await NotificationService.removeDeviceToken(
        req.user!.id.toString(),
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

// Send test notification
router.post("/test", async (req: CustomRequest, res: Response) => {
  try {
    const { title, message, type = "test" } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Send only to the requesting user
    await NotificationService.sendPushNotification(
      {
        id: 0,
        user_id: req.user!.id.toString(),
        title,
        message,
        type,
        priority: "high",
        data: { screen: "/(dashboard)/management/notifications" },
      },
      [req.user!.id.toString()]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error sending test notification:", error);
    res.status(500).json({
      error: "Failed to send test notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get all group-admins and employees under the current management user's company
router.get("/users", async (req: CustomRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const client = await pool.connect();

    try {
      // First get the company_id of the current management user
      const companyResult = await client.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [currentUserId]
      );

      if (!companyResult.rows[0]?.company_id) {
        throw new Error("Company ID not found for current user");
      }

      const companyId = companyResult.rows[0].company_id;

      // Get all group-admins and employees from the same company
      const result = await client.query(
        `SELECT id, name, email, role, employee_number 
         FROM users 
         WHERE company_id = $1 
         AND role != 'management'
         AND id != $2
         ORDER BY role, name`,
        [companyId, currentUserId]
      );

      // Group users by role for easier frontend handling
      const groupedUsers = result.rows.reduce((acc: any, user) => {
        if (!acc[user.role]) {
          acc[user.role] = [];
        }
        acc[user.role].push({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          employee_number: user.employee_number
        });
        return acc;
      }, {});

      res.json(groupedUsers);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      error: "Failed to fetch users",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
