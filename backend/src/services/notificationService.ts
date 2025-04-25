import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { pool } from "../config/database";
import { QueryResult } from "pg";
import * as admin from "firebase-admin";
import { getMessaging } from "firebase-admin/messaging";

// Initialize Firebase Admin
const serviceAccount = require("../config/admin-service-key.json");
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

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

type ExpoErrorCode =
  | "DeviceNotRegistered"
  | "MessageTooBig"
  | "MessageRateExceeded"
  | "MismatchSenderId"
  | "InvalidCredentials"
  | "DeveloperError"
  | "ExpoError"
  | "ProviderError";

interface PushMessage {
  to: string;
  sound: string;
  title: string;
  body: string;
  data?: any;
  priority: "default" | "normal" | "high";
  categoryId?: string;
  badge: number;
  channelId: string;
  _displayInForeground: boolean;
  isExpoToken?: boolean;
}

interface PushReceipt {
  id: string;
  status: "ok" | "error";
  message?: string;
  details?: {
    error?: ExpoErrorCode;
    [key: string]: any;
  };
}

interface PushTicket {
  id?: string;
  status: "ok" | "error";
  message?: string;
  details?: {
    error?: ExpoErrorCode;
    [key: string]: any;
  };
}

interface FCMResult {
  error?: Error;
  messageId?: string;
}

interface NotificationResult {
  expo: {
    success: boolean;
    tickets: PushTicket[];
  };
  fcm: {
    success: boolean;
    results: FCMResult[];
  };
}

class NotificationService {
  private expo: Expo;
  private messaging: admin.messaging.Messaging;

  constructor() {
    this.expo = new Expo();
    this.messaging = getMessaging();
  }

  private isExpoToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  private async sendFCMNotification(
    token: string,
    notification: PushNotification
  ): Promise<string> {
    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: notification.title,
          body: notification.message,
        },
        data: notification.data || {},
        android: {
          priority: notification.priority === "high" ? "high" : "normal",
          notification: {
            channelId:
              notification.priority === "high" ? "high_priority" : "default",
            sound: "default",
            priority: "high",
          },
        },
        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              sound: "default",
              badge: 1,
              contentAvailable: true,
              mutableContent: true,
              interruptionLevel:
                notification.priority === "high" ? "time-sensitive" : "active",
            },
          },
        },
      };

      return await this.messaging.send(message);
    } catch (error) {
      console.error("[FCM] Error sending message:", error);
      throw error;
    }
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
      console.log("[PUSH] Starting sendPushNotification:", {
        notificationId: notification.id,
        title: notification.title.substring(0, 20),
        recipientCount: userIds?.length || 1,
        targetUsers: userIds,
      });

      if (!userIds || userIds.length === 0) {
        userIds = [notification.user_id];
      }

      // For test notifications, first create a record
      if (notification.id === 0) {
        const result = await client.query(
          `INSERT INTO push_notifications 
           (user_id, title, message, type, priority, data) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING id`,
          [
            notification.user_id,
            notification.title,
            notification.message,
            notification.type || "test",
            notification.priority || "default",
            notification.data || {},
          ]
        );
        notification.id = result.rows[0].id;
      }

      const tokenResult = await client.query(
        "SELECT dt.*, u.role FROM device_tokens dt JOIN users u ON dt.user_id::integer = u.id WHERE dt.user_id = ANY($1) AND dt.is_active = true",
        [userIds]
      );

      const tokens = tokenResult.rows.map((row) => ({
        token: row.token,
        isExpoToken: this.isExpoToken(row.token),
      }));

      console.log(
        `[PUSH] Retrieved ${tokens.length} active tokens for ${userIds.length} recipients`
      );

      if (!tokens.length) {
        console.log("[PUSH] No tokens found for recipients");
        return { success: false, message: "No registered devices found" };
      }

      // Separate Expo and FCM tokens
      const expoTokens = tokens
        .filter((t) => t.isExpoToken)
        .map((t) => t.token);
      const fcmTokens = tokens
        .filter((t) => !t.isExpoToken)
        .map((t) => t.token);

      const results: NotificationResult = {
        expo: { success: false, tickets: [] },
        fcm: { success: false, results: [] },
      };

      // Handle Expo notifications
      if (expoTokens.length > 0) {
        const messages: ExpoPushMessage[] = expoTokens.map((token) => ({
          to: token,
          sound: "default",
          title: notification.title,
          body: notification.message,
          data: notification.data || {},
          priority: notification.priority as "default" | "normal" | "high",
          categoryId: notification.category,
          badge: 1,
          channelId:
            notification.priority === "high" ? "high_priority" : "default",
          _displayInForeground: true,
        }));

        const chunks = this.expo.chunkPushNotifications(messages);
        const tickets: PushTicket[] = [];

        for (let chunk of chunks) {
          try {
            const ticketChunk = await this.expo.sendPushNotificationsAsync(
              chunk
            );
            tickets.push(...ticketChunk);
          } catch (error) {
            console.error("[EXPO] Error sending notification chunk:", error);
          }
        }

        results.expo = {
          success: tickets.some((t) => t.status === "ok"),
          tickets,
        };
      }

      // Handle FCM notifications
      if (fcmTokens.length > 0) {
        const fcmResults = await Promise.all(
          fcmTokens.map(async (token) => {
            try {
              const messageId = await this.sendFCMNotification(
                token,
                notification
              );
              return { messageId };
            } catch (error) {
              return { error: error as Error };
            }
          })
        );

        results.fcm = {
          success: fcmResults.some((result) => !result.error),
          results: fcmResults,
        };
      }

      // Update notification as sent
      await client.query(
        `UPDATE push_notifications
         SET sent = true, sent_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [notification.id]
      );

      return {
        success: results.expo.success || results.fcm.success,
        results,
      };
    } catch (error: any) {
      console.error("[PUSH] Fatal error in sendPushNotification:", error);
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

  async processReceipts(): Promise<void> {
    const client = await pool.connect();
    try {
      console.log("[PUSH] Starting receipt processing");

      // Get unprocessed receipts
      const { rows } = await client.query(
        `SELECT id, receipt_id FROM push_receipts WHERE processed = false`
      );

      if (rows.length === 0) {
        console.log("[PUSH] No unprocessed receipts found");
        return;
      }

      console.log(`[PUSH] Processing ${rows.length} receipts`);

      // Process receipts in chunks
      const chunks = this.expo.chunkPushNotificationReceiptIds(
        rows.map((r) => r.receipt_id)
      );

      for (const chunk of chunks) {
        try {
          const receipts = await this.expo.getPushNotificationReceiptsAsync(
            chunk
          );

          // Convert receipts object to array for iteration
          const receiptArray = Object.entries(receipts).map(
            ([id, receipt]) => ({
              id,
              ...receipt,
            })
          );

          for (const receipt of receiptArray) {
            console.log(`[RECEIPT] Processing receipt ${receipt.id}:`, receipt);

            if (receipt.status === "error") {
              console.error(
                `[RECEIPT] Error [${receipt.id}]:`,
                receipt.message,
                receipt.details?.error
              );

              // Update receipt with error details
              await client.query(
                `UPDATE push_receipts 
                 SET processed = true,
                     processed_at = CURRENT_TIMESTAMP,
                     error_details = $1
                 WHERE receipt_id = $2`,
                [
                  JSON.stringify({
                    status: receipt.status,
                    message: receipt.message,
                    error: receipt.details?.error,
                    details: receipt.details,
                  }),
                  receipt.id,
                ]
              );

              // Handle specific error codes
              if (receipt.details?.error === "DeviceNotRegistered") {
                // Get the token associated with this receipt
                const { rows: tokenRows } = await client.query(
                  `SELECT dt.token, dt.user_id 
                   FROM device_tokens dt
                   JOIN push_receipts pr ON pr.notification_id = dt.notification_id
                   WHERE pr.receipt_id = $1`,
                  [receipt.id]
                );

                if (tokenRows.length > 0) {
                  const { token, user_id } = tokenRows[0];
                  console.log(
                    `[RECEIPT] Marking token ${token} as inactive due to DeviceNotRegistered error`
                  );
                  await this.removeDeviceToken(user_id, token);
                }
              }
            } else {
              // Update receipt as processed successfully
              await client.query(
                `UPDATE push_receipts 
                 SET processed = true,
                     processed_at = CURRENT_TIMESTAMP
                 WHERE receipt_id = $1`,
                [receipt.id]
              );
            }
          }
        } catch (error) {
          console.error("[PUSH] Error processing receipt chunk:", error);
        }
      }
    } catch (error) {
      console.error("[PUSH] Error in processReceipts:", error);
    } finally {
      client.release();
    }
  }
}

export default new NotificationService();
