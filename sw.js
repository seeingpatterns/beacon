// 오프라인의 심장: 설치 때 모든 자산을 통째로 캐시하고, 이후 요청은 캐시 우선.
// 파일이 바뀌면 CACHE 버전을 올려야 갱신된다 (v1 → v2).
const CACHE = 'nc-v6'; // v6: '남의 전화 빌리기' 설명 쉽게 교정
const ASSETS = ['./', './index.html', './app.js', './lib/geo.js', './lib/sun.js',
  './lib/plan.js', './lib/beacon.js', './route-data.json', './manifest.webmanifest', './icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
