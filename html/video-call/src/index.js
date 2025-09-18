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

function createCredentialsPrompt() {
    // Only create if not exists
    if (document.getElementById('credentialsOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'credentialsOverlay';
    overlay.className = 'credentials-overlay';
    
    overlay.innerHTML = `
        <div class="credentials-prompt">
            <h3>Enter Server Credentials</h3>
            <input type="text" id="serverPath" placeholder="Server Path" required>
            <input type="text" id="serverKey" placeholder="Server Key" required>
            <button class="callButton" onclick="submitCredentials()">Connect</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function submitCredentials() {
    const path = document.getElementById('serverPath').value;
    const key = document.getElementById('serverKey').value;
    
    if (!path || !key) {
        alert('Please enter both server path and key');
        return;
    }

    // Store credentials
    localStorage.setItem('peerPath', path);
    localStorage.setItem('peerKey', key);
    
    // Initialize peer connection
    setUpPeer(path, key);
    
    // Remove credentials prompt
    document.getElementById('credentialsOverlay').remove();
}

// Modified initialization
window.addEventListener('load', () => {
    const path = localStorage.getItem('peerPath');
    const key = localStorage.getItem('peerKey');
    
    if (path && key) {
        setUpPeer(path, key);
    } else {
        createCredentialsPrompt();
    }
});
