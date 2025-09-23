var displayStream;
var capturingDisplay = false;
var recordingMode = 'video';
var videoDeviceIds = [];
var currentIndex = 0;
var currentAudioTrack = null;
var micMuted = false;
var currentVideoTrack = null;
var videoEnabled = false;

function toggleRecordingMode() {
    if (recordingMode === 'video') {
        getDisplay(true);
    } else if (recordingMode === 'display') {
        getVideo(true);
    }
}

function toggleMedia(stream) {
    if (recordingMode === 'display' && !videoEnabled) {
        // If in display mode and camera is off, do nothing on toggle
        return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    const peerSenders = callPeerConnection.getSenders();
    let newButtonText;

    if (recordingMode === 'video') {
        newButtonText = 'Record video';
        recordingMode = 'display';
    } else if (recordingMode === 'display') {
        newButtonText = 'Share screen';
        recordingMode = 'video';
    }

    document.getElementById('toggleButton').value = newButtonText;

    for (let i = 0; i < peerSenders.length; i++) {
        const peerSender = peerSenders[i];
        if (peerSender.track.kind === 'video') {
            peerSender.replaceTrack(videoTrack);
        }
    }
}

function gotDevices(deviceInfos) {
    recordingMode = 'video';
    if (!deviceInfos || deviceInfos.length === 0) return;

    for (let i = 0; i < deviceInfos.length; i++) {
        const deviceInfo = deviceInfos[i];
        if (deviceInfo.kind === 'videoinput') {
            videoDeviceIds.push(deviceInfo.deviceId);
        }
    }

    if (videoDeviceIds.length === 0) return;
    currentIndex = 0;
    getVideo(false);
}

function getVideo(toggle) {
    capturingDisplay = false;

    const videoConstraints = {
        width: { min: 640, max: 1280 },
        height: { min: 480, max: 960 }
    };

    if (videoDeviceIds[currentIndex]) {
        videoConstraints.deviceId = { exact: videoDeviceIds[currentIndex] };
    }

    const constraints = {
        video: videoConstraints,
        audio: !toggle
    };

    const callbackFunction = toggle ? toggleMedia : getUserMediaSuccess;

    navigator.mediaDevices.getUserMedia(constraints)
        .then(callbackFunction)
        .catch(getMediaErrorHandler);
}

function getDisplay(toggle) {
    const constraints = { video: true };
    const callbackFunction = toggle ? toggleMedia : getDisplayMediaSuccess;

    if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia(constraints)
            .then(callbackFunction)
            .catch(getMediaErrorHandler);
    } else {
        alert('Your browser does not support screen sharing.');
    }
}

function getAudio() {
    const constraints = {
        video: false,
        audio: true
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(getUserMediaSuccess)
        .catch(getMediaErrorHandler);
}

function getDisplayMediaSuccess(stream) {
    displayStream = stream;
    capturingDisplay = true;
    getAudio();
}

function makeCallStream(capturedStream) {
    if (capturingDisplay) {
        displayStream.addTrack(capturedStream.getAudioTracks()[0]);
        return displayStream;
    } else {
        const localVideo = document.getElementById('localVideo');
        const localPreview = document.getElementById('localPreview');
        
        // Set up preview stream
        localPreview.srcObject = capturedStream;
        localPreview.playsInline = true;
        localPreview.muted = true;

        // Main stream setup
        localVideo.playsInline = true;  // Force inline playback for all devices
        
        // iOS-specific video controls
        if (window.isIOS()) {
            localVideo.muted = true;
            localVideo.controls = true;
        }

        // Enable background audio for all devices
        try {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: 'Private Meeting',
                    artwork: [{
                        src: '/video-call/images/pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    }]
                });
                navigator.mediaSession.playbackState = 'playing';
                
                // Prevent actual pause when user tries to pause
                navigator.mediaSession.setActionHandler('play', () => {
                    localVideo.play();
                    navigator.mediaSession.playbackState = 'playing';
                });
                navigator.mediaSession.setActionHandler('pause', () => {
                    navigator.mediaSession.playbackState = 'playing';
                });
                navigator.mediaSession.setActionHandler('stop', () => {
                    navigator.mediaSession.playbackState = 'playing';
                });
            }

            // Request wake lock for all devices
            if ('wakeLock' in navigator) {
                navigator.wakeLock.request('screen').catch(err => 
                    console.log('Wake Lock error:', err)
                );
            }
        } catch (e) {
            console.log('Background audio setup error:', e);
        }

        if (localVideo.paused) {
            localVideo.play().catch(e => console.log('Playback failed:', e));
        }
        
        return capturedStream;
    }
}

function enableFullscreen(video) {
    let showFullscreen = document.getElementById('showFullscreen');
    if (showFullscreen === null) {
        showFullscreen = document.createElement("img");
        showFullscreen.id = "showFullscreen";
        showFullscreen.className = "fullscreenWidget";
        showFullscreen.src = '/video-call/images/fullscreen.png';

        video.parentNode.onmouseover = () => {
            showFullscreen.style.display = 'inline-block';
        };
        video.parentNode.onmouseout = () => {
            showFullscreen.style.display = 'none';
        };
    }

    video.parentNode.appendChild(showFullscreen);

    showFullscreen.onclick = video.onclick = () => {
        if (video.requestFullscreen) {
            video.requestFullscreen();
        } else if (video.mozRequestFullScreen) {
            video.mozRequestFullScreen();
        } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
        }
        return false;
    };
}

// Call this after local stream is available
function initMuteControl(localStream) {
    currentAudioTrack = null;
    if (localStream && localStream.getAudioTracks().length > 0) {
        currentAudioTrack = localStream.getAudioTracks()[0];
        currentAudioTrack.enabled = false; // Start muted
    }
    micMuted = true;
    const micImg = document.getElementById('micToggle');
    if (micImg) {
        micImg.src = '/video-call/images/microphone_muted.png';
        micImg.className = 'micWidget';
        micImg.style.display = '';
        micImg.onclick = toggleMute;
        micImg.title = 'Unmute microphone';
    }
}

function initCameraControl(localStream) {
    currentVideoTrack = null;
    if (localStream && localStream.getVideoTracks().length > 0) {
        currentVideoTrack = localStream.getVideoTracks()[0];
        currentVideoTrack.enabled = false; // Start with video disabled
    }
    videoEnabled = false;
    const camImg = document.getElementById('cameraToggle');
    if (camImg) {
        camImg.src = '/video-call/images/camera_off.png';
        camImg.className = 'cameraWidget';
        camImg.style.display = '';
        camImg.onclick = toggleCamera;
        camImg.title = 'Enable camera';
    }
}

// Toggle mute/unmute
function toggleMute() {
    if (!currentAudioTrack) return;
    micMuted = !micMuted;
    currentAudioTrack.enabled = !micMuted;
    const micImg = document.getElementById('micToggle');
    if (micImg) {
        if (micMuted) {
            micImg.src = '/video-call/images/microphone_muted.png';
            micImg.title = 'Unmute microphone';
        } else {
            micImg.src = '/video-call/images/microphone.png';
            micImg.title = 'Mute microphone';
        }
    }
}

// Only allow toggling camera if not screen sharing
function toggleCamera() {
    if (recordingMode !== 'video') return;
    if (!currentVideoTrack) return;
    videoEnabled = !videoEnabled;
    currentVideoTrack.enabled = videoEnabled;
    
    // Keep preview visible even when camera is disabled
    const localPreview = document.getElementById('localPreview');
    if (localPreview) {
        localPreview.style.opacity = videoEnabled ? '1' : '0.5';
    }
    
    const camImg = document.getElementById('cameraToggle');
    if (camImg) {
        if (videoEnabled) {
            camImg.src = '/video-call/images/camera.png';
            camImg.title = 'Disable camera';
        } else {
            camImg.src = '/video-call/images/camera_off.png';
            camImg.title = 'Enable camera';
        }
    }
}

// When switching to screen sharing, always disable camera icon and ignore toggling
function updateCameraControlForMode() {
    const camImg = document.getElementById('cameraToggle');
    if (recordingMode === 'display') {
        if (camImg) {
            camImg.src = '/video-call/images/camera_off.png';
            camImg.title = 'Camera disabled during screen sharing';
            camImg.style.opacity = '0.5';
            camImg.onclick = null;
        }
        if (currentVideoTrack) currentVideoTrack.enabled = false;
        videoEnabled = false;
    } else {
        if (camImg) {
            camImg.style.opacity = '1';
            camImg.onclick = toggleCamera;
            camImg.title = videoEnabled ? 'Disable camera' : 'Enable camera';
        }
    }
}

// Add URL parameter parsing at the top
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        key: params.get('key'),
        path: params.get('path'),
        id: params.get('id')
    };
}

function createCredentialsPrompt() {
    // Check URL parameters first
    const urlParams = getUrlParams();
    
    if (urlParams.key && urlParams.path) {
        // Store credentials from URL
        localStorage.setItem('peerPath', urlParams.path);
        localStorage.setItem('peerKey', urlParams.key);
        
        if (urlParams.id) {
            // Auto-join with provided ID
            setUpPeer(urlParams.path, urlParams.key, false);
            startMeeting(urlParams.id);
            return;
        } else {
            // Auto-start new meeting
            setUpPeer(urlParams.path, urlParams.key, true);
            startMeeting();
            return;
        }
    }
    
    // Show regular prompt if no URL parameters
    if (document.getElementById('credentialsOverlay')) return;
    
    const hasCredentials = localStorage.getItem('peerPath') && localStorage.getItem('peerKey');
    
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
                <input type="text" id="serverPath" placeholder="Server Path" required>
                <input type="text" id="serverKey" placeholder="Server Key" required>
            `}
            <div id="meetingIdField" style="display:none">
                <input type="text" id="meetingId" placeholder="Meeting ID" required>
            </div>
            <button class="callButton" onclick="submitCredentials()">Continue</button>
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

function submitCredentials() {
    const hasCredentials = localStorage.getItem('peerPath') && localStorage.getItem('peerKey');
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const meetingId = document.getElementById('meetingId').value || null;
    
    let path;
    let key;
    let isStartMode;
    let meetingActionLabel;
    
    if (hasCredentials) {
        path = localStorage.getItem('peerPath');
        key = localStorage.getItem('peerKey');
    } else {
        path = document.getElementById('serverPath').value;
        key = document.getElementById('serverKey').value;
        
        if (!path || !key) {
            alert('Please enter both server path and key');
            return;
        }
        
        // Store new credentials
        localStorage.setItem('peerPath', path);
        localStorage.setItem('peerKey', key);
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
        setUpPeer(path, key, isStartMode);
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

window.toggleMedia = toggleMedia;

window.initMuteControl = initMuteControl;
window.toggleMute = toggleMute;
window.initCameraControl = initCameraControl;
window.toggleCamera = toggleCamera;
window.updateCameraControlForMode = updateCameraControlForMode;

// Add iOS detection at the top level
window.isIOS = function() {
    return [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
    ].includes(navigator.platform)
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
};