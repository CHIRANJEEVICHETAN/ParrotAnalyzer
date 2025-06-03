## 📲 `push_notifications` Table

Stores push notification records sent to users, including metadata, status, and references to templates and batches.

---

### 🧱 Columns

| Column       | Type                    | Nullable | Default                                         | Description                                                        |
|--------------|-------------------------|----------|-------------------------------------------------|--------------------------------------------------------------------|
| id           | integer                 | No       | nextval('push_notifications_id_seq'::regclass) | Primary key, unique identifier for each push notification          |
| user_id      | integer                 | No       |                                                 | Foreign key referencing the recipient user                         |
| title        | character varying(255)  | No       |                                                 | Title of the push notification                                     |
| message      | text                    | No       |                                                 | Content/message body of the notification                           |
| data         | jsonb                   | Yes      | '{}'::jsonb                                     | Additional data payload in JSON format                             |
| type         | character varying(50)   | No       |                                                 | Type/category of the notification                                  |
| sent         | boolean                 | Yes      | false                                           | Indicates if the notification has been sent                        |
| created_at   | timestamp with time zone| Yes      | CURRENT_TIMESTAMP                               | Timestamp when the notification was created                        |
| sent_at      | timestamp with time zone| Yes      |                                                 | Timestamp when the notification was sent                           |
| action_url   | character varying(255)  | Yes      |                                                 | URL linked with the notification action                            |
| priority     | character varying(20)   | Yes      | 'default'::character varying                     | Priority level (high, default, low)                               |
| category     | character varying(50)   | Yes      |                                                 | Category classification of the notification                        |
| expires_at   | timestamp with time zone| Yes      |                                                 | Expiration timestamp for the notification                          |
| batch_id     | character varying(255)  | Yes      |                                                 | Identifier for grouping notifications in a batch                   |
| template_id  | integer                 | Yes      |                                                 | Foreign key referencing the notification template                  |

---

### 🔍 Indexes

- **push_notifications_pkey**: Primary key on `id`.
- **idx_push_notifications_batch**: Index on `batch_id`.
- **idx_push_notifications_created_at**: Index on `created_at`.
- **idx_push_notifications_expiration**: Index on `expires_at`.
- **idx_push_notifications_sent**: Index on `sent`.
- **idx_push_notifications_type**: Index on `type`.
- **idx_push_notifications_user_id**: Index on `user_id`.

---

### ✅ Check Constraints

- **push_notifications_priority_check**: Ensures `priority` is one of `'high'`, `'default'`, or `'low'`.

---

### 🔗 Foreign-Key Constraints

- **push_notifications_template_id_fkey**: References `notification_templates(id)`.
- **push_notifications_user_id_fkey**: References `users(id)` with `ON DELETE CASCADE`.

---

### 📝 Notes

- The `sent` column defaults to `false`, indicating the notification has not yet been sent.
- The table supports optional batching (`batch_id`) and templating (`template_id`) of notifications.
- Notifications can have expiration times and action URLs for user interaction.
- Referenced by the `push_receipts` table with cascading deletes on `push_notifications(id)`.
