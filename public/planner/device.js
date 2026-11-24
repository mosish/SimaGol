import {setupInstall} from '../components/install.js';
function applicationKey(value) {
  const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}

async function request(action,body) {
  const response=await fetch('/api/push/'+action,{
    method:body?'POST':'GET', credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','X-SimaGol':'1'},
    body:body?JSON.stringify(body):undefined
  });
  if(!response.ok)throw Object.assign(new Error('push request failed'),{status:response.status});
  return response.json();
}

export async function initDevice({getSnapshot,onMessage}) {
  let registration,config,subscription;
  let queue=Promise.resolve();
  const install=document.querySelector('#install-app');
  const enable=document.querySelector('#enable-push');
  const disable=document.querySelector('#disable-push');
  const say=(fa,en)=>onMessage(getSnapshot().lang==='fa'?fa:en);
  setupInstall(install,say);
  function controls(){
    disable.hidden=!subscription;
    enable.hidden=!!subscription;
  }
  const report=error=>error?.status===401?
    say('برای اعلان‌های پس‌زمینه وارد حساب فروشگاه شو و به تقویم برگرد.','Sign in to the shop, then return to the planner to enable background reminders.'):
    say('زمان‌بندی اعلان هنوز همگام نشده است. تقویم روی دستگاه ذخیره است. هنگام اتصال دوباره تلاش می‌شود.',
      'Push scheduling has not synced. Your dates are saved locally. Reopen online to retry.');
  async function syncNow(){
    if(!subscription || !navigator.onLine || getSnapshot().authenticated===false)return;
    const {timeZone,time}=getSnapshot();
    await request('sync',{endpoint:subscription.endpoint,source:'account',timeZone,time});
  }
  function sync(){
    queue=queue.then(syncNow).catch(report);
    return queue;
  }
  controls();
  enable.onclick=async()=>{
    if(getSnapshot().authenticated===false){say('ابتدا وارد حساب خود شوید.','Sign in to enable reminders.');return;}
    if(!registration || !('PushManager' in window) || !('Notification' in window)){
      say('یادآورها داخل تقویم فعال‌اند. برای اعلان پس‌زمینه در آیفون، برنامه را به صفحهٔ اصلی اضافه کن و از همان‌جا باز کن.',
        'In-app reminders are active. On iPhone, install and open the Home Screen app for background notifications.');
      return;
    }
    if(!navigator.onLine){
      say('برای فعال‌سازی اعلان دستگاه به اینترنت وصل شو.','Connect to the internet to enable device reminders.');
      return;
    }
    if(!config?.enabled){
      say('اعلان سرور هنوز آماده نیست. یادآورهای داخل تقویم فعال‌اند.','Server push is unavailable. In-app reminders are active.');
      return;
    }
    enable.disabled=true;
    try{
      // Keep permission directly inside the click handler for WebKit.
      const granted=await Notification.requestPermission();
      if(granted!=='granted'){
        say('اجازهٔ اعلان داده نشد. یادآورها در تقویم دیده می‌شوند.','Notifications were not enabled. Reminders will appear in the planner.');
        return;
      }
      const current=await registration.pushManager.getSubscription();
      subscription=current||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(config.publicKey)});
      try {await syncNow();}
      catch(error){if(!current){await subscription.unsubscribe();subscription=null;}throw error;}
      say('اعلان‌های این دستگاه فعال شد.','Device reminders are enabled.');
    }catch(error){report(error);}
    finally{controls();enable.disabled=false;}
  };
  disable.onclick=async()=>{
    if(!subscription)return;
    disable.disabled=true;
    const endpoint=subscription.endpoint;
    try{
      await queue;
      if(!await subscription.unsubscribe())throw new Error('unsubscribe');
      subscription=null;
      // Local revocation immediately ends delivery; 404/410 also prunes stale server rows.
      if(navigator.onLine)await request('delete',{endpoint}).catch(()=>{});
      say('اعلان‌های این دستگاه خاموش شد.','Device notifications are off.');
    }catch(error){report(error);}
    finally{controls();disable.disabled=false;}
  };
  if('serviceWorker' in navigator){
    try{
      await navigator.serviceWorker.register('/planner/sw.js',{scope:'/'});
      registration=await navigator.serviceWorker.ready;
      subscription=await registration.pushManager?.getSubscription();
      controls();
    }catch{
      say('ذخیرهٔ آفلاین آماده نشد. برنامه را یک‌بار آنلاین باز کن.','Offline setup did not finish. Open the planner online once.');
    }
  }
  const reconnect=async()=>{
    try{config=await request('config');}catch{config=null;}
    await sync();
  };
  window.addEventListener('online',reconnect);
  if(navigator.onLine)await reconnect();
  return {sync};
}
