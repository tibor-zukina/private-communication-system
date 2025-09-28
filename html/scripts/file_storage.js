class FileStorageManager {
    constructor() {
        this.apiBaseUrl = '/api/file-storage.php';
        this.userKeys = {}; // Store encryption keys per user ID
        this.currentUserId = this.generateUserId();
    }

    generateUserId() {
        const characters = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 24; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    async deriveKeyFromPassword(password) {
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        const salt = new Uint8Array(16); // Fixed salt for same password = same key
        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async encryptFile(file, password) {
        const key = await this.deriveKeyFromPassword(password);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const fileBuffer = await file.arrayBuffer();
        
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            fileBuffer
        );

        // Combine IV and encrypted data
        const result = new Uint8Array(iv.length + encrypted.byteLength);
        result.set(iv, 0);
        result.set(new Uint8Array(encrypted), iv.length);
        
        return new Blob([result], { type: 'application/octet-stream' });
    }

    async decryptFile(encryptedBlob, password) {
        const key = await this.deriveKeyFromPassword(password);
        const buffer = await encryptedBlob.arrayBuffer();
        const dataArray = new Uint8Array(buffer);
        
        const iv = dataArray.slice(0, 12);
        const encrypted = dataArray.slice(12);

        try {
            const decrypted = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                encrypted
            );
            return new Blob([decrypted]);
        } catch (error) {
            throw new Error('Invalid password or corrupted file');
        }
    }

    async uploadFile(file, recipientId, password) {
        try {
            const encryptedFile = await this.encryptFile(file, password);
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

    async downloadFile(userId, fileId, password) {
        try {
            const response = await fetch(`${this.apiBaseUrl}?action=download&user_id=${encodeURIComponent(userId)}&file_id=${encodeURIComponent(fileId)}`);
            
            if (!response.ok) {
                throw new Error('Download failed');
            }

            const encryptedBlob = await response.blob();
            return await this.decryptFile(encryptedBlob, password);
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
                    
                    <label>Encryption Password:</label>
                    <input type="password" id="encryptionPassword" placeholder="Enter password">
                    
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
        const password = modal.querySelector('#encryptionPassword').value;
        const fileInput = modal.querySelector('#fileStorageInput');
        const progressDiv = modal.querySelector('#uploadProgress');
        const progressBar = modal.querySelector('#uploadProgressBar');
        const progressText = modal.querySelector('#uploadProgressText');

        if (!recipientId || !password || fileInput.files.length === 0) {
            alert('Please fill all fields and select at least one file');
            return;
        }

        if (!/^[A-Za-z0-9]{24}$/.test(recipientId)) {
            alert('Recipient ID must be exactly 24 alphanumeric characters');
            return;
        }

        // Store password for this user
        this.userKeys[recipientId] = password;

        progressDiv.style.display = 'block';
        const files = Array.from(fileInput.files);
        let completed = 0;

        try {
            for (const file of files) {
                await this.uploadFile(file, recipientId, password);
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
                    
                    <label>Decryption Password:</label>
                    <input type="password" id="decryptionPassword" placeholder="Enter password">
                    
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
        const listBtn = modal.querySelector('#listFilesBtn');
        const cancelBtn = modal.querySelector('#cancelDownloadBtn');
        const copyBtn = modal.querySelector('#copyUserIdBtn');

        copyBtn.addEventListener('click', () => {
            const userIdInput = modal.querySelector('#downloadUserId');
            navigator.clipboard.writeText(userIdInput.value).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => copyBtn.textContent = 'Copy', 1200);
            });
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
        const password = modal.querySelector('#decryptionPassword').value;
        const filesList = modal.querySelector('#filesList');

        if (!password) {
            alert('Please enter decryption password');
            return;
        }

        try {
            const files = await this.listFiles(userId);
            this.displayFilesList(files, filesList, userId, password);
        } catch (error) {
            alert('Failed to list files: ' + error.message);
        }
    }

    displayFilesList(files, container, userId, password) {
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
                await this.handleFileDownload(userId, fileId, filename, password, e.target);
            });
        });
    }

    async handleFileDownload(userId, fileId, filename, password, button) {
        const originalText = button.textContent;
        button.textContent = 'Downloading...';
        button.disabled = true;

        try {
            const decryptedBlob = await this.downloadFile(userId, fileId, password);
            
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