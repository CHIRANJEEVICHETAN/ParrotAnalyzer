# 🎉 `company_holidays` Table (Schema: `public`)

## 🧩 Columns

| Column Name     | Data Type                | Nullable | Default                                   |
|------------------|--------------------------|----------|-------------------------------------------|
| `id`             | integer                  | ❌       | `nextval('company_holidays_id_seq'::regclass)` |
| `company_id`     | integer                  | ❌       |                                           |
| `name`           | varchar(100)             | ❌       |                                           |
| `date`           | date                     | ❌       |                                           |
| `is_full_day`    | boolean                  | ✅       | `true`                                    |
| `description`    | text                     | ✅       |                                           |
| `is_active`      | boolean                  | ✅       | `true`                                    |
| `created_at`     | timestamp with time zone | ✅       | `CURRENT_TIMESTAMP`                       |
| `updated_at`     | timestamp with time zone | ✅       | `CURRENT_TIMESTAMP`                       |
| `created_by`     | integer                  | ✅       |                                           |
| `updated_by`     | integer                  | ✅       |                                           |

---

## 🔑 Indexes

- `company_holidays_pkey` – **Primary Key**, btree(`id`)
- `idx_company_holidays_company_id` – btree(`company_id`)
- `idx_company_holidays_date` – btree(`date`)
- `idx_company_holidays_active` – btree(`is_active`)
- `idx_company_holidays_company_date` – btree(`company_id`, `date`)
- `company_holidays_company_date_unique` – **Unique**, btree(`company_id`, `date`) WHERE `is_active = true`

---

## ✅ Check Constraints

- `check_company_holidays_date_not_past`: `date` must be greater than or equal to `CURRENT_DATE`

---

## 🔗 Foreign Key Constraints

- `company_holidays.company_id` → `companies(id)` *(ON DELETE CASCADE)*
- `company_holidays.created_by` → `users(id)` *(ON DELETE SET NULL)*
- `company_holidays.updated_by` → `users(id)` *(ON DELETE SET NULL)*

---

## 🔄 Triggers

- `trigger_update_company_holidays_updated_at` – Automatically updates `updated_at` timestamp on row updates

---

## 📋 Use Cases

### 1. **Calendar Integration**
- Store company-specific holidays for display in leave calendar
- Support both full-day and partial-day holidays
- Enable holiday-aware leave planning

### 2. **Leave Management**
- Prevent leave requests on holiday dates
- Calculate working days excluding holidays
- Provide holiday information in leave requests

### 3. **Company Administration**
- Allow management to configure company holidays
- Support holiday deactivation/reactivation
- Track who created/updated holiday records

### 4. **Reporting & Analytics**
- Generate holiday reports
- Analyze leave patterns around holidays
- Track holiday utilization

---

## 🔧 Sample Queries

### Get all active holidays for a company
```sql
SELECT name, date, is_full_day, description
FROM company_holidays
WHERE company_id = 1 AND is_active = true
ORDER BY date;
```

### Get holidays within a date range
```sql
SELECT name, date, is_full_day
FROM company_holidays
WHERE company_id = 1 
  AND date BETWEEN '2025-01-01' AND '2025-12-31'
  AND is_active = true
ORDER BY date;
```

### Check if a specific date is a holiday
```sql
SELECT EXISTS (
  SELECT 1 FROM company_holidays
  WHERE company_id = 1 
    AND date = '2025-08-15'
    AND is_active = true
);
```

---

## 📝 Notes

- **Unique Constraint**: Prevents duplicate holidays for the same company and date (only for active holidays)
- **Cascade Delete**: When a company is deleted, all its holidays are automatically removed
- **Audit Trail**: Tracks who created and last updated each holiday record
- **Soft Delete**: Uses `is_active` flag instead of physical deletion
- **Date Validation**: Ensures holidays cannot be created for past dates 