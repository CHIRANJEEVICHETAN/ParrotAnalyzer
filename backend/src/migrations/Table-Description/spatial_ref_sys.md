## 🌐 `spatial_ref_sys` Table

Stores spatial reference system definitions used by PostGIS for geographic and geometric data projection and transformation.

---

### 🧱 Columns

| Column      | Type                     | Nullable | Default | Description                                                   |
|-------------|--------------------------|----------|---------|---------------------------------------------------------------|
| srid        | integer                  | No       |         | Spatial Reference System Identifier (primary key)             |
| auth_name   | character varying(256)   | Yes      |         | Authority name that defines the spatial reference system       |
| auth_srid   | integer                  | Yes      |         | Identifier assigned by the authority                           |
| srtext      | character varying(2048)  | Yes      |         | Well-known text (WKT) representation of the spatial reference system |
| proj4text   | character varying(2048)  | Yes      |         | Proj.4 text representation of the spatial reference system     |

---

### 🔍 Indexes

- **spatial_ref_sys_pkey**: Primary key on `srid`.

---

### 📝 Notes

- This table is part of PostGIS extension used for managing spatial reference systems.
- Each entry defines how spatial data coordinates are projected or transformed.
