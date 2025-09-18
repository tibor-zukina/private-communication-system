const CACHE_NAME = 'private-chat-v1';
const DISABLE_CACHE = true; // Toggle this for development/production
const urlsToCache = [
  '/video-call/',
  '/video-call/index.html',
  '/video-call/dist/bundle.js',
  '/video-call/images/favicon.ico',
  '/video-call/images/camera.png',
  '/video-call/images/camera_off.png',
  '/video-call/images/microphone.png',
  '/video-call/images/microphone_muted.png',
  '/video-call/images/fullscreen.png',
  '/video-call/images/send_gray.png',
  '/video-call/images/file_gray.png',
  '/video-call/images/empty_background_pattern.jpg',
  '/video-call/dist/static/js/peerjs.js',
  '/video-call/dist/static/js/video_utils.js',
  '/video-call/dist/static/js/chat_utils.js',
  '/video-call/dist/static/js/encryption_utils.js',
  '/video-call/dist/static/js/start_meeting.js',
  '/video-call/dist/static/js/join_meeting.js',
  '/video-call/dist/static/css/design.css'
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
