# 🧾 `leave_balances` Table (Schema: `public`)

## 📑 Columns

| Column Name           | Data Type                 | Nullable | Default                                   |
|-----------------------|---------------------------|----------|-------------------------------------------|
| `id`                  | integer                   | ❌       | `nextval('leave_balances_id_seq'::regclass)` |
| `user_id`             | integer                   | ✅       |                                           |
| `leave_type_id`       | integer                   | ✅       |                                           |
| `total_days`          | integer                   | ❌       |                                           |
| `used_days`           | integer                   | ✅       | `0`                                       |
| `pending_days`        | integer                   | ✅       | `0`                                       |
| `year`                | integer                   | ❌       |                                           |
| `created_at`          | timestamp without time zone | ✅     | `CURRENT_TIMESTAMP`                       |
| `updated_at`          | timestamp without time zone | ✅     | `CURRENT_TIMESTAMP`                       |
| `carry_forward_days`  | integer                   | ✅       | `0`                                       |

---

## 🔑 Indexes

- `leave_balances_pkey` – **Primary Key**, btree(`id`)
- `idx_leave_balances_user_id` – btree(`user_id`)
- `idx_leave_balances_leave_type_id` – btree(`leave_type_id`)
- `leave_balances_user_id_leave_type_id_year_key` – **Unique**, btree(`user_id`, `leave_type_id`, `year`)

---

## 🔗 Foreign Key Constraints

- `leave_balances.user_id` → `users(id)`
- `leave_balances.leave_type_id` → `leave_types(id)`

---