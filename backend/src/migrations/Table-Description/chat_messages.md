## 💬 `chat_messages` Table

Stores user-submitted messages and the system's AI-generated responses for chat-based interactions.

---

### 🧱 Columns

| Column       | Type                       | Nullable | Default                             | Description                                  |
|--------------|----------------------------|----------|-------------------------------------|----------------------------------------------|
| `id`         | `integer`                  | ❌       | `nextval('chat_messages_id_seq')`   | Primary key                                  |
| `user_id`    | `integer`                  | ✅       | —                                   | References `users(id)`                       |
| `message`    | `text`                     | ❌       | —                                   | User's input message                         |
| `response`   | `text`                     | ❌       | —                                   | AI-generated or system-generated response    |
| `created_at` | `timestamp with time zone` | ✅       | `CURRENT_TIMESTAMP`                 | Message creation timestamp                   |
| `updated_at` | `timestamp with time zone` | ✅       | `CURRENT_TIMESTAMP`                 | Last update timestamp                        |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name                  | Type   | Columns    | Notes                        |
|-----------------------------|--------|------------|------------------------------|
| `chat_messages_pkey`        | B-tree | `(id)`     | Primary key                  |
| `idx_chat_messages_user_id`| B-tree | `(user_id)`| For filtering by user        |

---

### 🔗 Foreign Key Constraints

| Column    | References     | On Delete |
|-----------|----------------|-----------|
| `user_id` | `users(id)`    | CASCADE   |

---

### ⚙️ Triggers

| Trigger Name                     | Event         | Timing   | Function                        |
|----------------------------------|---------------|----------|---------------------------------|
| `update_chat_messages_updated_at` | `BEFORE UPDATE` | `ROW`    | `update_updated_at_column()`    |

---
