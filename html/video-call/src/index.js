import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import './design/design.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/video-call/service-worker.js')
            .then(registration => {
                console.log('SW registered:', registration);
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    });
}

// Save params when opening normally
const params = new URLSearchParams(window.location.search);
if (params.has('path') && params.has('key')) {
    localStorage.setItem('peerPath', params.get('path'));
    localStorage.setItem('peerKey', params.get('key'));
}

// Get params either from URL or localStorage
function getPeerParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        path: params.get('path') || localStorage.getItem('peerPath'),
        key: params.get('key') || localStorage.getItem('peerKey')
    };
}

window.getPeerParams = getPeerParams;
