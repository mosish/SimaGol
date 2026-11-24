export function setupInstall(install,say) {
  let installEvent=null;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
  install.hidden=standalone();
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();installEvent=event;install.hidden=false;
  });
  window.addEventListener('appinstalled',()=>{installEvent=null;install.hidden=true;});
  install.onclick=async()=>{
    if(installEvent){
      const prompt=installEvent;installEvent=null;
      await prompt.prompt();await prompt.userChoice;
    } else {
      say('در آیفون، در Safari گزینهٔ اشتراک‌گذاری و سپس افزودن به صفحهٔ اصلی را بزن. در اندروید از منوی مرورگر، نصب برنامه را انتخاب کن.',
        'On iPhone, use Safari → Share → Add to Home Screen → Open as Web App. On Android, choose Install app or Add to Home screen in the browser menu.');
    }
  };
}
