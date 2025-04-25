# 📝 `leave_types` Table (Schema: `public`)

## 🧩 Columns

| Column Name              | Data Type                | Nullable | Default                                   |
|--------------------------|--------------------------|----------|-------------------------------------------|
| `id`                     | integer                  | ❌       | `nextval('leave_types_id_seq'::regclass)` |
| `name`                   | varchar(100)             | ❌       |                                           |
| `description`            | text                     | ✅       |                                           |
| `requires_documentation`| boolean                  | ✅       | `false`                                   |
| `max_days`               | integer                  | ✅       |                                           |
| `is_paid`                | boolean                  | ✅       | `true`                                    |
| `is_active`              | boolean                  | ✅       | `true`                                    |
| `created_at`             | timestamp with time zone | ✅       | `CURRENT_TIMESTAMP`                       |
| `updated_at`             | timestamp with time zone | ✅       | `CURRENT_TIMESTAMP`                       |
| `company_id`             | integer                  | ✅       |                                           |

---

## 🔑 Indexes

- `leave_types_pkey` – **Primary Key**, btree(`id`)
- `idx_leave_types_company_id` – btree(`company_id`)
- `leave_types_name_key` – **Unique**, btree(`name`)
- `leave_types_name_company_id_unique` – **Unique**, btree(`name`, `company_id`)

---

## 🔗 Foreign Key Constraints

- `leave_types.company_id` → `companies(id)`

---

## 🔁 Referenced By

- `leave_balances.leave_type_id`
- `leave_policies.leave_type_id`
- `leave_requests.leave_type_id`

---