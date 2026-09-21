// Minimal Service Worker для PWA — позволяет Chrome предложить "Установить приложение"
// Кешируем только статику (app shell), API запросы идут напрямую.

const CACHE_NAME = "futures-tracker-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-512.png",
  "/globals.css",
];

// Установка — кешируем базовые ассеты
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Игнорируем ошибки кеширования — некоторые ассеты могут 404
      });
    })
  );
  self.skipWaiting();
});

// Активация — чистим старые кеши
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch — network-first для API, cache-first для статики
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Только GET запросы
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // API запросы — всегда в сеть (не кешируем)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Статика — cache-first, fallback на сеть
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Кешируем успешные ответы
        if (response.ok && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
