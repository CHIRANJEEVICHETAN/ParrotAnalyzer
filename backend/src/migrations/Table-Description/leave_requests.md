# 📄 `leave_requests` Table (Schema: `public`)

## 🧩 Columns

| Column Name           | Data Type           | Nullable | Default                                           |
|-----------------------|---------------------|----------|---------------------------------------------------|
| `id`                  | integer             | ❌       | `nextval('leave_requests_id_seq'::regclass)`      |
| `user_id`             | integer             | ✅       |                                                   |
| `leave_type_id`       | integer             | ✅       |                                                   |
| `start_date`          | date                | ❌       |                                                   |
| `end_date`            | date                | ❌       |                                                   |
| `reason`              | text                | ❌       |                                                   |
| `status`              | varchar(20)         | ✅       | `'pending'::character varying`                    |
| `rejection_reason`    | text                | ✅       |                                                   |
| `contact_number`      | varchar(20)         | ❌       |                                                   |
| `requires_documentation` | boolean         | ✅       | `false`                                           |
| `approver_id`         | integer             | ✅       |                                                   |
| `created_at`          | timestamp           | ✅       | `CURRENT_TIMESTAMP`                               |
| `updated_at`          | timestamp           | ✅       | `CURRENT_TIMESTAMP`                               |
| `days_requested`      | integer             | ❌       |                                                   |
| `has_documentation`   | boolean             | ✅       | `false`                                           |
| `group_admin_id`      | integer             | ✅       |                                                   |

---

## 🔑 Indexes

- `leave_requests_pkey` – **Primary Key**, btree(`id`)
- `idx_leave_requests_dates` – btree(`start_date`, `end_date`)
- `idx_leave_requests_group_admin` – btree(`group_admin_id`)
- `idx_leave_requests_leave_type_id` – btree(`leave_type_id`)
- `idx_leave_requests_status` – btree(`status`)
- `idx_leave_requests_user_id` – btree(`user_id`)

---

## ✅ Check Constraints

- `leave_requests_status_check`:
  ```sql
  status::text = ANY (
    ARRAY['pending', 'approved', 'rejected', 'escalated', 'cancelled']::text[]
  )
  ```

---

## 🔗 Foreign Key Constraints

- `approver_id` → `users(id)`
- `group_admin_id` → `users(id)` – ON DELETE SET NULL
- `leave_type_id` → `leave_types(id)`
- `user_id` → `users(id)`

---

## 📎 Referenced By

- `leave_documents.request_id` → `leave_requests(id)` – ON DELETE CASCADE

---