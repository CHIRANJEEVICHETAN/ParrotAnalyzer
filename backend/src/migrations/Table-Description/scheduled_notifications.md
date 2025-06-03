## 📅 `scheduled_notifications` Table

Manages notifications scheduled for future delivery, targeting specific roles or users with customizable variables and tracking status.

---

### 🧱 Columns

| Column               | Type                    | Nullable | Default                   | Description                                                                                     |
|----------------------|-------------------------|----------|---------------------------|-------------------------------------------------------------------------------------------------|
| id                   | integer                 | No       | nextval('scheduled_notifications_id_seq'::regclass) | Primary key, unique identifier for each scheduled notification                                  |
| template_id          | integer                 | Yes      |                           | Foreign key referencing the notification template                                              |
| variables            | jsonb                   | Yes      | '{}'::jsonb               | JSON object for dynamic variables to replace placeholders in the notification                   |
| target_role          | character varying(50)   | Yes      |                           | Role to which the notification will be sent (mutually exclusive with user and group admin)      |
| target_user_id       | integer                 | Yes      |                           | User ID to send the notification to (mutually exclusive with role and group admin)              |
| target_group_admin_id| integer                 | Yes      |                           | Group admin user ID to send the notification to (mutually exclusive with role and user)         |
| scheduled_for        | timestamp with time zone| No       |                           | Date and time when the notification is scheduled to be sent                                    |
| status               | character varying(20)   | Yes      | 'pending'::character varying | Current status of the scheduled notification (e.g., pending, sent)                              |
| created_at           | timestamp with time zone| Yes      | CURRENT_TIMESTAMP         | Timestamp when the scheduled notification was created                                          |
| updated_at           | timestamp with time zone| Yes      | CURRENT_TIMESTAMP         | Timestamp when the scheduled notification was last updated                                    |
| sent_at              | timestamp with time zone| Yes      |                           | Timestamp when the notification was actually sent                                              |
| error                | text                    | Yes      |                           | Text describing any error encountered during sending                                          |

---

### 🔍 Indexes

- **scheduled_notifications_pkey**: Primary key on `id`.
- **idx_scheduled_notifications_scheduled_for**: Index on `scheduled_for`.
- **idx_scheduled_notifications_status**: Index on `status`.
- **idx_scheduled_notifications_target_group_admin**: Index on `target_group_admin_id`.

---

### ✔️ Check Constraints

- **chk_target_specification**: Ensures exactly one of `target_role`, `target_user_id`, or `target_group_admin_id` is non-null, enforcing mutual exclusivity of notification target.

---

### 🔗 Foreign-Key Constraints

- **scheduled_notifications_target_group_admin_id_fkey**: References `users(id)` for `target_group_admin_id`.
- **scheduled_notifications_target_user_id_fkey**: References `users(id)` for `target_user_id`.
- **scheduled_notifications_template_id_fkey**: References `notification_templates(id)` for `template_id`.

---

### 📝 Notes

- Only one target field (`target_role`, `target_user_id`, or `target_group_admin_id`) can be set per scheduled notification.
- `variables` allow customization of notification content using the associated template.
- The `status` field tracks the lifecycle of the scheduled notification.
- Errors during sending are logged in the `error` column.
