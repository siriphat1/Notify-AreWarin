'use strict';
const {createClient}=require('@supabase/supabase-js');
let admin;
function db(){
 if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('Missing Supabase server credentials');
 if (!admin) admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
 return admin;
}
function send(res,status,body){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body)}
function goodId(s){return typeof s==='string'&&/^[0-9a-f-]{36}$/i.test(s)}
function textSafe(s,max=150){return String(s??'').trim().slice(0,max)}
async function lineIdentity(idToken){
 if(typeof idToken!=='string'||idToken.length<40||idToken.length>12000) throw Object.assign(new Error('Missing or invalid LINE token'),{statusCode:401});
 if(!process.env.LINE_LOGIN_CHANNEL_ID)throw Object.assign(new Error('LINE login not configured'),{statusCode:503});
 const form=new URLSearchParams({id_token:idToken,client_id:process.env.LINE_LOGIN_CHANNEL_ID});
 const response=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString(),signal:AbortSignal.timeout(10000)});
 if(!response.ok) throw Object.assign(new Error('LINE login verification failed; check LINE Login Channel ID'),{statusCode:401});
 const user=await response.json();
 if(user.aud!==process.env.LINE_LOGIN_CHANNEL_ID||user.iss!=='https://access.line.me'||!/^U[0-9a-f]{32}$/.test(user.sub||''))throw Object.assign(new Error('LINE token claims mismatch'),{statusCode:401});
 return user;
}
async function currentLink(lineUserId){
 const {data,error}=await db().from('awt_line_accounts').select('organization_id,student_id,line_user_id,notifications_enabled').eq('line_user_id',lineUserId).order('linked_at',{ascending:true}).limit(1).maybeSingle();
 if(error)throw error;return data;
}
async function manager(req){
 const token=(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1];
 if(!token)throw Object.assign(new Error('Manager login required'),{statusCode:401});
 const {data,error}=await db().auth.getUser(token);
 if(error||!data.user)throw Object.assign(new Error('Manager session expired'),{statusCode:401});
 const {data:staff,error:staffError}=await db().from('awt_staff_members').select('organization_id,role').eq('user_id',data.user.id).in('role',['owner','admin']).limit(1).maybeSingle();
 if(staffError)throw staffError;
 if(!staff)throw Object.assign(new Error('Owner/Admin permission required'),{statusCode:403});
 return {...staff,userId:data.user.id};
}
function validUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'?u.toString():null}catch{return null}}
async function push(userId,text){
 const token=process.env.LINE_CHANNEL_ACCESS_TOKEN;
 if(!token)throw Object.assign(new Error('Messaging API token not configured'),{statusCode:503});
 const body={to:userId,messages:[{type:'text',text:textSafe(text,4500)}]};
 const r=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!r.ok){const detail=await r.text();throw Object.assign(new Error('LINE push failed ('+r.status+'): '+detail.slice(0,140)),{statusCode:r.status>=500?502:400});}
 return r.headers.get('x-line-request-id')||null;
}
function classLabel(s){return s.session_type==='individual'?'เรียนเดี่ยว':s.session_type==='mixed'?'เรียนกลุ่ม + เดี่ยว':'เรียนกลุ่ม'}
function bkk(iso){return new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));}
// Keep the confirmation short and privacy-conscious. This is sent only to a LINE user
// whose identity was verified by the LINE Login channel or chosen by an authorized manager.
function linkConfirmationMessage(student){
 const name=String(student?.full_name||'').replace(/[\r\n\t]+/g,' ').trim().slice(0,100);
 const studentLine=name?`\nนักเรียน: ${name}`:'';
 const portal=validUrl(process.env.AWT_STUDENT_URL)||'https://liff.line.me/2012751475-G2D9ZDuM';
 return `✅ ผูกบัญชี LINE สำเร็จแล้ว!\nAreWarin Tutor 🧬${studentLine}\n\nบัญชี LINE นี้เชื่อมกับระบบนักเรียนเรียบร้อยแล้ว\nสามารถดูตารางเรียน ชั่วโมงคงเหลือ และแจ้งลาได้ที่\n${portal}\n\nหากไม่ได้ทำรายการนี้ กรุณาติดต่อผู้ดูแลกวดวิชา`;
}
const {createHash}=require('node:crypto');
// One logical notification per stored attendance state, even after a retry or refresh.
function attendanceKind(a){
 const state=[a.id,a.status,a.lesson_date,a.check_in_at,a.check_out_at,a.hours].map(v=>String(v??'')).join('|');
 return 'attendance_'+createHash('sha256').update(state).digest('hex').slice(0,24);
}
async function attendanceSummary(orgId,enrollmentId,sessionId){
 const q=async(table,columns,id)=>{
  const {data,error}=await db().from(table).select(columns).eq('id',id).eq('organization_id',orgId).single();
  if(error)throw error;return data;
 };
 const e=await q('awt_enrollments','id,student_id,course_id,purchased_hours',enrollmentId);
 const a=await db().from('awt_attendance').select('id,enrollment_id,session_id,status,hours,lesson_date,check_in_at,check_out_at,created_by')
  .eq('organization_id',orgId).eq('enrollment_id',enrollmentId).eq('session_id',sessionId).maybeSingle();
 if(a.error)throw a.error;
 if(!a.data)return null;
 const [student,course,session,tx,line]=await Promise.all([
  q('awt_students','id,full_name',e.student_id),
  q('awt_courses','id,name',e.course_id),
  q('awt_class_sessions','id,course_id,topic,session_type,group_label',sessionId),
  db().from('awt_hour_transactions').select('delta_hours').eq('organization_id',orgId).eq('enrollment_id',enrollmentId),
  db().from('awt_line_accounts').select('line_user_id,notifications_enabled').eq('organization_id',orgId).eq('student_id',e.student_id).maybeSingle()
 ]);
 if(tx.error||line.error)throw tx.error||line.error;
 if(session.course_id!==e.course_id)throw new Error('Attendance and course mismatch');
 const remaining=Number(e.purchased_hours||0)+(tx.data||[]).reduce((sum,t)=>sum+Number(t.delta_hours||0),0);
 const fmt=n=>Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:2});
 const classType=classLabel(session)+(session.group_label?' · '+session.group_label:'');
 const day=a.data.lesson_date?new Intl.DateTimeFormat('th-TH',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(a.data.lesson_date+'T12:00:00Z')):'—';
 const clock=t=>t?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t)):'—';
 const status=a.data.status==='present'?'บันทึกเวลาเรียนแล้ว':a.data.status==='excused'?'บันทึกการลาเรียนแล้ว':'บันทึกสถานะขาดเรียนแล้ว';
 const interval=a.data.status==='present'?('\nเวลาเข้า–ออก: '+clock(a.data.check_in_at)+'–'+clock(a.data.check_out_at)+' น.'):'';
 const portal=validUrl(process.env.AWT_STUDENT_URL)||'https://liff.line.me/2012751475-G2D9ZDuM';
 const text='AreWarin Tutor 🧬\n✅ '+status+'\nนักเรียน: '+student.full_name+
  '\nคอร์ส: '+course.name+'\nหัวข้อ: '+session.topic+'\nประเภท: '+classType+'\nวันที่: '+day+interval+
  '\nบันทึกครั้งนี้: '+fmt(a.data.hours)+' ชม.\nชั่วโมงคงเหลือ: '+fmt(remaining)+' ชม.'+
  (remaining<=4?'\n⚠️ ชั่วโมงเรียนใกล้หมด สามารถแจ้งต่อคอร์สหรือยุติได้ในพื้นที่นักเรียน':'')+
  '\n\nดูสมุดการเรียน: '+portal;
 return {attendance:a.data,enrollment:e,student,course,session,remaining,line:line.data,kind:attendanceKind(a.data),text};
}
module.exports={db,send,goodId,textSafe,lineIdentity,currentLink,manager,push,validUrl,classLabel,bkk,linkConfirmationMessage,attendanceKind,attendanceSummary};
