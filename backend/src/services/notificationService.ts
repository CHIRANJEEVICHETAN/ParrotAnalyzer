import {
  Expo,
  ExpoPushMessage,
  ExpoPushSuccessTicket,
  ExpoPushErrorReceipt,
} from "expo-server-sdk";
import { pool } from "../config/database";
import { QueryResult } from "pg";

interface DeviceToken {
  id: number;
  user_id: string;
  token: string;
  device_type: string;
  is_active: boolean;
}

interface PushNotification {
  id: number;
  user_id: string;
  title: string;
  message: string;
  data?: any;
  type: string;
  priority: string;
  category?: string;
  action_url?: string;
  template_id?: number;
}

interface InAppNotification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: Date;
}

class NotificationService {
  private expo: Expo;

  constructor() {
    this.expo = new Expo();
  }

  async saveDeviceToken(
    userId: string,
    token: string,
    deviceType: string,
    deviceName: string
  ): Promise<QueryResult> {
    const client = await pool.connect();
    try {
      // Check if token already exists
      const existingToken = await client.query(
        "SELECT id FROM device_tokens WHERE user_id = $1 AND token = $2",
        [userId, token]
      );

      if (existingToken.rows.length > 0) {
        // Update existing token
        return await client.query(
          `UPDATE device_tokens 
           SET is_active = true, 
               device_type = $3, 
               device_name = $4,
               updated_at = CURRENT_TIMESTAMP,
               last_used_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND token = $2
           RETURNING *`,
          [userId, token, deviceType, deviceName]
        );
      }

      // Insert new token
      return await client.query(
        `INSERT INTO device_tokens 
         (user_id, token, device_type, device_name) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [userId, token, deviceType, deviceName]
      );
    } finally {
      client.release();
    }
  }

  async removeDeviceToken(userId: string, token: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        "UPDATE device_tokens SET is_active = false WHERE user_id = $1 AND token = $2",
        [userId, token]
      );
    } finally {
      client.release();
    }
  }

  async sendPushNotification(
    notification: PushNotification,
    userIds?: string[]
  ): Promise<any> {
    const client = await pool.connect();
    try {
      console.log('[PUSH] Starting sendPushNotification:', {
        notificationId: notification.id,
        title: notification.title.substring(0, 20),
        recipientCount: userIds?.length || 1
      });
      
      if (!userIds || userIds.length === 0) {
        userIds = [notification.user_id];
      }

      // Get active device tokens
      const tokenQuery = userIds
        ? "SELECT token FROM device_tokens WHERE user_id = ANY($1) AND is_active = true"
        : "SELECT token FROM device_tokens WHERE is_active = true";
      const tokenParams = userIds ? [userIds] : [];

      const tokenResult = await client.query(tokenQuery, tokenParams);
      const tokens = tokenResult.rows.map(row => row.token);
      
      console.log(`[PUSH] Retrieved ${tokens.length} tokens for ${userIds.length} recipients`);
      
      if (!tokens.length) {
        console.log('[PUSH] No tokens found for recipients');
        return { success: false, message: 'No registered devices found' };
      }

      // Format the notification for Expo push service
      const messages = [];
      for (const token of tokens) {
        if (!Expo.isExpoPushToken(token)) {
          console.error(`[PUSH] Invalid Expo push token: ${token}`);
          continue;
        }

        messages.push({
          to: token,
          sound: 'default',
          title: notification.title,
          body: notification.message,
          data: notification.data || {},
          priority: notification.priority as "default" | "normal" | "high",
          categoryId: notification.category,
          badge: 1, // Set badge count
          channelId: 'default', // Android channel ID
          // Add these fields for better delivery rates
          _displayInForeground: true, // Force display in foreground 
        });
      }

      if (messages.length === 0) {
        console.log('[PUSH] No valid tokens to send notifications');
        return { success: false, message: 'No valid tokens' };
      }

      console.log(`[PUSH] Prepared ${messages.length} messages for sending`);
      
      // Send to Expo push notification service
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];
      
      // Send chunks to Expo
      for (let chunk of chunks) {
        try {
          console.log(`[PUSH] Sending chunk of ${chunk.length} messages...`);
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          console.log(`[PUSH] Received ${ticketChunk.length} tickets in response`);
          
          // Log any errors in the response
          ticketChunk.forEach((ticket, i) => {
            if (ticket.status === 'error') {
              console.error(`[PUSH] Error in ticket ${i}:`, ticket.message);
            }
          });
          
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('[PUSH] Error sending notification chunk:', error);
        }
      }

      // Check if we have any successful tickets
      const successTickets = tickets.filter(ticket => ticket.status === 'ok');
      console.log(`[PUSH] Successfully sent ${successTickets.length}/${tickets.length} notifications`);
      
      // Update notification as sent in the database
      await client.query(
        `UPDATE push_notifications
         SET sent = true, sent_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [notification.id]
      );
      
      return { success: successTickets.length > 0, tickets };
    } catch (error: any) {
      console.error('[PUSH] Fatal error in sendPushNotification:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  async getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<PushNotification[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM push_notifications 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async createInAppNotification(
    userId: number,
    title: string,
    message: string,
    type: string
  ): Promise<QueryResult> {
    const client = await pool.connect();
    try {
      return await client.query(
        `INSERT INTO notifications 
         (user_id, title, message, type) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [userId, title, message, type]
      );
    } finally {
      client.release();
    }
  }

  async getUserNotificationsByRole(
    userId: number,
    role: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ push: PushNotification[]; inApp: InAppNotification[] }> {
    const client = await pool.connect();
    try {
      // Get push notifications - only those belonging to the user
      const pushResult = await client.query(
        `SELECT DISTINCT ON (id) * FROM push_notifications 
         WHERE user_id = $1 
         ORDER BY id, created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      // Get in-app notifications - only those belonging to the user
      const inAppResult = await client.query(
        `SELECT DISTINCT ON (id) * FROM notifications 
         WHERE user_id = $1 
         ORDER BY id, created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      console.log("[GetNotifications] Results:", {
        userId,
        role,
        pushCount: pushResult.rows.length,
        inAppCount: inAppResult.rows.length,
      });

      return {
        push: pushResult.rows,
        inApp: inAppResult.rows,
      };
    } finally {
      client.release();
    }
  }

  async markNotificationAsRead(
    notificationId: number,
    userId: number
  ): Promise<QueryResult> {
    const client = await pool.connect();
    try {
      return await client.query(
        `UPDATE notifications 
         SET read = true 
         WHERE id = $1 AND user_id = $2 
         RETURNING *`,
        [notificationId, userId]
      );
    } finally {
      client.release();
    }
  }

  async sendGroupNotification(
    groupAdminId: number,
    targetGroupAdminId: number,
    notification: Omit<PushNotification, "id" | "user_id">
  ): Promise<void> {
    const client = await pool.connect();
    try {
      // Get all employees under this group admin
      const employees = await client.query(
        `SELECT id FROM users WHERE group_admin_id = $1 AND role = 'employee'`,
        [targetGroupAdminId]
      );

      // Send notification to each employee
      for (const employee of employees.rows) {
        await this.sendPushNotification({
          ...notification,
          id: 0,
          user_id: employee.id.toString(),
        });

        // Create in-app notification
        await this.createInAppNotification(
          employee.id,
          notification.title,
          notification.message,
          notification.type
        );
      }
    } finally {
      client.release();
    }
  }

  async sendRoleNotification(
    managementId: number,
    role: string,
    notification: Omit<PushNotification, "id" | "user_id">,
    excludeSender: boolean = false
  ): Promise<void> {
    const client = await pool.connect();
    try {
      // Get all users with the specified role, excluding the sender if needed
      const query = excludeSender
        ? `SELECT DISTINCT u.id 
           FROM users u 
           LEFT JOIN device_tokens dt ON u.id = dt.user_id::integer 
           WHERE u.role = $1 
           AND u.id != $2 
           AND dt.is_active = true`
        : `SELECT DISTINCT u.id 
           FROM users u 
           LEFT JOIN device_tokens dt ON u.id = dt.user_id::integer 
           WHERE u.role = $1 
           AND dt.is_active = true`;

      const params = excludeSender ? [role, managementId] : [role];
      const users = await client.query(query, params);

      if (users.rows.length > 0) {
        // Send push notification to all users at once
        await this.sendPushNotification(
          {
            ...notification,
            id: 0,
            user_id: managementId.toString(), // sender's ID
          },
          users.rows.map((user) => user.id.toString())
        );

        // Create in-app notifications for each user
        for (const user of users.rows) {
          await this.createInAppNotification(
            user.id,
            notification.title,
            notification.message,
            notification.type
          );
        }
      }
    } finally {
      client.release();
    }
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT COUNT(*) FROM notifications 
         WHERE user_id = $1 AND read = false`,
        [userId]
      );
      return parseInt(result.rows[0].count);
    } finally {
      client.release();
    }
  }
}

export default new NotificationService();
