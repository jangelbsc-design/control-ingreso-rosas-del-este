/* Service Worker · Urbanización Rosas del Este */
var CACHE = "rde-app-v16";
var ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/config.js",
  "./js/utils.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/logo-192.png",
  "./icons/logo-512.png",
  "./icons/logo-maskable-512.png",
  "./icons/logo-180.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.status === 200) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        return caches.match("./index.html");
      });
    })
  );
});