## 🔔 `notification_templates` Table

Defines reusable templates for sending system notifications, including dynamic placeholders, target roles, and priority levels.

---

### 🧱 Columns

| Column      | Type                     | Nullable | Default                              | Description                                                       |
|-------------|--------------------------|----------|------------------------------------|-------------------------------------------------------------------|
| id          | integer                  | No       | nextval('notification_templates_id_seq'::regclass) | Primary key, unique identifier for each template                 |
| name        | character varying(255)   | No       |                                    | Name of the notification template                                |
| title       | text                     | No       |                                    | Title of the notification message                               |
| message     | text                     | No       |                                    | Main message body of the notification                           |
| type        | character varying(50)    | No       |                                    | Type/category of the notification (e.g., alert, reminder)       |
| role        | character varying(50)    | No       |                                    | User role targeted by this notification (e.g., employee, admin) |
| priority    | character varying(20)    | No       | 'default'::character varying       | Priority level of the notification (e.g., default, high)        |
| data        | jsonb                    | Yes      | '{}'::jsonb                        | Additional data payload stored as JSON                          |
| variables   | text[]                   | Yes      | '{}'::text[]                      | List of variable placeholders used in the message               |
| created_at  | timestamp with time zone | Yes      | CURRENT_TIMESTAMP                  | Timestamp when the record was created                            |
| updated_at  | timestamp with time zone | Yes      | CURRENT_TIMESTAMP                  | Timestamp when the record was last updated                      |

---

### 🔍 Indexes

- **notification_templates_pkey**: Primary key on `id`.
- **idx_notification_templates_role**: B-tree index on `role` for efficient queries by user role.
- **idx_notification_templates_type**: B-tree index on `type` for efficient queries by notification type.

---

### 🔗 Referenced By

- **push_notifications** — foreign key constraint on `template_id` referencing `notification_templates(id)`
- **scheduled_notifications** — foreign key constraint on `template_id` referencing `notification_templates(id)`

---

### 📝 Notes

- The `variables` column allows dynamic replacement of placeholders in the notification message.
- The `data` column stores additional structured information as JSON to support flexible notification content.
