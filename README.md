# AreWarin Tutor OS v2.8 — LINE LIFF Edition

- **เริ่มติดตั้ง:** `START_LINE_TH.md`
- **SQL ใหม่:** `supabase/08_LINE_LIFF_CONNECTION.sql` (รันเฉพาะเมื่อ 01–07 ติดตั้งสำเร็จแล้ว)
- **Manager:** `/` (Supabase Auth)
- **Student Portal ผ่าน LINE:** `/student.html` (LIFF SDK + backend ID Token verification)
- **สำรองหน้า Email/Password เดิม:** `/student-email.html`
- **Vercel API:** `/api/health`, `/api/line`, `/api/line-admin`, `/api/line-cron`
- **การแจ้งเตือน:** ล่วงหน้า 1 วัน, ก่อน 1 ชั่วโมง, ชั่วโมงเรียนคงเหลือ 4 ชม., ยกเลิกคลาส; จะส่งจริงหลังตั้งค่าตัวตั้งเวลาและ Messaging API

Backend secrets must be configured in Vercel, not committed to GitHub.

**ไม่แก้ข้อมูลใน Supabase โปรเจกต์เดิม และไม่ลบตารางข้อมูลใด ๆ ใน SQL v2.8**
