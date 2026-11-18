# AreWarin Tutor OS — v1 prototype

## สิ่งที่เปิดใช้งานได้ทันที

- หน้า Dashboard ภาษาไทย รองรับมือถือ
- เพิ่มนักเรียน สร้างคอร์ส ลงทะเบียนคอร์ส
- สร้างคลาสและใส่ลิงก์ Meet/Zoom
- บันทึกชั่วโมงเรียนและแสดงชั่วโมงคงเหลือ
- แจ้งลาและรับทราบคำขอ ประกาศ และใบแจ้งค่าเรียน
- ตัวอย่างการสร้างรหัสเชิญ (DEMO เท่านั้น)

**สำคัญ:** หน้าจอเป็น interactive prototype เท่านั้น ข้อมูลถูกเก็บใน localStorage ของเครื่อง ไม่ใช่ระบบหลายผู้ใช้ ไม่ควรใส่ข้อมูลนักเรียนจริง ข้อมูลตัวอย่างไม่มีการเชื่อม Supabase/LINE และไม่มีการส่งแจ้งเตือนจริง

## เปิดเว็บ

ต้องใช้ local web server เพราะ src.js เป็น JavaScript module:

```bash
python -m http.server 8000
```

เปิด http://localhost:8000

## Deploy Vercel

อัปโหลดทั้งโฟลเดอร์เป็น GitHub repository แล้ว Import ไปยัง Vercel (Framework Preset: Other, Output Directory: `.`) หน้าเว็บ demo ทำงานโดยไม่ต้องตั้งค่า Environment Variables

## การเชื่อมต่อระบบจริง (ยังไม่รวมใน prototype)

1. สร้าง Supabase project **ใหม่** แล้วรัน `supabase/schema.sql` ใน SQL Editor
2. สร้าง Supabase Auth สำหรับ Admin/Staff และสร้าง API server-side ที่ตรวจ JWT, organization_id และ role ก่อนเขียนข้อมูล
3. เพิ่มองค์กรและ Owner ผ่านขั้นตอน provisioning ฝั่ง server ที่ได้รับสิทธิ์เท่านั้น
4. ทำการเพิ่มนักเรียนผ่าน Backend; generate activation code แบบ CSPRNG, เก็บเฉพาะ SHA-256/HMAC hash, มี expiry และ one-time redemption ใน transaction
5. ตั้ง LINE Login channel + LIFF; verify LINE ID token ฝั่ง server และตรวจ audience/issuer/expiry ก่อนผูก line_user_id กับ student_id; ใช้ LINE OA Messaging API สำหรับส่งข้อความหลังตรวจความยินยอมและสถานะการเป็นเพื่อน
6. สร้าง notification queue เมื่อเพิ่มหรือแก้ไข class_sessions: 1 วันและ 1 ชั่วโมงก่อนเริ่มตาม timezone Asia/Bangkok; cancel/reschedule เมื่อคลาสเปลี่ยนเวลา; ป้องกันการส่งซ้ำด้วย idempotency
7. ใช้ Vercel Cron เรียก server endpoint ที่ตรวจ `CRON_SECRET`, claim jobs แบบ atomic, retry แบบ bounded, เก็บ delivery logs และตรวจโควตาข้อความ LINE
8. บันทึก attendance และ hour_transactions ใน transaction เดียวพร้อม row lock; ห้ามหักชั่วโมงซ้ำ; ตรวจ enrollment/course/session/org ตรงกัน
9. สร้าง Student/Parent Portal ที่ใช้ identity จริงและ RLS หรือ server-side authorization; จำกัดการดูข้อมูลการเงินตามสิทธิ์
10. ทำ audit trail, data retention, consent, payment verification และทดสอบ RLS ก่อนใช้งานจริง

**อย่านำโค้ดสาธิต localStorage นี้ไปใช้กับข้อมูลนักเรียนจริงโดยไม่สร้าง authentication, authorization และ backend ให้ครบ**

## รายการไฟล์

- `index.html` UI responsive
- `src.js` พฤติกรรมหน้า demo
- `supabase/schema.sql` โครงสร้างฐานข้อมูลเริ่มต้น พร้อม RLS แบบปิดการเขียนจาก client
