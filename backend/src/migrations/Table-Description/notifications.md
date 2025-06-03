## 🔔 `notifications` Table

Stores individual notifications sent to users, tracking their read status and associated metadata.

---

### 🧱 Columns

| Column     | Type                   | Nullable | Default                    | Description                                   |
|------------|------------------------|----------|----------------------------|-----------------------------------------------|
| id         | integer                | No       | nextval('notifications_id_seq'::regclass) | Primary key, unique identifier for each notification |
| user_id    | integer                | Yes      |                            | Foreign key referencing the recipient user   |
| title      | character varying(255) | No       |                            | Title of the notification                      |
| message    | text                   | No       |                            | Notification message content                   |
| type       | character varying(50)  | No       |                            | Type/category of the notification              |
| read       | boolean                | Yes      | false                      | Flag indicating if the notification has been read |
| created_at | timestamp without time zone | Yes  | CURRENT_TIMESTAMP          | Timestamp when the notification was created   |

---

### 🔍 Indexes

- **notifications_pkey**: Primary key on `id`.

---

### 🔗 Foreign-Key Constraints

- **notifications_user_id_fkey**: Foreign key referencing `users(id)`.
- **notifications_user_id_fkey1**: Foreign key referencing `users(id)` with `ON DELETE CASCADE`.

---

### 📝 Notes

- The `read` column defaults to `false`, meaning notifications are unread when first created.
- Two foreign key constraints on `user_id` exist: one standard and one with cascade delete, ensuring cleanup when a user is removed.
