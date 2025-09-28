// Join-specific chat connection
function openChatConnection() {
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
                    openChatConnection();
                }
            }, 5000);
        });
        await generateMeetingKey();
        sendMeetingKey();
    });
}


// Encrypt and send chat message
async function sendMessage() {
    if ((!chatStarted && !chatActive) || !meetingKey) return;

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

// Handle incoming chat data (for file and key)
async function handleChatData(data) {
    if (typeof data === "object" && data.type === "meeting-key") {
        // Key handling is now done on the joiner side
        await importMeetingKey(data.key);
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
            await displayFileMessage(blob, data.name, data.mime, false);
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
            await displayFileMessage(blob, fileInfo.name, fileInfo.mime, false);
            delete incomingFiles[key];
        }
    } else {
        addReceivedMessage(data);
    }
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

// Display received message

function addReceivedMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'receivedMessageDiv';
    messageDiv.innerHTML = `<div class="receivedMessageText"><div class="chatTextDiv"><span class="chatTextDiv">${text}</span></div></div>`;
    const chatContentDiv = document.getElementById('chatContentDiv');
    chatContentDiv.appendChild(messageDiv);
    chatContentDiv.scrollTop = chatContentDiv.scrollHeight;
}

// General chat message sending (no encryption)
function sendChatMessage(chatConn, text) {
    chatConn.send({
        type: "chat",
        text: text
    });
    addSentMessage(text);
}

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

function clearFilePreview() {
    selectedFile = null;
    uploadInProgress = false;
    document.getElementById('filePreviewDiv').innerHTML = '';
    document.getElementById('fileInput').value = '';
}

// Encrypt and send file in chunks
async function sendFile(file) {
    if ((!chatStarted && !chatActive) || !meetingKey) return;
    
    const { iv, encryptedArr, totalChunks, name, mime } = await window.encryptAndChunkFile(file, meetingKey);
    const fileId = ++outgoingFileId;

    for (let i = 0; i < totalChunks; i++) {
        if (!uploadInProgress) break;
        const chunk = encryptedArr.slice(i * FILE_CHUNK_SIZE, (i + 1) * FILE_CHUNK_SIZE);
        chatConn.send({
            type: "file-chunk",
            fileId,
            name,
            mime,
            chunkIndex: i,
            totalChunks,
            iv,
            data: Array.from(chunk)
        });
        updateFileUploadProgress(i + 1, totalChunks);
        await new Promise(r => setTimeout(r, 0));
    }

    if (uploadInProgress) {
        chatConn.send({
            type: "file-done",
            fileId,
            name,
            mime,
            totalChunks,
            iv
        });
        await displayFileMessage(file, name, mime, true);
    }
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

function isImageFile(mimeType) {
    return mimeType.startsWith('image/');
}

async function displayFileMessage(blob, fileName, mimeType, isSent = false) {
    const url = URL.createObjectURL(blob);
    let messageContent = '';
    
    if (isImageFile(mimeType)) {
        // Show image preview
        messageContent = `
            <div class="chatImagePreview">
                <img src="${url}" alt="${fileName}" style="max-width:200px; border-radius:8px;"/>
                <br>
                <a href="${url}" download="${fileName}" class="chatFileLink" style="font-size:0.8em;">Download ${fileName}</a>
            </div>`;
    } else {
        // Regular file download link
        messageContent = `<a href="${url}" download="${fileName}" class="chatFileLink">Attachment: ${fileName}</a>`;
    }

    if (isSent) {
        addSentMessage(messageContent);
    } else {
        addReceivedMessage(messageContent);
    }
}