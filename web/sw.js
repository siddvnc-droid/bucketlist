// Lets the home screen app open even on a weak connection.
// Always asks the network first, so updates show up straight away, and only
// falls back to the copy saved last time when the network doesn't answer.
const CACHE = "bucketlist-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only this site's own files. Sign-in pages (/__/) and Google's servers are left alone.
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/__/")) return;
  const key = req.mode === "navigate" ? "/" : req;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key).then((hit) => hit || Response.error()))
  );
});
