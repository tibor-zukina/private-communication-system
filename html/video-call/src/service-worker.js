const CACHE_NAME = 'private-chat-v1';
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
  '/video-call/static/css/design.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
