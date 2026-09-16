self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = event.notification.data?.url || "/";
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windowClients) {
        if ("focus" in client) {
          await client.focus();
          return;
        }
      }
      if ("openWindow" in self.clients) {
        await self.clients.openWindow(url);
      }
    })()
  );
});