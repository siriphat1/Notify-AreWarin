## เช็กหลังติดตั้ง

Run query (read-only):

```sql
SELECT tablename FROM pg_catalog.pg_tables
WHERE schemaname='public' AND tablename LIKE 'awt_%'
ORDER BY tablename;
```

ควรแสดง 15 ตาราง

หากมีข้อผิดพลาด ให้ส่ง **ข้อความ Error เท่านั้น** ไม่ต้องส่ง Secret Key หรือรหัสผ่าน
