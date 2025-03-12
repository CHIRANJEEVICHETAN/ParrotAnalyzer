import { pool } from "../config/database";

export interface NotificationTemplate {
  id: number;
  name: string;
  title: string;
  message: string;
  type: string;
  role: string;
  priority: "high" | "default" | "low";
  data?: Record<string, any>;
  variables?: string[];
  created_at: Date;
  updated_at: Date;
}

class NotificationTemplateModel {
  // Create a new template
  async create(
    template: Omit<NotificationTemplate, "id" | "created_at" | "updated_at">
  ) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO notification_templates 
         (name, title, message, type, role, priority, data, variables) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [
          template.name,
          template.title,
          template.message,
          template.type,
          template.role,
          template.priority,
          template.data || {},
          template.variables || [],
        ]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Get template by ID
  async getById(id: number) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM notification_templates WHERE id = $1",
        [id]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Get templates by role
  async getByRole(role: string) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM notification_templates WHERE role = $1 OR role = 'all'",
        [role]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Update template
  async update(id: number, template: Partial<NotificationTemplate>) {
    const client = await pool.connect();
    try {
      const fields = Object.keys(template)
        .map((key, i) => `${key} = $${i + 2}`)
        .join(", ");
      const values = Object.values(template);

      const result = await client.query(
        `UPDATE notification_templates 
         SET ${fields}, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING *`,
        [id, ...values]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Delete template
  async delete(id: number) {
    const client = await pool.connect();
    try {
      await client.query("DELETE FROM notification_templates WHERE id = $1", [
        id,
      ]);
      return true;
    } finally {
      client.release();
    }
  }

  // Get all templates
  async getAll() {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM notification_templates ORDER BY created_at DESC"
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Render template with variables
  renderTemplate(
    template: NotificationTemplate,
    variables: Record<string, any>
  ) {
    let title = template.title;
    let message = template.message;

    // Replace variables in title and message
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      title = title.replace(regex, String(value));
      message = message.replace(regex, String(value));
    });

    return {
      ...template,
      title,
      message,
    };
  }
}

export default new NotificationTemplateModel();
