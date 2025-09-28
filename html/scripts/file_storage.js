class FileStorageManager {
    constructor() {
        this.apiBaseUrl = '/api/file-storage.php';
        this.currentUserId = this.generateUserId();
        this.keyPair = null;
        this.publicKeys = {}; // Store other users' public keys
    }

    generateUserId() {
        const characters = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 24; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    async generateKeyPair() {
        if (this.keyPair) return this.keyPair;
        
        this.keyPair = await window.crypto.subtle.generateKey(
            {
                name: 'RSA-OAEP',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            },
            true,
            ['encrypt', 'decrypt']
        );
        
        return this.keyPair;
    }

    async exportPublicKey() {
        if (!this.keyPair) await this.generateKeyPair();
        const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', this.keyPair.publicKey);
        return Array.from(new Uint8Array(publicKeyBuffer));
    }

    async importPublicKey(publicKeyArray) {
        const publicKeyBuffer = new Uint8Array(publicKeyArray).buffer;
        return await window.crypto.subtle.importKey(
            'spki',
            publicKeyBuffer,
            {
                name: 'RSA-OAEP',
                hash: 'SHA-256'
            },
            true,
            ['encrypt']
        );
    }

    async encryptFile(file, recipientPublicKey) {
        // Generate AES key for file encryption (hybrid approach)
        const aesKey = await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        // Export AES key
        const aesKeyBuffer = await window.crypto.subtle.exportKey('raw', aesKey);
        
        // Encrypt AES key with recipient's RSA public key
        const encryptedAesKey = await window.crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            recipientPublicKey,
            aesKeyBuffer
        );

        // Encrypt file with AES key
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const fileBuffer = await file.arrayBuffer();
        const encryptedFile = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            fileBuffer
        );

        // Combine encrypted AES key, IV, and encrypted file
        const result = {
            encryptedAesKey: Array.from(new Uint8Array(encryptedAesKey)),
            iv: Array.from(iv),
            encryptedFile: new Uint8Array(encryptedFile)
        };

        return new Blob([JSON.stringify({
            encryptedAesKey: result.encryptedAesKey,
            iv: result.iv,
            encryptedFile: Array.from(result.encryptedFile)
        })], { type: 'application/json' });
    }

    async decryptFile(encryptedBlob) {
        if (!this.keyPair) throw new Error('No private key available');

        const encryptedData = JSON.parse(await encryptedBlob.text());
        
        // Decrypt AES key with private RSA key
        const encryptedAesKeyBuffer = new Uint8Array(encryptedData.encryptedAesKey).buffer;
        const aesKeyBuffer = await window.crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            this.keyPair.privateKey,
            encryptedAesKeyBuffer
        );

        // Import AES key
        const aesKey = await window.crypto.subtle.importKey(
            'raw',
            aesKeyBuffer,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        // Decrypt file with AES key
        const iv = new Uint8Array(encryptedData.iv);
        const encryptedFileBuffer = new Uint8Array(encryptedData.encryptedFile).buffer;
        
        const decryptedFile = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            encryptedFileBuffer
        );

        return new Blob([decryptedFile]);
    }

    async uploadFile(file, recipientId, recipientPublicKey) {
        try {
            const encryptedFile = await this.encryptFile(file, recipientPublicKey);
            const formData = new FormData();
            formData.append('file', encryptedFile, file.name);
            formData.append('recipient_id', recipientId);
            formData.append('sender_id', this.currentUserId);

            const response = await fetch(`${this.apiBaseUrl}?action=upload`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            return result;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    async listFiles(userId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}?action=list&user_id=${encodeURIComponent(userId)}`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to list files');
            }

            return result.files;
        } catch (error) {
            console.error('List files error:', error);
            throw error;
        }
    }

    async downloadFile(userId, fileId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}?action=download&user_id=${encodeURIComponent(userId)}&file_id=${encodeURIComponent(fileId)}`);
            
            if (!response.ok) {
                throw new Error('Download failed');
            }

            const encryptedBlob = await response.blob();
            return await this.decryptFile(encryptedBlob);
        } catch (error) {
            console.error('Download error:', error);
            throw error;
        }
    }

    showUploadDialog() {
        this.createUploadModal();
    }

    showDownloadDialog() {
        this.createDownloadModal();
    }

    createUploadModal() {
        const modal = document.createElement('div');
        modal.className = 'file-storage-modal';
        modal.innerHTML = `
            <div class="file-storage-modal-content">
                <h3>Upload Files</h3>
                <div class="upload-form">
                    <label>Recipient User ID (24 characters):</label>
                    <input type="text" id="recipientUserId" maxlength="24" placeholder="Enter recipient's user ID">
                    
                    <label>Recipient's Public Key:</label>
                    <textarea id="recipientPublicKey" rows="4" placeholder="Paste recipient's public key here..."></textarea>
                    
                    <label>Select Files:</label>
                    <input type="file" id="fileStorageInput" multiple>
                    
                    <div id="selectedFilesList"></div>
                    
                    <div class="upload-progress" id="uploadProgress" style="display:none;">
                        <div class="progress-bar">
                            <div id="uploadProgressBar"></div>
                        </div>
                        <span id="uploadProgressText">0%</span>
                    </div>
                    
                    <div class="modal-buttons">
                        <button id="uploadFilesBtn" class="callButton">Upload Files</button>
                        <button id="cancelUploadBtn" class="callButton" style="background:#515151;">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupUploadModalEvents(modal);
    }

    setupUploadModalEvents(modal) {
        const fileInput = modal.querySelector('#fileStorageInput');
        const filesList = modal.querySelector('#selectedFilesList');
        const uploadBtn = modal.querySelector('#uploadFilesBtn');
        const cancelBtn = modal.querySelector('#cancelUploadBtn');

        fileInput.addEventListener('change', () => {
            this.displaySelectedFiles(fileInput.files, filesList);
        });

        uploadBtn.addEventListener('click', async () => {
            await this.handleFileUpload(modal);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    displaySelectedFiles(files, container) {
        container.innerHTML = '';
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileDiv = document.createElement('div');
            fileDiv.className = 'selected-file';
            fileDiv.innerHTML = `<span>${file.name} (${Math.round(file.size/1024)} KB)</span>`;
            container.appendChild(fileDiv);
        }
    }

    async handleFileUpload(modal) {
        const recipientId = modal.querySelector('#recipientUserId').value.trim();
        const publicKeyText = modal.querySelector('#recipientPublicKey').value.trim();
        const fileInput = modal.querySelector('#fileStorageInput');
        const progressDiv = modal.querySelector('#uploadProgress');
        const progressBar = modal.querySelector('#uploadProgressBar');
        const progressText = modal.querySelector('#uploadProgressText');

        if (!recipientId || !publicKeyText || fileInput.files.length === 0) {
            alert('Please fill all fields and select at least one file');
            return;
        }

        if (!/^[A-Za-z0-9]{24}$/.test(recipientId)) {
            alert('Recipient ID must be exactly 24 alphanumeric characters');
            return;
        }

        try {
            // Parse and import recipient's public key
            const publicKeyArray = JSON.parse(publicKeyText);
            const recipientPublicKey = await this.importPublicKey(publicKeyArray);
            
            // Store for future use
            this.publicKeys[recipientId] = recipientPublicKey;

            progressDiv.style.display = 'block';
            const files = Array.from(fileInput.files);
            let completed = 0;

            for (const file of files) {
                await this.uploadFile(file, recipientId, recipientPublicKey);
                completed++;
                const percent = Math.round((completed / files.length) * 100);
                progressBar.style.width = percent + '%';
                progressText.textContent = `${percent}% (${completed}/${files.length})`;
            }

            alert('All files uploaded successfully!');
            document.body.removeChild(modal);
        } catch (error) {
            alert('Upload failed: ' + error.message);
        }
    }

    createDownloadModal() {
        const modal = document.createElement('div');
        modal.className = 'file-storage-modal';
        modal.innerHTML = `
            <div class="file-storage-modal-content">
                <h3>Download Files</h3>
                <div class="download-form">
                    <label>Your User ID:</label>
                    <input type="text" id="downloadUserId" value="${this.currentUserId}" readonly>
                    <button id="copyUserIdBtn" class="callButton" style="margin-left:8px;">Copy</button>
                    
                    <label>Your Public Key (share this with senders):</label>
                    <textarea id="publicKeyDisplay" rows="4" readonly></textarea>
                    <button id="copyPublicKeyBtn" class="callButton" style="margin-left:8px;">Copy Public Key</button>
                    
                    <button id="generateKeysBtn" class="callButton">Generate Key Pair</button>
                    <button id="listFilesBtn" class="callButton">List Available Files</button>
                    
                    <div id="filesList"></div>
                    
                    <div class="modal-buttons">
                        <button id="cancelDownloadBtn" class="callButton" style="background:#515151;">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupDownloadModalEvents(modal);
    }

    setupDownloadModalEvents(modal) {
        const generateBtn = modal.querySelector('#generateKeysBtn');
        const listBtn = modal.querySelector('#listFilesBtn');
        const cancelBtn = modal.querySelector('#cancelDownloadBtn');
        const copyUserIdBtn = modal.querySelector('#copyUserIdBtn');
        const copyPublicKeyBtn = modal.querySelector('#copyPublicKeyBtn');
        const publicKeyDisplay = modal.querySelector('#publicKeyDisplay');

        generateBtn.addEventListener('click', async () => {
            await this.generateKeyPair();
            const publicKeyArray = await this.exportPublicKey();
            publicKeyDisplay.value = JSON.stringify(publicKeyArray);
            generateBtn.textContent = 'Keys Generated!';
            generateBtn.disabled = true;
            setTimeout(() => {
                generateBtn.textContent = 'Generate Key Pair';
                generateBtn.disabled = false;
            }, 2000);
        });

        copyUserIdBtn.addEventListener('click', () => {
            const userIdInput = modal.querySelector('#downloadUserId');
            navigator.clipboard.writeText(userIdInput.value).then(() => {
                copyUserIdBtn.textContent = 'Copied!';
                setTimeout(() => copyUserIdBtn.textContent = 'Copy', 1200);
            });
        });

        copyPublicKeyBtn.addEventListener('click', () => {
            if (publicKeyDisplay.value) {
                navigator.clipboard.writeText(publicKeyDisplay.value).then(() => {
                    copyPublicKeyBtn.textContent = 'Copied!';
                    setTimeout(() => copyPublicKeyBtn.textContent = 'Copy Public Key', 1200);
                });
            }
        });

        listBtn.addEventListener('click', async () => {
            await this.handleListFiles(modal);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    async handleListFiles(modal) {
        const userId = modal.querySelector('#downloadUserId').value;
        const filesList = modal.querySelector('#filesList');

        if (!this.keyPair) {
            alert('Please generate your key pair first');
            return;
        }

        try {
            const files = await this.listFiles(userId);
            this.displayFilesList(files, filesList, userId);
        } catch (error) {
            alert('Failed to list files: ' + error.message);
        }
    }

    displayFilesList(files, container, userId) {
        container.innerHTML = '';
        
        if (files.length === 0) {
            container.innerHTML = '<p>No files available for download</p>';
            return;
        }

        files.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'download-file-item';
            const date = new Date(file.timestamp * 1000).toLocaleDateString();
            
            fileDiv.innerHTML = `
                <div class="file-info">
                    <strong>${file.original_name}</strong><br>
                    <small>From: ${file.sender_id} | ${Math.round(file.size/1024)} KB | ${date}</small>
                </div>
                <button class="download-btn callButton" data-file-id="${file.file_id}" data-filename="${file.original_name}">
                    Download
                </button>
            `;
            
            container.appendChild(fileDiv);
        });

        // Add download event listeners
        container.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const fileId = e.target.getAttribute('data-file-id');
                const filename = e.target.getAttribute('data-filename');
                await this.handleFileDownload(userId, fileId, filename, e.target);
            });
        });
    }

    async handleFileDownload(userId, fileId, filename, button) {
        const originalText = button.textContent;
        button.textContent = 'Downloading...';
        button.disabled = true;

        try {
            const decryptedBlob = await this.downloadFile(userId, fileId);
            
            // Create download link
            const url = URL.createObjectURL(decryptedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            button.textContent = 'Downloaded';
            setTimeout(() => {
                button.style.display = 'none';
            }, 1000);
        } catch (error) {
            alert('Download failed: ' + error.message);
            button.textContent = originalText;
            button.disabled = false;
        }
    }
}

// Initialize file storage manager
const fileStorageManager = new FileStorageManager();

// Expose functions to window
window.showFileUploadDialog = () => fileStorageManager.showUploadDialog();
window.showFileDownloadDialog = () => fileStorageManager.showDownloadDialog();