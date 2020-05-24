const CACHE_NAME = "";
const urlsToCache = [
	"/",
	"/main.css",
	"/main.js",
	"/assets/atom-one-light.css"
];

self.addEventListener("install", e => {
	e.waitUntil(
		caches.open(CACHE_NAME).then(cache => {
			return cache.addAll(urlsToCache);
		})
	)
});

self.addEventListener("fetch", e => {
	e.respondWith(
		caches.match(e.request).then(response => {
			return response ? response : fetch(e.request);
		})
	);
});