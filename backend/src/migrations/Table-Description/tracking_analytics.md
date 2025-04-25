## 📊 `tracking_analytics` Table

Stores daily analytics of user activity like distance traveled, travel time, and time spent indoors/outdoors.

---

### 🧱 Columns

| Column                    | Type                       | Nullable | Default                             | Description                                |
|---------------------------|----------------------------|----------|-------------------------------------|--------------------------------------------|
| `id`                      | `integer`                  | ❌       | `nextval('tracking_analytics_id_seq')` | Primary key                             |
| `user_id`                 | `integer`                  | ❌       | —                                   | References `users(id)`                    |
| `date`                    | `date`                     | ❌       | —                                   | The specific day for analytics             |
| `total_distance`          | `numeric(10,2)`            | ✅       | `0`                                 | Total distance in meters                   |
| `total_distance_km`       | `numeric(10,2)`            | ✅       | `0`                                 | Total distance in kilometers               |
| `total_travel_time_minutes` | `integer`               | ✅       | `0`                                 | Total time spent traveling (minutes)       |
| `outdoor_time`            | `integer`                  | ✅       | `0`                                 | Outdoor time (legacy or placeholder)       |
| `indoor_time`             | `integer`                  | ✅       | `0`                                 | Indoor time (legacy or placeholder)        |
| `indoor_time_minutes`     | `integer`                  | ✅       | `0`                                 | Time spent indoors (minutes)               |
| `outdoor_time_minutes`    | `integer`                  | ✅       | `0`                                 | Time spent outdoors (minutes)              |
| `last_update`             | `timestamp with time zone` | ✅       | —                                   | Last analytics update timestamp            |
| `created_at`              | `timestamp with time zone` | ✅       | `CURRENT_TIMESTAMP`                 | Record creation timestamp                  |
| `updated_at`              | `timestamp with time zone` | ✅       | `CURRENT_TIMESTAMP`                 | Last modification timestamp                |

---

### 🔑 Primary Key

- `tracking_analytics_pkey` — `(id)`

---

### 🗂️ Indexes

| Index Name                         | Type     | Columns               | Notes                                 |
|------------------------------------|----------|------------------------|----------------------------------------|
| `idx_tracking_analytics_date`      | B-tree   | `(date)`              | For querying by date                   |
| `idx_tracking_analytics_user`      | B-tree   | `(user_id)`           | For filtering by user                  |
| `idx_tracking_analytics_user_date` | B-tree   | `(user_id, date)`     | 🔒 **Unique** per user per day         |

---

### 🔗 Foreign Key Constraints

| Column    | References      | On Delete |
|-----------|------------------|-----------|
| `user_id` | `users(id)`      | CASCADE   |

---