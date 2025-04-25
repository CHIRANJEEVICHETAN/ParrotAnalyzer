# 🏢 `companies` Table (Schema: `public`)

## 🧩 Columns

| Column Name     | Data Type             | Nullable | Default                                   |
|------------------|------------------------|----------|-------------------------------------------|
| `id`             | integer                | ❌       | `nextval('companies_id_seq'::regclass)`   |
| `name`           | varchar(100)           | ❌       |                                           |
| `email`          | varchar(100)           | ❌       |                                           |
| `phone`          | varchar(20)            | ✅       |                                           |
| `address`        | text                   | ✅       |                                           |
| `status`         | varchar(20)            | ✅       | `'active'`                                |
| `created_at`     | timestamp              | ✅       | `CURRENT_TIMESTAMP`                       |
| `user_limit`     | integer                | ❌       | `100`                                     |
| `pending_users`  | integer                | ❌       | `0`                                       |
| `logo`           | bytea                  | ✅       |                                           |

---

## 🔑 Indexes

- `companies_pkey` – **Primary Key**, btree(`id`)
- `companies_email_key` – **Unique**, btree(`email`)

---

## ✅ Check Constraints

- `companies_status_check`: `status` must be one of `'active'`, `'disabled'`

---

## 🔗 Referenced By

- `company_geofences.company_id` → `companies(id)` *(ON DELETE CASCADE)*
- `company_tracking_settings.company_id` → `companies(id)` *(ON DELETE CASCADE)*
- `users.company_id` → `companies(id)`

---