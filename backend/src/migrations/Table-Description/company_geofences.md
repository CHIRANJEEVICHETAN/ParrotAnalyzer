## 📍 `company_geofences` Table

Stores geofence zones associated with companies, including radius, coordinates, and tracking metadata.

---

### 🧱 Columns

| Column        | Type                         | Nullable | Default                                 | Description                                 |
|---------------|------------------------------|----------|-----------------------------------------|---------------------------------------------|
| `id`          | `integer`                    | ❌       | `nextval('company_geofences_id_seq')`   | Primary key                                  |
| `company_id`  | `integer`                    | ✅       | —                                       | References `companies(id)`                  |
| `name`        | `varchar(100)`               | ❌       | —                                       | Name of the geofence                         |
| `coordinates` | `geography(Point, 4326)`     | ❌       | —                                       | Center point of the geofence (GPS)          |
| `radius`      | `numeric(10,2)`              | ✅       | —                                       | Radius in meters                             |
| `created_at`  | `timestamp`                  | ✅       | `CURRENT_TIMESTAMP`                     | Creation timestamp                           |
| `updated_at`  | `timestamp`                  | ✅       | `CURRENT_TIMESTAMP`                     | Last update timestamp                        |
| `created_by`  | `integer`                    | ✅       | —                                       | References `users(id)` who created the zone |

---

### 🔑 Primary Key

- `company_geofences_new_pkey1` — `(id)`

---

### 🗂️ Indexes

| Index Name                         | Columns / Type                   |
|------------------------------------|----------------------------------|
| `idx_company_geofences_active`     | `(company_id)` — partial index where `radius > 0` |
| `idx_company_geofences_company`    | `(company_id)` — B-tree index    |
| `idx_company_geofences_coordinates`| `(coordinates)` — GIST index     |

---

### 🔗 Foreign Key Constraints

| Column       | References         | On Delete     |
|--------------|--------------------|---------------|
| `company_id` | `companies(id)`    | `CASCADE`     |
| `created_by` | `users(id)`        | `SET NULL`    |

---

### 🔁 Triggers

| Trigger Name                         | Event           | Function                         |
|--------------------------------------|------------------|-----------------------------------|
| `update_company_geofences_updated_at`| `BEFORE UPDATE` | `update_modified_column()`       |
| `update_geofences_timestamp`         | `BEFORE UPDATE` | `update_timestamp()`             |

---