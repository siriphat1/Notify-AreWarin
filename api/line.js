'use strict';
const {db,send,goodId,textSafe,lineIdentity,currentLink,validUrl}=require('../lib/awt-server');
const uuid=/^[0-9a-f-]{36}$/i;
async function getMany(table,col,ids,cols='*'){
 if(!ids.length)return [];
 const {data,error}=await db().from(table).select(cols).in(col,ids).limit(500);
 if(error)throw error;return data||[];
}
async function scopedDashboard(link){
 const studentId=link.student_id,orgId=link.organization_id;
 const {data:student,error:sErr}=await db().from('awt_students').select('id,student_code,full_name,organization_id').eq('id',studentId).eq('organization_id',orgId).single();
 if(sErr)throw sErr;
 const {data:enrollments,error:eErr}=await db().from('awt_enrollments').select('id,course_id,purchased_hours,created_at').eq('student_id',studentId).eq('organization_id',orgId).limit(500);
 if(eErr)throw eErr;
 const coursesIds=[...new Set(enrollments.map(e=>e.course_id))],eIds=enrollments.map(e=>e.id);
 const [courses,tx,attendance,participants,leave,invoices,requests,announcements]=await Promise.all([
 getMany('awt_courses','id',coursesIds,'id,name'),getMany('awt_hour_transactions','enrollment_id',eIds,'enrollment_id,delta_hours,created_at'),
 getMany('awt_attendance','enrollment_id',eIds,'enrollment_id,session_id,hours,status,created_at,lesson_date,check_in_at,check_out_at'),
 getMany('awt_session_participants','enrollment_id',eIds,'session_id,enrollment_id'),
 db().from('awt_leave_requests').select('id,session_id,reason,status,created_at').eq('student_id',studentId).eq('organization_id',orgId).order('created_at',{ascending:false}).limit(100).then(({data,error})=>{if(error)throw error;return data||[]}),
 db().from('awt_invoices').select('id,amount,due_date,status').eq('student_id',studentId).eq('organization_id',orgId).limit(100).then(({data,error})=>{if(error)throw error;return data||[]}),
 db().from('awt_course_requests').select('id,enrollment_id,request_type,status,created_at').eq('student_id',studentId).eq('organization_id',orgId).limit(100).then(({data,error})=>{if(error)throw error;return data||[]}),
 db().from('awt_announcements').select('id,title,body,created_at').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(30).then(({data,error})=>{if(error)throw error;return data||[]})
 ]);
 let sessions=[];
 if(coursesIds.length){const {data,error}=await db().from('awt_class_sessions').select('id,course_id,topic,starts_at,ends_at,meeting_url,status,cancel_reason,session_type,group_label,participants_locked').eq('organization_id',orgId).in('course_id',coursesIds).order('starts_at',{ascending:true}).limit(500);if(error)throw error;
 const mine=new Set(participants.map(p=>p.session_id));sessions=(data||[]).filter(s=>!s.participants_locked||mine.has(s.id));}
 const allowedSessionIds=new Set(sessions.map(s=>s.id));
 const balances=enrollments.map(e=>({ ...e,remaining_hours:Math.round((Number(e.purchased_hours||0)+tx.filter(t=>t.enrollment_id===e.id).reduce((n,t)=>n+Number(t.delta_hours||0),0))*100)/100}));
 return {student,courses,enrollments:balances,sessions,attendance:attendance.filter(x=>allowedSessionIds.has(x.session_id)),leave:leave.filter(x=>allowedSessionIds.has(x.session_id)),invoices,requests,announcements,notificationsEnabled:link.notifications_enabled!==false};
}
module.exports=async(req,res)=>{
 if(req.method!=='POST')return send(res,405,{error:'Only POST allowed'});
 res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
 try{
  const body=req.body||{};if(!body||typeof body!=='object')return send(res,400,{error:'Invalid JSON'});
  const action=String(body.action||'');const user=await lineIdentity(body.idToken);
  if(action==='claim'){
   const code=textSafe(body.code,45).toUpperCase();if(!/^AWT-[0-9A-F]{32}$/.test(code))return send(res,400,{error:'รหัสเชิญไม่ถูกต้อง'});
   // Atomic claim in SQL, callable only by server-side service role.
   const {data,error}=await db().rpc('awt_claim_line_invite_secure',{p_code:code,p_line_user_id:user.sub});
   if(error)return send(res,400,{error:'รหัสเชิญไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว'});
   return send(res,200,{ok:true,linked:data?.linked===true});
  }
  const link=await currentLink(user.sub);
  if(!link)return send(res,200,{linked:false});
  if(action==='dashboard'||action==='status'){return send(res,200,{linked:true,...(action==='dashboard'?await scopedDashboard(link):{})});}
  if(action==='leave'){
   if(!goodId(body.sessionId))return send(res,400,{error:'Invalid class ID'});
   const reason=textSafe(body.reason,1000);if(reason.length<3)return send(res,400,{error:'กรุณากรอกเหตุผลการลา'});
   const data=await scopedDashboard(link);const ss=data.sessions.find(s=>s.id===body.sessionId);
   if(!ss||ss.status!=='scheduled'||new Date(ss.starts_at)<=new Date())return send(res,400,{error:'ไม่สามารถลาเรียนคลาสนี้ได้'});
   if(data.leave.some(x=>x.session_id===ss.id&&x.status==='pending'))return send(res,409,{error:'มีคำขอลาของคลาสนี้รอดำเนินการแล้ว'});
   const {error}=await db().from('awt_leave_requests').insert({organization_id:link.organization_id,student_id:link.student_id,session_id:ss.id,reason,status:'pending'});if(error)throw error;
   return send(res,200,{ok:true});
  }
  if(action==='course-request'){
   if(!goodId(body.enrollmentId)||!['renew','end'].includes(body.requestType))return send(res,400,{error:'ข้อมูลคำขอไม่ถูกต้อง'});
   const data=await scopedDashboard(link);const en=data.enrollments.find(e=>e.id===body.enrollmentId);
   if(!en||en.remaining_hours>4)return send(res,400,{error:'ส่งคำขอได้เมื่อเหลือไม่เกิน 4 ชั่วโมง'});
   const {error}=await db().from('awt_course_requests').insert({organization_id:link.organization_id,student_id:link.student_id,enrollment_id:en.id,request_type:body.requestType,status:'pending'});
   if(error)return send(res,409,{error:'มีคำขอที่รอดำเนินการอยู่แล้ว'});
   return send(res,200,{ok:true});
  }
  return send(res,400,{error:'Unknown action'});
 }catch(e){return send(res,e.statusCode||500,{error:e.statusCode?e.message:'ระบบเชื่อมต่อไม่พร้อม กรุณาลองอีกครั้ง'});}
};
