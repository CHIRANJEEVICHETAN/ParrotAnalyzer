## ✅ `employee_tasks` Table

Stores tasks assigned to employees, including priority, status updates, and assignment metadata.

---

### 🧱 Columns

| Column               | Type                         | Nullable | Default                               | Description                                    |
|----------------------|------------------------------|----------|---------------------------------------|------------------------------------------------|
| `id`                 | `integer`                    | ❌       | `nextval('employee_tasks_id_seq')`    | Primary key                                    |
| `title`              | `character varying(255)`     | ❌       | —                                     | Title or name of the task                      |
| `description`        | `text`                       | ✅       | —                                     | Detailed description of the task               |
| `assigned_to`        | `integer`                    | ✅       | —                                     | References `users(id)` (employee)              |
| `assigned_by`        | `integer`                    | ✅       | —                                     | References `users(id)` (assigner)              |
| `priority`           | `character varying(20)`      | ❌       | `'medium'`                            | Task priority (`low`, `medium`, `high`, etc.)  |
| `status`             | `character varying(20)`      | ❌       | `'pending'`                           | Task status (`pending`, `in-progress`, etc.)   |
| `due_date`           | `timestamp without time zone`| ✅       | —                                     | Deadline for task completion                   |
| `created_at`         | `timestamp without time zone`| ✅       | `CURRENT_TIMESTAMP`                   | Task creation timestamp                        |
| `updated_at`         | `timestamp without time zone`| ✅       | `CURRENT_TIMESTAMP`                   | Last task update timestamp                     |
| `last_status_update` | `timestamp without time zone`| ✅       | —                                     | When the task status was last updated          |
| `status_history`     | `jsonb`                      | ✅       | `'[]'::jsonb`                          | JSON array of previous statuses and timestamps |
| `is_reassigned`      | `boolean`                    | ✅       | `false`                               | Indicates if the task was reassigned           |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Ind
