## ⚙️ `company_tracking_settings` Table

Defines location tracking configuration per company, including intervals, battery optimization, and tracking precision.

---

### 🧱 Columns

| Column                      | Type                          | Nullable | Default                                         | Description                                              |
|-----------------------------|-------------------------------|----------|-------------------------------------------------|----------------------------------------------------------|
| `id`                        | `integer`                     | ❌       | `nextval('company_tracking_settings_id_seq')`   | Primary key                                              |
| `company_id`                | `integer`                     | ✅       | —                                               | References `companies(id)`                              |
| `update_interval_seconds`   | `integer`                     | ✅       | `30`                                            | Location update frequency in seconds                     |
| `battery_saving_enabled`    | `boolean`                     | ✅       | `true`                                          | Whether battery saving mode is on                        |
| `indoor_tracking_enabled`   | `boolean`                     | ✅       | `false`                                         | Whether indoor tracking is enabled                       |
| `created_at`                | `timestamp without time zone` | ✅       | `CURRENT_TIMESTAMP`                             | Record creation time                                     |
| `updated_at`                | `timestamp without time zone` | ✅       | `CURRENT_TIMESTAMP`                             | Record update time                                       |
| `default_tracking_precision`| `character varying(10)`       | ❌       | `'medium'::character varying`                   | One of: `'low'`, `'medium'`, `'high'`                    |

---

### 🔑 Primary Key

- `(id)`

---

### 🗂️ Indexes

| Index Name                          | Type    | Columns        |
|------------------------------------|---------|----------------|
| `company_tracking_settings_pkey`   | B-tree  | `(id)`         |
| `idx_company_tracking_settings`    | Unique  | `(company_id)` |

---

### ✅ Check Constraints

| Constraint Name                                                    | Condition                                                                 |
|--------------------------------------------------------------------|---------------------------------------------------------------------------|
| `company_tracking_settings_default_tracking_precision_check`      | `default_tracking_precision IN ('low', 'medium', 'high')`                |

---

### 🔗 Foreign Key Constraints

| Column        | References         | On Delete |
|---------------|--------------------|-----------|
| `company_id`  | `companies(id)`    | CASCADE   |

---

### ⚡ Triggers

| Trigger Name                | Event   | Function              | Timing  |
|----------------------------|---------|------------------------|---------|
| `update_settings_timestamp`| UPDATE  | `update_timestamp()`   | BEFORE  |

---
