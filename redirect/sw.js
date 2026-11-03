// Replaces the old app's service worker: remove the old offline copy so the next
// visit loads the redirect page (which keeps QR check-in links intact).
// It does not reload open pages, so someone mid check-in can finish first.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key)
    await self.registration.unregister()
  })())
})
