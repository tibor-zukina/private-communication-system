// Chat UI helpers
function addSentMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'sentMessageDiv';
    messageDiv.innerHTML = `<div class="sentMessageText"><div class="chatTextDiv"><span class="chatTextDiv">${text}</span></div></div>`;
    const chatContentDiv = document.getElementById('chatContentDiv');
    chatContentDiv.appendChild(messageDiv);
    chatContentDiv.scrollTop = chatContentDiv.scrollHeight;
}

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
