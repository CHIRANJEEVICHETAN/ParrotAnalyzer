## 📍 `employee_locations` Table

Stores real-time and historical location data of employees, including tracking status, movement, and battery info.

---

### 🧱 Columns

| Column              | Type                       | Nullable | Default                                | Description                         |
|---------------------|----------------------------|----------|----------------------------------------|-------------------------------------|
| `id`                | `integer`                  | ❌       | `nextval('employee_locations_id_seq')` | Primary key                         |
| `user_id`           | `integer`                  | ✅       | —                                      | References `users(id)`             |
| `timestamp`         | `timestamp`                | ❌       | `CURRENT_TIMESTAMP`                    | Location timestamp                  |
| `latitude`          | `numeric(10,8)`            | ❌       | —                                      | Latitude value                      |
| `longitude`         | `numeric(11,8)`            | ❌       | —                                      | Longitude value                     |
| `accuracy`          | `numeric(10,2)`            | ✅       | —                                      | GPS accuracy                        |
| `is_moving`         | `boolean`                  | ✅       | `false`                                | Whether the employee is moving      |
| `battery_level`     | `integer`                  | ✅       | —                                      | Device battery level (%)            |
| `shift_id`          | `integer`                  | ✅       | —                                      | References `employee_shifts(id)`   |
| `is_outdoor`        | `boolean`                  | ✅       | `false`                                | Whether location is outdoor         |
| `geofence_status`   | `varchar(20)`              | ✅       | —                                      | Inside/Outside geofence status      |
| `movement_type`     | `varchar(20)`              | ✅       | —                                      | Type of movement (e.g., walk, idle) |
| `location_accuracy` | `integer`                  | ✅       | —                                      | Alternate accuracy metric           |
| `created_at`        | `timestamp`                | ✅       | `CURRENT_TIMESTAMP`                    | Record creation time                |
| `is_tracking_active`| `boolean`                  | ✅       | `false`                                | Tracking status flag                |

---

### 🔑 Primary Key

- `employee_locations_pkey` — `(id)`

---

### 🗂️ Indexes

| Index Name                             | Columns / Conditions                                 |
|----------------------------------------|------------------------------------------------------|
| `idx_employee_locations_moving`        | `(user_id, is_moving)` where `is_moving = true`     |
| `idx_employee_locations_outdoor`       | `(user_id, is_outdoor)` where `is_outdoor = true`   |
| `idx_employee_locations_shift`         | `(shift_id, timestamp DESC)`                        |
| `idx_employee_locations_user_timestamp`| `(user_id, timestamp DESC)`                         |

---

### 🔗 Foreign Key Constraints

| Column     | References                    | On Delete     |
|------------|-------------------------------|---------------|
| `shift_id` | `employee_shifts(id)`         | `CASCADE`     |
| `user_id`  | `users(id)`                   | `CASCADE`     |

---