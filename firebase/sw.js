// Lets the home screen app open even on a weak connection.
// Always asks the network first, so updates show up straight away, and only
// falls back to the copy saved last time when the network doesn't answer.
const CACHE = "bucketlist-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// "Add to calendar" links: the app puts the calendar file in the link, and this hands it back as
// a real file, which Safari on iPhone needs to offer "Add to Calendar".
function calendarFile(url) {
  try {
    const b64 = (url.searchParams.get("ics") || "").replace(/-/g, "+").replace(/_/g, "/");
    const text = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    if (!text.startsWith("BEGIN:VCALENDAR")) return null;
    const name = (url.searchParams.get("name") || "activity").replace(/[^A-Za-z0-9-]+/g, "-").slice(0, 60) || "activity";
    return new Response(text, { headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${name}.ics"`,
      "Cache-Control": "no-store",
    } });
  } catch { return null; }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === "GET" && url.origin === self.location.origin && url.pathname === "/event.ics") {
    const res = calendarFile(url);
    if (res) { event.respondWith(res); return; }
  }
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
