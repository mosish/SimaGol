// Bump this version when changing an asset in a source deployment.
const cacheName = 'simagol-planner-shell-v18';
const shell = '/planner/';
const assets = [
  shell, '/planner/index.html', '/planner/manifest.json', '/planner/planner.css',
  '/planner/app.js', '/planner/store.js', '/planner/dates.js', '/planner/device.js',
  '/planner/images/icon-192.png', '/planner/images/icon-512.png', '/planner/images/apple-touch.png',
  '/components/signin.js', '/', '/index.html', '/shop.css', '/app.js', '/labels.json',
  '/components/theme.js', '/components/greeting.js', '/components/navigation.js', '/components/icons.js',
  '/components/install.js', '/components/ui.js', '/components/home.js', '/components/store.js',
  '/components/account.js', '/components/appearance.js', '/components/calendar.js', '/planner/iran.js',
  '/images/meadow.jpg', '/images/hero.jpg', '/images/roses.jpg', '/images/lilies.jpg', '/images/tulips.jpg',
];
const cachedPaths = new Set(assets);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(assets.map(path => new Request(path, {cache:'reload'})))
  ).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('simagol-planner-') && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !cachedPaths.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    // Local development serves the current checkout on each online visit.
    if (['127.0.0.1','localhost','[::1]'].includes(url.hostname)) {
      try {
        const fresh=await fetch(event.request,{cache:'no-store'});
        if(fresh.ok) { await cache.put(url.pathname,fresh.clone()); return fresh; }
      } catch { /* Use the installed shell while offline. */ }
    }
    const cached = await cache.match(url.pathname);
    return cached || fetch(event.request);
  })());
});
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    const fa = (self.navigator.language || 'fa').startsWith('fa');
    await self.registration.showNotification(fa ? 'یادآور گل سیماگل' : 'SimaGol flower reminder', {
      body: fa ? 'برای دیدن مناسبت و سفارش گل، تقویم را باز کن.' : 'Open your calendar to see the occasion and plan your flowers.',
      icon: '/planner/images/icon-192.png', tag: 'simagol-flowers', renotify: true,
    });
    for (const tab of await self.clients.matchAll({type:'window'})) tab.postMessage('planner-reminder');
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    for (const tab of await self.clients.matchAll({type:'window',includeUncontrolled:true})) {
      const url = new URL(tab.url);
      if (url.origin === self.location.origin && url.pathname.startsWith(shell)) {
        await tab.focus();
        tab.postMessage('planner-reminder');
        return;
      }
    }
    await self.clients.openWindow(shell);
  })());
});
