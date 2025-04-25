# 📄 `users` Table (Schema: `public`)

## 🧩 Columns

| Column Name               | Data Type                 | Nullable | Default                                  |
|--------------------------|---------------------------|----------|------------------------------------------|
| `id`                     | integer                   | ❌       | `nextval('users_id_seq'::regclass)`      |
| `name`                   | varchar(100)              | ❌       |                                          |
| `email`                  | varchar(100)              | ❌       |                                          |
| `phone`                  | varchar(20)               | ✅       |                                          |
| `password`               | varchar(100)              | ❌       |                                          |
| `role`                   | varchar(20)               | ❌       |                                          |
| `created_at`             | timestamp                 | ✅       | `CURRENT_TIMESTAMP`                      |
| `reset_token`            | varchar(255)              | ✅       |                                          |
| `reset_token_expires`    | timestamp                 | ✅       |                                          |
| `status`                 | varchar(20)               | ✅       | `'active'::character varying`            |
| `last_login`             | timestamp                 | ✅       |                                          |
| `failed_login_attempts`  | integer                   | ✅       | `0`                                      |
| `password_reset_required`| boolean                   | ✅       | `false`                                  |
| `company_id`             | integer                   | ✅       |                                          |
| `can_submit_expenses_anytime` | boolean            | ✅       | `false`                                  |
| `shift_status`           | varchar(20)               | ✅       | `'inactive'::character varying`          |
| `updated_at`             | timestamp                 | ✅       | `CURRENT_TIMESTAMP`                      |
| `employee_number`        | varchar(50)               | ✅       |                                          |
| `department`             | varchar(100)              | ✅       |                                          |
| `designation`            | varchar(100)              | ✅       |                                          |
| `group_admin_id`         | integer                   | ✅       |                                          |
| `profile_image`          | bytea                     | ✅       |                                          |
| `token_version`          | integer                   | ✅       | `0`                                      |
| `gender`                 | varchar(10)               | ✅       |                                          |
| `management_id`          | integer                   | ✅       |                                          |

---

## 🔑 Indexes

- `users_pkey` – **Primary Key**, btree(`id`)
- `idx_users_company_status` – btree(`company_id`, `status`)
- `idx_users_group_admin_id` – btree(`group_admin_id`)
- `idx_users_management_id` – btree(`management_id`)
- `idx_users_token_version` – btree(`token_version`)

---

## 🔐 Unique Constraints

- `users_email_key` – UNIQUE(`email`)
- `users_employee_number_key` – UNIQUE(`employee_number`)
- `users_phone_key` – UNIQUE(`phone`)

---

## ✅ Check Constraints

- `users_gender_check`:  
  ```sql
  gender::text = ANY (ARRAY['male', 'female', 'other']::text[])
  ```

- `users_role_check`:  
  ```sql
  role::text = ANY (ARRAY['employee', 'group-admin', 'management', 'super-admin']::text[])
  ```

---

## 🔗 Foreign Key Constraints

- `company_id` → `companies(id)`
- `group_admin_id` → `users(id)` ON DELETE CASCADE
- `management_id` → `users(id)` ON DELETE CASCADE

---

## 🔁 Referenced By

> The following tables have **foreign keys referencing `users(id)`**:

- `chat_messages(user_id)` – ON DELETE CASCADE  
- `company_geofences(created_by)` – ON DELETE SET NULL  
- `device_tokens(user_id)` – ON DELETE CASCADE  
- `employee_locations(user_id)` – ON DELETE CASCADE  
- `employee_schedule(user_id)` – ON DELETE CASCADE  
- `employee_shifts(user_id)` – ON DELETE CASCADE  
- `employee_tasks(assigned_by)` – ON DELETE SET NULL  
- `employee_tasks(assigned_to)` – ON DELETE CASCADE  
- `error_logs(user_id)` – ON DELETE SET NULL  
- `expenses(group_admin_id)` – ON DELETE CASCADE  
- `expenses(user_id)` – ON DELETE CASCADE  
- `geofence_events(user_id)`  
- `group_admin_shifts(user_id)` – ON DELETE CASCADE  
- `leave_balances(user_id)`  
- `leave_requests(approver_id)`  
- `leave_requests(group_admin_id)` – ON DELETE SET NULL  
- `leave_requests(user_id)`  
- `management_shifts(user_id)` – ON DELETE CASCADE  
- `notifications(user_id)`  
- `notifications(user_id)` – ON DELETE CASCADE  
- `push_notifications(user_id)` – ON DELETE CASCADE  
- `scheduled_notifications(target_group_admin_id)`  
- `scheduled_notifications(target_user_id)`  
- `support_messages(user_id)` – ON DELETE SET NULL  
- `tracking_analytics(user_id)` – ON DELETE CASCADE  
- `user_tracking_permissions(user_id)` – ON DELETE CASCADE  
- `users(group_admin_id)` – ON DELETE CASCADE  
- `users(management_id)` – ON DELETE CASCADE  

---

## ⚙️ Triggers

```sql
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column()
```