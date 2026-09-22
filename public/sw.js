// Минимальный Service Worker для PWA.
// НЕ кеширует ничего — только регистрирует fetch handler,
// чтобы Chrome разрешил установку приложения.
// Network-only стратегия — все запросы идут напрямую в сеть.
// Это предотвращает ERR_FAILED после логина (когда SW возвращал
// закешированную страницу /login вместо реальной сессии).
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
