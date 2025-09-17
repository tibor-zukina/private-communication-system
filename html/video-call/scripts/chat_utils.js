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

// General message sending (no encryption)
function sendFileMessage(chatConn, file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        chatConn.send({
            type: "file",
            name: file.name,
            mime: file.type,
            buffer: Array.from(new Uint8Array(arrayBuffer))
        });
        if (callback) callback();
    };
    reader.readAsArrayBuffer(file);
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
    if (!chatStarted || !meetingKey) return;
    
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
        const localUrl = URL.createObjectURL(new Blob([file], { type: mime }));
        addSentMessage(`<a href="${localUrl}" download="${name}" class="chatFileLink">Attachment: ${name}</a>`);
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