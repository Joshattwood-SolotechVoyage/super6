/* Super 6 push service worker — notifications only.
   No fetch interception or offline caching, so scoring and login are unaffected. */
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : "" }; }
  const title = typeof payload.title === "string" ? payload.title.slice(0, 90) : "Super 6";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 240) : "Check Super 6.";
  const tag = typeof payload.tag === "string" ? payload.tag.slice(0, 150) : "super6-update";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: "/icon-192.png",
    badge: "/favicon-48.png",
    data: { url: "/" },
    renotify: false,
    requireInteraction: false
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL("/", self.location.origin).href;
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = clientsList.find(client => new URL(client.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      if (typeof open.navigate === "function") await open.navigate(url);
    } else {
      await self.clients.openWindow(url);
    }
  })());
});
