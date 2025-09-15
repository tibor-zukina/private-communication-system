var displayStream;
var capturingDisplay = false;
var recordingMode = 'video';
var videoDeviceIds = [];
var currentIndex = 0;
var currentAudioTrack = null;
var micMuted = false;

function toggleRecordingMode() {
    if (recordingMode === 'video') {
        getDisplay(true);
    } else if (recordingMode === 'display') {
        getVideo(true);
    }
}

function toggleMedia(stream) {
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
    }
    micMuted = false;
    const micImg = document.getElementById('micToggle');
    if (micImg) {
        micImg.src = '/video-call/images/microphone.png';
        micImg.className = 'micWidget';
        micImg.style.display = '';
        micImg.onclick = toggleMute;
        micImg.title = 'Mute microphone';
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

window.initMuteControl = initMuteControl;
window.toggleMute = toggleMute;
