# วิธีติดตั้ง AreWarin Tutor OS Firebase Edition (ไม่ใช้ localhost / Terminal)

**วิธีใช้งาน:** แตก ZIP → นำโค้ดขึ้น GitHub → Deploy Vercel → ตั้ง Firebase → ตั้ง LINE OA และ LIFF → ทดลองผูกนักเรียน

> อัปโหลดเฉพาะไฟล์จากโฟลเดอร์นี้ทั้งหมด: `index.html`, `student.html`, `src.js`, `auth.js`, `student.js`, `config.js`, `package.json`, `vercel.json`, `api/`, `lib/` เป็นต้น โดยให้ `index.html` อยู่ระดับบนสุดของ Repository. อย่าอัปโหลดไฟล์ Service Account JSON จาก Firebase ลง GitHub โดยเด็ดขาด

## ขั้นที่ 1 — เตรียม Firebase Project

1. เปิด https://console.firebase.google.com/
2. กด **Add project / Create a project** แล้วตั้งชื่อ `arewarin-tutor-os`
3. เลือกการตั้งค่า Google Analytics ตามต้องการ แล้วรอสร้างโปรเจกต์
4. ใน Project Overview กดสัญลักษณ์ **Web (`</>`)** เพื่อเพิ่มเว็บแอป ตั้งชื่อ `AreWarin Tutor Web`
5. เปิดหน้า **Project settings → General → Your apps → SDK setup and configuration → Config** แล้วจดค่า `apiKey`, `authDomain`, `projectId`, `appId` (เป็น public web config ไม่ใช่ความลับ)
6. ไปที่ **Build → Firestore Database → Create database** เลือก Region ที่เหมาะ เช่น Singapore (ถ้ามี) และเลือก **Production mode** อย่าเลือก Test mode สำหรับข้อมูลจริง
7. เปิด **Firestore Database → Rules** วางโค้ดจากไฟล์ `firestore.rules` แล้วกด **Publish** จะเป็น `allow read, write: if false;` ทุก collection เนื่องจาก API บน Vercel จะจัดการข้อมูลผ่าน Firebase Admin SDK แทน
8. ไปที่ **Build → Authentication → Get started → Sign-in method** เปิด **Email/Password**
9. เปิดแท็บ **Users → Add user** สร้างผู้ใช้ผู้สอนด้วยอีเมลและรหัสผ่านที่รัดกุม (ไม่ใช่อีเมลผู้เรียน) แล้วคัดลอก **User UID** ของบัญชีนี้เก็บไว้ใช้เป็น `ADMIN_UID`
10. ไปที่ **Authentication → Settings → Authorized domains** เพิ่มโดเมนเว็บที่ได้จาก Vercel เมื่อ Deploy เสร็จ เช่น `arewarin-tutor-os.vercel.app` ถ้าไม่มีอยู่แล้ว
11. เปิด **Project settings → Service accounts → Generate new private key** แล้วดาวน์โหลด JSON ไว้ในเครื่องส่วนตัว ห้ามส่งในแชตหรืออัปโหลด GitHub

## ขั้นที่ 2 — อัปโหลด GitHub (ผ่านเว็บไซต์)

1. เปิด https://github.com/new
2. สร้าง Repository ชื่อ `arewarin-tutor-os-firebase` และเลือก **Private**
3. เปิด Repository → **Add file → Upload files**
4. ลากไฟล์และโฟลเดอร์ภายใน ZIP ที่แตกแล้วขึ้น GitHub โดยให้ `index.html` อยู่ที่ root (ระดับบนสุด) และให้โฟลเดอร์ `api` กับ `lib` อยู่ระดับเดียวกัน
5. กด **Commit changes**
6. ถ้า GitHub Upload files ไม่รับโฟลเดอร์ ให้ลากโฟลเดอร์เข้าช่อง Drag and drop บนหน้า Upload files; หรือเปิดหน้าสร้างไฟล์ใน GitHub และสร้าง path เช่น `api/data.js` พร้อมวางเนื้อหา

## ขั้นที่ 3 — Deploy Vercel (ผ่านเว็บไซต์)

1. เปิด https://vercel.com/new และ **Add New → Project**
2. Import Repository จาก GitHub (`arewarin-tutor-os-firebase`)
3. Framework Preset ตั้ง `Other`; Root Directory เป็น `./` (โฟลเดอร์เดียวกับ `package.json`, `index.html` และ `api/`)
4. กด Deploy; Vercel ติดตั้งแพ็กเกจ `firebase-admin` จาก `package.json` ให้โดยอัตโนมัติ ไม่ต้องติดตั้งโปรแกรมในเครื่อง
5. เมื่อสถานะ Ready ให้กด Visit เพื่อดู URL จริงแบบ `https://....vercel.app`
6. ตอนนี้เว็บอาจยังขึ้นข้อความแจ้งให้ตั้งค่า Firebase เนื่องจากเรายังไม่กรอก Web Config และ Env ถือเป็นปกติ

## ขั้นที่ 4 — ใส่ Firebase Web Config ในไฟล์ GitHub

1. ไปที่ GitHub Repository → คลิกไฟล์ **config.js** → กดรูป **ดินสอ Edit**
2. เปลี่ยนค่า `PASTE_FIREBASE_WEB_API_KEY`, `PASTE_PROJECT_ID`, `PASTE_FIREBASE_WEB_APP_ID` ให้ตรงกับ Firebase Web App Config จากขั้นที่ 1
3. ตัวอย่าง (สมมติ):

```js
window.AWT_CONFIG = {
  firebase: {
    apiKey: "AIza....",             // Web API key จาก Firebase
    authDomain: "my-project.firebaseapp.com",
    projectId: "my-project",
    appId: "1:123456:web:abc"
  },
  liffId: "PASTE_LINE_LIFF_ID",     // ใส่หลังสร้าง LIFF
  oaFriendUrl: ""                   // URL เพิ่มเพื่อน LINE OA ถ้ามี
};
```

4. กด **Commit changes** แล้ว Vercel จะ Deploy รอบใหม่อัตโนมัติ
5. ค่าใน `config.js` เป็น **public web config** เท่านั้น ไม่ใส่ Service Account JSON, LINE Channel Access Token หรือ CRON_SECRET ในไฟล์นี้

## ขั้นที่ 5 — ใส่ Secret เฉพาะใน Vercel Environment Variables

1. Vercel → เลือกโปรเจกต์ → **Settings → Environment Variables**
2. เพิ่มชื่อ/ค่า (Environment เลือก **Production**):

| Variable | ค่าที่ใส่ | ใช้ทำอะไร |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **เนื้อหา JSON ทั้งหมด** จาก Firebase Service Account ที่ดาวน์โหลด โดยเปิดด้วย Notepad แล้วคัดลอกทั้งหมด | การเชื่อม Firestore ฝั่งเซิร์ฟเวอร์ |
| `ADMIN_UID` | UID จาก Firebase Authentication → Users | จำกัดสิทธิ์หน้า Manager ให้ผู้สอน |
| `LINE_LOGIN_CHANNEL_ID` | Channel ID ของ LINE Login (ใส่ในขั้นที่ 7) | ยืนยันตัวตนนักเรียน |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token ของ Messaging API (ใส่ในขั้นที่ 7) | ส่ง LINE แจ้งเตือน |
| `CRON_SECRET` | ข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษรที่เดาไม่ได้ (สร้างในเครื่องมือ Password Generator ที่เชื่อถือได้) | ป้องกันการเรียกแจ้งเตือนโดยไม่ได้รับอนุญาต |

3. **Secret ทุกตัวต้องไม่อยู่ใน GitHub หรือหน้าเว็บ** และห้ามส่งให้ผู้อื่น
4. หลังบันทึกค่าหรือแก้ไขค่าใน Vercel ให้เปิด **Deployments → ... → Redeploy** เพื่อให้ Runtime ของ Deployment ใหม่รับค่าล่าสุด
5. ตอนเริ่มต้นสามารถใส่เฉพาะ `FIREBASE_SERVICE_ACCOUNT_JSON` กับ `ADMIN_UID` ก่อนเพื่อทดลองหลังบ้าน ส่วน LINE ใส่ทีหลังได้
6. เปิดเว็บ Vercel → ล็อกอินอีเมลผู้สอนที่สร้างใน Firebase → หน้า Manager ควรขึ้น `Firebase Connected`
7. ทดลองเพิ่มข้อมูลนักเรียนตัวอย่างหนึ่งคน รีเฟรชหน้าเว็บ แล้วดูว่ารายการยังอยู่

## ขั้นที่ 6 — ผูก LINE OA และ LINE Login ให้ใช้ Provider เดียวกัน

1. เปิด https://manager.line.biz/ สร้าง LINE Official Account สำหรับ AreWarin Tutor ถ้ายังไม่มี
2. ใน LINE Official Account Manager เปิดการใช้ **Messaging API** (ดูคู่มือ https://developers.line.biz/en/docs/messaging-api/getting-started/)
3. ไป https://developers.line.biz/console/ สร้างหรือเลือก **Provider** สำหรับ AreWarin Tutor
4. สร้าง **LINE Login Channel** ภายใต้ Provider **เดียวกัน** กับ Messaging API Channel ของ LINE OA เพื่อให้เชื่อม LINE user ID ได้อย่างถูกต้อง
5. LINE Login Channel → **LIFF** → **Add LIFF app**
6. ชื่อแอป `AreWarin Student`; ขนาด `Full`; Endpoint URL ใส่ `https://YOUR-VERCEL-DOMAIN.vercel.app/student.html` (ใช้ URL จริงที่ได้); Scopes ให้มี `profile` และ **`openid`**
7. คัดลอก **LIFF ID** ไปใส่ `liffId` ใน GitHub → `config.js` แล้ว Commit changes
8. ใน LINE Developers จด **LINE Login Channel ID** ใส่ค่า `LINE_LOGIN_CHANNEL_ID` ที่ Vercel Environment Variables
9. ใน Messaging API Channel เปิด **Messaging API** และสร้าง/คัดลอก **Channel access token** ใส่ใน `LINE_CHANNEL_ACCESS_TOKEN` ที่ Vercel
10. ที่ LINE Login Settings หากมีตัวเลือกให้เชื่อม/แสดง Add Friend ของ Official Account ให้เชื่อม OA ของ Provider เดียวกัน
11. เพิ่มโดเมนที่ระบุใน Endpoint ให้ถูกต้อง และกด Redeploy บน Vercel หลังเพิ่ม Env
12. สามารถส่งลิงก์ `https://liff.line.me/LIFF_ID` ให้นักเรียนเพื่อเปิดผ่าน LINE ได้
13. ตัวเว็บมี Student Portal ให้เข้าสู่ระบบผ่าน LINE และกรอกรหัสเชิญ ผูกบัญชีได้ **หลังตั้งค่า LINE และ Vercel API ครบแล้ว**

## ขั้นที่ 7 — เพิ่มนักเรียนและผูก LINE ด้วยรหัสเชิญ

1. เปิดเว็บ Manager → เมนู **นักเรียน** → เพิ่มรหัสนักเรียน เช่น ST003 และชื่อ
2. ไปที่ **คอร์สเรียน** → สร้างคอร์ส → ลงทะเบียนนักเรียนและชั่วโมงเรียน
3. ไปที่เมนู **ผูก LINE** → เลือกนักเรียนที่ยังไม่ผูก → กด **สร้าง Activation Code**
4. ระบบจะสร้างรหัส `AWT-...` แบบสุ่ม ใช้ครั้งเดียว และหมดอายุใน **7 วัน**
5. กด **คัดลอกลิงก์เชิญ** แล้วส่งให้นักเรียนเป็นการส่วนตัว
6. นักเรียนเปิดลิงก์ → ล็อกอิน LINE → กดผูกบัญชี (โดยระบบยืนยัน ID token กับ LINE จากฝั่ง Vercel)
7. นักเรียนเพิ่มเพื่อน LINE OA ของ AreWarin Tutor เพื่อรับแจ้งเตือน (หากยังไม่ได้เป็นเพื่อน)
8. นักเรียนเปิด **Student Portal** ดูคอร์ส ชั่วโมงคงเหลือ ตารางเรียน เข้าเรียนออนไลน์ แจ้งลา และแจ้งต่อคอร์ส/ยุติได้
9. ครูเปิด Manager และกดรีเฟรชเพื่อโหลดสถานะผูก LINE และคำร้องล่าสุด

## ขั้นที่ 8 — ระบบแจ้งเตือนก่อนเรียน 1 วัน / 1 ชั่วโมง

มีไฟล์ `api/cron.js` สำหรับส่ง LINE Messaging API เมื่อถึงเวลาที่กำหนด โดยส่งเฉพาะนักเรียนที่ผูก LINE และมีสิทธิ์เรียนคอร์สนั้น ระบุเวลาเรียนเป็นเวลาไทย (UTC+7) และป้องกันส่งข้อความซ้ำด้วย `noticeEvents` ใน Firestore

**ข้อควรทราบ:** Vercel Hobby ปัจจุบันไม่รองรับ Cron ความถี่ทุก 5 นาที (และไม่เหมาะสำหรับงานเชิงพาณิชย์ตามข้อกำหนดแผน) จึงใช้ `vercel.json` แบบไม่มี Cron โดยตั้งต้น เพื่อให้ Deploy ได้ก่อน

หากคุณใช้ **Vercel Pro**:

1. เปิด GitHub Repository → ไฟล์ `vercel.json` → กด Edit
2. แทนที่เนื้อหาด้วยโค้ดใน `vercel-cron-pro.example.json` (ค่า Schedule `*/5 * * * *` หมายถึงตรวจทุก 5 นาที)
3. Commit changes ให้ Vercel Deploy อีกครั้ง
4. ตรวจว่ามี `CRON_SECRET` อยู่ใน Vercel Production Environment Variables
5. เปิด Vercel Project → Settings → Cron Jobs / ดูรายการ Cron ใน Dashboard
6. ทดลองสร้างคลาสล่วงหน้าและผูก LINE นักเรียนทดสอบจริง

ถ้าไม่เปิด Cron อัตโนมัติ: ครูสามารถกด **ผูก LINE → ตรวจและส่งแจ้งเตือนที่ถึงกำหนด** ภายใน Manager ได้ แต่วิธีนี้ไม่ส่งตามเวลาเอง หากไม่ได้กดตรวจ

LINE OA อาจมีการคิดค่าบริการตามจำนวนข้อความ และ LINE ส่ง Push ได้เฉพาะกรณีผู้รับมีสิทธิ์รับข้อความตามข้อกำหนดแพลตฟอร์ม

## ขั้นที่ 9 — ทดสอบก่อนใช้กับนักเรียนจริง

- [ ] ผู้สอนล็อกอิน Manager ได้ แต่บัญชีอื่นไม่เข้า Manager
- [ ] สร้างนักเรียน/คอร์ส/ตารางเรียนแล้วข้อมูลไม่หายเมื่อรีเฟรช
- [ ] นักเรียนใช้ Activation Code ผูก LINE ผ่าน Student Portal ได้เพียงครั้งเดียว
- [ ] นักเรียนคนหนึ่งมองไม่เห็นข้อมูลของอีกคน
- [ ] นักเรียนเห็นลิงก์เข้าเรียนของคลาสที่ลงทะเบียน
- [ ] ส่งคำขอลา/ต่อคอร์ส → ผู้สอนรีเฟรชแล้วเห็นใน Manager
- [ ] ผู้สอนบันทึกชั่วโมงแล้วชั่วโมงคงเหลือเปลี่ยน
- [ ] เมื่อข้ามเกณฑ์ 4 ชั่วโมง ระบบพยายามส่ง LINE ไปยังนักเรียนที่ผูกบัญชี
- [ ] ถ้าตั้ง Cron แล้ว ทดลองแจ้งเตือนคลาสล่วงหน้า 1 วัน และ 1 ชั่วโมง
- [ ] Firestore Rules ไม่ได้เปิด `allow read, write: if true;`

## ปัญหาที่พบบ่อย

**"ยังไม่ได้ตั้งค่า config.js"** — แก้ค่า Firebase Web Config ใน GitHub แล้ว Commit ใหม่

**"Missing FIREBASE_SERVICE_ACCOUNT_JSON" หรือ Backend ผิดพลาด** — ตั้ง Environment Variable ให้ถูก แล้ว Redeploy; ตรวจ Logs ใน Vercel Functions โดยไม่เผย Secret

**"บัญชีนี้ไม่มีสิทธิ์ผู้ดูแล"** — ตรวจ UID ใน Firebase Authentication → Users ให้ตรงกับ `ADMIN_UID`

**"LINE ID Token ไม่ถูกต้อง"** — ตรวจ `LINE_LOGIN_CHANNEL_ID`, LIFF ID, Scope `openid`, Provider และ Endpoint URL ให้ตรงกัน

**"Firebase permission denied"** — อย่าเปิด Rules กว้าง ๆ ให้แก้เซิร์ฟเวอร์/Service Account แทน

**"ยังไม่ได้รับ LINE แจ้งเตือน"** — ต้องผูก LINE สำเร็จ เพิ่มเพื่อน LINE OA และมี `LINE_CHANNEL_ACCESS_TOKEN`; สำหรับแจ้งเตือนตรงเวลา ต้องเปิด Cron ที่เรียกได้ถี่พอ

## ข้อจำกัดของรุ่นนี้

เวอร์ชันนี้ยังเก็บข้อมูลหลักของสถาบันใน Firestore **1 เอกสารที่มี Revision** เพื่อคงรูปแบบ UI เดิมได้อย่างรวดเร็ว เหมาะกับการทดลองกับกวดวิชาขนาดเล็ก มีการตรวจความขัดแย้งเมื่อแก้ไขพร้อมกัน แต่ยังไม่เหมาะกับงานหลายสาขา/จำนวนผู้ใช้มาก หรืองานการเงินที่ต้อง audit สูง ก่อนขยายจริงควรแยก collections เป็นรายนักเรียน รายคอร์ส รายคลาส และบันทึก ledger ชั่วโมงเรียนแบบ append-only พร้อม transaction แยก

ยังไม่รองรับ Import Excel อัตโนมัติ, Parent Portal เต็มรูปแบบ, ระบบใบเสร็จที่ออกตามข้อกำหนดบัญชี, การเรียกคืนรหัสเชิญด้วยตนเอง และระบบรองรับข้อพิพาทการชำระเงิน จึงควรทดสอบด้วยข้อมูลสมมติก่อนใช้งานจริง
