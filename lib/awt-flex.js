'use strict';
// LINE Flex Message builders for AreWarin Tutor OS.
// Only text and https URI actions; no user-controlled rich content or HTML.
const GREEN='#087F66', DARK='#163D33', MUTED='#71827A', LIGHT='#F2F8F5', WHITE='#FFFFFF';
const portal='https://liff.line.me/2012751475-G2D9ZDuM';
const clean=(value,max=240)=>String(value??'').replace(/[\r\n\t]+/g,' ').trim().slice(0,max)||'–';
const url=value=>{try{let u=new URL(value);return u.protocol==='https:'?u.toString():portal}catch{return portal}};
const text=(value,size='sm',color=DARK,weight='regular',wrap=true)=>({
  type:'text',text:clean(value,650),size,color,weight,wrap
});
const row=(label,value)=>({
  type:'box',layout:'horizontal',spacing:'md',contents:[
    { ...text(label,'xs',MUTED),flex:4 },
    { ...text(value,'sm',DARK,'bold'),flex:7,align:'end' }
  ]
});
function card({label='AREWARIN TUTOR',title,subtitle='',rows=[],accent=GREEN,
 metric=null,actionLabel='เปิดสมุดการเรียน',actionUrl=portal,altText=null,extra=null}){
 const content=[
  {type:'text',text:clean(label,70).toUpperCase(),size:'xxs',weight:'bold',color:accent},
  { ...text(title,'xl',DARK,'bold'),margin:'sm' }
 ];
 if(subtitle)content.push({ ...text(subtitle,'sm',MUTED),margin:'xs' });
 if(rows.length){content.push({type:'separator',margin:'lg',color:'#E3ECE7'});}
 for(const [l,v] of rows.slice(0,8)){content.push({...row(l,v),margin:'md'});}
 if(metric){
  content.push({
    type:'box',layout:'vertical',margin:'xl',backgroundColor:LIGHT,cornerRadius:'lg',paddingAll:'lg',
    contents:[
      {...text(metric.label||'ชั่วโมงคงเหลือ','xs',MUTED),margin:'none'},
      {...text(metric.value||'0 ชม.','xxl',accent,'bold'),margin:'xs'},
      ...(metric.note?[{...text(metric.note,'xs',MUTED),margin:'sm'}]:[])
    ]
  });
 }
 if(extra)content.push({...text(extra,'xs',MUTED),margin:'lg'});
 const contents={
  type:'bubble',size:'mega',
  header:{type:'box',layout:'vertical',backgroundColor:accent,paddingAll:'lg',contents:[
    {type:'text',text:'🧬  AREWARIN TUTOR',size:'xs',color:WHITE,weight:'bold'}
  ]},
  body:{type:'box',layout:'vertical',paddingAll:'xl',contents:content},
  footer:{type:'box',layout:'vertical',paddingAll:'lg',contents:[
    {type:'button',style:'primary',height:'md',color:accent,
     action:{type:'uri',label:clean(actionLabel,30),uri:url(actionUrl)}}
  ]}
 };
 return {type:'flex',altText:clean(altText||title,350),contents};
}
function linkCard(student,studentUrl){
 return card({
  label:'บัญชีของฉัน · ACCOUNT CONNECTED',
  title:'ผูกบัญชี LINE สำเร็จ',
  subtitle:'ยินดีต้อนรับเข้าสู่พื้นที่นักเรียน',
  rows:[['ชื่อนักเรียน',student?.full_name||'บัญชีนักเรียน'],['สถานะ','เชื่อมต่อเรียบร้อย']],
  extra:'จากนี้สามารถดูตารางเรียน ชั่วโมงคงเหลือ และแจ้งลาได้ในระบบ',
  actionLabel:'เปิดพื้นที่นักเรียน',
  actionUrl:studentUrl,
  altText:'AreWarin Tutor: ผูกบัญชี LINE สำเร็จ'
 });
}
function attendanceCard(summary,studentUrl){
 const a=summary.attendance;
 const f=(n)=>Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:2});
 const day=a.lesson_date?new Intl.DateTimeFormat('th-TH',{timeZone:'UTC',year:'numeric',day:'numeric',month:'short'}).format(new Date(a.lesson_date+'T12:00:00Z')):'–';
 const clock=v=>v?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'–';
 const type=summary.session.session_type==='individual'?'เรียนเดี่ยว':summary.session.session_type==='mixed'?'กลุ่ม + เดี่ยว':'เรียนกลุ่ม';
 const status=a.status==='present'?'บันทึกเวลาเรียนแล้ว':a.status==='excused'?'บันทึกลาเรียนแล้ว':'บันทึกขาดเรียนแล้ว';
 const rows=[
  ['นักเรียน',summary.student.full_name],
  ['วิชา',summary.course.name],
  ['หัวข้อ',summary.session.topic],
  ['รูปแบบ',type+(summary.session.group_label?' · '+summary.session.group_label:'')],
  ['วันที่',day],
  ...(a.status==='present'?[['เวลาเรียน',clock(a.check_in_at)+'–'+clock(a.check_out_at)+' น.']]:[]),
  ['บันทึกครั้งนี้',f(a.hours)+' ชม.']
 ];
 return card({
  label:'LEARNING RECORD · สรุปการเรียน',
  title:status,rows,metric:{
    label:'ชั่วโมงเรียนคงเหลือ',value:f(summary.remaining)+' ชั่วโมง',
    note:summary.remaining<=4?'ใกล้หมด · กดต่อคอร์สหรือยุติได้ในระบบ':'อัปเดตจากการบันทึกล่าสุด'
  }, actionLabel:summary.remaining<=4?'ดูคอร์ส / ต่อคอร์ส':'ดูรายละเอียดการเรียน',
  actionUrl:studentUrl,altText:'AreWarin Tutor: '+status+' เหลือ '+f(summary.remaining)+' ชั่วโมง'
 });
}
function classCard(session,kind,studentUrl){
 const start=new Date(session.starts_at);
 const when=new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short',hour12:false}).format(start);
 const type=session.session_type==='individual'?'เรียนเดี่ยว':session.session_type==='mixed'?'กลุ่ม + เดี่ยว':'เรียนกลุ่ม';
 const cancel=kind==='cancel';
 const title=cancel?'ยกเลิกคลาสเรียน':kind==='before_1hour'?'อีก 1 ชั่วโมงจะเริ่มเรียน':'แจ้งเตือนเรียนวันพรุ่งนี้';
 return card({
  label:cancel?'CLASS UPDATE · แจ้งเปลี่ยนแปลง':'CLASS REMINDER · ตารางเรียน',
  title,accent:cancel?'#A04A39':GREEN,
  rows:[
    ['หัวข้อ',session.topic],['ประเภท',type+(session.group_label?' · '+session.group_label:'')],
    ['วันเวลา',when],
    ...(cancel?[['เหตุผล',session.cancel_reason||'ครูแจ้งยกเลิก']]:[])
  ],
  extra:cancel?'โปรดตรวจสอบตารางเรียนล่าสุด':'เตรียมอุปกรณ์และตรวจสอบลิงก์เข้าเรียน',
  actionLabel:cancel?'ดูตารางเรียน':'เปิดรายละเอียดคลาส',
  actionUrl:studentUrl,altText:'AreWarin Tutor: '+title+' '+session.topic
 });
}
function lowHoursCard(courseName,hours,studentUrl){
 const f=Number(hours||0).toLocaleString('th-TH',{maximumFractionDigits:2});
 return card({
  label:'COURSE ALERT · แจ้งเตือนชั่วโมง',
  title:'ชั่วโมงเรียนใกล้หมด',
  rows:[['คอร์ส',courseName]],metric:{label:'ชั่วโมงเรียนคงเหลือ',value:f+' ชั่วโมง',note:'ต่อคอร์สหรือยุติได้จากหน้า Student Portal'},
  actionLabel:'ต่อคอร์ส / ยุติคอร์ส',actionUrl:studentUrl,
  altText:'AreWarin Tutor: ชั่วโมงเรียนใกล้หมด เหลือ '+f+' ชั่วโมง'
 });
}
function testCard(studentUrl){
 return card({label:'SYSTEM TEST',title:'ระบบแจ้งเตือนพร้อมใช้งาน',subtitle:'นี่คือข้อความทดสอบจาก AreWarin Tutor',
  rows:[['ช่องทาง','LINE Official Account'],['สถานะ','ส่งคำขอเรียบร้อย']],
  actionLabel:'เปิดสมุดการเรียน',actionUrl:studentUrl,altText:'AreWarin Tutor: ทดสอบการแจ้งเตือน'});
}
module.exports={card,linkCard,attendanceCard,classCard,lowHoursCard,testCard};