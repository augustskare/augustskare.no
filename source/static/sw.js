const cacheName = 'as_2';

addEventListener('install', event => {
  event.waitUntil(skipWaiting());
});

addEventListener('activate', event => {
  event.waitUntil(clients.claim());
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== cacheName).map(caches.delete)
    ))
  );
});

addEventListener('fetch', event => {
  const request = event.request;
  const { headers, method, url, mode } = request;

  event.respondWith((async function () {
    const response = fetch(request);

    event.waitUntil((async function() {
      const clone = (await response).clone();
      const cache = await caches.open(cacheName);
      await cache.put(request, clone);
    })());

    if (mode === 'navigate' || headers.get('Accept').includes('text/html')) {
      return Promise.race([
        response,
        delay(2000),
      ]).catch(async function() {
        const cached = await caches.match(request);
        return cached || response;
      });
    }

    const cached = await caches.match(request);
    return cached || response;
  })());

});

const delay = (t) => new Promise((resolve, reject) => setTimeout(reject, t));