import { pool } from "../config/database";
import NotificationService from "./notificationService";
import NotificationTemplateModel from "../models/notificationTemplate";
import { scheduleJob, Job } from "node-schedule";

interface ScheduledNotification {
  id: number;
  template_id: number;
  variables: Record<string, any>;
  target_role?: string;
  target_user_id?: number;
  target_group_id?: number;
  scheduled_for: Date;
  status: "pending" | "sent" | "failed" | "cancelled";
}

class ScheduledNotificationService {
  private scheduledJobs: Map<number, Job>;

  constructor() {
    this.scheduledJobs = new Map();
    this.initializeScheduledNotifications();
  }

  private async initializeScheduledNotifications() {
    const client = await pool.connect();
    try {
      // Get all pending notifications
      const result = await client.query(
        `SELECT * FROM scheduled_notifications 
         WHERE status = 'pending' 
         AND scheduled_for > CURRENT_TIMESTAMP`
      );

      // Schedule each notification
      result.rows.forEach((notification: ScheduledNotification) => {
        this.scheduleNotification(notification);
      });
    } catch (error) {
      console.error("Error initializing scheduled notifications:", error);
    } finally {
      client.release();
    }
  }

  private scheduleNotification(notification: ScheduledNotification) {
    const job = scheduleJob(notification.scheduled_for, async () => {
      await this.sendScheduledNotification(notification);
    });

    this.scheduledJobs.set(notification.id, job);
  }

  private async sendScheduledNotification(notification: ScheduledNotification) {
    const client = await pool.connect();
    try {
      // Get the template
      const template = await NotificationTemplateModel.getById(
        notification.template_id
      );
      if (!template) {
        throw new Error("Template not found");
      }

      // Render the template with variables
      const renderedTemplate = NotificationTemplateModel.renderTemplate(
        template,
        notification.variables
      );

      // Determine target users based on notification type
      let userIds: string[] = [];
      if (notification.target_user_id) {
        userIds = [notification.target_user_id.toString()];
      } else if (notification.target_role) {
        const users = await client.query(
          "SELECT id FROM users WHERE role = $1",
          [notification.target_role]
        );
        userIds = users.rows.map((user) => user.id.toString());
      } else if (notification.target_group_id) {
        const users = await client.query(
          "SELECT id FROM users WHERE group_id = $1",
          [notification.target_group_id]
        );
        userIds = users.rows.map((user) => user.id.toString());
      }

      // Send the notification
      await NotificationService.sendPushNotification(
        {
          id: 0,
          user_id: userIds[0], // Primary recipient
          title: renderedTemplate.title,
          message: renderedTemplate.message,
          type: template.type,
          priority: template.priority,
          data: { ...template.data, scheduled: true },
          template_id: template.id,
        },
        userIds
      );

      // Update notification status
      await client.query(
        `UPDATE scheduled_notifications 
         SET status = 'sent', 
             sent_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [notification.id]
      );

      // Remove the job from tracked jobs
      this.scheduledJobs.delete(notification.id);
    } catch (error) {
      console.error("Error sending scheduled notification:", error);
      await client.query(
        `UPDATE scheduled_notifications 
         SET status = 'failed', 
             error = $2,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [
          notification.id,
          error instanceof Error ? error.message : "Unknown error",
        ]
      );
    } finally {
      client.release();
    }
  }

  async scheduleNewNotification(
    templateId: number,
    variables: Record<string, any>,
    scheduledFor: Date,
    options: {
      targetRole?: string;
      targetUserId?: number;
      targetGroupId?: number;
    }
  ) {
    const client = await pool.connect();
    try {
      // Validate template exists
      const template = await NotificationTemplateModel.getById(templateId);
      if (!template) {
        throw new Error("Template not found");
      }

      // Create scheduled notification record
      const result = await client.query(
        `INSERT INTO scheduled_notifications 
         (template_id, variables, scheduled_for, target_role, target_user_id, target_group_id) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [
          templateId,
          variables,
          scheduledFor,
          options.targetRole,
          options.targetUserId,
          options.targetGroupId,
        ]
      );

      const notification = result.rows[0];
      this.scheduleNotification(notification);

      return notification;
    } finally {
      client.release();
    }
  }

  async cancelScheduledNotification(id: number) {
    const client = await pool.connect();
    try {
      const job = this.scheduledJobs.get(id);
      if (job) {
        job.cancel();
        this.scheduledJobs.delete(id);
      }

      await client.query(
        `UPDATE scheduled_notifications 
         SET status = 'cancelled', 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [id]
      );

      return true;
    } finally {
      client.release();
    }
  }

  async getScheduledNotifications(
    options: {
      status?: string;
      targetRole?: string;
      targetUserId?: number;
      targetGroupId?: number;
    } = {}
  ) {
    const client = await pool.connect();
    try {
      let query = "SELECT * FROM scheduled_notifications WHERE 1=1";
      const params: any[] = [];
      let paramCount = 1;

      if (options.status) {
        query += ` AND status = $${paramCount}`;
        params.push(options.status);
        paramCount++;
      }

      if (options.targetRole) {
        query += ` AND target_role = $${paramCount}`;
        params.push(options.targetRole);
        paramCount++;
      }

      if (options.targetUserId) {
        query += ` AND target_user_id = $${paramCount}`;
        params.push(options.targetUserId);
        paramCount++;
      }

      if (options.targetGroupId) {
        query += ` AND target_group_id = $${paramCount}`;
        params.push(options.targetGroupId);
        paramCount++;
      }

      query += " ORDER BY scheduled_for DESC";

      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
}

export default new ScheduledNotificationService();
