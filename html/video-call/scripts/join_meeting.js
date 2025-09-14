const host = '64.176.216.148';
let meetingDeviceIds = [];
let meetingId;
let chatConn = null;
let chatStarted = false;
let chatActive = false;
let counterInterval = null;
let reconnectInterval = null;
let startTime = 0;
let previousState = 'not started';
let callPeerConnection;
let peer;
let localStream;

// Utility: Random Peer ID
function makeRandomId(length) {
    const characters = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Setup PeerJS instance
function setUpPeer(peerServerPath, peerServerKey) {
    peer = new Peer(makeRandomId(32), {
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

// Init from URL params
const params = new URLSearchParams(window.location.search);
setUpPeer(params.get('path'), params.get('key'));

// Join meeting flow
function joinMeeting() {
    const callButton = document.querySelector('.callButton');
    callButton.disabled = true;
    callButton.value = 'Meeting started';
    meetingId = document.getElementById('meetingId').value;
    navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(enumerationErrorHandler);
}

// Start peer data channel chat
function startChat(meetingId) {
    chatStarted = true;
    openChatConnection(meetingId);

    const messageInput = document.getElementById('message');
    messageInput.onkeydown = (e) => {
        if (e.keyCode === 13 && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };
}

// Open or reopen chat connection
function openChatConnection(meetingId) {
    if (chatConn) chatConn.close();
    chatConn = peer.connect(meetingId);

    chatConn.on('open', () => {
        chatActive = true;
        chatConn.on('data', addReceivedMessage);
        chatConn.on('close', () => {
            chatActive = false;
            reconnectInterval = setInterval(() => {
                if (chatActive) {
                    clearInterval(reconnectInterval);
                } else {
                    openChatConnection(meetingId);
                }
            }, 5000);
        });
    });
}

// Send chat message
function sendMessage() {
    if (!chatActive) return;

    const messageInput = document.getElementById('message');
    const messageText = messageInput.value;
    messageInput.value = '';
    addSentMessage(messageText);
    chatConn.send(messageText);
}

// Display received message
function addReceivedMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'receivedMessageDiv';
    messageDiv.innerHTML = `<div class="receivedMessageText"><div class="chatTextDiv"><span class="chatTextDiv">${text}</span></div></div>`;
    const chatContentDiv = document.getElementById('chatContentDiv');
    chatContentDiv.appendChild(messageDiv);
    chatContentDiv.scrollTop = chatContentDiv.scrollHeight;
}

// Display sent message
function addSentMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'sentMessageDiv';
    messageDiv.innerHTML = `<div class="sentMessageText"><div class="chatTextDiv"><span class="chatTextDiv">${text}</span></div></div>`;
    const chatContentDiv = document.getElementById('chatContentDiv');
    chatContentDiv.appendChild(messageDiv);
    chatContentDiv.scrollTop = chatContentDiv.scrollHeight;
}

// Handle success from getUserMedia
function getUserMediaSuccess(capturedStream) {
    localStream = makeCallStream(capturedStream);
    const call = peer.call(meetingId, localStream);

    call.on('stream', (remoteStream) => {
        callPeerConnection = call.peerConnection;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = remoteStream;
        enableFullscreen(localVideo);
        enableToggle();
        startCounter();
    });

    call.peerConnection.oniceconnectionstatechange = () => {
        const state = call.peerConnection.iceConnectionState;
        if (state === 'disconnected') {
            connectionLost();
        } else if (state === 'connected') {
            if (!chatStarted) startChat(meetingId);
            startCounter();
        }
        previousState = state;
    };
}

// Counter start (duration timer)
function startCounter() {
    const meetingStatus = document.getElementById('meetingStatus');
    if (startTime === 0) startTime = Date.now();

    const updateTimer = () => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        setTimer(seconds, meetingStatus);
    };

    updateTimer();
    if (counterInterval) clearInterval(counterInterval);
    counterInterval = setInterval(updateTimer, 1000);
}

// Timer formatting
function setTimer(seconds, element) {
    const s = String(seconds % 60).padStart(2, '0');
    const m = String(Math.floor(seconds / 60) % 60).padStart(2, '0');
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    element.innerHTML = `${h}:${m}:${s}`;
}

// Device enumeration handler
function gotDevices(deviceInfos) {
    meetingDeviceIds = deviceInfos
        .filter(info => info.kind === 'videoinput')
        .map(info => info.deviceId);

    if (meetingDeviceIds.length > 0) {
        getVideo(false);
    }
}

// Error handlers
function enumerationErrorHandler(error) {
    console.error('Device enumeration error:', error);
}

function getMediaErrorHandler(error) {
    console.error('Failed to get local stream:', error);
}

// Connection lost handling
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

// Toggle button visibility
function enableToggle() {
    const toggleButton = document.getElementById('toggleButton');
    toggleButton.className = 'callButton';
}
