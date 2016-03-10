var version = 1.0;

self.addEventListener("install", function(event) {
  event.waitUntil(caches
    .open(version + 'fundamentals')
    .then(function(cache) {
      return cache.addAll([
        '/',
        '/fonts/butler_regular.woff',
        '/fonts/butler_extrabold.woff',
        '/app.min.js'
      ]);
    })
    .then(function() {})
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(caches.match(event.request).then(function(cached) {
    var networking = fetch(event.request).then(fetchedFromNetwork, unableToResolve).catch(unableToResolve);
    return cached || networking;

    function fetchedFromNetwork(resp) {
      var copy = resp.clone();

      caches.open(version + 'pages').then(function add(cache) {
        cache.put(event.request, copy);
      }).then(function() {});

      return response;
    }
    function unableToResolve () {
      return new Response('<h1>Service Unavailable</h1>', {status: 503, statusText: 'Service Unavailable', headers: new Headers({'Content-Type': 'text/html'})});
    }

  }));
})


self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (key) {
            return !key.startsWith(version);
          }).map(function (key) {
            return caches.delete(key);
          })
        );
      }).then(function() {
    })
  );
});
