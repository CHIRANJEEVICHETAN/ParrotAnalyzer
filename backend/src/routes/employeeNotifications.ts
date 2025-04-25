import express, { Response } from "express";
import { verifyToken } from "../middleware/auth";
import { CustomRequest } from "../types";
import NotificationService from "../services/notificationService";
import { pool } from "../config/database";

const router = express.Router();

// Apply verifyToken middleware to all routes
router.use(verifyToken);

// Middleware to ensure employee role
const ensureEmployee = (req: CustomRequest, res: Response, next: Function) => {
  if (!req.user?.id || req.user.role !== "employee") {
    return res.status(403).json({ error: "Access restricted to employees" });
  }
  next();
};

router.use(ensureEmployee);

// Get employee's notifications
router.get("/", async (req: CustomRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await NotificationService.getUserNotificationsByRole(
      req.user!.id,
      "employee",
      limit,
      offset
    );

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching employee notifications:", error);
    res.status(500).json({
      error: "Failed to fetch notifications",
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
      userRole: req.user?.role,
      userIdType: typeof userId,
    });

    if (isNaN(notificationId) || isNaN(userId)) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: "Notification ID and User ID must be valid numbers",
      });
    }

    const client = await pool.connect();
    try {
      // Check both tables first
      const [inAppResult, pushResult] = await Promise.all([
        client.query(
          `SELECT id, user_id, read, title, message, type 
           FROM notifications 
           WHERE id = $1`,
          [notificationId]
        ),
        client.query(
          `SELECT id, user_id, sent, title, message, type 
           FROM push_notifications 
           WHERE id = $1`,
          [notificationId]
        ),
      ]);

      console.log("[MarkAsRead] Search results:", {
        inAppFound: inAppResult.rows.length > 0,
        pushFound: pushResult.rows.length > 0,
        inAppUserId: inAppResult.rows[0]?.user_id,
        inAppUserIdType: typeof inAppResult.rows[0]?.user_id,
        pushUserId: pushResult.rows[0]?.user_id,
        pushUserIdType: typeof pushResult.rows[0]?.user_id,
      });

      // First try push notifications since that's the original source
      if (pushResult.rows.length > 0) {
        const pushNotification = pushResult.rows[0];

        // Convert IDs to numbers for comparison
        const pushUserId = parseInt(pushNotification.user_id);

        if (pushUserId !== userId) {
          console.log(
            "[MarkAsRead] Unauthorized access to push notification:",
            {
              notificationId,
              ownerId: pushUserId,
              ownerIdType: typeof pushUserId,
              requesterId: userId,
              requesterIdType: typeof userId,
            }
          );
          return res.status(403).json({
            error: "Unauthorized access",
            details:
              "You don't have permission to mark this notification as read",
          });
        }

        // Create or update in-app notification record for read status
        const createInAppResult = await client.query(
          `INSERT INTO notifications 
           (id, user_id, title, message, type, read, created_at)
           VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE
           SET read = true
           RETURNING id, user_id, title, message, type, read, created_at`,
          [
            notificationId,
            userId,
            pushNotification.title,
            pushNotification.message,
            pushNotification.type,
          ]
        );

        console.log(
          "[MarkAsRead] Push notification marked as read:",
          createInAppResult.rows[0]
        );
        return res.json(createInAppResult.rows[0]);
      }

      // If not found in push notifications, check in-app notifications
      if (inAppResult.rows.length > 0) {
        const inAppNotification = inAppResult.rows[0];

        // Convert IDs to numbers for comparison
        const inAppUserId = parseInt(inAppNotification.user_id);

        if (inAppUserId !== userId) {
          console.log(
            "[MarkAsRead] Unauthorized access to in-app notification:",
            {
              notificationId,
              ownerId: inAppUserId,
              ownerIdType: typeof inAppUserId,
              requesterId: userId,
              requesterIdType: typeof userId,
            }
          );
          return res.status(403).json({
            error: "Unauthorized access",
            details:
              "You don't have permission to mark this notification as read",
          });
        }

        // Update in-app notification
        const updateResult = await client.query(
          `UPDATE notifications 
           SET read = true 
           WHERE id = $1 AND user_id = $2 
           RETURNING id, user_id, title, message, type, read, created_at`,
          [notificationId, userId]
        );

        console.log(
          "[MarkAsRead] In-app notification marked as read:",
          updateResult.rows[0]
        );
        return res.json(updateResult.rows[0]);
      }

      // If notification not found in either table
      console.log("[MarkAsRead] Notification not found:", notificationId);
      return res.status(404).json({
        error: "Notification not found",
        details: "No notification found with the given ID",
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[MarkAsRead] Error:", error);
    res.status(500).json({
      error: "Failed to mark notification as read",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get unread notification count
router.get("/unread-count", async (req: CustomRequest, res: Response) => {
  try {
    const count = await NotificationService.getUnreadNotificationCount(
      req.user!.id
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
    console.log("[Device Registration] Starting registration process");
    console.log("[Device Registration] User:", req.user?.id);
    console.log("[Device Registration] Request body:", req.body);

    const { token, deviceType, deviceName } = req.body;

    if (!token) {
      console.log("[Device Registration] Error: Token missing");
      return res.status(400).json({ error: "Token is required" });
    }

    const result = await NotificationService.saveDeviceToken(
      req.user!.id.toString(),
      token,
      deviceType || "unknown",
      deviceName || "unknown"
    );

    console.log("[Device Registration] Success:", result.rows[0]);
    res.json({ success: true, device: result.rows[0] });
  } catch (error) {
    console.error("[Device Registration] Error:", error);
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

// Send notification to group admin
router.post("/notify-admin", async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { title, message, type = "employee-update" } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Get the employee's group admin
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT group_admin_id FROM users WHERE id = $1 AND role = 'employee'",
        [req.user.id]
      );

      if (!result.rows.length || !result.rows[0].group_admin_id) {
        return res.status(400).json({ error: "No group admin assigned" });
      }

      const groupAdminId = result.rows[0].group_admin_id;

      // Create push notification with correct schema
      const pushNotifResult = await client.query(
        `INSERT INTO push_notifications 
         (user_id, title, message, type, priority, data, sent, sent_at, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          groupAdminId, // Integer, not string (matches schema)
          title,
          message,
          type,
          "high",
          JSON.stringify({
            // Convert to JSONB format
            screen: "/(dashboard)/Group-Admin/notifications",
            employeeId: req.user.id,
            employeeName: req.user.name,
          }),
        ]
      );

      // Use the generated ID for sending the push notification
      await NotificationService.sendPushNotification(
        {
          id: pushNotifResult.rows[0].id,
          user_id: groupAdminId.toString(), // Convert to string for the service
          title,
          message,
          type,
          priority: "high",
          data: {
            screen: "/(dashboard)/Group-Admin/notifications",
            employeeId: req.user.id,
            employeeName: req.user.name,
          },
        },
        [groupAdminId.toString()]
      );

      // Create in-app notification matching exact schema
      await client.query(
        `INSERT INTO notifications 
         (user_id, title, message, type, read, created_at) 
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          groupAdminId, // Integer (matches schema)
          title, // varchar(255)
          message, // text
          type, // varchar(50)
          false, // boolean default false
        ]
      );

      res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error sending notification to group admin:", error);
    res.status(500).json({
      error: "Failed to send notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
