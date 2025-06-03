## 💬 `support_messages` Table

Stores messages submitted by users seeking support, including message details, user info, and resolution status.

---

### 🧱 Columns

| Column      | Type                      | Nullable | Default             | Description                           |
|-------------|---------------------------|----------|---------------------|-------------------------------------|
| id          | integer                   | No       | nextval('support_messages_id_seq'::regclass) | Primary key                         |
| user_id     | integer                   | Yes      |                     | Reference to the user who sent the message (nullable) |
| subject     | character varying(255)    | No       |                     | Subject of the support message       |
| message     | text                      | No       |                     | Content of the support message       |
| user_email  | character varying(100)    | No       |                     | Email of the user                    |
| user_name   | character varying(100)    | No       |                     | Name of the user                    |
| user_role   | character varying(20)     | No       |                     | Role of the user submitting the message |
| status      | character varying(20)     | Yes      | 'pending'::character varying | Current status of the support message |
| created_at  | timestamp without time zone | Yes    | CURRENT_TIMESTAMP   | Timestamp when the message was created |
| resolved_at | timestamp without time zone | Yes    |                     | Timestamp when the message was resolved |

---

### 🔍 Indexes

- **support_messages_pkey**: Primary key on `id`.

---

### 🔐 Foreign Keys

- **support_messages_user_id_fkey**: Foreign key on `user_id` referencing `users(id)` with `ON DELETE SET NULL`.

---
