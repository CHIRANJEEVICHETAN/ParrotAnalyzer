import express, { Response } from "express";
import { verifyToken } from "../middleware/auth";
import { CustomRequest } from "../types";
import NotificationService from "../services/notificationService";
import { pool } from "../config/database";

const router = express.Router();

// Apply verifyToken middleware to all routes
router.use(verifyToken);

// Middleware to ensure group admin role
const ensureGroupAdmin = (
  req: CustomRequest,
  res: Response,
  next: Function
) => {
  if (!req.user?.id || req.user.role !== "group-admin") {
    return res.status(403).json({ error: "Access restricted to group admins" });
  }
  next();
};

router.use(ensureGroupAdmin);

// Get group admin's notifications
router.get("/", async (req: CustomRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await NotificationService.getUserNotificationsByRole(
      parseInt(req.user!.id),
      "group-admin",
      limit,
      offset
    );

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching group admin notifications:", error);
    res.status(500).json({
      error: "Failed to fetch notifications",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Send group notification
router.post("/send-group", async (req: CustomRequest, res: Response) => {
  try {
    const { title, message, type = "group", groupAdminId } = req.body;

    if (!title || !message || !groupAdminId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Verify that the requesting user is the group admin
    if (parseInt(req.user!.id) !== groupAdminId) {
      return res
        .status(403)
        .json({ error: "Unauthorized to send notifications to this group" });
    }

    await NotificationService.sendGroupNotification(
      parseInt(req.user!.id),
      groupAdminId, // Using groupAdminId to find employees
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

// Mark notification as read
router.put("/:id/read", async (req: CustomRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);
    const userId = parseInt(req.user!.id);

    console.log("[MarkAsRead] Request details:", {
      notificationId,
      userId,
      userRole: req.user?.role,
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
        pushFound: pushResult.rows.length > 0,
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

        console.log(
          "[MarkAsRead] In-app notification marked as read:",
          updateResult.rows[0]
        );
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

        console.log(
          "[MarkAsRead] Push notification marked as read:",
          createInAppResult.rows[0]
        );
        return res.json(createInAppResult.rows[0]);
      }

      // If notification not found in either table
      console.log("[MarkAsRead] Notification not found:", notificationId);
      return res.status(404).json({
        error: "Notification not found",
        details: "No notification found with the given ID for this user",
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
      parseInt(req.user!.id)
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

// Test notification endpoint for group-admin
router.post("/test", async (req: CustomRequest, res: Response) => {
  try {
    const { title, message, type = "test" } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    await NotificationService.sendPushNotification(
      {
        id: 0,
        user_id: req.user!.id.toString(),
        title,
        message,
        type,
        priority: "high",
        data: { screen: "/(dashboard)/Group-Admin/notifications" },
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

// Send notification for expense approval/rejection
router.post("/notify-expense-status", async (req: CustomRequest, res: Response) => {
  try {
    const { employeeId, status, expenseDetails, reason } = req.body;

    if (!employeeId || !status || !expenseDetails) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const title = `💰 Expense Report ${status === 'approved' ? 'Approved' : 'Rejected'}`;
    const message = `Your expense report has been ${status}.\n\n` +
      `📊 Details:\n` +
      `💵 Amount: ₹${expenseDetails.amount}\n` +
      `🗓️ Date: ${expenseDetails.date}\n` +
      `🚗 Travel: ${expenseDetails.kilometers}km\n` +
      `📍 Route: ${expenseDetails.route}\n` +
      (reason ? `\n📝 Reason: ${reason}` : '');

    await NotificationService.sendPushNotification(
      {
        id: 0,
        user_id: employeeId.toString(),
        title,
        message,
        type: "expense-status",
        priority: "high",
        data: { screen: "/(dashboard)/employee/expenses" },
      },
      [employeeId.toString()]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error sending expense status notification:", error);
    res.status(500).json({
      error: "Failed to send notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Send notification for task assignment
router.post("/notify-task-assignment", async (req: CustomRequest, res: Response) => {
  try {
    const { employeeId, taskDetails } = req.body;

    if (!employeeId || !taskDetails) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const title = `📋 New Task Assigned`;
    const message = `You have been assigned a new task.\n\n` +
      `📌 Task: ${taskDetails.title}\n` +
      `📝 Description: ${taskDetails.description}\n` +
      `⚡ Priority: ${taskDetails.priority.toUpperCase()}\n` +
      `📅 Due Date: ${taskDetails.due_date ? new Date(taskDetails.due_date).toLocaleDateString() : 'Not set'}\n` +
      `\n🔔 Please review and start working on this task.`;

    await NotificationService.sendPushNotification(
      {
        id: 0,
        user_id: employeeId.toString(),
        title,
        message,
        type: "task-assignment",
        priority: "high",
        data: { screen: "/(dashboard)/employee/tasks" },
      },
      [employeeId.toString()]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error sending task assignment notification:", error);
    res.status(500).json({
      error: "Failed to send notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Send notification for leave request status update
router.post("/notify-leave-status", async (req: CustomRequest, res: Response) => {
  try {
    const { employeeId, status, leaveDetails, reason } = req.body;

    if (!employeeId || !status || !leaveDetails) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const statusEmoji = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⏫';
    const title = `${statusEmoji} Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    
    const message = `Your leave request has been ${status}.\n\n` +
      `📅 Period: ${new Date(leaveDetails.start_date).toLocaleDateString()} to ${new Date(leaveDetails.end_date).toLocaleDateString()}\n` +
      `📝 Type: ${leaveDetails.leave_type_name}\n` +
      `⏱️ Duration: ${leaveDetails.days_requested} day(s)\n` +
      (reason ? `\n📋 Reason: ${reason}` : '');

    await NotificationService.sendPushNotification(
      {
        id: 0,
        user_id: employeeId.toString(),
        title,
        message,
        type: "leave-status",
        priority: "high",
        data: { screen: "/(dashboard)/employee/leave-insights" },
      },
      [employeeId.toString()]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error sending leave status notification:", error);
    res.status(500).json({
      error: "Failed to send notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Send notification to management
router.post("/notify-admin", async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { title, message, type = "group-admin-update" } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Get the management personnel from the same company
    const client = await pool.connect();
    try {
      // First get the current user's company_id and verify they are a group admin
      const userResult = await client.query(
        `SELECT company_id, role FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (!userResult.rows.length || userResult.rows[0].role !== 'group-admin') {
        return res.status(403).json({ error: "Access restricted to group admins" });
      }

      const companyId = userResult.rows[0].company_id;
      
      if (!companyId) {
        return res.status(400).json({ error: "No company associated with this group admin" });
      }

      // Find the management user for this company
      const managementResult = await client.query(
        `SELECT id FROM users 
         WHERE company_id = $1 
         AND role = 'management' 
         AND status = 'active' 
         LIMIT 1`,
        [companyId]
      );

      if (!managementResult.rows.length) {
        return res.status(400).json({ error: "No management personnel found for your company" });
      }

      const managementId = managementResult.rows[0].id;

      // Create push notification with correct schema
      const pushNotifResult = await client.query(
        `INSERT INTO push_notifications 
         (user_id, title, message, type, priority, data, sent, sent_at, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          managementId,
          title,
          message,
          type,
          "high",
          JSON.stringify({
            screen: "/(dashboard)/management/notifications",
            groupAdminId: req.user.id,
            groupAdminName: req.user.name,
            companyId: companyId
          }),
        ]
      );

      // Use the generated ID for sending the push notification
      await NotificationService.sendPushNotification(
        {
          id: pushNotifResult.rows[0].id,
          user_id: managementId.toString(),
          title,
          message,
          type,
          priority: "high",
          data: {
            screen: "/(dashboard)/management/notifications",
            groupAdminId: req.user.id,
            groupAdminName: req.user.name,
            companyId: companyId
          },
        },
        [managementId.toString()]
      );

      // Create in-app notification matching exact schema
      await client.query(
        `INSERT INTO notifications 
         (user_id, title, message, type, read, created_at) 
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          managementId,
          title,
          message,
          type,
          false,
        ]
      );

      res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error sending notification to management:", error);
    res.status(500).json({
      error: "Failed to send notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
