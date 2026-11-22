# AreWarin Tutor OS v2.4 — แก้ปัญหา SQL ที่ถูกตัดกลางบล็อก

**ห้ามลบตารางเดิม และไม่ต้องสร้างโปรเจกต์ Supabase ใหม่**. โปรเจกต์นี้ใช้ตาราง `public.awt_*` เท่านั้น ไม่แตะตาราง `public.courses` ที่มีอยู่แล้ว

## ติดตั้งผ่านเว็บ Supabase ไม่ใช้ Terminal

1. ใน Supabase → **Authentication → Users** ให้สร้างบัญชีครูด้วยอีเมลและรหัสผ่าน (ถ้ามีแล้วข้าม)
2. เข้า SQL Editor → **New query** แล้วกด **Ctrl+A → Delete** เพื่อล้าง SQL เก่าที่ถูกตัดค้าง
3. เปิด `supabase/01_CREATE_AWT_TABLES.sql` ด้วย Notepad กด **Ctrl+A, Ctrl+C** กลับไป SQL Editor กด **Ctrl+V** แล้วกด **Run**. ต้องเห็น Success
4. กด **New query** ใหม่ เปิด `supabase/02_POLICIES_AND_OWNER.sql` ด้วย Notepad โดยผมใส่อีเมล `arewarin.biology@gmail.com` ใน `v_owner_email` ให้แล้ว **ไม่ต้องแก้ไข SQL เพิ่ม** หากบัญชีครูใน Authentication ใช้อีเมลนี้. **คัดลอกโค้ดทั้งไฟล์** ไปวาง SQL Editor และ Run
5. กด **New query** อีกครั้ง เปิด `supabase/03_ATTENDANCE_RPC.sql` แล้วคัดลอกทั้งไฟล์ไป Run
6. ใช้ไฟล์หน้าเว็บชุดนี้แทนชุดเก่าใน GitHub แล้ว Deploy บน Vercel ตามเดิม จากนั้นเข้าเว็บด้วยบัญชีครู

**ข้อสำคัญ:** SQL ทั้ง 3 ไฟล์ต้องคัดลอกตั้งแต่บรรทัดแรกถึงบรรทัดสุดท้าย ห้ามไฮไลต์รันเพียงบางบรรทัด และอย่าเลือกฟังก์ชันอัตโนมัติที่เพิ่ม `-- Added by Supabase: ...` ในระหว่างบล็อกฟังก์ชัน โค้ด Step 1 ตั้ง RLS ให้แล้ว

## ถ้าขึ้นข้อผิดพลาดอีก

เปิด SQL Editor ใหม่ แล้วรันคำสั่งตรวจอย่างเดียว:

```sql
select tablename from pg_catalog.pg_tables
where schemaname='public' and tablename like 'awt_%'
order by tablename;
```

ควรเห็น **15 ตาราง** หลัง Step 1. ถ้าพบข้อผิดพลาดให้ส่งเฉพาะข้อความ Error มาตรวจ **ไม่ต้องส่งรหัสผ่านหรือคีย์ลับ**

ไฟล์ชุดนี้ **ยังไม่ได้เชื่อม LINE OA จริง**. การติดตั้ง Supabase และ Manager สำเร็จยังไม่ทำให้แจ้งเตือน LINE อัตโนมัติ
