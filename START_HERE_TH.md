# AreWarin Tutor OS — คู่มือย้ายไป Supabase ใหม่ (ไม่ต้องใช้ Terminal)

## โปรเจกต์ที่จะใช้

- Project ID: `ihmiqtwclnqrezsnswfz`
- Project URL: `https://ihmiqtwclnqrezsnswfz.supabase.co`
- Publishable Key: ใส่ใน `config.js` ให้เรียบร้อยแล้ว
- โปรเจกต์เก่า `wdatmgdgppikecqqxemz` ไม่ถูกแก้ไข / ไม่ถูกลบ

**สำคัญ:** ชุดนี้เป็นการเปลี่ยนจุดเชื่อมต่อเว็บไซต์ไปยังฐานข้อมูลใหม่ ยัง **ไม่ใช่การย้ายข้อมูลนักเรียนจากฐานข้อมูลเดิม** ถ้าโปรเจกต์เดิมมีข้อมูลที่ต้องการเก็บ ให้ส่งออก/ย้ายข้อมูลอย่างระมัดระวังก่อนเลิกใช้

## ทำตามนี้ หาก Supabase ใหม่ยังเป็นโปรเจกต์ว่าง

### 1. สร้างบัญชีผู้สอนในโปรเจกต์ใหม่

1. เข้า https://supabase.com/dashboard แล้วเลือก **โปรเจกต์ที่มี Project ID = ihmiqtwclnqrezsnswfz** (ดู Settings > General ได้)
2. ไปที่ **Authentication → Users → Add user**
3. สร้างบัญชีอีเมลครู + รหัสผ่าน (บัญชีเดิมของโปรเจกต์เก่าไม่ได้ย้ายมาด้วย)
4. เก็บอีเมลและรหัสผ่านไว้สำหรับเข้าสู่เว็บ

### 2. รัน SQL ในโปรเจกต์ใหม่ **ครั้งเดียว**

1. ที่ Supabase โปรเจกต์ใหม่ ไปที่ **Table Editor** ตรวจว่าตาราง `students`, `courses`, `staff_members` **ยังไม่มี**
2. เปิดไฟล์ `supabase/00_INSTALL_NEW_PROJECT_ONCE.sql` ด้วย Notepad
3. กด Ctrl+F หา **`v_owner_email text :=`**
4. เปลี่ยนเฉพาะอีเมลตัวอย่างที่อยู่ในบรรทัดนั้น ให้เป็นอีเมลบัญชีครูที่เพิ่งสร้าง เช่น `v_owner_email text := 'teacher@example.com';`
5. **อย่าแก้** เงื่อนไขตรวจสอบ `if v_owner_email = 'REPLACE_WITH_YOUR_EMAIL@example.com'` ที่อยู่บรรทัดถัดไป
6. กด Ctrl+A, Ctrl+C แล้วกลับไป **SQL Editor → New query → Ctrl+V → Run**
7. เมื่อสำเร็จจะเห็น `Success. No rows returned` และตารางต่าง ๆ ใน Table Editor

**ไม่ต้องรัน `01_SCHEMA_NEW_PROJECT.sql` หรือ `02_ENABLE_APP_PASTE.sql` อีก** เพราะ `00_INSTALL_NEW_PROJECT_ONCE.sql` ทำสองส่วนนี้รวมไว้แล้ว

### ถ้า Supabase ใหม่นี้เคยรัน schema.sql ไปแล้ว

- **ห้ามรัน `00_INSTALL_NEW_PROJECT_ONCE.sql`** เพราะจะพยายามสร้างตารางซ้ำ
- ถ้า `organizations`, `staff_members`, `students`, `courses`, `class_sessions` มีอยู่แล้ว และเป็นตารางของ AreWarin Tutor OS จากไฟล์เดิม ให้รัน **เฉพาะ `supabase/02_ENABLE_APP_PASTE.sql`** หลังเปลี่ยนอีเมลครูในบรรทัด `v_owner_email text := ...`
- ถ้าเป็นตารางของโปรเจกต์อื่น หรือไม่แน่ใจว่าตารางชื่อเดียวกันเป็นของอะไร **อย่ารัน SQL จนกว่าจะตรวจสอบก่อน**

## 3. เปลี่ยนเว็บไซต์ให้ใช้โปรเจกต์ใหม่

**กรณีเคย Deploy เวอร์ชัน Supabase Connected ผ่าน GitHub/Vercel แล้ว (ง่ายที่สุด)**

1. เข้า GitHub Repository ของ AreWarin Tutor OS
2. เปิดไฟล์ `config.js` → กดไอคอนดินสอ Edit
3. แทนที่เนื้อหา `config.js` ด้วยเนื้อหาของ `config.js` **ใน ZIP ชุดใหม่นี้** ทั้งไฟล์
4. กด Commit changes
5. ไป Vercel → Deployments → รอให้ Deployment ใหม่ขึ้น Ready แล้วกด Visit

**กรณียังไม่เคย Deploy**

1. แตก ZIP ชุดใหม่ก่อน (ห้ามอัปโหลดไฟล์ ZIP ตรง ๆ ไปเป็นเว็บ)
2. เข้า https://github.com/new และสร้าง Repo แบบ Private
3. Upload **เนื้อหาภายในโฟลเดอร์ `AreWarin_Tutor_OS_Supabase_New_Project`** ให้ `index.html`, `app.js`, `style.css`, `config.js` อยู่ระดับบนสุด
4. ไป https://vercel.com/new → Import Repository → Framework Preset `Other` → Deploy

## 4. ทดลองว่าทำงานจริง

1. เปิดเว็บบน Vercel แล้วเข้าสู่ระบบด้วยบัญชีครูที่สร้างใน **Supabase ใหม่**
2. ลองเพิ่มนักเรียนสมมติรหัส `DEMO01` และคอร์สสมมติ 10 ชม.
3. รีเฟรชหน้าเว็บ แล้วยืนยันว่าข้อมูลยังอยู่
4. เปิด Supabase โปรเจกต์ใหม่ → Table Editor → `students` เพื่อดูว่าข้อมูลทดสอบอยู่ในที่ใหม่

## 5. หากเกิดข้อผิดพลาด

- `Invalid login credentials` → บัญชีครูยังไม่ได้สร้างในโปรเจกต์ใหม่ หรือรหัสผ่านผิด
- `บัญชีนี้ยังไม่ได้รับสิทธิ์ครู` → เช็กอีเมลใน SQL `v_owner_email`, ยืนยันว่า SQL รันสำเร็จใน **โปรเจกต์ใหม่**
- `relation does not exist` → ตารางยังไม่ถูกสร้างในโปรเจกต์ใหม่; ตรวจขั้นตอน SQL
- `permission denied` → ตรวจว่ารันไฟล์ `02_ENABLE_APP_PASTE.sql` (หรือ SQL รวม) สำเร็จและไม่ได้ปิด RLS
- เว็บยังต่อโปรเจกต์เก่า → ตรวจ GitHub `config.js` และ Vercel Deployment ล่าสุด, รีเฟรชเว็บแบบไม่ใช้แคช

## ความปลอดภัยและสถานะปัจจุบัน

- Publishable Key อยู่ใน frontend ได้ แต่ต้องเปิด RLS ตามไฟล์ SQL
- **ห้าม** นำ `service_role` / `sb_secret_...` / Database password ใส่ใน `config.js` หรือ GitHub
- เว็บไซต์ชุดนี้ยังเป็น **Manager** สำหรับครู ส่วน Student LINE Login/LIFF, LINE notification และ Parent Portal ยังไม่ได้เชื่อมจริง
- ทดลองด้วยข้อมูลสมมติก่อนนำข้อมูลนักเรียนจริงเข้าระบบ
