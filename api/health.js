'use strict';
const {send}=require('../lib/awt-server');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
 return send(res,200,{app:'AreWarin Tutor OS',supabaseServerReady:!!(process.env.SUPABASE_URL&&(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)),lineLoginReady:!!process.env.LINE_LOGIN_CHANNEL_ID,messagingReady:!!process.env.LINE_CHANNEL_ACCESS_TOKEN,cronReady:!!process.env.CRON_SECRET});
};
