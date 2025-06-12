## ⏲️ `shift_timer_settings` Table

Stores per-shift timer configurations and status for users, including duration, completion state, and notification tracking.

---

### 🧱 Columns

| Column                   | Type                          | Nullable | Default                                            | Description                                                       |
|--------------------------|-------------------------------|----------|----------------------------------------------------|-------------------------------------------------------------------|
| `id`                     | `integer`                     | ❌       | `nextval('shift_timer_settings_id_seq')`           | Primary key                                                       |
| `shift_id`               | `integer`                     | ❌       |                                                    | References the shift this timer applies to                        |
| `user_id`                | `integer`                     | ❌       |                                                    | References the user the timer belongs to                          |
| `timer_duration_hours`   | `numeric(5,2)`                | ❌       |                                                    | Configured duration of the timer in hours                         |
| `end_time`               | `timestamp with time zone`    | ❌       |                                                    | Exact timestamp when the timer should complete                    |
| `created_at`             | `timestamp with time zone`    | ✅       | `CURRENT_TIMESTAMP`                                | Record creation timestamp                                         |
| `completed`              | `boolean`                     | ❌       | `false`                                            | Flag indicating if the timer has completed                        |
| `notification_sent`      | `boolean`                     | ❌       | `false`                                            | Flag indicating if completion notification has been sent          |
| `role_type`              | `character varying(20)`       | ✅       | `'employee'::character varying`                    | Role type context for this timer (e.g., `employee`, `group_admin`) |
| `shift_table_name`       | `character varying(50)`       | ✅       | `'employee_shifts'::character varying`             | Name of the shifts table this timer references                    |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name                      | Type   | Columns                     | Notes                                              |
|---------------------------------|--------|-----------------------------|----------------------------------------------------|
| `shift_timer_settings_pkey`     | B-tree | `(id)`                      | Primary key                                        |
| `idx_shift_timer_notification`  | B-tree | `(notification_sent, end_time)` | For querying timers needing notification           |
| `idx_shift_timer_pending`       | B-tree | `(completed, end_time)`     | For finding pending (incomplete) timers            |
| `idx_shift_timer_user_id`       | B-tree | `(user_id)`                 | For filtering by user                              |

---

### 🔗 Foreign Key Constraints

| Column     | References     | On Delete |
|------------|----------------|-----------|
| `user_id`  | `users(id)`    | CASCADE   |