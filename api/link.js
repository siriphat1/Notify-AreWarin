const {db,stateRef,verifyLineToken,http,json,fail,readBody,digest}=require('../lib/core');
module.exports=async (req,res)=>{
  try{
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
    const {idToken,code}=readBody(req);
    const profile=await verifyLineToken(idToken);
    if(typeof code!=='string'||!/^AWT-[A-F0-9]{18}$/.test(code))throw http(400,'รหัสเชิญไม่ถูกต้อง');
    const key=digest(code),lineKey=digest(profile.id);
    const result=await db().runTransaction(async tx=>{
      const codeRef=db().collection('activationCodes').doc(key);
      const lineRef=db().collection('lineLinks').doc(lineKey);
      const ref=stateRef();
      const [invite,existing,snap]=await Promise.all([tx.get(codeRef),tx.get(lineRef),tx.get(ref)]);
      if(!invite.exists||invite.data().used||invite.data().expiresAt<Date.now())throw http(400,'รหัสเชิญหมดอายุหรือถูกใช้แล้ว');
      if(existing.exists)throw http(409,'LINE นี้เคยผูกกับนักเรียนแล้ว');
      const studentId=invite.data().studentId;
      const studentRef=db().collection('studentLinks').doc(studentId);
      const prevLink=await tx.get(studentRef);
      if(prevLink.exists)throw http(409,'นักเรียนนี้ผูก LINE แล้ว');
      if(!snap.exists)throw http(400,'ไม่มีข้อมูลนักเรียนในระบบ');
      const current=snap.data(),d=current.data;
      const student=d.students.find(x=>x.id===studentId);
      if(!student)throw http(404,'ไม่พบรหัสนักเรียน');
      tx.set(lineRef,{studentId,lineUserId:profile.id,linkedAt:Date.now()});
      tx.set(studentRef,{studentId,lineUserId:profile.id,linkedAt:Date.now()});
      tx.update(codeRef,{used:true,usedAt:Date.now()});
      tx.update(ref,{revision:current.revision+1,data:{...d,students:d.students.map(x=>x.id===studentId?{...x,line:true}:x)},updatedAt:Date.now()});
      return {studentId,name:student.name};
    });
    return json(res,200,{ok:true,...result});
  }catch(e){return fail(res,e);}
};
