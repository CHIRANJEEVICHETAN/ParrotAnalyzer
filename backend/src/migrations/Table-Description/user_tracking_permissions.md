# 📄 `user_tracking_permissions` Table (Schema: `public`)

## 🧩 Columns

| Column Name          | Data Type            | Nullable | Default                                        |
|----------------------|----------------------|----------|------------------------------------------------|
| `id`                 | integer              | ❌       | `nextval('user_tracking_permissions_id_seq'::regclass)` |
| `user_id`            | integer              | ❌       |                                                |
| `can_override_geofence` | boolean          | ❌       | `false`                                        |
| `tracking_precision` | varchar(20)          | ✅       | `'high'::character varying`                    |
| `created_at`         | timestamp            | ✅       | `CURRENT_TIMESTAMP`                            |
| `updated_at`         | timestamp            | ✅       | `CURRENT_TIMESTAMP`                            |

---

## 🔑 Indexes

- `user_tracking_permissions_pkey` – **Primary Key**, btree(`id`)
- `idx_user_tracking_permissions` – btree(`user_id`, `tracking_precision`)

---

## 🔐 Unique Constraints

- `unique_user_tracking_permission` – UNIQUE(`user_id`)

---

## ✅ Check Constraints

- `chk_tracking_precision`:
  ```sql
  tracking_precision::text = ANY (ARRAY['low', 'medium', 'high']::text[])
  ```

---

## 🔗 Foreign Key Constraints

- `user_id` → `users(id)` – ON DELETE CASCADE

---

## ⚙️ Triggers

```sql
BEFORE UPDATE ON user_tracking_permissions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp()
```

---