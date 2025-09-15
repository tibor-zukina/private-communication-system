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
const FILE_CHUNK_SIZE = 4096; // 4KB
let outgoingFileId = 0;
let incomingFiles = {};

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
    });

    const messageBox = document.getElementById('message');
    messageBox.onkeydown = (e) => {
        if (e.keyCode === 13 && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // File selection preview logic
    document.getElementById('fileInput').onchange = (e) => {
        if (!chatStarted || !meetingKey) return;
        if (e.target.files.length > 0) {
            selectedFile = e.target.files[0];
            showFilePreview(selectedFile);
        }
    };
}

// Show file preview and send/cancel buttons
function showFilePreview(file) {
    const previewDiv = document.getElementById('filePreviewDiv');
    let fileInfo = `<span style="color:#bfbfbf;">Selected file: ${file.name} (${Math.round(file.size/1024)} KB)</span>`;
    let sendBtn = `<button id="sendFileBtn" class="callButton" style="margin-left:8px;">Send</button>`;
    let cancelBtn = `<button id="cancelFileBtn" class="callButton" style="margin-left:8px;background:#515151;">Cancel</button>`;
    previewDiv.innerHTML = fileInfo + sendBtn + cancelBtn;

    document.getElementById('sendFileBtn').onclick = async () => {
        await sendFile(selectedFile);
        clearFilePreview();
    };
    document.getElementById('cancelFileBtn').onclick = () => {
        clearFilePreview();
    };
}

// Clear file preview and reset input
function clearFilePreview() {
    selectedFile = null;
    document.getElementById('filePreviewDiv').innerHTML = '';
    document.getElementById('fileInput').value = '';
}

// Encrypt and send chat message
async function sendMessage() {
    if (!chatStarted || !meetingKey) return;

    const messageBox = document.getElementById('message');
    const messageText = messageBox.value.trim();
    messageBox.value = '';

    // Prevent sending empty message if no file is selected
    if (!messageText && !selectedFile) return;

    if (messageText) {
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

    // If file is selected, send it
    if (selectedFile) {
        await sendFile(selectedFile);
        clearFilePreview();
    }
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
        addReceivedMessage(`<a href="${url}" download="${data.name}" class="chatFileLink">Attachment: ${data.name}</a>`);
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
    } else if (typeof data === "object" && data.type === "file-chunk") {
        const key = data.fileId;
        if (!incomingFiles[key]) {
            incomingFiles[key] = { chunks: [], totalChunks: data.totalChunks, name: data.name, mime: data.mime, iv: data.iv, received: 0 };
        }
        incomingFiles[key].chunks[data.chunkIndex] = new Uint8Array(data.data);
        incomingFiles[key].received++;
    } else if (typeof data === "object" && data.type === "file-done") {
        const key = data.fileId;
        const fileInfo = incomingFiles[key];
        if (fileInfo && fileInfo.received === fileInfo.totalChunks) {
            // Concatenate chunks
            const encryptedArr = new Uint8Array(fileInfo.chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let offset = 0;
            for (const chunk of fileInfo.chunks) {
                encryptedArr.set(chunk, offset);
                offset += chunk.length;
            }
            // Decrypt
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(fileInfo.iv) },
                meetingKey,
                encryptedArr
            );
            const blob = new Blob([decrypted], { type: fileInfo.mime });
            const url = URL.createObjectURL(blob);
            addReceivedMessage(`<a href="${url}" download="${fileInfo.name}" class="chatFileLink">Attachment: ${fileInfo.name}</a>`);
            delete incomingFiles[key];
        }
    } else {
        addReceivedMessage(data);
    }
}

// Encrypt and send file in chunks
async function sendFile(file) {
    if (!chatStarted || !meetingKey) return;
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Generate IV once per file
    const fileBuffer = await file.arrayBuffer();
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        meetingKey,
        fileBuffer
    );
    const encryptedArr = new Uint8Array(encrypted);
    const totalChunks = Math.ceil(encryptedArr.length / FILE_CHUNK_SIZE);
    const fileId = ++outgoingFileId;

    for (let i = 0; i < totalChunks; i++) {
        const chunk = encryptedArr.slice(i * FILE_CHUNK_SIZE, (i + 1) * FILE_CHUNK_SIZE);
        chatConn.send({
            type: "file-chunk",
            fileId,
            name: file.name,
            mime: file.type,
            chunkIndex: i,
            totalChunks,
            iv: Array.from(iv), // Send the same IV for all chunks
            data: Array.from(chunk)
        });
    }
    chatConn.send({
        type: "file-done",
        fileId,
        name: file.name,
        mime: file.type,
        totalChunks,
        iv: Array.from(iv) // Send IV with done message
    });

    // Show sent file as a download link in the chat (local, unencrypted)
    const sentBlob = new Blob([fileBuffer], { type: file.type });
    const sentUrl = URL.createObjectURL(sentBlob);
    addSentMessage(`<a href="${sentUrl}" download="${file.name}" class="chatFileLink">Attachment: ${file.name}</a>`);
}

// Media capture success handler
function getUserMediaSuccess(capturedStream) {
    document.getElementById('meetingStatus').innerHTML = 'Waiting for the other side to join...';

    // Generate invitation URL
    const invitationUrl = `https://${host}/video-call/join-meeting.php?path=${params.get('path')}&key=${params.get('key')}&id=${peerId}`;
    const invitationElem = document.getElementById('invitationUrl');
    invitationElem.innerHTML = `<span id="copyInvitationLink" style="cursor:pointer;text-decoration:underline;">Copy invitation link</span>`;

    document.getElementById('copyInvitationLink').onclick = () => {
        navigator.clipboard.writeText(invitationUrl).then(() => {
            invitationElem.innerHTML = `<span style="color:#ed62b5;">Link copied!</span>`;
            setTimeout(() => {
                invitationElem.innerHTML = `<span id="copyInvitationLink" style="cursor:pointer;text-decoration:underline;">Copy invitation link</span>`;
                document.getElementById('copyInvitationLink').onclick = () => {
                    navigator.clipboard.writeText(invitationUrl).then(() => {
                        invitationElem.innerHTML = `<span style="color:#ed62b5;">Link copied!</span>`;
                        setTimeout(() => {
                            invitationElem.innerHTML = `<span id="copyInvitationLink" style="cursor:pointer;text-decoration:underline;">Copy invitation link</span>`;
                            document.getElementById('copyInvitationLink').onclick = arguments.callee;
                        }, 1200);
                    });
                };
            }, 1200);
        });
    };

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