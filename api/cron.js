const {db,state,dueEpoch,thaiDate,remaining,sendLine,requireAdmin,http,json,fail}=require('../lib/core');
module.exports=async (req,res)=>{
  try{
    if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
    const configured=process.env.CRON_SECRET;
    const bySecret=Boolean(configured)&&req.headers.authorization===`Bearer ${configured}`;
    if(!bySecret)await requireAdmin(req); // Admin may run due reminders manually in UI.
    const now=Date.now();const {data:d}=await state();const notices=[];
    for(const s of d.sessions){
      if(s.status!=='scheduled')continue;
      const starts=dueEpoch(s.start),diff=(starts-now)/60000;
      for(const [kind,target] of [['day',1440],['hour',60]]){
        if(!Number.isFinite(diff)||Math.abs(diff-target)>3)continue;
        for(const e of d.enrollments.filter(x=>x.course===s.course)){
          notices.push({id:`${kind}_${s.id}_${e.student}`,kind,s,e});
        }
      }
    }
    let sent=0,skipped=0,failed=0;
    for(const n of notices.slice(0,40)){
      const linkDoc=await db().collection('studentLinks').doc(n.e.student).get();
      if(!linkDoc.exists){skipped++;continue;}
      const event=db().collection('noticeEvents').doc(n.id);
      try{await event.create({status:'processing',type:n.kind,createdAt:now});}
      catch(err){if(err.code===6||err.code==='already-exists'){skipped++;continue;}throw err;}
      const course=d.courses.find(x=>x.id===n.s.course);
      try{
        const message=`AreWarin Tutor 📚\n${n.kind==='day'?'แจ้งเตือน: พรุ่งนี้มีเรียน':'แจ้งเตือน: อีกประมาณ 1 ชั่วโมงจะเริ่มเรียน'}\n${course?.name||'คอร์สเรียน'} / ${n.s.topic}\n${thaiDate(n.s.start)}\nเปิดระบบเพื่อตรวจสอบรายละเอียดคลาส`;
        await sendLine(linkDoc.data().lineUserId,message);
        await event.update({status:'sent',sentAt:Date.now()});sent++;
      }catch(err){failed++;await event.update({status:'failed',reason:String(err.message).slice(0,150)});}
    }
    return json(res,200,{ok:true,examined:notices.length,sent,skipped,failed,note:'ต้องมีตัวเรียกทุก 5 นาทีจึงจะเตือนใกล้เวลาที่กำหนด'});
  }catch(e){return fail(res,e);}
};
