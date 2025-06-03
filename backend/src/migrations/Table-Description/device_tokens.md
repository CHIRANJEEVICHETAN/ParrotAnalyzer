## 📱 `device_tokens` Table

Stores device tokens for push notifications, mapped to user devices and used for platform-specific delivery.

---

### 🧱 Columns

| Column         | Type                        | Nullable | Default                                         | Description                                                              |
|----------------|-----------------------------|----------|-------------------------------------------------|--------------------------------------------------------------------------|
| `id`           | `integer`                   | ❌       | `nextval('device_tokens_id_seq')`              | Primary key                                                              |
| `user_id`      | `integer`                   | ❌       | —                                               | References `users(id)`                                                  |
| `token`        | `character varying(255)`    | ❌       | —                                               | Push notification token                                                  |
| `device_type`  | `character varying(20)`     | ❌       | —                                               | Must be `'ios'`, `'android'`, or `'web'`                                |
| `device_name`  | `character varying(100)`    | ✅       | —                                               | Optional name/label of the device                                       |
| `created_at`   | `timestamp with time zone`  | ✅       | `CURRENT_TIMESTAMP`                             | Record creation time                                                     |
| `updated_at`   | `timestamp with time zone`  | ✅       | `CURRENT_TIMESTAMP`                             | Last update time                                                         |
| `last_used_at` | `timestamp with time zone`  | ✅       | `CURRENT_TIMESTAMP`                             | Last time this token was used                                           |
| `is_active`    | `boolean`                   | ✅       | `true`                                          | Token activity status                                                    |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name                              | Type    | Columns           |
|----------------------------------------|---------|-------------------|
| `device_tokens_pkey`                   | B-tree  | `(id)`            |
| `device_tokens_user_id_token_key`      | Unique  | `(user_id, token)`|
| `idx_device_tokens_token`              | B-tree  | `(token)`         |
| `idx_device_tokens_user_id`            | B-tree  | `(user_id)`       |

---

### ✅ Check Constraints

| Constraint Name                     | Condition                                                             |
|------------------------------------|-----------------------------------------------------------------------|
| `device_tokens_device_type_check`  | `device_type IN ('ios', 'android', 'web')`                            |

---

### 🔗 Foreign Key Constraints

| Column     | References     | On Delete |
|------------|----------------|-----------|
| `user_id`  | `users(id)`    | CASCADE   |

---
