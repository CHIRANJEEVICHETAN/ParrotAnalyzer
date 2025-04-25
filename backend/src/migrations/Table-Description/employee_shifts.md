## 🕒 `employee_shifts` Table

Represents a user's working shift with start/end times, GPS-based tracking, expenses, and location history.

---

### 🧱 Columns

| Column                 | Type                          | Nullable | Default                                  | Description                            |
|------------------------|-------------------------------|----------|------------------------------------------|----------------------------------------|
| `id`                   | `integer`                     | ❌       | `nextval('employee_shifts_id_seq')`      | Primary key                            |
| `user_id`              | `integer`                     | ✅       | —                                        | References `users(id)`                |
| `start_time`           | `timestamp`                   | ❌       | —                                        | Shift start time                      |
| `end_time`             | `timestamp`                   | ✅       | —                                        | Shift end time                        |
| `duration`             | `interval`                    | ✅       | —                                        | Total shift duration                  |
| `status`               | `varchar(20)`                 | ✅       | `'active'`                               | Shift status (`active`, `completed`, etc.) |
| `total_kilometers`     | `numeric`                     | ✅       | `0`                                      | Total distance in kilometers          |
| `total_expenses`       | `numeric`                     | ✅       | `0`                                      | Total expenses during the shift       |
| `location_start`       | `point`                       | ✅       | —                                        | Starting GPS point                    |
| `location_end`         | `point`                       | ✅       | —                                        | Ending GPS point                      |
| `created_at`           | `timestamp`                   | ✅       | `CURRENT_TIMESTAMP`                      | Record creation time                  |
| `updated_at`           | `timestamp`                   | ✅       | `CURRENT_TIMESTAMP`                      | Last update time                      |
| `location_history`     | `geography(LineString,4326)`  | ✅       | —                                        | Full path of the shift                |
| `total_distance_km`    | `numeric(10,2)`               | ✅       | `0`                                      | Redundant/processed total distance    |
| `travel_time_minutes`  | `integer`                     | ✅       | `0`                                      | Travel time in minutes                |
| `last_location_update` | `timestamp`                   | ✅       | —                                        | Last GPS update time                  |
| `is_tracking_active`   | `boolean`                     | ✅       | `false`                                  | Whether tracking is active            |

---

### 🔑 Primary Key

- `employee_shifts_pkey` — `(id)`

---

### 🗂️ Indexes

| Index Name                       | Columns / Type                     |
|----------------------------------|------------------------------------|
| `idx_employee_shifts_location`   | `location_history` (GIST index)    |
| `idx_employee_shifts_start_time` | `start_time` (B-tree index)        |
| `idx_employee_shifts_status`     | `status` (B-tree index)            |

---

### 🔗 Foreign Key Constraints

| Column     | References         | On Delete |
|------------|--------------------|-----------|
| `user_id`  | `users(id)`        | `CASCADE` |

---

### 🔁 Referenced By

| Table                | Column     | On Delete |
|----------------------|------------|-----------|
| `employee_locations` | `shift_id` | `CASCADE` |
| `geofence_events`    | `shift_id` | `CASCADE` |

---