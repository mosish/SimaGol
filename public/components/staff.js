import {state,api,t,label,field,button,persist} from './ui.js';
import {admin} from './admin.js';
import {invoice} from './account.js';
import {calendarSystem,readDate} from './calendar.js';
const $=q=>document.querySelector(q);
async function render(){
  document.documentElement.dir=state.lang==='fa'?'rtl':'ltr';
  document.documentElement.lang=state.lang;
  $('#language').textContent=state.lang==='fa'?'EN':'FA';
  $('#calendar').textContent=calendarSystem()==='persian'?'شمسی':'Gregorian';
  $('#logout').hidden=!state.me;
  if(!state.me){$('#workspace').innerHTML='<h1>'+label('Login')+'</h1><form data-form="login">'+field('email','Email','','email')+field('password','Password','','password')+button('Login')+'</form>';return;}
  if(state.me.role==='customer'){$('#workspace').textContent=t('Access denied');return;}
  if(location.hash.startsWith('#invoice/')){
    const o=await api('orders/'+encodeURIComponent(location.hash.slice(9)));
    $('#workspace').innerHTML='<a href="/admin">'+label('Staff')+'</a>'+invoice(o);return;
  }
  $('#workspace').innerHTML=await admin();
}
async function refresh(){
  const [me,shop]=await Promise.all([api('me'),api('store')]);Object.assign(state,{me,...shop});await render();
}
function error(e){$('#status').textContent=t(e.message);}
$('#language').onclick=()=>{state.lang=state.lang==='fa'?'en':'fa';persist('lang',state.lang);render().catch(error);};
$('#calendar').onclick=()=>{localStorage.setItem('simagol.calendar',calendarSystem()==='persian'?'gregory':'persian');render().catch(error);};
$('#logout').onclick=async()=>{await api('logout','POST',{});localStorage.removeItem('simagol.planner.viewer');await refresh();};
window.addEventListener('hashchange',()=>render().catch(error));
document.addEventListener('click',e=>{if(e.target.closest('[data-print]'))window.print();});
document.addEventListener('change',e=>{if(e.target.name==='key'){const p=state.settings.copy[e.target.value]||state.dict[e.target.value];const f=e.target.form.elements;f.copyFa.value=p.fa;f.copyEn.value=p.en;}});
document.addEventListener('submit',async e=>{
  e.preventDefault();const form=e.target,k=form.dataset.form,data=Object.fromEntries(new FormData(form));
  const submit=form.querySelector('[type=submit]');if(submit.disabled)return;submit.disabled=true;
  try{
    for(const el of form.querySelectorAll('[type=checkbox]'))data[el.name]=el.checked;
    if(k==='upload'){
      if(data.file.size>2097152)throw new Error('File too large');
      const reader=new FileReader();const encoded=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(data.file);});
      const out=await api('admin/upload','POST',{data:encoded});$('#upload-path').textContent=out.path;return;
    }
    if(k==='slot'){
      const date=readDate(data.endDate);if(!date||!/^\d\d:\d\d$/.test(data.endTime))throw new Error('Invalid input');
      data.ends=date+'T'+data.endTime+':00.000Z';
    }
    await api(k==='login'?k:'admin/'+k,'POST',data);await refresh();$('#status').textContent='';
  }catch(err){error(err);}finally{submit.disabled=false;}
});
try{state.dict=await (await fetch('/labels.json')).json();await refresh();}catch(err){error(err);}
