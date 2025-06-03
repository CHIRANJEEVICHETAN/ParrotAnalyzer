## 📩 `push_receipts` Table

Stores delivery and processing receipts for push notifications, tracking their status and any errors.

---

### 🧱 Columns

| Column          | Type                    | Nullable | Default                                         | Description                                                      |
|-----------------|-------------------------|----------|-------------------------------------------------|------------------------------------------------------------------|
| id              | integer                 | No       | nextval('push_receipts_id_seq'::regclass)       | Primary key, unique identifier for each push receipt             |
| notification_id | integer                 | No       |                                                 | Foreign key referencing the associated push notification         |
| receipt_id      | character varying(36)   | No       |                                                 | Unique identifier for the push receipt (e.g., device receipt ID) |
| processed       | boolean                 | Yes      | false                                           | Indicates if the receipt has been processed                       |
| created_at      | timestamp with time zone| Yes      | CURRENT_TIMESTAMP                               | Timestamp when the receipt was created                            |
| processed_at    | timestamp with time zone| Yes      |                                                 | Timestamp when the receipt was processed                          |
| error_details   | jsonb                   | Yes      |                                                 | JSON details of any error encountered during processing          |

---

### 🔍 Indexes

- **push_receipts_pkey**: Primary key on `id`.
- **idx_push_receipts_notification_id**: Index on `notification_id`.
- **idx_push_receipts_processed**: Index on `processed`.
- **unique_receipt_id**: Unique constraint on `receipt_id`.

---

### 🔗 Foreign-Key Constraints

- **push_receipts_notification_id_fkey**: References `push_notifications(id)` with `ON DELETE CASCADE`.

---

### 📝 Notes

- The `processed` flag indicates whether the receipt has been handled by the system.
- The `receipt_id` must be unique to avoid duplicate processing.
- `error_details` stores any relevant error information for troubleshooting.
