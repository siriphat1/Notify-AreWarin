const {db,stateRef,cleanData,state,http,requireAdmin,json,fail,readBody,remaining,sendLine}=require('../lib/core');

// One versioned state document retains compatibility with all v1.3 screens.
// Deliberately limited to a small single-school deployment, not enterprise scale.
module.exports=async (req,res)=>{
  try{
    await requireAdmin(req);
    if(req.method==='GET')return json(res,200,await state());
    if(req.method!=='PUT')return json(res,405,{error:'Method not allowed'});
    const body=readBody(req),next=cleanData(body.data);
    if(!Number.isInteger(body.revision)||body.revision<0)throw http(400,'revision ไม่ถูกต้อง');
    let previous;
    const rev=await db().runTransaction(async tx=>{
      const ref=stateRef(),snap=await tx.get(ref);
      const curr=snap.exists?snap.data():{revision:0,data:null};
      if(curr.revision!==body.revision)throw http(409,'ข้อมูลมีการเปลี่ยนแปลงจากอีกอุปกรณ์ กรุณารีเฟรชหน้าเว็บก่อนบันทึก');
      previous=curr.data;
      tx.set(ref,{revision:curr.revision+1,data:next,updatedAt:Date.now()});
      return curr.revision+1;
    });
    // Follow-on notifications are awaited before responding, to work in serverless functions.
    // Async follow-on notifications are best-effort; reminders can be re-run from Admin.
    // No billing details in messages, and only send to explicitly linked LINE recipients.
    if(previous){
      for(const e of next.enrollments.slice(0,40)){
        const prior=previous.enrollments.find(x=>x.student===e.student&&x.course===e.course);
        if(!prior)continue;
        const before=remaining(previous,e.student,e.course),after=remaining(next,e.student,e.course);
        if(before>4&&after<=4){
          try{
            const doc=await db().collection('studentLinks').doc(e.student).get();
            if(!doc.exists)continue;
            const key=`hours4_${e.student}_${e.course}_${rev}`;
            const event=db().collection('noticeEvents').doc(key);
            await event.create({createdAt:Date.now(),type:'hours4',status:'queued'});
            const c=next.courses.find(x=>x.id===e.course);
            await sendLine(doc.data().lineUserId,`AreWarin Tutor: คอร์ส ${c?.name||'ของคุณ'} เหลือ ${after} ชั่วโมง\nเปิดระบบเพื่อเลือกต่อคอร์สหรือยุติการเรียน`);
            await event.update({status:'sent'});
          }catch(err){console.error('hours4 notice:',err.message);}
        }
      }
      for(const s of next.sessions.slice(0,40)){
        const prev=previous.sessions.find(x=>x.id===s.id);
        if(prev?.status==='scheduled' && s.status==='cancelled'){
          const affected=next.enrollments.filter(x=>x.course===s.course);
          for(const e of affected.slice(0,20)){
            try{
              const link=await db().collection('studentLinks').doc(e.student).get();
              if(link.exists)await sendLine(link.data().lineUserId,`AreWarin Tutor: คลาส ${s.topic} วันที่ ${s.start.replace('T',' ')} น. ยกเลิกแล้ว\nโปรดดูตารางเรียนใหม่ในระบบ`);
            }catch(err){console.error('cancel notice:',err.message)}
          }
        }
      }
    }
    return json(res,200,{ok:true,revision:rev});
  }catch(e){return fail(res,e);}
};
