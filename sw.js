/* Worship Atmos service worker
   - App files: network first, so updates arrive; cached copy used when offline.
   - Audio pads: cache first, so a pad that has been saved never downloads again.
   To change any audio file later, rename the cache below (wa-audio-v1 -> wa-audio-v2). */
const SHELL = 'wa-shell-v2', AUDIO = 'wa-audio-v1', FONTS = 'wa-fonts-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('wa-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (u.pathname.includes('/audio/')) return e.respondWith(audio(r));
    if (r.mode === 'navigate') return e.respondWith(page(r));
    return e.respondWith(swr(r, SHELL));
  }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') e.respondWith(swr(r, FONTS));
});

async function audio(r) {
  const c = await caches.open(AUDIO), hit = await c.match(r.url);
  if (hit) return hit;
  const n = await fetch(r);
  if (n.ok) c.put(r.url, n.clone());
  return n;
}

async function page(r) {
  try {
    const n = await fetch(r);
    if (n.ok) (await caches.open(SHELL)).put('index.html', n.clone());
    return n;
  } catch (err) {
    return (await caches.match('index.html')) || (await caches.match('./')) || Response.error();
  }
}

async function swr(r, name) {
  const c = await caches.open(name), hit = await c.match(r);
  const net = fetch(r).then(n => { if (n.ok || n.type === 'opaque') c.put(r, n.clone()); return n; }).catch(() => hit || Response.error());
  return hit || net;
}
