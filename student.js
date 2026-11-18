(function(){
  const $=id=>document.getElementById(id);let token='',details=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toDate=x=>{const dt=new Date(String(x)+'+07:00');return dt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'})};
  const say=(text,error=false)=>{const el=$('message');el.textContent=text;el.classList.add('show');el.style.background=error?'#ffebe8':'#fff6dd';el.style.color=error?'#a83d35':'#6a592b'};
  const hideMessage=()=>$('message').classList.remove('show');
  async function api(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,idToken:token})});const d=await r.json().catch(()=>({error:'ไม่สามารถอ่านคำตอบจากเซิร์ฟเวอร์'}));if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d;}
  function populate(d){
    details=d;hideMessage();$('connection').classList.add('hide');$('portal').classList.remove('hide');
    $('studentName').textContent='สวัสดี, '+d.student.name;
    const total=d.enrollments.reduce((n,e)=>n+e.purchased,0),remain=d.enrollments.reduce((n,e)=>n+e.remaining,0);
    $('totalHours').textContent=total+' ชม.';$('hoursLeft').textContent=remain+' ชม.';
    $('courses').innerHTML=d.enrollments.map(x=>`<div class="item"><div><b>${esc(x.courseName)}</b><p class="muted">ลงทะเบียน ${x.purchased} ชม. · เหลือ ${x.remaining} ชม.</p><div class="progress"><b style="width:${Math.max(0,Math.min(100,(x.purchased-x.remaining)/Math.max(1,x.purchased)*100))}%"></b></div></div></div>`).join('')||'<div class="empty">ยังไม่ได้ลงทะเบียนคอร์ส</div>';
    const low=d.enrollments.filter(x=>x.remaining<=4);
    $('alerts').innerHTML=low.map(x=>`<div class="item"><div><span class="tag">ชั่วโมงใกล้หมด</span><p><b>${esc(x.courseName)}</b></p><p class="muted">เหลือ ${x.remaining} ชั่วโมง — เลือกต่อคอร์สหรือยุติได้ด้านล่าง</p></div></div>`).join('')||'<div class="empty">ไม่มีรายการสำคัญ</div>';
    const classes=d.sessions;
    $('classes').innerHTML=classes.map(s=>`<div class="item"><div><b>${esc(s.topic)}</b><p class="muted">${esc(toDate(s.start))} · ${esc(s.status==='cancelled'?'ยกเลิก':'ตามกำหนด')}</p></div><div class="actions">${typeof s.link==='string'&&s.link.startsWith('https://')?`<a class="join" target="_blank" rel="noopener noreferrer" href="${esc(s.link)}">เข้าเรียนออนไลน์ ↗</a>`:'<span class="muted">ห้องเรียน / ยังไม่ระบุลิงก์</span>'}</div></div>`).join('')||'<div class="empty">ไม่มีคลาสในตาราง</div>';
    const leaveAllowed=classes.filter(s=>s.status==='scheduled'&&!d.leaves.some(x=>x.session===s.id));
    $('leaveSession').innerHTML=leaveAllowed.map(s=>`<option value="${esc(s.id)}">${esc(s.topic)} — ${esc(toDate(s.start))}</option>`).join('');
    $('leaveForm').querySelector('button').disabled=!leaveAllowed.length;
    $('leaveHistory').innerHTML=d.leaves.slice(-4).map(x=>`<p class="muted">${esc(classes.find(s=>s.id===x.session)?.topic||'คลาสเรียน')} • ${esc(x.status==='approved'?'รับทราบแล้ว':'รอรับทราบ')}</p>`).join('');
    $('decisionCourse').innerHTML=d.enrollments.map(x=>`<option value="${esc(x.course)}">${esc(x.courseName)}</option>`).join('');
    $('decisionForm').querySelector('button').disabled=!d.enrollments.length;
    $('decisionHistory').innerHTML=d.decisions.map(x=>`<p class="muted">${esc(d.enrollments.find(e=>e.course===x.course)?.courseName||'คอร์ส')} • ${esc(x.choice==='renew'?'แจ้งต่อคอร์สแล้ว':'แจ้งยุติแล้ว')}</p>`).join('');
    $('announcements').innerHTML=d.announcements.slice().reverse().map(a=>`<div class="item"><div><b>${esc(a.title)}</b><p class="muted">${esc(a.body)}</p></div></div>`).join('')||'<div class="empty">ยังไม่มีประกาศ</div>';
    $('invoices').innerHTML=d.invoices.map(v=>`<div class="item"><div><b>${Number(v.amount||0).toLocaleString('th-TH')} บาท</b><p class="muted">ครบกำหนด ${esc(v.due||'-')} • ${v.paid?'ชำระแล้ว':'รอชำระ'}</p></div></div>`).join('')||'<div class="empty">ยังไม่มีใบแจ้งหนี้</div>';
  }
  async function load(){try{const d=await api('/api/student',{action:'read'});populate(d)}catch(err){$('connection').classList.remove('hide');$('portal').classList.add('hide');$('status').textContent='กรุณากรอกรหัสเชิญจากผู้สอนเพื่อเชื่อมบัญชี LINE';$('codePanel').classList.remove('hide');if(!err.message.includes('ยังไม่ผูก'))say(err.message,true);}}
  async function init(){
    const config=window.AWT_CONFIG||{};
    if(config.oaFriendUrl?.startsWith('https://')){$('oaLink').href=config.oaFriendUrl;$('oaLink').classList.remove('hide')}
    const code=new URLSearchParams(location.search).get('code');if(code)$('inviteCode').value=code;
    if(!config.liffId||config.liffId.startsWith('PASTE_')){$('status').textContent='ยังไม่ได้ตั้งค่า LIFF ID ใน config.js';return;}
    if(!window.liff){$('status').textContent='โหลด LINE LIFF ไม่สำเร็จ กรุณาเปิดด้วยอินเทอร์เน็ต';return;}
    try{await liff.init({liffId:config.liffId});}catch(e){$('status').textContent='ไม่สามารถเริ่ม LINE LIFF: '+e.message;return;}
    if(!liff.isLoggedIn()){$('lineLogin').classList.remove('hide');$('status').textContent='กดปุ่มด้านล่างเพื่อยืนยันตัวตนด้วย LINE';return;}
    token=liff.getIDToken();if(!token){$('status').textContent='ไม่พบ LINE ID Token กรุณาเปิด Scope openid ใน LINE Developers แล้วเข้าสู่ระบบใหม่';return;}
    $('status').textContent='ยืนยัน LINE แล้ว กำลังโหลดบัญชีนักเรียน...';await load();
  }
  $('lineLogin').onclick=()=>liff.login({redirectUri:location.href});
  $('linkForm').onsubmit=async e=>{e.preventDefault();try{const x=await api('/api/link',{code:$('inviteCode').value.trim()});say('ผูก LINE สำเร็จ: '+x.name);await load()}catch(err){say(err.message,true)}};
  $('leaveForm').onsubmit=async e=>{e.preventDefault();try{const d=await api('/api/student',{action:'leave',sessionId:$('leaveSession').value,reason:$('leaveReason').value});populate(d);say('ส่งคำขอลาเรียนแล้ว ผู้สอนจะเห็นใน Manager')}catch(err){say(err.message,true)}};
  $('decisionForm').onsubmit=async e=>{e.preventDefault();try{const d=await api('/api/student',{action:'decision',courseId:$('decisionCourse').value,choice:$('decisionChoice').value,note:$('decisionNote').value});populate(d);say('ส่งความประสงค์ให้ผู้สอนแล้ว')}catch(err){say(err.message,true)}};
  init();
})();
