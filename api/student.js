const {db,stateRef,state,verifyLineToken,remaining,thaiDate,http,json,fail,readBody,digest}=require('../lib/core');
async function identity(idToken){
  const profile=await verifyLineToken(idToken);
  const doc=await db().collection('lineLinks').doc(digest(profile.id)).get();
  if(!doc.exists)throw http(403,'LINE ยังไม่ผูกกับนักเรียน กรุณาใช้รหัสเชิญก่อน');
  return doc.data().studentId;
}
function ownView(d,id){
  const st=d.students.find(x=>x.id===id);
  if(!st)throw http(404,'ไม่พบนักเรียน');
  const enrollment=d.enrollments.filter(x=>x.student===id).map(e=>({course:e.course,courseName:d.courses.find(c=>c.id===e.course)?.name||'',purchased:Number(e.hours||0),remaining:remaining(d,id,e.course)}));
  const classes=d.sessions.filter(s=>s.status!=='cancelled'&&enrollment.some(e=>e.course===s.course)).sort((a,b)=>a.start.localeCompare(b.start));
  return {student:{id:st.id,name:st.name},enrollments:enrollment,sessions:classes,leaves:d.leaves.filter(x=>x.student===id),decisions:d.decisions.filter(x=>x.student===id),invoices:d.invoices.filter(x=>x.student===id).map(x=>({amount:x.amount,due:x.due,paid:x.paid})),announcements:d.announcements.slice(-20)};
}
module.exports=async (req,res)=>{
  try{
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
    const body=readBody(req),id=await identity(body.idToken);
    if(body.action==='read')return json(res,200,{ok:true,...ownView((await state()).data,id)});
    if(!['leave','decision'].includes(body.action))throw http(400,'ไม่รองรับคำสั่งนี้');
    const result=await db().runTransaction(async tx=>{
      const ref=stateRef(),snap=await tx.get(ref);if(!snap.exists)throw http(404,'ไม่พบข้อมูล');
      const cur=snap.data();const d=cur.data;
      if(body.action==='leave'){
        const s=d.sessions.find(x=>x.id===body.sessionId);
        if(!s||s.status!=='scheduled'||!d.enrollments.some(e=>e.student===id&&e.course===s.course))throw http(400,'ไม่สามารถลาคลาสนี้ได้');
        const reason=String(body.reason||'').trim();if(reason.length<2||reason.length>400)throw http(400,'กรุณาระบุเหตุผล 2–400 ตัวอักษร');
        if(d.leaves.some(x=>x.student===id&&x.session===s.id))throw http(409,'ส่งคำขอคลาสนี้แล้ว');
        d.leaves.push({student:id,session:s.id,reason,status:'pending',createdAt:Date.now()});
      }else{
        const cid=String(body.courseId||''),choice=body.choice;
        if(!['renew','stop'].includes(choice))throw http(400,'ตัวเลือกไม่ถูกต้อง');
        if(!d.enrollments.some(e=>e.student===id&&e.course===cid))throw http(403,'ไม่ได้ลงทะเบียนคอร์สนี้');
        d.decisions=d.decisions.filter(x=>!(x.student===id&&x.course===cid));
        d.decisions.push({student:id,course:cid,choice,note:String(body.note||'').slice(0,200),createdAt:Date.now()});
      }
      tx.update(ref,{data:d,revision:cur.revision+1,updatedAt:Date.now()});return ownView(d,id);
    });
    return json(res,200,{ok:true,...result});
  }catch(e){return fail(res,e);}
};
