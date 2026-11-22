'use strict';
const {db,send,push,classLabel,bkk}=require('../lib/awt-server');
const MINUTE=60000,HOUR=60*MINUTE;
async function participants(ss){
 let studentIds=[];
 if(ss.participants_locked){
  const a=await db().from('awt_session_participants').select('enrollment_id').eq('session_id',ss.id).eq('organization_id',ss.organization_id).limit(500);if(a.error)throw a.error;
  const ids=(a.data||[]).map(x=>x.enrollment_id);if(ids.length){const b=await db().from('awt_enrollments').select('student_id').eq('organization_id',ss.organization_id).in('id',ids);if(b.error)throw b.error;studentIds=(b.data||[]).map(x=>x.student_id);}
 }else{const a=await db().from('awt_enrollments').select('student_id').eq('organization_id',ss.organization_id).eq('course_id',ss.course_id).limit(500);if(a.error)throw a.error;studentIds=(a.data||[]).map(x=>x.student_id);}
 studentIds=[...new Set(studentIds)];if(!studentIds.length)return [];
 const {data,error}=await db().from('awt_line_accounts').select('line_user_id,student_id').eq('organization_id',ss.organization_id).in('student_id',studentIds).eq('notifications_enabled',true);
 if(error)throw error;return data||[];
}
async function enqueue(ss,kind,at){
 for(const user of await participants(ss)){
  const {error}=await db().from('awt_notification_jobs').insert({organization_id:ss.organization_id,student_id:user.student_id,session_id:ss.id,kind,scheduled_at:at,status:'pending'});
  if(error&&error.code!=='23505')throw error;
 }
}
async function prepareClassAlerts(now){
 const intervals=[['before_1day',24*HOUR],['before_1hour',HOUR]];
 for(const [label,offset] of intervals){
  const low=new Date(now.getTime()+offset-10*MINUTE).toISOString();
  const hi=new Date(now.getTime()+offset).toISOString();
  const {data,error}=await db().from('awt_class_sessions').select('id,organization_id,course_id,starts_at,topic,session_type,group_label,participants_locked').eq('status','scheduled').gte('starts_at',low).lte('starts_at',hi).limit(100);
  if(error)throw error;
  for(const ss of (data||[]))await enqueue(ss,`${label}_${new Date(ss.starts_at).toISOString()}`,new Date().toISOString());
 }
}
async function deliver(job){
 const updated=await db().from('awt_notification_jobs').update({status:'processing',attempts:(job.attempts||0)+1,locked_at:new Date().toISOString()}).eq('id',job.id).in('status',['pending','failed']).select('id').maybeSingle();
 if(updated.error)throw updated.error;
 if(!updated.data)return 'skipped';
 try{
  const [line,student]=await Promise.all([
   db().from('awt_line_accounts').select('line_user_id,notifications_enabled').eq('organization_id',job.organization_id).eq('student_id',job.student_id).maybeSingle(),
   db().from('awt_students').select('full_name').eq('organization_id',job.organization_id).eq('id',job.student_id).maybeSingle()
  ]);
  if(line.error||student.error)throw line.error||student.error;
  if(!line.data||line.data.notifications_enabled===false){await db().from('awt_notification_jobs').update({status:'cancelled'}).eq('id',job.id);return 'skipped';}
  let content='';
  if(job.kind==='hours_low'){
   const {data:en,error}=await db().from('awt_enrollments').select('course_id,purchased_hours').eq('id',job.enrollment_id).single();if(error)throw error;
   const {data:trans,error:te}=await db().from('awt_hour_transactions').select('delta_hours').eq('enrollment_id',job.enrollment_id);if(te)throw te;
   const left=Number(en.purchased_hours)+(trans||[]).reduce((n,t)=>n+Number(t.delta_hours),0);
   if(left>4){await db().from('awt_notification_jobs').update({status:'cancelled'}).eq('id',job.id);return 'skipped';}
   const {data:c}=await db().from('awt_courses').select('name').eq('id',en.course_id).maybeSingle();
   content=`AreWarin Tutor 🧬\nแจ้งเตือนชั่วโมงเรียนใกล้หมด\nคอร์ส: ${c?.name||'คอร์สเรียน'}\nคงเหลือ ${Math.max(0,Math.round(left*100)/100)} ชั่วโมง\nเปิดพื้นที่นักเรียนเพื่อเลือก “ต่อคอร์ส” หรือ “ยุติเมื่อจบคอร์ส”\n${process.env.AWT_STUDENT_URL||''}`;
  }else{
   const {data:ss,error}=await db().from('awt_class_sessions').select('topic,starts_at,status,session_type,group_label,meeting_url,cancel_reason').eq('id',job.session_id).maybeSingle();if(error)throw error;
   const isCancel=job.kind.startsWith('cancel_');
   if(!ss||!job.kind.endsWith(new Date(ss.starts_at).toISOString())||(isCancel?ss.status!=='cancelled':ss.status!=='scheduled')){await db().from('awt_notification_jobs').update({status:'cancelled'}).eq('id',job.id);return 'skipped';}
   if(isCancel){
     content=`AreWarin Tutor 🧬\nแจ้งยกเลิกคลาส\nหัวข้อ: ${ss.topic}\nประเภท: ${classLabel(ss)}${ss.group_label?' · '+ss.group_label:''}\nเดิมกำหนด: ${bkk(ss.starts_at)} น.\nเหตุผล: ${ss.cancel_reason||'ครูยกเลิกคลาส'}\n${process.env.AWT_STUDENT_URL||''}`;
   }else if(job.kind.startsWith('before_1day_')||job.kind.startsWith('before_1hour_')){
     const label=job.kind.startsWith('before_1day_')?'ล่วงหน้า 1 วัน':'ก่อนเรียน 1 ชั่วโมง';
     content=`AreWarin Tutor 🧬\nแจ้งเตือนเรียน ${label}\nหัวข้อ: ${ss.topic}\nประเภท: ${classLabel(ss)}${ss.group_label?' · '+ss.group_label:''}\nวันเวลา: ${bkk(ss.starts_at)} น.\n${process.env.AWT_STUDENT_URL||''}`;
   }else{await db().from('awt_notification_jobs').update({status:'cancelled'}).eq('id',job.id);return 'skipped';}
  }
  const receipt=await push(line.data.line_user_id,content);
  const {error:e}=await db().from('awt_notification_jobs').update({status:'sent',provider_message_id:receipt,locked_at:null}).eq('id',job.id);if(e)throw e;
  return 'sent';
 }catch(e){
  await db().from('awt_notification_jobs').update({status:'failed',locked_at:null,scheduled_at:new Date(Date.now()+5*MINUTE).toISOString()}).eq('id',job.id);
  return 'failed';
 }
}
module.exports=async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.authorization!==`Bearer ${secret}`)return send(res,401,{error:'Unauthorized'});
 try{
  if(!process.env.LINE_CHANNEL_ACCESS_TOKEN)return send(res,503,{error:'LINE_CHANNEL_ACCESS_TOKEN not configured'});
  const now=new Date();
  await prepareClassAlerts(now);
  // Recover interrupted tasks for another attempt.
  await db().from('awt_notification_jobs').update({status:'failed',locked_at:null}).eq('status','processing').lt('locked_at',new Date(Date.now()-20*MINUTE).toISOString());
  const {data,error}=await db().from('awt_notification_jobs').select('id,organization_id,student_id,session_id,enrollment_id,kind,attempts,status').in('status',['pending','failed']).lte('scheduled_at',now.toISOString()).lt('attempts',3).order('scheduled_at',{ascending:true}).limit(50);
  if(error)throw error;
  let sent=0,failed=0;
  for(let i=0;i<(data||[]).length;i+=5){const results=await Promise.all(data.slice(i,i+5).map(deliver));sent+=results.filter(x=>x==='sent').length;failed+=results.filter(x=>x==='failed').length;}
  return send(res,200,{ok:true,processed:(data||[]).length,sent,failed});
 }catch(e){return send(res,500,{error:'Background notifications could not be processed'});}
};
