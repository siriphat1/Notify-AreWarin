const admin = require('firebase-admin');
const crypto = require('node:crypto');

function getAdmin() {
  if (!admin.apps.length) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
    const cert = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!cert.private_key || !cert.client_email) throw new Error('Invalid Firebase service account');
    admin.initializeApp({credential: admin.credential.cert(cert)});
  }
  return admin;
}
function db() { return getAdmin().firestore(); }
const stateRef=()=>db().collection('workspace').doc('primary');
const KEY_NAMES=['students','courses','enrollments','sessions','attendance','leaves','announcements','invoices','codes','decisions','notifications','notificationDismissals','classReturns'];
function emptyData(){ return Object.fromEntries(KEY_NAMES.map(k=>[k,[]])); }
function cleanData(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw http(400,'ข้อมูลไม่ถูกต้อง');
  const d=emptyData();
  for(const key of KEY_NAMES){
    if(!Array.isArray(input[key])) throw http(400,`ข้อมูล ${key} ไม่ถูกต้อง`);
    if(input[key].length>2000) throw http(413,'ข้อมูลมากเกินขนาดที่รองรับ');
    d[key]=input[key];
  }
  if(Buffer.byteLength(JSON.stringify(d),'utf8')>750000) throw http(413,'ข้อมูลเกินขนาดที่เวอร์ชันนี้รองรับ');
  for(const s of d.sessions){
    if (s.link && !isSafeUrl(s.link)) throw http(400,'ลิงก์เข้าเรียนต้องเป็น https:// เท่านั้น');
    if (s.start && s.end && String(s.end)<=String(s.start)) throw http(400,'เวลาสิ้นสุดคลาสไม่ถูกต้อง');
  }
  return d;
}
function isSafeUrl(s){ try {return new URL(String(s)).protocol==='https:';} catch {return false;} }
function http(status,msg){const e=new Error(msg);e.status=status;return e;}
async function state(){const doc=await stateRef().get();return {revision:doc.exists?(doc.data().revision||0):0,data:doc.exists?(doc.data().data||emptyData()):emptyData()};}
function bearer(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');}
async function requireAdmin(req){
  const token=bearer(req);if(!token)throw http(401,'กรุณาเข้าสู่ระบบ');
  const decoded=await getAdmin().auth().verifyIdToken(token,true).catch(()=>{throw http(401,'บัญชีหมดอายุ กรุณาเข้าสู่ระบบใหม่');});
  if(!process.env.ADMIN_UID || decoded.uid!==process.env.ADMIN_UID)throw http(403,'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแล');
  return decoded;
}
async function verifyLineToken(idToken){
  if(!process.env.LINE_LOGIN_CHANNEL_ID)throw http(503,'ยังไม่ได้ตั้งค่า LINE_LOGIN_CHANNEL_ID');
  if(typeof idToken!=='string'||idToken.length<20||idToken.length>5000)throw http(401,'กรุณาเข้าสู่ระบบด้วย LINE');
  const form=new URLSearchParams({id_token:idToken,client_id:process.env.LINE_LOGIN_CHANNEL_ID});
  const r=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
  if(!r.ok)throw http(401,'LINE Login ไม่ถูกต้องหรือหมดอายุ');
  const profile=await r.json();
  if(!profile.sub||profile.aud!==process.env.LINE_LOGIN_CHANNEL_ID)throw http(401,'ไม่สามารถยืนยัน LINE ได้');
  return {id:profile.sub,name:profile.name||'นักเรียน'};
}
async function sendLine(userId,text){
  if(!process.env.LINE_CHANNEL_ACCESS_TOKEN)throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN');
  const r=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{'Authorization':`Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({to:userId,messages:[{type:'text',text:String(text).slice(0,4800)}]})});
  if(!r.ok)throw new Error(`LINE push ${r.status}: ${(await r.text()).slice(0,200)}`);
}
function thaiDate(iso){const t=new Date(String(iso)+'+07:00');return Number.isFinite(t.valueOf())?t.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'}):String(iso);}
function dueEpoch(local){return Date.parse(String(local)+'+07:00');}
function used(d,sid,cid){return d.attendance.filter(x=>x.student===sid&&x.course===cid).reduce((n,x)=>n+Number(x.hours||0),0);}
function remaining(d,sid,cid){const e=d.enrollments.find(x=>x.student===sid&&x.course===cid);return e?Math.max(0,Number(e.hours||0)-used(d,sid,cid)):0;}
function json(res,status,obj){res.status(status).setHeader('Cache-Control','no-store').json(obj);}
function fail(res,e){const status=e.status||500; if(status>=500)console.error(e);return json(res,status,{error:status>=500?'เกิดข้อผิดพลาดของระบบ ตรวจสอบการตั้งค่า Vercel':e.message});}
function readBody(req){return req.body && typeof req.body==='object' ? req.body : JSON.parse(req.body||'{}');}
const digest=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
module.exports={admin:getAdmin,db,stateRef,emptyData,cleanData,state,http,bearer,requireAdmin,verifyLineToken,sendLine,thaiDate,dueEpoch,remaining,json,fail,readBody,digest};
