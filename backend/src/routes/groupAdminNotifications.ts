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
  if (!req.user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role !== "group-admin") {
    console.log(`Access denied: User role ${req.user.role} attempted to access group-admin endpoint`);
    return res.status(403).json({ 
      error: "Access restricted to group admins",
      details: `Your role (${req.user.role}) does not have permission to access this resource`
    });
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
      req.user!.id,
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
    if (req.user!.id !== groupAdminId) {
      return res
        .status(403)
        .json({ error: "Unauthorized to send notifications to this group" });
    }

    await NotificationService.sendGroupNotification(
      req.user!.id,
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
    const userId = req.user!.id;

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


// Send notification for task assignment
router.post("/notify-task-assignment", async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { employeeId, taskDetails } = req.body;

    if (!employeeId || !taskDetails) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Determine if this is a reassignment
    const isReassignment = taskDetails.isReassignment;
    const titlePrefix = isReassignment ? '🔄 Task Reassigned' : '📋 New Task Assigned';
    
    // Use formatted due date if provided, otherwise format it
    const dueDateDisplay = taskDetails.formattedDueDate || 
      (taskDetails.dueDate ? new Date(taskDetails.dueDate).toLocaleDateString() : 'Not set');
    
    const title = titlePrefix;
    const message = `${isReassignment ? 'You have been reassigned a task' : 'You have been assigned a new task'}.\n\n` +
      `📌 Task: ${taskDetails.title}\n` +
      `📝 Description: ${taskDetails.description}\n` +
      `⚡ Priority: ${taskDetails.priority.toUpperCase()}\n` +
      `📅 Due Date: ${dueDateDisplay}\n` +
      `\n🔔 Please review and start working on this task.`;

    // Store notification in database first
    const notificationData = {
      screen: "/(dashboard)/employee/employee",
      isReassignment,
      taskId: taskDetails.taskId
    };

    const insertResult = await client.query(
      `INSERT INTO push_notifications 
       (user_id, title, message, type, priority, data, sent, sent_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        employeeId,
        title,
        message,
        "task-assignment",
        "high",
        JSON.stringify(notificationData)
      ]
    );

    // Send push notification with the database ID
    await NotificationService.sendPushNotification(
      {
        id: insertResult.rows[0].id,
        user_id: employeeId.toString(),
        title,
        message,
        type: "task-assignment",
        priority: "high",
        data: notificationData,
      },
      [employeeId.toString()]
    );

    await client.query('COMMIT');
    res.json({ success: true, notificationId: insertResult.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error sending task assignment notification:", error);
    res.status(500).json({
      error: "Failed to send notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    client.release();
  }
});

// Send notification for leave request status update
router.post("/notify-leave-status", async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
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

    const notificationData = { 
      screen: "/(dashboard)/employee/leave-insights",
      leaveId: leaveDetails.id,
      status
    };

    // Store notification in database first
    const insertResult = await client.query(
      `INSERT INTO push_notifications 
       (user_id, title, message, type, priority, data, sent, sent_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        employeeId,
        title,
        message,
        "leave-status",
        "high",
        JSON.stringify(notificationData)
      ]
    );

    // Send push notification with the database ID
    await NotificationService.sendPushNotification(
      {
        id: insertResult.rows[0].id,
        user_id: employeeId.toString(),
        title,
        message,
        type: "leave-status",
        priority: "high",
        data: notificationData,
      },
      [employeeId.toString()]
    );

    await client.query('COMMIT');
    res.json({ success: true, notificationId: insertResult.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error sending leave status notification:", error);
    res.status(500).json({
      error: "Failed to send notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    client.release();
  }
});

// Send notification to management
router.post("/notify-admin", async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    console.log('[GroupAdmin Notification] Starting notification process');
    console.log('[GroupAdmin Notification] User:', req.user);

    if (!req.user?.id) {
      console.log('[GroupAdmin Notification] Error: No user ID');
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify the user is a group admin
    const userCheck = await client.query(
      "SELECT role, company_id FROM users WHERE id = $1 AND role = 'group-admin'",
      [req.user.id]
    );

    if (!userCheck.rows.length) {
      console.log('[GroupAdmin Notification] Error: User is not a group admin');
      return res.status(403).json({ error: "Access restricted to group admins" });
    }

    const { title, message, type = "group-admin-update" } = req.body;
    console.log('[GroupAdmin Notification] Payload:', { title, message, type });

    if (!title || !message) {
      console.log('[GroupAdmin Notification] Error: Missing required parameters');
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const companyId = userCheck.rows[0].company_id;

    // Get the management user for this company
    const managementResult = await client.query(
      "SELECT id, name FROM users WHERE company_id = $1 AND role = 'management'",
      [companyId]
    );

    if (!managementResult.rows.length) {
      console.log('[GroupAdmin Notification] Error: No management user found for company:', companyId);
      return res.status(400).json({ error: "No management user found" });
    }

    const managementId = managementResult.rows[0].id;
    console.log('[GroupAdmin Notification] Found management ID:', managementId);

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

    console.log('[GroupAdmin Notification] Created push notification:', pushNotifResult.rows[0]);

    // Send push notification
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

    // Create in-app notification
    await client.query(
      `INSERT INTO notifications 
       (user_id, title, message, type, read, created_at) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [
        managementId,
        title,
        message,
        type,
        false
      ]
    );

    console.log('[GroupAdmin Notification] Successfully created notifications');
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[GroupAdmin Notification] Error:', error);
    res.status(500).json({
      error: "Failed to send notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    client.release();
  }
});

// Get all employees under the current group-admin
router.get("/users", async (req: CustomRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const client = await pool.connect();

    try {
      // First get the company_id and group_id of the current group-admin
      const adminResult = await client.query(
        `SELECT company_id FROM users WHERE id = $1`,
        [currentUserId]
      );

      if (!adminResult.rows[0]?.company_id) {
        throw new Error("Company ID not found for current user");
      }

      const { company_id } = adminResult.rows[0];

      // Get all employees from the same group
      const result = await client.query(
        `SELECT id, name, email, role, employee_number 
         FROM users 
         WHERE company_id = $1 
         AND group_admin_id = $2
         AND role = 'employee'
         AND id != $3
         ORDER BY name`,
        [company_id, currentUserId, currentUserId]
      );

      // Group users by role (in this case, only employees)
      const groupedUsers = {
        employee: result.rows.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          employee_number: user.employee_number
        }))
      };

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

// Send notification to specific users
router.post("/send-users", async (req: CustomRequest, res: Response) => {
  try {
    const {
      title,
      message,
      userIds,
      type = "group-admin",
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

export default router;
