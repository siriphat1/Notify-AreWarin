# AreWarin Tutor OS — LINE Auto Notification + Flex Cards

## สิ่งที่อัปเดตใน GitHub แล้ว
- ผูก LINE ครั้งแรกสำเร็จ → ส่งการ์ดยืนยันจาก LINE OA โดยอัตโนมัติ
- ลงเวลาเรียนสำเร็จ → ส่งการ์ดสรุปชั่วโมงเรียนและชั่วโมงคงเหลือโดยอัตโนมัติ
- คอร์สเหลือไม่เกิน 4 ชั่วโมง → มีคำเตือนในการ์ดสรุป และมีคิวแจ้งเตือนเฉพาะรายการสำหรับระบบตั้งเวลา
- เตือนก่อนคลาส 1 วัน และ 1 ชั่วโมง / ยกเลิกคลาส → การ์ด LINE Flex Message
- ประวัติลงเวลาเรียนใน Manager ยังมีปุ่มแจ้งย้อนหลัง เผื่อกรณี LINE ส่งไม่สำเร็จ (ไม่จำเป็นต้องกดเป็นประจำ)

## เปิดระบบตั้งเวลาอัตโนมัติ (ทำครั้งเดียว)
1. Vercel > Project > Settings > Environment Variables: ตรวจว่า `CRON_SECRET` มีค่าจริง และได้ตั้งใน **Production** แล้ว
2. GitHub > Repository > Settings > Secrets and variables > Actions > New repository secret
3. Name = `AWT_CRON_SECRET`
4. Value = **ค่าเดียวกับ** `CRON_SECRET` ใน Vercel (ไม่ต้องส่งค่านี้ให้ใคร)
5. ไปที่ GitHub > Actions > `AreWarin LINE automatic class reminders`; เปิดใช้ Actions เมื่อมีคำถาม แล้วกด Run workflow หนึ่งครั้งเพื่อทดสอบ
6. ดู log ว่ามี JSON ประมาณ `{"ok":true,"processed":0,"sent":0,"failed":0}` (0 คือไม่มีแจ้งเตือนถึงกำหนด ไม่ใช่ข้อผิดพลาด)

Workflow อยู่ใน `.github/workflows/awt-line-notifications.yml` และตั้งค่าให้เรียก `/api/line-cron` ทุก 5 นาที
โดยอ้างอิงเวลา UTC ใน GitHub Actions และเวลา Asia/Bangkok สำหรับคลาส

**ข้อจำกัด:** GitHub Actions schedule ไม่รับประกันว่ารันตรงนาที อาจล่าช้าหรือถูกข้ามในช่วงโหลดสูง สำหรับระบบแจ้งเตือนที่ต้องตรงเวลาอย่างเคร่งครัด ให้ใช้ตัวตั้งเวลาที่มี SLA

## การทดสอบ
1. Vercel > Deployments: ดูการ Deploy ล่าสุดว่า Ready
2. Manager > ตั้งค่าระบบ > เลือกนักเรียนที่ผูก LINE แล้ว > ส่งข้อความทดสอบ (หนึ่งครั้ง): ควรได้รับ Flex card สีเขียว
3. Manager > ลงเวลาเรียน > บันทึกเวลาที่ถูกต้อง: เมื่อบันทึกสำเร็จควรเห็นข้อความสถานะ LINE และมีการ์ดเข้าห้องแชต
4. ถ้าเคยลงเวลาไปแล้ว ใช้ปุ่ม **แจ้ง LINE** ที่ประวัติการลงเวลาเรียน
5. สร้างคลาสที่จะเริ่มในอีก 1 ชั่วโมง/วันข้างหน้า แล้วตรวจผลเมื่อ scheduler เรียก

## หากไม่ได้รับข้อความ
- เช็ก `https://notify-arewarin.vercel.app/api/health` ว่า `messagingReady` เป็น `true`
- ตรวจนักเรียนเพิ่มเพื่อน OA และไม่บล็อก OA
- ดู Vercel Runtime Logs ของ `/api/line-admin` หรือ `/api/line-cron`
- `messagingReady: true` บอกแค่ว่ามี environment variable ไม่ได้ยืนยันว่า Token ถูกต้อง
- คำตอบ 200 จาก Messaging API หมายถึง LINE รับคำขอ ไม่ใช่รับรองว่าแชตปลายทางได้รับแล้ว

## ข้อมูลและความปลอดภัย
- ใช้ `SUPABASE_SECRET_KEY` และ `LINE_CHANNEL_ACCESS_TOKEN` เฉพาะ Environment Variables ใน Vercel
- ห้าม Commit ไฟล์ .env หรือ Secret ลง GitHub
- Backend ตรวจ Supabase Auth ของ Manager ก่อนส่งการ์ดสำหรับบันทึกเวลา
- กันข้อความซ้ำจากสถานะข้อมูลการเข้าเรียนที่เหมือนเดิมด้วยตาราง notification jobs
