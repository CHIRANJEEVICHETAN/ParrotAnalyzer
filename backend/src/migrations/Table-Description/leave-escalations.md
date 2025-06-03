## ⚠️ `leave_escalations` Table

Tracks escalation events related to leave requests, including who escalated, who it was escalated to, and the status of the escalation.

---

### 🧱 Columns

| Column           | Type                          | Nullable | Default                           | Description                                                 |
|------------------|-------------------------------|----------|------------------------------------|-------------------------------------------------------------|
| `id`             | `integer`                     | ❌       | `nextval('leave_escalations_id_seq')` | Primary key                                           |
| `request_id`     | `integer`                     | ❌       | —                                  | ID of the related leave request                            |
| `escalated_by`   | `integer`                     | ❌       | —                                  | User ID who initiated the escalation                        |
| `escalated_to`   | `integer`                     | ❌       | —                                  | User ID to whom the issue is escalated                     |
| `reason`         | `text`                        | ❌       | —                                  | Reason for the escalation                                  |
| `status`         | `character varying(20)`       | ✅       | `'pending'`                        | Status of the escalation: `pending` or `resolved`          |
| `resolution_notes`| `text`                       | ✅       | —                                  | Notes or comments on how the issue was resolved            |
| `created_at`     | `timestamp without time zone` | ✅       | `CURRENT_TIMESTAMP`                | When the escalation was created                            |
| `resolved_at`    | `timestamp without time zone` | ✅       | —                                  | Timestamp of when the escalation was resolved              |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name                          | Type   | Columns       |
|-------------------------------------|--------|----------------|
| `leave_escalations_pkey`           | B-tree | `(id)`         |
| `idx_leave_escalations_request_id` | B-tree | `(request_id)` |

---

### ✅ Check Constraints

| Constraint Name                      | Condition                                           |
|-------------------------------------|-----------------------------------------------------|
| `leave_escalations_status_check`    | `status` must be one of `'pending'`, `'resolved'` |

---

### 🔗 Foreign Key Constraints

*ℹ️ Not explicitly shown in the table definition, but typically expected for the following:*

- `request_id` → `leave_requests(id)`
- `escalated_by` → `users(id)`
- `escalated_to` → `users(id)`

*(If not enforced by foreign keys, you may consider adding them for referential integrity.)*

---
