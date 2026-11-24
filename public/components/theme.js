// Apply the persisted appearance before the first paint on every document.
window.SimaGolTheme = (() => {
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem('simagol.' + key)) ?? fallback; }
    catch { return fallback; }
  }
  function preference() {
    const legacy=read('dark',null);
    const value=read('themeMode',typeof legacy==='boolean'?(legacy?'dark':'light'):'auto');
    return ['dark','light','auto'].includes(value)?value:'auto';
  }
  function paint(mode) {
    const hour=new Date().getHours();
    const dark=mode==='dark'||(mode==='auto'&&(hour<7||hour>=19));
    document.documentElement.dataset.theme=dark?'dark':'light';
    document.documentElement.classList.toggle('dark',dark);
  }
  paint(preference());
  const lang=read('lang','fa')==='en'?'en':'fa';
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='fa'?'rtl':'ltr';
  if(location.pathname==='/' && location.hash.startsWith('#account')){
    document.documentElement.classList.add('opening-account');
  }
  return {preference,paint};
})();
