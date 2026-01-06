const CACHE = "Damon-v1";
const ASSETS = [
  "/",
  "/pair",
  "/manifest.json",
  "/service-worker.js",
  "https://files.catbox.moe/57tf3e.jpeg",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
  "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE) return caches.delete(key);
        })
      )
    )
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match("/")))
  );
});
