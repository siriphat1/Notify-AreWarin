import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
const cfg=window.AWT_CONFIG?.firebase||{};
const panel=document.querySelector('#loginPanel'),msg=document.querySelector('#loginMessage');
const mode=document.querySelector('#mode'),shell=document.querySelector('.shell');
const update=(text,isError=false)=>{msg.textContent=text;msg.style.color=isError?'#ae3f3a':'#267a5b'};
function configReady(){return cfg.apiKey&&!cfg.apiKey.startsWith('PASTE_')&&!cfg.projectId?.startsWith('PASTE_');}
if(!configReady()){
  update('ยังไม่ได้ตั้งค่า config.js ใน GitHub กรุณานำ Firebase Web App Configuration มาใส่',true);
}else{
  try{
    const auth=getAuth(initializeApp(cfg));
    window.AWT_AUTH=auth;
    let loaded=false,revision=0,writeQueue=Promise.resolve();
    window.AWT_REQUEST=async(path,method='GET',payload)=>{
      const user=auth.currentUser;
      if(!user)throw new Error('กรุณาเข้าสู่ระบบใหม่');
      const r=await fetch(path,{method,headers:{'Authorization':`Bearer ${await user.getIdToken()}`,...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined});
      const result=await r.json().catch(()=>({error:'ตอบกลับไม่ถูกต้อง'}));
      if(!r.ok)throw new Error(result.error||`HTTP ${r.status}`);
      return result;
    };
    window.AWT_SAVE=snapshot=>{
      // Old UI saves after every action. Serialized snapshots avoid write reordering.
      const copy=JSON.parse(JSON.stringify(snapshot));
      writeQueue=writeQueue.then(async()=>{
        mode.textContent='กำลังบันทึก…';
        const result=await window.AWT_REQUEST('/api/data','PUT',{revision,data:copy});
        revision=result.revision;mode.textContent='● Firebase Connected';
      }).catch(err=>{
        mode.textContent='บันทึกไม่สำเร็จ';
        alert('บันทึกข้อมูลไม่สำเร็จ: '+err.message+'\nกรุณารีเฟรชหน้าเว็บเพื่อโหลดข้อมูลล่าสุด อย่าบันทึกข้อมูลซ้ำ');
        throw err;
      });
      return writeQueue;
    };
    window.AWT_ACTIVATION=async(studentId)=>{
      await writeQueue;
      return await window.AWT_REQUEST('/api/activation','POST',{studentId});
    };
    window.AWT_CRON=async()=>await window.AWT_REQUEST('/api/cron','POST',{});
    const attemptLoad=async(user)=>{
      if(loaded)return;
      update('กำลังโหลดข้อมูลจาก Firebase...');
      const result=await window.AWT_REQUEST('/api/data');
      revision=result.revision;window.AWT_INITIAL_DATA=result.data;
      loaded=true;panel.classList.add('hide');shell.classList.add('active');mode.textContent='● Firebase Connected';
      document.querySelector('#accountBar').textContent=user.email||'ผู้ดูแล';
      await import('./src.js');
    };
    document.querySelector('#loginForm').addEventListener('submit',async e=>{
      e.preventDefault();const f=new FormData(e.target);
      try{update('กำลังเข้าสู่ระบบ...');await signInWithEmailAndPassword(auth,f.get('email'),f.get('password'));}
      catch(err){update('เข้าสู่ระบบไม่สำเร็จ โปรดตรวจอีเมล รหัสผ่าน และการตั้งค่า Firebase',true);}
    });
    document.querySelector('#logoutBtn').addEventListener('click',async()=>{await signOut(auth);location.reload();});
    onAuthStateChanged(auth,async user=>{
      if(!user){panel.classList.remove('hide');shell.classList.remove('active');loaded=false;return;}
      try{await attemptLoad(user)}catch(err){update('เชื่อมต่อ Backend ไม่สำเร็จ: '+err.message,true);panel.classList.remove('hide');shell.classList.remove('active');}
    });
  }catch(e){update('ตั้งค่า Firebase ไม่ถูกต้อง: '+e.message,true)}
}
