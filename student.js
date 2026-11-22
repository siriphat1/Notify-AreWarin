/* AreWarin Tutor OS — Student Portal v2.6, uses Supabase Auth + per-student RLS. */
(() => {
'use strict';
const app = document.getElementById('student-app');
const config = window.AWT_CONFIG;
if(!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase?.createClient){
 app.innerHTML='<div class="auth-wrap"><section class="auth-card"><h1>ยังเปิดหน้าระบบไม่ได้</h1><p>กรุณาตรวจสอบ config.js และอินเทอร์เน็ต</p></section></div>';return;
}
const db = window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
const $ = x => document.querySelector(x);
const safe = v => String(v??'').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const date = v => v ? new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}).format(new Date(v)) : '–';
const time = v => v ? new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)) : '–';
const currency = v => Number(v||0).toLocaleString('th-TH',{maximumFractionDigits:2});
const hours = v => Math.round(Number(v||0)*100)/100;
const money = n => `${currency(n)} บาท`;
const tag=(s,k='')=>`<span class="tag ${k}">${safe(s)}</span>`;
const empty=s=>`<div class="empty">${safe(s)}</div>`;
const validLink=u=>{try{let a=new URL(u);return a.protocol==='https:'?a.href:null;}catch{return null;}};
let mode='signin',section='overview',ctx=null,busy=false;
let user=null,account=null,records={};
let toastTimeout;
function notify(msg,error=false){let n=$('#student-toast');n.textContent=msg;n.style.background=error?'#a33a31':'#194f3b';n.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>n.classList.remove('show'),5500);}
function authView(message='',isError=false){
 const up=mode==='signup';
 app.innerHTML=`<div class="auth-wrap"><div class="auth-card stack"><div class="brand"><span class="mark">✦</span> AreWarin Tutor</div>
 <div><div class="eyebrow">STUDENT PORTAL</div><h1>${up?'สมัครบัญชีนักเรียน':'ยินดีต้อนรับกลับ'}</h1><p class="muted">ดูตารางเรียน ชั่วโมงคงเหลือ และแจ้งลาในที่เดียว</p></div>
 ${message?`<div class="hint ${isError?'error':''}">${safe(message)}</div>`:''}
 <form id="auth-form" class="stack"><div class="field"><label for="email">อีเมล</label><input id="email" name="email" type="email" autocomplete="email" required placeholder="student@example.com" /></div>
 <div class="field"><label for="pass">รหัสผ่าน</label><input id="pass" name="password" type="password" minlength="8" autocomplete="${up?'new-password':'current-password'}" required /></div>
 <button type="submit">${up?'สร้างบัญชี':'เข้าสู่ระบบ'}</button></form>
 <button class="secondary" id="toggle-mode">${up?'มีบัญชีแล้ว? เข้าสู่ระบบ':'ยังไม่มีบัญชี? สมัครใช้งาน'}</button>
 <div class="hint"><b>สำหรับนักเรียน:</b> ครูต้องเพิ่มชื่อของเราใน Manager และส่งรหัสเชิญให้ก่อน จึงจะเชื่อมข้อมูลคอร์สได้</div>
 <a href="./index.html" class="small" style="text-align:center">เข้าสู่ระบบครู</a></div></div>`;
 $('#toggle-mode').onclick=()=>{mode=up?'signin':'signup';authView()};
 $('#auth-form').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button');btn.disabled=true;const v=Object.fromEntries(new FormData(e.target));try{
 if(up){const {data,error}=await db.auth.signUp({email:v.email,password:v.password,options:{emailRedirectTo:new URL('student.html',location.href).href}});if(error)throw error;
 if(data.session){await boot();return;}mode='signin';authView('สมัครบัญชีแล้ว กรุณาตรวจอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ');return;}
 const {error}=await db.auth.signInWithPassword({email:v.email,password:v.password});if(error)throw error;await boot();
 }catch(err){authView(err.message||'เข้าสู่ระบบไม่สำเร็จ',true);}finally{btn.disabled=false;}};
}
function claimView(message='',isError=false){app.innerHTML=`<div class="auth-wrap"><div class="auth-card stack"><div class="brand"><span class="mark">✦</span> AreWarin Tutor</div>
<div><div class="eyebrow">CONNECT YOUR ACCOUNT</div><h1>ผูกบัญชีกับนักเรียน</h1><p class="muted">เข้าสู่ระบบแล้วด้วย ${safe(user?.email)} แต่ยังไม่ได้เชื่อมกับข้อมูลนักเรียน</p></div>
${message?`<div class="hint ${isError?'error':''}">${safe(message)}</div>`:''}
<form id="claim-form" class="stack"><div class="field"><label for="invite">รหัสเชิญจากครู</label><input name="code" id="invite" placeholder="AWT-..." autocomplete="off" required maxlength="40" /></div><button type="submit">ยืนยันและเปิดสมุดการเรียน</button></form>
<div class="hint">ครูเข้า Manager → นักเรียน → สร้างรหัสเชิญ แล้วส่งรหัสนี้ให้เป็นการส่วนตัว</div><button class="ghost" id="signout">ออกจากระบบ</button></div></div>`;
$('#signout').onclick=logout;
$('#claim-form').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button');btn.disabled=true;try{const code=new FormData(e.target).get('code');const {error}=await db.rpc('awt_claim_student_invite',{p_code:code});if(error)throw error;await boot();}catch(err){claimView(err.message||'ไม่สามารถผูกบัญชีได้',true);}finally{btn.disabled=false;}};
}
async function logout(){await db.auth.signOut();user=null;account=null;ctx=null;mode='signin';authView();}
const one = (name,id) => (records[name]||[]).find(x=>x.id===id);
const balance=en=>hours(Number(en.purchased_hours||0)+(records.hour_transactions||[]).filter(t=>t.enrollment_id===en.id).reduce((s,t)=>s+Number(t.delta_hours||0),0));
const allE=()=>records.enrollments||[];
const sessions=()=>[...(records.class_sessions||[])].sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
const recentCourse=()=>allE().slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
const nextSession=()=>sessions().find(s=>s.status==='scheduled' && new Date(s.ends_at)>new Date());
async function loadRecords(){
 const {data:a,error:ae}=await db.from('awt_student_accounts').select('student_id,organization_id').eq('auth_user_id',user.id).maybeSingle();if(ae)throw ae;
 if(!a){account=null;claimView();return false;}account=a;
 const {data:s,error:se}=await db.from('awt_students').select('id,organization_id,student_code,full_name').eq('id',a.student_id).single();if(se)throw se;
 ctx=s;
 const fetch=async (table,field,id)=>{const q=db.from('awt_'+table).select('*');if(field)q.eq(field,id);const {data,error}=await q.limit(500);if(error)throw error;return data||[];};
 const enroll=await fetch('enrollments','student_id',ctx.id);
 records={enrollments:enroll};
 const courseIds=[...new Set(enroll.map(e=>e.course_id))];const enIds=enroll.map(e=>e.id);
 async function batchIn(t,col,ids){if(!ids.length)return [];const {data,error}=await db.from('awt_'+t).select('*').in(col,ids).limit(500);if(error)throw error;return data||[];}
 const vals=await Promise.all([
 batchIn('courses','id',courseIds),batchIn('class_sessions','course_id',courseIds),
 batchIn('hour_transactions','enrollment_id',enIds),batchIn('attendance','enrollment_id',enIds),
 fetch('leave_requests','student_id',ctx.id),fetch('invoices','student_id',ctx.id),
 fetch('announcements','organization_id',ctx.organization_id),fetch('course_requests','student_id',ctx.id)
 ]);
 ['courses','class_sessions','hour_transactions','attendance','leave_requests','invoices','announcements','course_requests'].forEach((k,i)=>records[k]=vals[i]);
 return true;
}
async function boot(){app.innerHTML='<div class="loading">กำลังโหลดสมุดการเรียน…</div>';try{
 const {data,error}=await db.auth.getUser();if(error)throw error;user=data.user;if(!user){authView();return;}
 if(await loadRecords())render();
}catch(err){app.innerHTML=`<div class="auth-wrap"><div class="auth-card stack"><h1>โหลดข้อมูลไม่ได้</h1><div class="hint error">${safe(err.message)}</div><button id="retry">ลองอีกครั้ง</button><button class="ghost" id="signout">ออกจากระบบ</button></div></div>`;$('#retry').onclick=boot;$('#signout').onclick=logout;}}
function header(){return `<header class="top"><div class="brand"><span class="mark">✦</span> AreWarin Tutor <span class="muted small">· พื้นที่นักเรียน</span></div><div class="right"><span class="muted small">${safe(ctx.full_name)}</span><button class="ghost" id="logout">ออกจากระบบ</button></div></header>`;}
const tabs=[['overview','ภาพรวม'],['schedule','ตารางเรียน'],['courses','คอร์สของฉัน'],['leave','แจ้งลา'],['announcements','ประกาศ'],['finance','ค่าเรียน'],['requests','คำร้อง']];
function shell(body){return `${header()}<div class="wrap"><nav class="tabs" aria-label="เมนูนักเรียน">${tabs.map(([k,v])=>`<button class="tab ${section===k?'active':''}" data-tab="${k}">${v}</button>`).join('')}</nav>${body}<p class="muted small" style="text-align:center;margin-top:24px">ข้อมูลจาก Supabase • นักเรียนดูเฉพาะข้อมูลของตัวเอง • LINE แจ้งเตือนยังไม่เปิดใช้งาน</p></div>`;}
function courseItem(e){const c=one('courses',e.course_id),r=balance(e),pct=Math.max(0,Math.min(100,100*(Number(e.purchased_hours)-r)/Number(e.purchased_hours)));const pending=(records.course_requests||[]).find(x=>x.enrollment_id===e.id&&x.status==='pending');return `<div class="item" style="display:block"><div class="row"><div><b>${safe(c?.name||'คอร์สเรียน')}</b><div class="muted small">ลงทะเบียน ${date(e.created_at)}</div></div>${tag(r<=4?'ใกล้หมด':'กำลังเรียน',r<=4?'warn':'')}</div><div class="progress"><div style="width:${pct}%"></div></div><div class="row"><span class="muted small">ลงทะเบียน ${hours(e.purchased_hours)} ชม.</span><b>คงเหลือ ${r} ชม.</b></div>${r<=4?`<div class="chiprow" style="margin-top:15px">${pending?tag('ส่งคำขอแล้ว · '+(pending.request_type==='renew'?'ต่อคอร์ส':'ยุติ'),'warn'):`<button class="secondary" data-request="renew" data-en="${safe(e.id)}">＋ ต่อคอร์ส</button><button class="ghost" data-request="end" data-en="${safe(e.id)}">ยุติเมื่อจบคอร์ส</button>`}</div>`:''}</div>`;}
function classroom(s){const c=one('courses',s.course_id),cancel=s.status==='cancelled',start=new Date(s.starts_at).getTime(),end=new Date(s.ends_at).getTime(),now=Date.now(),joined=validLink(s.meeting_url),open=!cancel && joined && now>=start-15*60*1000 && now<=end;return `<div class="item"><div style="min-width:200px;flex:1"><div class="row" style="justify-content:flex-start;gap:8px"><b>${safe(s.topic)}</b>${cancel?tag('ยกเลิก','danger'):s.status==='completed'?tag('จบแล้ว','gray'):tag('กำหนดเรียน')}</div><div class="muted small">${safe(c?.name||'')}</div><div class="muted small">${date(s.starts_at)} · ${time(s.starts_at)}–${time(s.ends_at)} น.</div>${cancel&&s.cancel_reason?`<div class="muted small">เหตุผล: ${safe(s.cancel_reason)}</div>`:''}</div><div>${open?`<a class="widebtn" href="${safe(joined)}" target="_blank" rel="noopener noreferrer">↗ เข้าเรียนออนไลน์</a>`:cancel?tag('เข้าห้องไม่ได้','danger'):!joined?tag('ครูยังไม่ใส่ลิงก์','gray'):now<start-15*60*1000?tag('เปิดก่อนเรียน 15 นาที','gray'):tag('ปิดห้องแล้ว','gray')}</div></div>`;}
function overview(){const e=allE(),r=e.reduce((s,x)=>s+balance(x),0),p=e.reduce((s,x)=>s+Number(x.purchased_hours||0),0),next=nextSession(),c=recentCourse(),alerts=e.filter(x=>balance(x)<=4),invoice=(records.invoices||[]).filter(x=>x.status==='unpaid');return `<div class="bento"><section class="hero span2"><div class="eyebrow">MY LEARNING SPACE</div><h1 style="margin:23px 0 8px">สวัสดี ${safe(ctx.full_name)} 👋</h1><div class="muted">ทุกคลาส ทุกชั่วโมงเรียน อยู่ที่นี่</div><div style="margin-top:21px">${tag('รหัสนักเรียน '+ctx.student_code)}</div></section><section class="card"><div class="eyebrow">ชั่วโมงที่ลงทะเบียน</div><div class="metric">${hours(p)} <span class="small">ชม.</span></div><div class="sub small">รวมทุกแพ็กเกจ</div></section><section class="card"><div class="eyebrow">ชั่วโมงคงเหลือ</div><div class="metric">${hours(r)} <span class="small">ชม.</span></div><div class="sub small">อัปเดตตามครูลงเวลา</div></section><section class="card span2"><div class="row"><h2>คลาสเรียนถัดไป</h2><button class="secondary" data-jump="schedule">ดูตาราง</button></div>${next?classroom(next):empty('ยังไม่มีคลาสเรียนถัดไป')}</section><section class="card span2"><div class="row"><h2>คอร์สที่ลงล่าสุด</h2><button class="secondary" data-jump="courses">คอร์สทั้งหมด</button></div>${c?courseItem(c):empty('ครูยังไม่ได้ลงทะเบียนคอร์สให้')}</section><section class="card span2"><h2>แจ้งเตือนในระบบ</h2><div class="stacklist">${alerts.map(x=>`<div class="hint warn">ชั่วโมงคอร์ส ${safe(one('courses',x.course_id)?.name||'')} เหลือ ${balance(x)} ชม. สามารถเลือกต่อหรือยุติคอร์สได้</div>`).join('')||'<div class="hint">ยังไม่มีรายการชั่วโมงใกล้หมด</div>'}${invoice.length?`<div class="hint warn">มีค่าเรียนรอตรวจสอบ ${invoice.length} รายการ ดูรายละเอียดในเมนูค่าเรียน</div>`:''}</div></section><section class="card span2"><h2>ประกาศล่าสุด</h2>${(records.announcements||[]).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,2).map(x=>`<div class="item" style="display:block"><b>${safe(x.title)}</b><div class="muted small">${date(x.created_at)}</div><p class="note small" style="margin:7px 0 0">${safe(x.body)}</p></div>`).join('')||empty('ยังไม่มีประกาศ')}</section></div>`;}
function schedulePage(){const all=sessions();return `<div class="section"><div class="row"><h1>ตารางเรียนของฉัน</h1>${tag(`${all.length} คลาส`)}</div><p class="muted">ครูเป็นผู้กำหนดวันเรียนและลิงก์เข้าเรียน ปุ่มเข้าห้องจะเปิดก่อนเริ่ม 15 นาที</p><div class="card stacklist">${all.map(classroom).join('')||empty('ครูยังไม่ได้กำหนดวันเรียน')}</div></div>`;}
function coursesPage(){return `<div class="section"><h1>คอร์สเรียนและชั่วโมงของฉัน</h1><div class="bento">${allE().map(e=>`<div class="card span2">${courseItem(e)}</div>`).join('')||'<div class="card span4">'+empty('ยังไม่ได้ลงทะเบียนคอร์ส')+'</div>'}</div></div>`;}
function leavePage(){const upcoming=sessions().filter(s=>s.status==='scheduled' && new Date(s.starts_at)>new Date());const existing=records.leave_requests||[];return `<div class="section"><h1>แจ้งลาเรียน</h1><div class="bento"><section class="card span2"><h2>เลือกคลาสที่ต้องการลา</h2>${upcoming.length?`<form id="leaveForm" class="stack"><div class="field"><label>วันและคลาสเรียน</label><select name="session_id" required style="width:100%;min-height:45px;border-radius:12px;border:1px solid #cedfd6;padding:10px">${upcoming.map(s=>`<option value="${safe(s.id)}">${safe(one('courses',s.course_id)?.name||'')} · ${safe(s.topic)} · ${date(s.starts_at)} ${time(s.starts_at)}</option>`).join('')}</select></div><div class="field"><label>เหตุผลการลา</label><textarea name="reason" required maxlength="1000" placeholder="แจ้งเหตุผลให้ครูทราบ"></textarea></div><button type="submit">ส่งคำร้องลาเรียน</button></form>`:empty('ไม่มีคลาสในอนาคตที่แจ้งลาได้')}</section><section class="card span2"><h2>สถานะคำร้อง</h2><div class="stacklist">${existing.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(l=>`<div class="item"><div><b>${safe(one('class_sessions',l.session_id)?.topic||'คลาสเรียน')}</b><div class="muted small">${date(l.created_at)} · ${safe(l.reason)}</div></div>${tag(l.status==='pending'?'รอครูตรวจ':l.status==='approved'?'รับทราบแล้ว':'ไม่อนุมัติ',l.status==='pending'?'warn':l.status==='approved'?'':'danger')}</div>`).join('')||empty('ยังไม่เคยแจ้งลา')}</div></section></div></div>`;}
function announcementsPage(){const arr=(records.announcements||[]).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));return `<div class="section"><h1>ประกาศจากครู</h1><div class="stack">${arr.map(a=>`<div class="card"><div class="row"><h2>${safe(a.title)}</h2><span class="muted small">${date(a.created_at)}</span></div><div class="note">${safe(a.body)}</div></div>`).join('')||empty('ยังไม่มีประกาศ')}</div></div>`;}
function financePage(){const arr=records.invoices||[];return `<div class="section"><h1>ติดตามค่าเรียน</h1><div class="card stacklist">${arr.map(i=>`<div class="item"><div><b>${money(i.amount)}</b><div class="muted small">ครบกำหนด ${date(i.due_date+'T12:00:00+07:00')}</div></div>${tag(i.status==='paid'?'ชำระแล้ว':i.status==='void'?'ยกเลิก':'รอชำระ',i.status==='unpaid'?'warn':'')}</div>`).join('')||empty('ยังไม่มีรายการค่าเรียน')}</div><div class="hint">หากชำระแล้วแต่ระบบยังไม่อัปเดต โปรดติดต่อผู้สอนโดยตรง หน้านี้ยังไม่มีปุ่มส่งสลิปออนไลน์</div></div>`;}
function requestsPage(){const arr=records.course_requests||[];return `<div class="section"><h1>คำขอต่อคอร์ส / ยุติคอร์ส</h1><div class="card stacklist">${arr.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(x=>`<div class="item"><div><b>${x.request_type==='renew'?'ขอต่อคอร์ส':'ขอยุติเมื่อจบคอร์ส'}</b><div class="muted small">${safe(one('courses',one('enrollments',x.enrollment_id)?.course_id)?.name||'')} · ${date(x.created_at)}</div></div>${tag(x.status==='pending'?'รอครูดำเนินการ':x.status==='approved'?'ดำเนินการแล้ว':'ไม่อนุมัติ',x.status==='pending'?'warn':'')}</div>`).join('')||empty('ยังไม่มีคำร้อง')}</div><div class="hint">ปุ่มต่อคอร์สหรือยุติจะปรากฏเมื่อเหลือไม่เกิน 4 ชั่วโมง คำขอไม่ได้หักหรือเพิ่มชั่วโมงเองจนกว่าครูจะดำเนินการ</div></div>`;}
function render(){const pages={overview,schedule:schedulePage,courses:coursesPage,leave:leavePage,announcements:announcementsPage,finance:financePage,requests:requestsPage};app.innerHTML=shell((pages[section]||overview)());$('#logout').onclick=logout;document.querySelectorAll('[data-tab],[data-jump]').forEach(b=>b.onclick=()=>{section=b.dataset.tab||b.dataset.jump;render();window.scrollTo({top:0,behavior:'smooth'});});
 document.querySelectorAll('[data-request]').forEach(b=>b.onclick=async()=>{const typ=b.dataset.request,enid=b.dataset.en;const e=allE().find(x=>x.id===enid);if(!e||balance(e)>4)return notify('ยังไม่ถึงเงื่อนไขต่อหรือยุติคอร์ส',true);if(!confirm(typ==='renew'?'ยืนยันส่งคำขอต่อคอร์สให้ครู?':'ยืนยันส่งคำขอยุติเมื่อจบคอร์สให้ครู?'))return;b.disabled=true;try{const {error}=await db.from('awt_course_requests').insert({organization_id:ctx.organization_id,student_id:ctx.id,enrollment_id:enid,request_type:typ});if(error)throw error;await loadRecords();render();notify('ส่งคำขอถึงหลังบ้านครูแล้ว');}catch(err){notify(err.message,true);b.disabled=false;}});
 const form=$('#leaveForm');if(form)form.onsubmit=async ev=>{ev.preventDefault();const b=form.querySelector('button[type="submit"]');b.disabled=true;const v=Object.fromEntries(new FormData(form));try{if((records.leave_requests||[]).some(l=>l.session_id===v.session_id&&l.status==='pending'))throw new Error('คลาสนี้มีคำร้องรอดำเนินการแล้ว');const {error}=await db.from('awt_leave_requests').insert({organization_id:ctx.organization_id,student_id:ctx.id,session_id:v.session_id,reason:v.reason.trim()});if(error)throw error;await loadRecords();render();notify('ส่งคำร้องลาเรียนแล้ว');}catch(err){notify(err.message,true);b.disabled=false;}};
}
boot();
})();
