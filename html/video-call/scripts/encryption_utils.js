// Encryption helpers for AES-GCM

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

async function encryptFile(file, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const fileBuffer = await file.arrayBuffer();
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        fileBuffer
    );
    return { iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)), name: file.name, mime: file.type };
}

async function decryptFile(ivArr, encryptedArr, key, mime, name) {
    const iv = new Uint8Array(ivArr);
    const encrypted = new Uint8Array(encryptedArr);
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encrypted
    );
    const blob = new Blob([decrypted], { type: mime });
    return { blob, name, mime };
}
