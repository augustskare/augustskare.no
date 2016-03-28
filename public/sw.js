var version = 'augustskare-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(version).then((cache) => {
      return cache.addAll([ '/' ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all( keys.filter( key => key !== version ).map( key => caches.delete(key) ));
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.indexOf('typekit') >= 0) { return; }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (!cached) {
        return fetch(event.request).then((response) => {
          return caches.open(version).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      }

      return cached;
    })
  )
});

self.addEventListener('message', function(event) {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
