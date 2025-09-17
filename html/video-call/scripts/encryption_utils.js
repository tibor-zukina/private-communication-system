// Encryption helpers for AES-GCM

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

async function encryptMessage(message, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(message)
    );
    return { iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)) };
}

async function decryptMessage(ivArr, encryptedArr, key) {
    const iv = new Uint8Array(ivArr);
    const encrypted = new Uint8Array(encryptedArr);
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encrypted
    );
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

const FILE_CHUNK_SIZE = 4096; // 4KB

async function encryptAndChunkFile(file, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const fileBuffer = await file.arrayBuffer();
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        fileBuffer
    );
    const encryptedArr = new Uint8Array(encrypted);
    const totalChunks = Math.ceil(encryptedArr.length / FILE_CHUNK_SIZE);

    return {
        iv: Array.from(iv),
        encryptedArr,
        totalChunks,
        name: file.name,
        mime: file.type
    };
}

async function combineAndDecryptFileChunks(chunks, iv, key, mime) {
    const encryptedArr = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        encryptedArr.set(chunk, offset);
        offset += chunk.length;
    }
    
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(iv) },
        key,
        encryptedArr
    );
    return new Blob([decrypted], { type: mime });
}

// Expose to window
window.FILE_CHUNK_SIZE = FILE_CHUNK_SIZE;
window.encryptMessage = encryptMessage;
window.decryptMessage = decryptMessage;
window.encryptAndChunkFile = encryptAndChunkFile;
window.combineAndDecryptFileChunks = combineAndDecryptFileChunks;
