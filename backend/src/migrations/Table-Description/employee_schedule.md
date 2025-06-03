## 🗓️ `employee_schedule` Table

Represents scheduled tasks or events assigned to employees on specific dates and times, with optional location details.

---

### 🧱 Columns

| Column       | Type                         | Nullable | Default                                | Description                              |
|--------------|------------------------------|----------|----------------------------------------|------------------------------------------|
| `id`         | `integer`                    | ❌       | `nextval('employee_schedule_id_seq')`  | Primary key                              |
| `user_id`    | `integer`                    | ✅       | —                                      | References `users(id)`                   |
| `title`      | `character varying(255)`     | ❌       | —                                      | Title of the schedule                    |
| `description`| `text`                       | ✅       | —                                      | Optional additional info                 |
| `date`       | `date`                       | ❌       | —                                      | Date of the schedule                     |
| `time`       | `time without time zone`     | ❌       | —                                      | Time of the scheduled task/event         |
| `location`   | `character varying(255)`     | ✅       | —                                      | Optional location                        |
| `created_at` | `timestamp without time zone`| ✅       | `CURRENT_TIMESTAMP`                    | Record creation time                     |
| `updated_at` | `timestamp without time zone`| ✅       | `CURRENT_TIMESTAMP`                    | Last update timestamp                    |
| `status`     | `character varying(20)`      | ✅       | `'pending'::character varying`         | Current status (`pending`, `completed`, etc.) |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name                | Type   | Columns |
|--------------------------|--------|---------|
| `employee_schedule_pkey` | B-tree | `(id)`  |

---

### 🔗 Foreign Key Constraints

| Column     | References    | On Delete |
|------------|---------------|-----------|
| `user_id`  | `users(id)`   | CASCADE   |

---
