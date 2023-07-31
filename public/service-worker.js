self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  self.registration
    .unregister()
    .then(() => {
      return self.clients.matchAll();
    })
    .then((clients) => {
      clients.forEach((client) => client.navigate(client.url));
    });
});
