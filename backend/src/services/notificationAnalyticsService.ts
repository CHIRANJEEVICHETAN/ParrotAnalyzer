import { pool } from "../config/database";

interface NotificationAnalytics {
  id: number;
  notification_id: number;
  user_id: number;
  action: "delivered" | "opened" | "clicked" | "dismissed";
  metadata?: Record<string, any>;
  created_at: Date;
}

class NotificationAnalyticsService {
  async trackNotificationAction(
    notificationId: number,
    userId: number,
    action: NotificationAnalytics["action"],
    metadata?: Record<string, any>
  ) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO notification_analytics 
         (notification_id, user_id, action, metadata) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [notificationId, userId, action, metadata]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getNotificationStats(
    options: {
      notificationId?: number;
      userId?: number;
      action?: NotificationAnalytics["action"];
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const client = await pool.connect();
    try {
      let query = `
        SELECT 
          n.type,
          COUNT(*) as total_count,
          COUNT(CASE WHEN a.action = 'delivered' THEN 1 END) as delivered_count,
          COUNT(CASE WHEN a.action = 'opened' THEN 1 END) as opened_count,
          COUNT(CASE WHEN a.action = 'clicked' THEN 1 END) as clicked_count,
          COUNT(CASE WHEN a.action = 'dismissed' THEN 1 END) as dismissed_count,
          AVG(CASE 
            WHEN a.action = 'opened' 
            THEN EXTRACT(EPOCH FROM (a.created_at - n.created_at)) 
          END) as avg_time_to_open
        FROM push_notifications n
        LEFT JOIN notification_analytics a ON n.id = a.notification_id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramCount = 1;

      if (options.notificationId) {
        query += ` AND n.id = $${paramCount}`;
        params.push(options.notificationId);
        paramCount++;
      }

      if (options.userId) {
        query += ` AND n.user_id = $${paramCount}`;
        params.push(options.userId);
        paramCount++;
      }

      if (options.action) {
        query += ` AND a.action = $${paramCount}`;
        params.push(options.action);
        paramCount++;
      }

      if (options.startDate) {
        query += ` AND n.created_at >= $${paramCount}`;
        params.push(options.startDate);
        paramCount++;
      }

      if (options.endDate) {
        query += ` AND n.created_at <= $${paramCount}`;
        params.push(options.endDate);
        paramCount++;
      }

      query += " GROUP BY n.type";

      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getUserEngagementMetrics(userId: number) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          COUNT(DISTINCT n.id) as total_notifications,
          COUNT(DISTINCT CASE WHEN a.action = 'opened' THEN n.id END) as opened_notifications,
          COUNT(DISTINCT CASE WHEN a.action = 'clicked' THEN n.id END) as clicked_notifications,
          AVG(CASE 
            WHEN a.action = 'opened' 
            THEN EXTRACT(EPOCH FROM (a.created_at - n.created_at)) 
          END) as avg_response_time,
          COUNT(DISTINCT CASE 
            WHEN a.action = 'opened' AND 
            EXTRACT(EPOCH FROM (a.created_at - n.created_at)) <= 300 
            THEN n.id 
          END) as quick_responses
        FROM push_notifications n
        LEFT JOIN notification_analytics a ON n.id = a.notification_id
        WHERE n.user_id = $1
        AND n.created_at >= NOW() - INTERVAL '30 days'
      `,
        [userId]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getNotificationEffectiveness(templateId?: number) {
    const client = await pool.connect();
    try {
      let query = `
        SELECT 
          t.name as template_name,
          COUNT(DISTINCT n.id) as total_sent,
          COUNT(DISTINCT CASE WHEN a.action = 'opened' THEN n.id END) as total_opened,
          COUNT(DISTINCT CASE WHEN a.action = 'clicked' THEN n.id END) as total_clicked,
          ROUND(
            COUNT(DISTINCT CASE WHEN a.action = 'opened' THEN n.id END)::NUMERIC / 
            COUNT(DISTINCT n.id)::NUMERIC * 100, 
            2
          ) as open_rate,
          ROUND(
            COUNT(DISTINCT CASE WHEN a.action = 'clicked' THEN n.id END)::NUMERIC / 
            COUNT(DISTINCT CASE WHEN a.action = 'opened' THEN n.id END)::NUMERIC * 100, 
            2
          ) as click_through_rate
        FROM notification_templates t
        JOIN push_notifications n ON n.template_id = t.id
        LEFT JOIN notification_analytics a ON n.id = a.notification_id
        WHERE n.created_at >= NOW() - INTERVAL '30 days'
      `;
      const params: any[] = [];

      if (templateId) {
        query += " AND t.id = $1";
        params.push(templateId);
      }

      query += " GROUP BY t.id, t.name ORDER BY total_sent DESC";

      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getBatchAnalytics(batchId: string) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          COUNT(DISTINCT n.id) as total_in_batch,
          COUNT(DISTINCT CASE WHEN a.action = 'delivered' THEN n.id END) as delivered_count,
          COUNT(DISTINCT CASE WHEN a.action = 'opened' THEN n.id END) as opened_count,
          COUNT(DISTINCT CASE WHEN a.action = 'clicked' THEN n.id END) as clicked_count,
          MIN(n.created_at) as batch_start_time,
          MAX(n.created_at) as batch_end_time,
          AVG(CASE 
            WHEN a.action = 'delivered' 
            THEN EXTRACT(EPOCH FROM (a.created_at - n.created_at)) 
          END) as avg_delivery_time
        FROM push_notifications n
        LEFT JOIN notification_analytics a ON n.id = a.notification_id
        WHERE n.batch_id = $1
      `,
        [batchId]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }
}

export default new NotificationAnalyticsService();
