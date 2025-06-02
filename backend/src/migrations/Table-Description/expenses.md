## 💸 `expenses` Table

Stores employee-submitted travel and expense reports including vehicle details, costs, and approval status.

---

### 🧱 Columns

| Column              | Type                           | Nullable | Default                                | Description                                      |
|---------------------|--------------------------------|----------|----------------------------------------|--------------------------------------------------|
| `id`                | `integer`                      | ❌       | `nextval('expenses_id_seq')`           | Primary key                                      |
| `user_id`           | `integer`                      | ❌       | —                                      | References `users(id)`                          |
| `employee_name`     | `character varying(100)`       | ❌       | —                                      | Name of the employee                            |
| `employee_number`   | `character varying(50)`        | ❌       | —                                      | Unique employee identifier                      |
| `department`        | `character varying(100)`       | ❌       | —                                      | Department name                                 |
| `designation`       | `character varying(100)`       | ❌       | —                                      | Employee's designation                          |
| `location`          | `character varying(100)`       | ❌       | —                                      | Work or travel location                         |
| `date`              | `timestamp without time zone`  | ❌       | —                                      | Date of expense                                  |
| `vehicle_type`      | `character varying(50)`        | ❌       | —                                      | Type of vehicle used                            |
| `vehicle_number`    | `character varying(50)`        | ❌       | —                                      | Vehicle registration number                     |
| `total_kilometers`  | `numeric`                      | ❌       | —                                      | Total kilometers traveled                       |
| `start_time`        | `timestamp without time zone`  | ❌       | —                                      | Start time of the travel                        |
| `end_time`          | `timestamp without time zone`  | ❌       | —                                      | End time of the travel                          |
| `route_taken`       | `text`                         | ❌       | —                                      | Description of the route                        |
| `lodging_expenses`  | `numeric`                      | ❌       | —                                      | Expenses for lodging                            |
| `daily_allowance`   | `numeric`                      | ❌       | —                                      | Per diem or daily allowance                     |
| `diesel`            | `numeric`                      | ❌       | —                                      | Diesel/fuel expenses                            |
| `toll_charges`      | `numeric`                      | ❌       | —                                      | Toll charges                                    |
| `other_expenses`    | `numeric`                      | ❌       | —                                      | Any other miscellaneous expenses                |
| `advance_taken`     | `numeric`                      | ❌       | —                                      | Advance received for travel                     |
| `total_amount`      | `numeric`                      | ❌       | —                                      | Total expense amount                            |
| `amount_payable`    | `numeric`                      | ❌       | —                                      | Net payable amount                              |
| `status`            | `character varying(20)`        | ❌       | `'pending'::character varying`         | Expense approval status                         |
| `created_at`        | `timestamp without time zone`  | ❌       | `CURRENT_TIMESTAMP`                    | Record creation timestamp                       |
| `updated_at`        | `timestamp without time zone`  | ❌       | `CURRENT_TIMESTAMP`                    | Last updated timestamp                          |
| `company_id`        | `integer`                      | ❌       | —                                      | Associated company                              |
| `comments`          | `text`                         | ✅       | —                                      | Optional comments                               |
| `group_admin_id`    | `integer`                      | ❌       | —                                      | References `users(id)` as group admin           |
| `rejection_reason`  | `text`                         | ✅       | —                                      | Reason if expense was rejected                  |
| `category`          | `character varying(50)`        | ✅       | —                                      | Expense category (e.g., travel, lodging)        |
| `shift_id`          | `integer`                      | ✅       | —                                      | References `employee_shifts(id)`                |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name              | Type   | Columns      | Notes                       |
|-------------------------|--------|--------------|-----------------------------|
| `idx_expenses_shift_id` | B-tree | `(shift_id)` | For filtering by shift ID  |

---

### 🔗 Foreign Key Constraints

| Column           | References                 | On Delete    |
|------------------|----------------------------|--------------|
| `user_id`        | `users(id)`                | CASCADE      |
| `group_admin_id` | `users(id)`                | CASCADE      |
| `shift_id`       | `employee_shifts(id)`      | SET NULL     |

---

