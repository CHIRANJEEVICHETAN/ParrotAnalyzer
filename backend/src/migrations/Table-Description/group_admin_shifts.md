## ⏱️ `group_admin_shifts` Table

Tracks shift sessions started by Group Admins, including start/end times, distance, expenses, and locations.

---

### 🧱 Columns

| Column              | Type                          | Nullable | Default                                  | Description                                     |
|---------------------|-------------------------------|----------|------------------------------------------|-------------------------------------------------|
| `id`                | `integer`                     | ❌       | `nextval('group_admin_shifts_id_seq')`   | Primary key                                     |
| `user_id`           | `integer`                     | ✅       | —                                        | References `users(id)`                          |
| `start_time`        | `timestamp without time zone` | ❌       | —                                        | Shift start timestamp                           |
| `end_time`          | `timestamp without time zone` | ✅       | —                                        | Shift end timestamp                             |
| `duration`          | `interval`                    | ✅       | —                                        | Total duration of the shift                     |
| `status`            | `character varying(20)`       | ✅       | `'active'`                               | Current status of the shift (active/completed)  |
| `total_kilometers`  | `numeric`                     | ✅       | `0`                                      | Distance covered during the shift               |
| `total_expenses`    | `numeric`                     | ✅       | `0`                                      | Expenses recorded during the shift              |
| `location_start`    | `point`                       | ✅       | —                                        | Geographical start location (lat, long)         |
| `location_end`      | `point`                       | ✅       | —                                        | Geographical end location (lat, long)           |
| `created_at`        | `timestamp without time zone` | ✅       | `CURRENT_TIMESTAMP`                      | Record creation timestamp                       |
| `updated_at`        | `timestamp without time zone` | ✅       | `CURRENT_TIMESTAMP`                      | Last updated timestamp                          |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name                          | Type   | Columns        | Notes                              |
|-------------------------------------|--------|----------------|------------------------------------|
| `group_admin_shifts_pkey`           | B-tree | `(id)`         | Primary key                        |
| `idx_group_admin_shifts_start_time` | B-tree | `(start_time)` | For sorting/querying by start time |
| `idx_group_admin_shifts_status`     | B-tree | `(status)`     | For filtering by shift status      |

---

### 🔗 Foreign Key Constraints

| Column    | References     | On Delete |
|-----------|----------------|-----------|
| `user_id` | `users(id)`    | CASCADE   |

---
