## 📄 `leave_documents` Table

Stores documents uploaded as part of leave requests, such as medical certificates or approval letters.

---

### 🧱 Columns

| Column         | Type                        | Nullable | Default                         | Description                                           |
|----------------|-----------------------------|----------|----------------------------------|-------------------------------------------------------|
| `id`           | `integer`                   | ❌       | `nextval('leave_documents_id_seq')` | Primary key                                     |
| `request_id`   | `integer`                   | ✅       | —                                | Reference to related leave request                   |
| `file_name`    | `character varying(255)`    | ❌       | —                                | Name of the uploaded file                            |
| `file_type`    | `character varying(100)`    | ❌       | —                                | MIME type or file extension (e.g., `image/jpeg`)     |
| `file_data`    | `text`                      | ❌       | —                                | Encoded or raw file data                             |
| `upload_method`| `character varying(20)`     | ✅       | —                                | Indicates if uploaded from `camera` or `file`        |
| `created_at`   | `timestamp without time zone` | ✅     | `CURRENT_TIMESTAMP`              | Record creation timestamp                            |
| `updated_at`   | `timestamp without time zone` | ✅     | `CURRENT_TIMESTAMP`              | Last record update timestamp                         |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name              | Type   | Columns |
|-------------------------|--------|---------|
| `leave_documents_pkey`  | B-tree | `(id)`  |

---

### ✅ Check Constraints

| Constraint Name                          | Condition                                      |
|------------------------------------------|------------------------------------------------|
| `leave_documents_upload_method_check`    | `upload_method` must be one of `'camera'`, `'file'` |

---

### 🔗 Foreign Key Constraints

| Column        | References             | On Delete |
|---------------|------------------------|-----------|
| `request_id`  | `leave_requests(id)`   | CASCADE   |

---
