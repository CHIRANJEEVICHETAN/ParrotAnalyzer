## 👨‍💼 `management_shifts` Table

Logs shift sessions initiated by Management Personnel, including start/end times, distance, expenses, and location data.

---

### 🧱 Columns

| Column              | Type                          | Nullable | Default                                   | Description                                       |
|---------------------|-------------------------------|----------|-------------------------------------------|---------------------------------------------------|
| `id`                | `integer`                     | ❌       | `nextval('management_shifts_id_seq')`     | Primary key                                       |
| `user_id`           | `integer`                     | ✅       | —                                         | References `users(id)`                            |
| `start_time`        | `timestamp without time zone` | ❌       | —                                         | Shift start timestamp                             |
| `end_time`          | `timestamp without time zone` | ✅       | —                                         | Shift end timestamp                               |
| `duration`          | `interval`                    | ✅       | —                                         | Total shift duration                              |
| `status`            | `character varying(20)`       | ✅       | `'active'`                                | Shift status (e.g., active, completed)            |
| `total_kilometers`  | `numeric`                     | ✅       | `0`                                       | Total distance traveled during the shift          |
| `total_expenses`    | `numeric`                     | ✅       | `0`                                       | Total expenses incurred during the shift          |
| `location_start`    | `point`                       | ✅       | —                                         | Starting location (latitude, longitude)           |
| `location_end`      | `point`                       | ✅       | —                                         | Ending location (latitude, longitude)             |
| `created_at`        | `timestamp without time zone` | ✅       | `CURRENT_TIMESTAMP`                       | Record creation timestamp                         |
| `updated_at`        | `timestamp without time zone` | ✅       | `CURRENT_TIMESTAMP`                       | Last update timestamp                             |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name                       | Type   | Columns        | Notes                               |
|----------------------------------|--------|----------------|-------------------------------------|
| `management_shifts_pkey`         | B-tree | `(id)`         | Primary key                         |
| `idx_management_shifts_start_time` | B-tree | `(start_time)` | For sorting/querying by start time  |
| `idx_management_shifts_status`   | B-tree | `(status)`     | For filtering by shift status       |

---

### 🔗 Foreign Key Constraints

| Column    | References     | On Delete |
|-----------|----------------|-----------|
| `user_id` | `users(id)`    | CASCADE   |

---
