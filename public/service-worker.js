// eslint-disable-next-line no-restricted-globals
// eslint-disable-next-line no-unused-expressions

/* eslint-disable no-restricted-globals */
/* global importScripts, workbox */

/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app and you should
 * disable HTTP caching for this file too.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */

// in dev, `process` is undefined because this file is not compiled until build
const IS_DEVELOPMENT =
  typeof process === "undefined" || process.env.NODE_ENV !== "production";

if (IS_DEVELOPMENT) {
  importScripts(
    "https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js",
  );
  workbox.setConfig({
    debug: false,
  });
} else {
  importScripts("/workbox/workbox-sw.js");
  workbox.setConfig({
    modulePathPrefix: "/workbox/",
  });
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

workbox.core.clientsClaim();

if (!IS_DEVELOPMENT) {
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);

  workbox.routing.registerNavigationRoute(
    workbox.precaching.getCacheKeyForURL("./index.html"),
    {
      blacklist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
    },
  );
}

// Cache relevant font files
workbox.routing.registerRoute(
  new RegExp("/(fonts.css|.+.(ttf|woff2|otf))"),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "fonts",
    plugins: [new workbox.expiration.Plugin({ maxEntries: 10 })],
  }),
);

self.addEventListener("fetch", (event) => {
  if (
    event.request.method === "POST" &&
    event.request.url.endsWith("/web-share-target")
  ) {
    return event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const file = formData.get("file");
        const webShareTargetCache = await caches.open("web-share-target");
        await webShareTargetCache.put("shared-file", new Response(file));
        return Response.redirect("/?web-share-target", 303);
      })(),
    );
  }
});
