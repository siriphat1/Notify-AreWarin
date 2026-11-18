const crypto=require('node:crypto');
const {db,state,requireAdmin,http,json,fail,readBody,digest}=require('../lib/core');
module.exports=async (req,res)=>{
  try{
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
    await requireAdmin(req);
    const {studentId}=readBody(req);
    const {data}=await state();
    if(!data.students.some(x=>x.id===studentId))throw http(404,'ไม่พบรหัสนักเรียน');
    if((await db().collection('studentLinks').doc(studentId).get()).exists)throw http(409,'นักเรียนผูก LINE แล้ว');
    const code='AWT-'+crypto.randomBytes(9).toString('hex').toUpperCase();
    const expiresAt=Date.now()+7*24*60*60*1000;
    await db().collection('activationCodes').doc(digest(code)).set({studentId,expiresAt,used:false,createdAt:Date.now()});
    return json(res,200,{code,studentId,expiresAt});
  }catch(e){return fail(res,e);}
};
