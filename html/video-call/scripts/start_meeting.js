const host = '64.176.216.148';
let peer;
let peerId;
let meetingDeviceIds = [];
let meetingLocalStream;
let chatConn;
let callerPeerId;
let chatStarted = false;
let counterInterval = null;
let startTime = 0;
let previousState = 'not started';
let lastCallTime;
let callPeerConnection;

// Crypto
let meetingKey; // CryptoKey for AES-GCM
let meetingKeyRaw; // ArrayBuffer for export/import

// Buffer for messages/files received before key is ready
let pendingEncryptedMessages = [];

// Utility to generate a secure random ID
function makeRandomId(length) {
    const characters = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Initialize PeerJS
function setUpPeer(peerServerPath, peerServerKey) {
    peerId = makeRandomId(32);
    peer = new Peer(peerId, {
        host: host,
        port: 3728,
        path: peerServerPath,
        key: peerServerKey
    });

    peer.on('open', () => {
        const callButton = document.querySelector('.callButton.invisibleButton');
        if (callButton) callButton.className = 'callButton';
    });
}

// Get query params and start peer
const params = new URLSearchParams(window.location.search);
setUpPeer(params.get('path'), params.get('key'));

// Start meeting process
async function startMeeting() {
    const callButton = document.querySelector('.callButton');
    callButton.disabled = true;
    callButton.value = 'Meeting started';
    navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(enumerationErrorHandler);
}

// Import AES-GCM key from raw bytes and update key if received again
async function importMeetingKey(rawBytes) {
    meetingKey = await window.crypto.subtle.importKey(
        "raw",
        new Uint8Array(rawBytes),
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
    );
    // Reprocess any pending messages with the new key
    for (const data of pendingEncryptedMessages) {
        await handleChatData(data);
    }
    pendingEncryptedMessages = [];
}

// Set up chat after PeerJS call connects
function startChat() {
    chatStarted = true;

    peer.on('connection', (conn) => {
        chatConn = conn;
        chatConn.on('data', handleChatData);
        chatConn.on('close', () => {});
        addFileInput(); // Ensure file input is present after chat connection
    });

    const messageBox = document.getElementById('message');
    messageBox.onkeydown = (e) => {
        if (e.keyCode === 13 && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };
}

// Encrypt and send chat message
async function sendMessage() {
    if (!chatStarted || !meetingKey) return;

    const messageBox = document.getElementById('message');
    const messageText = messageBox.value;
    messageBox.value = '';

    // Encrypt message
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        meetingKey,
        encoder.encode(messageText)
    );

    chatConn.send({
        type: "chat",
        iv: Array.from(iv),
        encrypted: Array.from(new Uint8Array(encrypted))
    });

    addSentMessage(messageText);
}

// Handle incoming chat data (for file and key)
async function handleChatData(data) {
    if (typeof data === "object" && data.type === "meeting-key") {
        // Always update the key if received
        await importMeetingKey(data.key);
    } else if (typeof data === "object" && data.type === "file") {
        if (!meetingKey) {
            pendingEncryptedMessages.push(data);
            return;
        }
        // Decrypt file
        const iv = new Uint8Array(data.iv);
        const encrypted = new Uint8Array(data.encrypted);
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            meetingKey,
            encrypted
        );
        const blob = new Blob([decrypted], { type: data.mime });
        const url = URL.createObjectURL(blob);
        addReceivedMessage(`<a href="${url}" download="${data.name}">Download ${data.name}</a>`);
    } else if (typeof data === "object" && data.type === "chat") {
        if (!meetingKey) {
            pendingEncryptedMessages.push(data);
            return;
        }
        // Decrypt chat message
        const iv = new Uint8Array(data.iv);
        const encrypted = new Uint8Array(data.encrypted);
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            meetingKey,
            encrypted
        );
        const decoder = new TextDecoder();
        addReceivedMessage(decoder.decode(decrypted));
    } else {
        addReceivedMessage(data);
    }
}

// Encrypt and send file
async function sendFile(file) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const fileBuffer = await file.arrayBuffer();
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        meetingKey,
        fileBuffer
    );
    chatConn.send({
        type: "file",
        name: file.name,
        mime: file.type,
        iv: Array.from(iv),
        encrypted: Array.from(new Uint8Array(encrypted))
    });
}

// Add file input to chat UI
function addFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
        if (e.target.files.length > 0) {
            await sendFile(e.target.files[0]);
        }
    };
    document.getElementById('sendChatDiv').appendChild(input);
}

// Media capture success handler
function getUserMediaSuccess(capturedStream) {
    document.getElementById('meetingStatus').innerHTML = 'Waiting for the other side to join...';
    document.getElementById('invitationUrl').innerHTML = `Invitation url: https://${host}/video-call/join-meeting.php?path=${params.get('path')}&key=${params.get('key')}&id=${peerId}`;

    meetingLocalStream = makeCallStream(capturedStream);

    peer.on('call', (call) => {
        lastCallTime = Date.now();
        call.timeStarted = lastCallTime;
        callerPeerId = call.peer;
        call.answer(meetingLocalStream);

        call.on('stream', (remoteStream) => {
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = remoteStream;
            enableFullscreen(localVideo);
            enableToggle();
            startCounter();
        });

        callPeerConnection = call.peerConnection;
        callPeerConnection.oniceconnectionstatechange = () => {
            const state = callPeerConnection.iceConnectionState;

            if (state === 'disconnected') {
                if (call.timeStarted === lastCallTime) connectionLost();
            } else if (state === 'connected') {
                if (!chatStarted) startChat();
                startCounter();
            }

            previousState = state;
        };
    }, getMediaErrorHandler);
}

// Device enumeration
function gotDevices(deviceInfos) {
    if (!deviceInfos.length) return;

    meetingDeviceIds = deviceInfos
        .filter(info => info.kind === 'videoinput')
        .map(info => info.deviceId);

    if (!meetingDeviceIds.length) return;

    getVideo(false);
}

// Timer logic for call duration
function startCounter() {
    document.getElementById('invitationUrl').style.display = 'none';
    const meetingStatus = document.getElementById('meetingStatus');

    if (startTime === 0) startTime = Date.now();

    const updateTime = () => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        setTimer(seconds, meetingStatus);
    };

    updateTime();
    if (counterInterval) clearInterval(counterInterval);
    counterInterval = setInterval(updateTime, 1000);
}

// Format timer as HH:MM:SS
function setTimer(seconds, element) {
    const s = String(seconds % 60).padStart(2, '0');
    const m = String(Math.floor(seconds / 60) % 60).padStart(2, '0');
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    element.innerHTML = `${h}:${m}:${s}`;
}

// When ICE disconnects
function connectionLost() {
    clearInterval(counterInterval);
    const meetingStatus = document.getElementById('meetingStatus');
    meetingStatus.innerHTML = 'Connection to the other side lost';

    setTimeout(() => {
        if (previousState === 'disconnected') {
            meetingStatus.innerHTML = 'Reconnecting ...';
        }
    }, 1000);
}

// Enable toggle button for media switching
function enableToggle() {
    const toggleButton = document.getElementById('toggleButton');
    toggleButton.className = 'callButton';
}

// Logging helpers
function enumerationErrorHandler(error) {
    console.error('Device enumeration error:', error);
}

function getMediaErrorHandler(error) {
    console.error('Media access error:', error);
}

function addSentMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'sentMessageDiv';
    messageDiv.innerHTML = `<div class="sentMessageText"><div class="chatTextDiv"><span class="chatTextDiv">${text}</span></div></div>`;
    const chatContentDiv = document.getElementById('chatContentDiv');
    chatContentDiv.appendChild(messageDiv);
    chatContentDiv.scrollTop = chatContentDiv.scrollHeight;
}
