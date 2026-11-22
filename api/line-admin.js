'use strict';
const {db,send,goodId,manager,push,classLabel,bkk,linkConfirmationMessage,attendanceSummary}=require('../lib/awt-server');
async function recipientsForSession(ss){
 let ens=[];
 if(ss.participants_locked){
  const {data,error}=await db().from('awt_session_participants').select('enrollment_id').eq('session_id',ss.id).eq('organization_id',ss.organization_id).limit(500);
  if(error)throw error;const ids=(data||[]).map(p=>p.enrollment_id);
  if(ids.length){const r=await db().from('awt_enrollments').select('student_id').eq('organization_id',ss.organization_id).in('id',ids);if(r.error)throw r.error;ens=r.data||[];}
 }else{const r=await db().from('awt_enrollments').select('student_id').eq('organization_id',ss.organization_id).eq('course_id',ss.course_id).limit(500);if(r.error)throw r.error;ens=r.data||[];}
 const students=[...new Set(ens.map(e=>e.student_id))];if(!students.length)return [];
 const {data,error}=await db().from('awt_line_accounts').select('line_user_id,student_id').eq('organization_id',ss.organization_id).in('student_id',students).eq('notifications_enabled',true);
 if(error)throw error;return data||[];
}
module.exports=async(req,res)=>{
 if(req.method!=='POST')return send(res,405,{error:'Only POST'});
 try{
  const admin=await manager(req),body=req.body||{},action=String(body.action||'');
  if(action==='attendance-notify'){
   if(!goodId(body.enrollmentId)||!goodId(body.sessionId))return send(res,400,{error:'ข้อมูลการลงเวลาไม่ถูกต้อง'});
   // Read the saved record on the server; never trust hours or LINE IDs from browser.
   const summary=await attendanceSummary(admin.organization_id,body.enrollmentId,body.sessionId);
   if(!summary)return send(res,409,{error:'ยังไม่มีการลงเวลาที่บันทึกสำเร็จ'});
   if(!summary.line||summary.line.notifications_enabled===false){
    return send(res,200,{ok:true,notification:'not_linked',message:'บันทึกเวลาแล้ว แต่ยังไม่ได้ผูก LINE หรือปิดรับแจ้งเตือน'});
   }
   // The unique attendance-kind index prevents duplicate pushes for the same stored state.
   const kind=summary.kind;
   const scope=()=>db().from('awt_notification_jobs')
    .select('id,status,attempts').eq('organization_id',admin.organization_id)
    .eq('student_id',summary.enrollment.student_id).eq('session_id',body.sessionId)
    .eq('kind',kind);
   const created=await db().from('awt_notification_jobs').insert({
     organization_id:admin.organization_id,student_id:summary.enrollment.student_id,
     session_id:body.sessionId,enrollment_id:body.enrollmentId,kind,
     scheduled_at:new Date().toISOString(),status:'pending'
   }).select('id,status,attempts').maybeSingle();
   if(created.error&&created.error.code!=='23505')throw created.error;
   const job=created.data||(await scope().maybeSingle()).data;
   if(!job)return send(res,503,{error:'ไม่สามารถตรวจสอบรายการแจ้งเตือน'});
   if(job.status==='sent')return send(res,200,{ok:true,notification:'already_sent',message:'แจ้งเตือนรายการนี้แล้ว'});
   if(job.status==='processing')return send(res,200,{ok:true,notification:'processing',message:'LINE กำลังประมวลผลข้อความ'});
   // Acquire only once: concurrent submissions must not push multiple times.
   const lock=await db().from('awt_notification_jobs').update({
     status:'processing',attempts:(job.attempts||0)+1,locked_at:new Date().toISOString()
   }).eq('id',job.id).in('status',['pending','failed']).select('id').maybeSingle();
   if(lock.error)throw lock.error;
   if(!lock.data)return send(res,200,{ok:true,notification:'processing',message:'LINE กำลังประมวลผลข้อความ'});
   try{
     const receipt=await push(summary.line.line_user_id,summary.text);
     const saved=await db().from('awt_notification_jobs')
       .update({status:'sent',provider_message_id:receipt,locked_at:null})
       .eq('id',job.id);
     if(saved.error)throw saved.error;
     return send(res,200,{ok:true,notification:'accepted',message:'LINE รับคำขอส่งสรุปการเรียนแล้ว'});
   }catch(err){
     // Do not undo the already saved attendance; allow retry for this notification.
     await db().from('awt_notification_jobs').update({status:'failed',locked_at:null})
       .eq('id',job.id);
     return send(res,502,{error:'บันทึกเวลาแล้ว แต่ LINE ส่งข้อความไม่สำเร็จ กรุณาตรวจ Token และการเพิ่มเพื่อน OA'});
   }
  }
  if(action==='link-confirmation'){
   if(!goodId(body.studentId))return send(res,400,{error:'Invalid student ID'});
   const {data:link,error:linkError}=await db().from('awt_line_accounts').select('line_user_id')
    .eq('student_id',body.studentId).eq('organization_id',admin.organization_id)
    .eq('notifications_enabled',true).maybeSingle();
   if(linkError)throw linkError;
   if(!link)return send(res,404,{error:'นักเรียนยังไม่ได้ผูก LINE หรือปิดรับแจ้งเตือน'});
   const {data:student,error:studentError}=await db().from('awt_students').select('full_name')
    .eq('id',body.studentId).eq('organization_id',admin.organization_id).single();
   if(studentError)throw studentError;
   await push(link.line_user_id,linkConfirmationMessage(student));
   return send(res,200,{ok:true,accepted:1});
  }
  if(action==='test'){
   if(!goodId(body.studentId))return send(res,400,{error:'Invalid student ID'});
   const {data,error}=await db().from('awt_line_accounts').select('line_user_id').eq('student_id',body.studentId).eq('organization_id',admin.organization_id).eq('notifications_enabled',true).maybeSingle();if(error)throw error;
   if(!data)return send(res,404,{error:'นักเรียนยังไม่ได้ผูก LINE หรือปิดรับแจ้งเตือน'});
   await push(data.line_user_id,'AreWarin Tutor 🧬\nทดสอบการแจ้งเตือนสำเร็จจากระบบจัดการเรียน');return send(res,200,{ok:true,sent:1});
  }
  if(action==='cancel-class'){
   if(!goodId(body.sessionId))return send(res,400,{error:'Invalid class ID'});
   const {data:ss,error}=await db().from('awt_class_sessions').select('id,organization_id,topic,course_id,starts_at,session_type,group_label,status,cancel_reason,participants_locked').eq('id',body.sessionId).eq('organization_id',admin.organization_id).single();if(error)throw error;
   if(ss.status!=='cancelled')return send(res,409,{error:'คลาสยังไม่ถูกยกเลิกในฐานข้อมูล'});
   const targets=await recipientsForSession(ss);
   const content=`AreWarin Tutor 🧬\nแจ้งยกเลิกคลาส\nหัวข้อ: ${ss.topic}\nรูปแบบ: ${classLabel(ss)}${ss.group_label?' · '+ss.group_label:''}\nเดิมกำหนด: ${bkk(ss.starts_at)} น.\n${ss.cancel_reason?'เหตุผล: '+ss.cancel_reason.slice(0,200):'โปรดตรวจสอบตารางเรียนใหม่'}`;
   let sent=0,failed=0;
   for(const t of targets){
    const kind='cancel_'+new Date(ss.starts_at).toISOString();
    const {data:created,error:je}=await db().from('awt_notification_jobs').insert({organization_id:ss.organization_id,student_id:t.student_id,session_id:ss.id,kind,scheduled_at:new Date().toISOString(),status:'pending'}).select('id').single();
    if(je){if(je.code==='23505')continue;throw je;}
    try{const requestId=await push(t.line_user_id,content);await db().from('awt_notification_jobs').update({status:'sent',attempts:1,provider_message_id:requestId}).eq('id',created.id);sent++;}
    catch(e){await db().from('awt_notification_jobs').update({status:'failed',attempts:1}).eq('id',created.id);failed++;}
   }
   return send(res,200,{ok:true,sent,failed,linkedStudents:targets.length});
  }
  return send(res,400,{error:'Unknown action'});
 }catch(e){return send(res,e.statusCode||500,{error:e.statusCode?e.message:'เกิดข้อผิดพลาดในการส่ง LINE'});}
};
