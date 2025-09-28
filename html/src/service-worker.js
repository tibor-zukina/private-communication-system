const CACHE_NAME = 'private-chat-v1';
const DISABLE_CACHE = false; // Toggle this for development/production
const urlsToCache = [
  '/',
  '/index.html',
  '/dist/bundle.js',
  '/images/favicon.ico',
  '/images/camera.png',
  '/images/camera_off.png',
  '/images/microphone.png',
  '/images/microphone_muted.png',
  '/images/fullscreen.png',
  '/images/send_gray.png',
  '/images/file_gray.png',
  '/images/empty_background_pattern.jpg',
  '/dist/static/js/peerjs.js',
  '/dist/static/js/chat_utils.js',
  '/dist/static/js/encryption_utils.js',
  '/dist/static/js/start_meeting.js',
  '/dist/static/js/join_meeting.js',
  '/dist/static/js/video_utils.js',
  '/dist/static/css/design.css'
];

self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // Skip cache in development
  if (DISABLE_CACHE) {
    return;
  }

  console.log('[ServiceWorker] Fetch', event.request.url);
  
  if (event.request.headers.get('Upgrade') === 'websocket') {
    console.log('[ServiceWorker] WebSocket request detected', event.request.url);
    return;
  }

  if (event.request.url.includes('chat-communication.perpetuumit.com')) {
    console.log('[ServiceWorker] PeerJS server request detected', event.request.url);
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activated');
});
