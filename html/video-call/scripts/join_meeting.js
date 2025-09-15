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
let meetingLocalStream;
let meetingKey; // CryptoKey for AES-GCM
let meetingKeyRaw; // ArrayBuffer for export/import

// Buffer for messages/files received before key is ready
let pendingEncryptedMessages = [];

const FILE_CHUNK_SIZE = 4096; // 4KB
let outgoingFileId = 0;
let incomingFiles = {};

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
let selectedFile = null;
let uploadInProgress = false;

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

    // File selection preview logic
    document.getElementById('fileInput').onchange = (e) => {
        if (!chatActive || !meetingKey) return;
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
    let progressBar = `<div id="fileUploadProgress" style="margin-top:8px;display:none;">
        <div style="background:#515151;border-radius:8px;width:80%;height:12px;position:relative;">
            <div id="fileUploadProgressBar" style="background:#ed62b5;height:12px;width:0%;border-radius:8px;"></div>
        </div>
        <span id="fileUploadProgressText" style="color:#bfbfbf;font-size:0.9em;"></span>
    </div>`;
    previewDiv.innerHTML = fileInfo + sendBtn + cancelBtn + progressBar;

    document.getElementById('sendFileBtn').onclick = async () => {
        uploadInProgress = true;
        document.getElementById('fileUploadProgress').style.display = 'block';
        await sendFile(selectedFile);
        clearFilePreview();
        uploadInProgress = false;
    };
    document.getElementById('cancelFileBtn').onclick = () => {
        if (uploadInProgress) return; // Prevent cancel during upload
        clearFilePreview();
    };
}

function updateFileUploadProgress(current, total) {
    const sentKB = Math.round(current * FILE_CHUNK_SIZE / 1024);
    const totalKB = Math.round(total * FILE_CHUNK_SIZE / 1024);
    const percent = Math.floor((current / total) * 100);
    const bar = document.getElementById('fileUploadProgressBar');
    const text = document.getElementById('fileUploadProgressText');
    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = `Uploading... ${percent}% (${sentKB} KB / ${totalKB} KB)`;
}

// Encrypt and send chat message
async function sendMessage() {
    if (!chatActive || !meetingKey) return;

    const messageInput = document.getElementById('message');
    const messageText = messageInput.value.trim();
    messageInput.value = '';

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

// Generate AES-GCM key on join
async function generateMeetingKey() {
    meetingKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    meetingKeyRaw = await window.crypto.subtle.exportKey("raw", meetingKey);
}

// Send key to peer via chatConn
function sendMeetingKey() {
    if (chatConn && meetingKeyRaw) {
        chatConn.send({ type: "meeting-key", key: Array.from(new Uint8Array(meetingKeyRaw)) });
    }
}

// Open or reopen chat connection
function openChatConnection(meetingId) {
    if (chatConn) chatConn.close();
    chatConn = peer.connect(meetingId);

    chatConn.on('open', async () => {
        chatActive = true;
        chatConn.on('data', handleChatData);
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
        await generateMeetingKey();
        sendMeetingKey();
        // addFileInput(); // Removed as per change
    });
}

// Handle incoming chat data (for file and key)
async function handleChatData(data) {
    if (typeof data === "object" && data.type === "meeting-key") {
        // Key handling is now done on the joiner side
    } else if ((typeof data === "object" && (data.type === "file" || data.type === "chat"))) {
        if (!meetingKey) {
            // Buffer until key is ready
            pendingEncryptedMessages.push(data);
            return;
        }
        if (data.type === "file") {
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
        } else if (data.type === "chat") {
            const iv = new Uint8Array(data.iv);
            const encrypted = new Uint8Array(data.encrypted);
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                meetingKey,
                encrypted
            );
            const decoder = new TextDecoder();
            addReceivedMessage(decoder.decode(decrypted));
        }
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
    if (!meetingKey) {
        addSentMessage("No key yet, can't send file.");
        return;
    }
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
        if (!uploadInProgress) break; // If cancelled, stop sending
        const chunk = encryptedArr.slice(i * FILE_CHUNK_SIZE, (i + 1) * FILE_CHUNK_SIZE);
        chatConn.send({
            type: "file-chunk",
            fileId,
            name: file.name,
            mime: file.type,
            chunkIndex: i,
            totalChunks,
            iv: Array.from(iv),
            data: Array.from(chunk)
        });
        updateFileUploadProgress(i + 1, totalChunks);
        await new Promise(r => setTimeout(r, 0));
    }
    if (uploadInProgress) {
        chatConn.send({
            type: "file-done",
            fileId,
            name: file.name,
            mime: file.type,
            totalChunks,
            iv: Array.from(iv)
        });
        // Show sent file as a download link in the chat (local, unencrypted)
        const sentBlob = new Blob([fileBuffer], { type: file.type });
        const sentUrl = URL.createObjectURL(sentBlob);
        addSentMessage(`<a href="${sentUrl}" download="${file.name}" class="chatFileLink">Attachment: ${file.name}</a>`);
    }
}

function clearFilePreview() {
    selectedFile = null;
    uploadInProgress = false;
    document.getElementById('filePreviewDiv').innerHTML = '';
    document.getElementById('fileInput').value = '';
}

// Encrypt and send chat message
async function sendMessage() {
    if (!chatActive || !meetingKey) return;

    const messageInput = document.getElementById('message');
    const messageText = messageInput.value.trim();
    messageInput.value = '';

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

// Generate AES-GCM key on join
async function generateMeetingKey() {
    meetingKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    meetingKeyRaw = await window.crypto.subtle.exportKey("raw", meetingKey);
}

// Send key to peer via chatConn
function sendMeetingKey() {
    if (chatConn && meetingKeyRaw) {
        chatConn.send({ type: "meeting-key", key: Array.from(new Uint8Array(meetingKeyRaw)) });
    }
}

// Open or reopen chat connection
function openChatConnection(meetingId) {
    if (chatConn) chatConn.close();
    chatConn = peer.connect(meetingId);

    chatConn.on('open', async () => {
        chatActive = true;
        chatConn.on('data', handleChatData);
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
        await generateMeetingKey();
        sendMeetingKey();
        // addFileInput(); // Removed as per change
    });
}

// Handle incoming chat data (for file and key)
async function handleChatData(data) {
    if (typeof data === "object" && data.type === "meeting-key") {
        // Key handling is now done on the joiner side
    } else if ((typeof data === "object" && (data.type === "file" || data.type === "chat"))) {
        if (!meetingKey) {
            // Buffer until key is ready
            pendingEncryptedMessages.push(data);
            return;
        }
        if (data.type === "file") {
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
        } else if (data.type === "chat") {
            const iv = new Uint8Array(data.iv);
            const encrypted = new Uint8Array(data.encrypted);
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                meetingKey,
                encrypted
            );
            const decoder = new TextDecoder();
            addReceivedMessage(decoder.decode(decrypted));
        }
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
    if (!meetingKey) {
        addSentMessage("No key yet, can't send file.");
        return;
    }
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
        if (!uploadInProgress) break; // If cancelled, stop sending
        const chunk = encryptedArr.slice(i * FILE_CHUNK_SIZE, (i + 1) * FILE_CHUNK_SIZE);
        chatConn.send({
            type: "file-chunk",
            fileId,
            name: file.name,
            mime: file.type,
            chunkIndex: i,
            totalChunks,
            iv: Array.from(iv),
            data: Array.from(chunk)
        });
        updateFileUploadProgress(i + 1, totalChunks);
        await new Promise(r => setTimeout(r, 0));
    }
    if (uploadInProgress) {
        chatConn.send({
            type: "file-done",
            fileId,
            name: file.name,
            mime: file.type,
            totalChunks,
            iv: Array.from(iv)
        });
        // Show sent file as a download link in the chat (local, unencrypted)
        const sentBlob = new Blob([fileBuffer], { type: file.type });
        const sentUrl = URL.createObjectURL(sentBlob);
        addSentMessage(`<a href="${sentUrl}" download="${file.name}" class="chatFileLink">Attachment: ${file.name}</a>`);
    }
}

function clearFilePreview() {
    selectedFile = null;
    uploadInProgress = false;
    document.getElementById('filePreviewDiv').innerHTML = '';
    document.getElementById('fileInput').value = '';
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
    meetingLocalStream = makeCallStream(capturedStream);

    // Initialize mute control
    window.initMuteControl(meetingLocalStream);
    const micImg = document.getElementById('micToggle');
    if (micImg) micImg.className = 'micWidget';

    const call = peer.call(meetingId, meetingLocalStream);

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
