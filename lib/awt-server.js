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
module.exports={db,send,goodId,textSafe,lineIdentity,currentLink,manager,push,validUrl,classLabel,bkk};
