const domainHost = 'communication.perpetuumit.com';
const peerHost = 'chat-communication.perpetuumit.com';

// Shared variables
let peer;
let peerId;
let meetingDeviceIds = [];
let meetingLocalStream;
let chatConn;
let chatStarted = false;
let counterInterval = null;
let startTime = 0;
let previousState = 'not started';
let callPeerConnection;
let outgoingFileId = 0;
let incomingFiles = {};

// Crypto variables
let meetingKey;
let meetingKeyRaw;
let pendingEncryptedMessages = [];

// Mode-specific variables
let isStartMode = false;
let meetingId = null;
let chatActive = false;
let reconnectInterval = null;
let lastCallTime;
let callerPeerId;

let selectedFile = null;
let uploadInProgress = false;

// Utility functions
function makeRandomId(length) {
    const characters = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// PeerJS setup
function setUpPeer(peerServerPath, peerServerKey, isStart = true) {
    isStartMode = isStart;
    peerId = makeRandomId(32);
    
    peer = new Peer(peerId, {
        host: peerHost,
        port: 3728,
        path: peerServerPath,
        key: peerServerKey,
        debug: 3
    });

    peer.on('open', () => {
        const callButton = document.querySelector('.callButton.invisibleButton');
        if (callButton) callButton.className = 'callButton';
    });
    
    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
    });
}

// Meeting start functions
function startMeeting(providedMeetingId = null) {
    meetingId = providedMeetingId;
    const callButton = document.querySelector('.callButton');
    callButton.disabled = true;
    callButton.value = 'Meeting started';
    navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(enumerationErrorHandler);
}

// Chat functionality
function startChat() {
    chatStarted = true;

    if (isStartMode) {
        // Host mode
        peer.on('connection', (conn) => {
            chatConn = conn;
            chatConn.on('data', handleChatData);
            chatConn.on('close', () => {});
        });
    } else {
        // Join mode
        openChatConnection();
    }

    setupChatUI();
}

function setupChatUI() {
    const messageBox = document.getElementById('message');
    messageBox.onkeydown = (e) => {
        if (e.keyCode === 13 && !e.shiftKey) {
            e.preventDefault();
            window.sendMessage();
        }
    };

    document.getElementById('fileInput').onchange = (e) => {
        if ((!chatStarted && !chatActive) || !meetingKey) return;
        if (e.target.files.length > 0) {
            selectedFile = e.target.files[0];
            showFilePreview(selectedFile);
        }
    };
}

// Media handlers
function getUserMediaSuccess(capturedStream) {
    meetingLocalStream = makeCallStream(capturedStream);
    
    // Initialize controls
    window.initMuteControl(meetingLocalStream);
    window.initCameraControl(meetingLocalStream);
    const micImg = document.getElementById('micToggle');
    if (micImg) micImg.className = 'micWidget';
    const camImg = document.getElementById('cameraToggle');
    if (camImg) camImg.className = 'cameraWidget';
    window.updateCameraControlForMode();

    if (isStartMode) {
        handleHostMedia();
    } else {
        handleJoinMedia();
    }
}

function handleHostMedia() {
    document.getElementById('meetingStatus').innerHTML = 'Waiting for the other side to join...';
    setupInvitationLink();

    peer.on('call', (call) => {
        lastCallTime = Date.now();
        call.timeStarted = lastCallTime;
        callerPeerId = call.peer;
        call.answer(meetingLocalStream);

        setupCallHandlers(call);
    });
}

function handleJoinMedia() {
    const call = peer.call(meetingId, meetingLocalStream);
    setupCallHandlers(call);
}

function setupCallHandlers(call) {
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
            if (!isStartMode || (call.timeStarted === lastCallTime)) {
                connectionLost();
            }
        } else if (state === 'connected') {
            if (!chatStarted) startChat();
            startCounter();
        }
        
        previousState = state;
    };
}

function generateMeetingLink(meetingId, path, key) {
    const currentUrl = window.location.href.split('?')[0];  // Remove any existing parameters
    return `${currentUrl}?path=${encodeURIComponent(path)}&key=${encodeURIComponent(key)}&id=${encodeURIComponent(meetingId)}`;
}

function setupInvitationLink() {
    const invitationElem = document.getElementById('invitationUrl');
    const path = localStorage.getItem('peerPath');
    const key = localStorage.getItem('peerKey');
    
    invitationElem.innerHTML = `
        <span id="copyMeetingId">Copy meeting ID</span>
        <span id="copyMeetingLink">Copy meeting link</span>
    `;

    document.getElementById('copyMeetingId').onclick = () => {
        navigator.clipboard.writeText(peerId).then(() => {
            invitationElem.innerHTML = `<span id="meetingIDCopied">Meeting ID copied!</span>`;
            setTimeout(() => setupInvitationLink(), 1200);
        });
    };

    document.getElementById('copyMeetingLink').onclick = () => {
        const meetingLink = generateMeetingLink(peerId, path, key);
        navigator.clipboard.writeText(meetingLink).then(() => {
            invitationElem.innerHTML = `<span id="meetingLinkCopied">Meeting link copied!</span>`;
            setTimeout(() => setupInvitationLink(), 1200);
        });
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


// Export needed functions for video_utils.js
window.setUpPeer = setUpPeer;
window.startMeeting = startMeeting;
