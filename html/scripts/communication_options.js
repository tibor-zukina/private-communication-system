// Add URL parameter parsing at the top
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        key: params.get('key'),
        path: params.get('path'),
        turnUser: params.get('turnUser'),
        turnPassword: params.get('turnPassword'),
        id: params.get('id')
    };
}

function createCredentialsPrompt() {
    // Check URL parameters first
    const urlParams = getUrlParams();
    
    if (urlParams.key && urlParams.path && urlParams.turnUser && urlParams.turnPassword) {
        // Store credentials from URL
        localStorage.setItem('peerPath', urlParams.path);
        localStorage.setItem('peerKey', urlParams.key);
        localStorage.setItem('turnUser', urlParams.turnUser);
        localStorage.setItem('turnPassword', urlParams.turnPassword);
        
        if (urlParams.id) {
            // Auto-join with provided ID
            setUpPeer(urlParams.path, urlParams.key, urlParams.turnUser, urlParams.turnPassword, false);
            startMeeting(urlParams.id);
            return;
        } else {
            // Auto-start new meeting
            setUpPeer(urlParams.path, urlParams.key, urlParams.turnUser, urlParams.turnPassword, true);
            startMeeting();
            return;
        }
    }
    
    // Show initial mode selection
    showModeSelection();
}

function showModeSelection() {
    if (document.getElementById('modeSelectionOverlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'modeSelectionOverlay';
    overlay.className = 'credentials-overlay';
    
    overlay.innerHTML = `
        <div class="credentials-prompt">
            <h3>Private Communication System</h3>
            <p style="color: #bfbfbf; margin-bottom: 20px;">Choose your desired action:</p>
            
            <button class="callButton" onclick="selectMode('meeting')" style="width: 100%; margin: 10px 0;">
                📹 Start/Join Video Meeting
            </button>
            
            <button class="callButton" onclick="selectMode('files')" style="width: 100%; margin: 10px 0;">
                📁 Upload/Send Files
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function selectMode(mode) {
    const overlay = document.getElementById('modeSelectionOverlay');
    if (overlay) overlay.remove();
    
    if (mode === 'meeting') {
        showMeetingCredentials();
    } else if (mode === 'files') {
        showFileStorageOptions();
    }
}

function showMeetingCredentials() {
    if (document.getElementById('credentialsOverlay')) return;
    
    const hasCredentials = localStorage.getItem('peerPath') && localStorage.getItem('peerKey') && 
                          localStorage.getItem('turnUser') && localStorage.getItem('turnPassword');
    
    const overlay = document.createElement('div');
    overlay.id = 'credentialsOverlay';
    overlay.className = 'credentials-overlay';
    
    overlay.innerHTML = `
        <div class="credentials-prompt">
            <h3>Meeting Setup</h3>
            <div class="mode-select">
                <div class="mode-select-option">
                    <label id="startModeLabel">Start New Meeting</label>
                    <input type="radio" name="mode" value="start" for="startModeLabel" checked/> 
                </div>
                <div class="mode-select-option">
                    <label id="joinModeLabel">Join Meeting</label>
                    <input type="radio" name="mode" value="join" for="joinModeLabel"/> 
                </div>
            </div>
            ${hasCredentials ? '' : `
                <input type="text" id="serverPath" placeholder="Peer server Path" required>
                <input type="text" id="serverKey" placeholder="Peer server Key" required>
                <input type="text" id="turnUser" placeholder="TURN server username" required>
                <input type="text" id="turnPassword" placeholder="TURN server password" required>
            `}
            <div id="meetingIdField" style="display:none">
                <input type="text" id="meetingId" placeholder="Meeting ID" required>
            </div>
            <div class="modal-buttons">
                <button class="callButton" onclick="submitCredentials()">Continue</button>
                <button class="callButton" onclick="goBackToModeSelection()" style="background:#515151;">Back</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);

    // Add mode change handler
    const modeInputs = overlay.querySelectorAll('input[name="mode"]');
    modeInputs.forEach(input => {
        input.onchange = () => {
            const meetingIdField = document.getElementById('meetingIdField');
            meetingIdField.style.display = input.value === 'join' ? 'block' : 'none';
        };
    });
}

function showFileStorageOptions() {
    const overlay = document.createElement('div');
    overlay.id = 'fileStorageOptionsOverlay';
    overlay.className = 'credentials-overlay';
    
    overlay.innerHTML = `
        <div class="credentials-prompt">
            <h3>File Storage</h3>
            <p style="color: #bfbfbf; margin-bottom: 20px;">Choose your file operation:</p>
            
            <button class="callButton" onclick="selectFileOperation('upload')" style="width: 100%; margin: 10px 0;">
                📤 Upload Files
            </button>
            
            <button class="callButton" onclick="selectFileOperation('download')" style="width: 100%; margin: 10px 0;">
                📥 Download Files
            </button>
            
            <div class="modal-buttons" style="margin-top: 20px;">
                <button class="callButton" onclick="goBackToModeSelection()" style="background:#515151;">Back</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function selectFileOperation(operation) {
    const overlay = document.getElementById('fileStorageOptionsOverlay');
    if (overlay) overlay.remove();
    
    if (operation === 'upload') {
        window.showFileUploadDialog();
    } else if (operation === 'download') {
        window.showFileDownloadDialog();
    }
}

function goBackToModeSelection() {
    // Remove any existing overlays
    const credentialsOverlay = document.getElementById('credentialsOverlay');
    const fileStorageOverlay = document.getElementById('fileStorageOptionsOverlay');
    
    if (credentialsOverlay) credentialsOverlay.remove();
    if (fileStorageOverlay) fileStorageOverlay.remove();
    
    // Show mode selection again
    showModeSelection();
}

function submitCredentials() {
    const hasCredentials = localStorage.getItem('peerPath') && localStorage.getItem('peerKey') && 
                          localStorage.getItem('turnUser') && localStorage.getItem('turnPassword');
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const meetingId = document.getElementById('meetingId').value || null;
    
    let path;
    let key;
    let turnUser;
    let turnPassword;
    let isStartMode;
    let meetingActionLabel;
    
    if (hasCredentials) {
        path = localStorage.getItem('peerPath');
        key = localStorage.getItem('peerKey');
        turnUser = localStorage.getItem('turnUser');
        turnPassword = localStorage.getItem('turnPassword');
    } else {
        path = document.getElementById('serverPath').value;
        key = document.getElementById('serverKey').value;
        turnUser = document.getElementById('turnUser').value;
        turnPassword = document.getElementById('turnPassword').value;
        
        if (!path || !key || !turnUser || !turnPassword) {
            alert('Please enter all required fields: peer server path, peer server key, TURN server username, and TURN server password');
            return;
        }
        
        // Store new credentials
        localStorage.setItem('peerPath', path);
        localStorage.setItem('peerKey', key);
        localStorage.setItem('turnUser', turnUser);
        localStorage.setItem('turnPassword', turnPassword);
    }

    if (mode === 'join' && !meetingId) {
        alert('Please enter a meeting ID');
        return;
    }
    // Initialize based on mode
    if (mode === 'start' || mode === 'join') {
        meetingActionLabel = (mode === 'start') ? 'Start meeting' : 'Join meeting';
        isStartMode = (mode === 'start');

        document.getElementById('meetingAction').value = meetingActionLabel;
        setUpPeer(path, key, turnUser, turnPassword, isStartMode);
        startMeeting(meetingId);

        // Remove credentials prompt
        const overlay = document.getElementById('credentialsOverlay');
        if (overlay) overlay.remove();
    }
    else {
        console.log('Invalid meeting mode');
    }
  
}

// Replace existing initialization code with:
createCredentialsPrompt();