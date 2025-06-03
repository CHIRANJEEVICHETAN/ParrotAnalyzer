## 🛠️ `error_logs` Table

Stores logs of application errors across services, useful for debugging, monitoring, and analytics.

---

### 🧱 Columns

| Column        | Type                        | Nullable | Default                     | Description                                      |
|---------------|-----------------------------|----------|-----------------------------|--------------------------------------------------|
| `id`          | `integer`                   | ❌       | `nextval('error_logs_id_seq')` | Primary key                                  |
| `timestamp`   | `timestamp with time zone`  | ❌       | —                           | Time when the error occurred                    |
| `service`     | `character varying(100)`    | ❌       | —                           | Name of the service/component where error occurred |
| `error_type`  | `character varying(100)`    | ❌       | —                           | Categorized type of the error (e.g., Validation, DB) |
| `message`     | `text`                      | ❌       | —                           | Error message description                       |
| `user_id`     | `integer`                   | ✅       | —                           | References the affected user (if applicable)    |
| `metadata`    | `jsonb`                     | ✅       | —                           | Additional context data in JSON format          |
| `stack_trace` | `text`                      | ✅       | —                           | Optional full stack trace for deeper debugging  |
| `created_at`  | `timestamp with time zone`  | ✅       | `CURRENT_TIMESTAMP`         | Log creation time                               |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name                         | Type   | Columns                     |
|-----------------------------------|--------|-----------------------------|
| `error_logs_pkey`                 | B-tree | `(id)`                      |
| `idx_error_logs_error_type`       | B-tree | `(error_type)`              |
| `idx_error_logs_service`          | B-tree | `(service)`                 |
| `idx_error_logs_service_timestamp`| B-tree | `(service, timestamp DESC)` |
| `idx_error_logs_timestamp`        | B-tree | `(timestamp DESC)`          |
| `idx_error_logs_type`             | B-tree | `(error_type)`              |
| `idx_error_logs_user_id`          | B-tree | `(user_id)`                 |
| `idx_error_logs_user_timestamp`   | B-tree | `(user_id, timestamp DESC)` |

---

### 🔗 Foreign Key Constraints

| Column     | References     | On Delete |
|------------|----------------|-----------|
| `user_id`  | `users(id)`    | SET NULL  |

---
