## 📍 `geofence_events` Table

Tracks user geofence events such as entries and exits during shifts, with associated timestamps and references.

---

### 🧱 Columns

| Column       | Type                         | Nullable | Default                               | Description                                        |
|--------------|------------------------------|----------|---------------------------------------|----------------------------------------------------|
| `id`         | `integer`                    | ❌       | `nextval('geofence_events_id_seq')`   | Primary key                                        |
| `user_id`    | `integer`                    | ❌       | —                                     | References `users(id)`                            |
| `geofence_id`| `integer`                    | ❌       | —                                     | ID of the geofence                                |
| `shift_id`   | `integer`                    | ❌       | —                                     | References `employee_shifts(id)`                  |
| `event_type` | `character varying(10)`      | ❌       | —                                     | Type of event: `'entry'` or `'exit'`              |
| `timestamp`  | `timestamp with time zone`   | ✅       | `CURRENT_TIMESTAMP`                   | When the event occurred                           |
| `created_at` | `timestamp with time zone`   | ✅       | `CURRENT_TIMESTAMP`                   | Record creation time                              |
| `updated_at` | `timestamp with time zone`   | ✅       | `CURRENT_TIMESTAMP`                   | Last update timestamp                             |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name                        | Type   | Columns       | Notes                        |
|----------------------------------|--------|---------------|------------------------------|
| `geofence_events_pkey`           | B-tree | `(id)`        | Primary key                  |
| `idx_geofence_events_user_id`    | B-tree | `(user_id)`   | For user-based filtering     |
| `idx_geofence_events_geofence_id`| B-tree | `(geofence_id)`| For geofence-specific events |
| `idx_geofence_events_shift_id`   | B-tree | `(shift_id)`  | For shift-specific filtering |
| `idx_geofence_events_timestamp`  | B-tree | `(timestamp)` | For time-based queries       |

---

### ✅ Check Constraints

- `event_type` must be either `'entry'` or `'exit'`

---

### 🔗 Foreign Key Constraints

| Column        | References             | On Delete |
|---------------|------------------------|-----------|
| `user_id`     | `users(id)`            | —         |
| `shift_id`    | `employee_shifts(id)`  | —         |

---

### 🔁 Triggers

| Trigger Name                         | Event         | Description                                  |
|-------------------------------------|---------------|----------------------------------------------|
| `update_geofence_events_updated_at` | `BEFORE UPDATE` | Automatically updates `updated_at` field   |

---
