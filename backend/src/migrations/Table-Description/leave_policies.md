# 📝 `leave_policies` Table (Schema: `public`)

## 🧩 Columns

| Column Name            | Data Type           | Nullable | Default                                   |
|------------------------|---------------------|----------|-------------------------------------------|
| `id`                   | integer              | ❌       | `nextval('leave_policies_id_seq'::regclass)` |
| `leave_type_id`        | integer              | ✅       |                                           |
| `default_days`         | integer              | ❌       |                                           |
| `carry_forward_days`   | integer              | ✅       | `0`                                       |
| `min_service_days`     | integer              | ✅       | `0`                                       |
| `requires_approval`    | boolean              | ✅       | `true`                                    |
| `notice_period_days`   | integer              | ✅       | `0`                                       |
| `max_consecutive_days` | integer              | ✅       |                                           |
| `gender_specific`      | varchar(10)          | ✅       |                                           |
| `is_active`            | boolean              | ✅       | `true`                                    |
| `created_at`           | timestamp with time zone | ✅ | `CURRENT_TIMESTAMP`                       |
| `updated_at`           | timestamp with time zone | ✅ | `CURRENT_TIMESTAMP`                       |

---

## 🔑 Indexes

- `leave_policies_pkey` – **Primary Key**, btree(`id`)
- `leave_policies_leave_type_id_key` – **Unique**, btree(`leave_type_id`)

---

## 🔗 Foreign Key Constraints

- `leave_policies.leave_type_id` → `leave_types(id)`

---