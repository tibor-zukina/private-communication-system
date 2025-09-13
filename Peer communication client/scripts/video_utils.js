var displayStream;
var capturingDisplay = false;
var recordingMode;
var localStream;
var toggleStream;

function toggleRecordingMode() {

    if (recordingMode == 'video') {
        getDisplay(true);
    } else if (recordingMode == 'display') {
        getVideo(true);
    }

}

function toggleMedia(stream) {

    videoTrack = stream.getVideoTracks()[0];
    peerSenders = callPeerConnection.getSenders();
    if(recordingMode == 'video') {
        newButtonText = 'Record video';
        recordingMode = 'display';
    }
    else if(recordingMode == 'display') {
        newButtonText = 'Share screen';
        recordingMode = 'video';
    }
    document.getElementById('toggleButton').value = newButtonText;
    for (var i = 0, j = peerSenders.length; i < j; i++) {
        peerSender = peerSenders[i];
        if (peerSender.track.kind == 'video') peerSender.replaceTrack(videoTrack);
    }


}

function gotDevices(deviceInfos) {
    recordingMode = 'video';
    if (!deviceInfos || deviceInfos.length === 0) return;
    for (var i = 0; i < deviceInfos.length; i++) {
        var deviceInfo = deviceInfos[i];
        if (deviceInfo.kind === 'videoinput') {
            deviceIds.push(deviceInfo.deviceId);
        }
    }
    if (deviceIds.length === 0) return;
    currentIndex = 0;
    getVideo(false);
}

function getVideo(toggle) {

    capturingDisplay = false;
    var constraints;
    constraints = {
        video: {
            mandatory: {
                minWidth: 640,
                maxWidth: 1280,
                minHeight: 480,
                maxHeight: 960
            },
            optional: [{
                sourceId: deviceIds[currentIndex] ? deviceIds[currentIndex] : undefined
            }]
        },
        audio: !toggle
    };

    var callbackFunction;

    if (toggle) callbackFunction = toggleMedia;
    else callbackFunction = getUserMediaSuccess;

    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia(constraints).then(callbackFunction).catch(getMediaErrorHandler);
    } else if (navigator.getUserMedia) {
        navigator.getUserMedia(constraints, callbackFunction, getMediaErrorHandler);
    }

}

function getDisplay(toggle) {

    var constraints = {
        video: true
    };

    if (toggle) callbackFunction = toggleMedia;
    else callbackFunction = getDisplayMediaSuccess;

    if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia(constraints).then(callbackFunction).catch(getMediaErrorHandler);
    } else if (navigator.getUserMedia) {
        navigator.getDisplayMedia(constraints, callbackFunction, getMediaErrorHandler);
    }
}

function getAudio() {

    var constraints;
    constraints = {
        video: false,
        audio: true
    };

    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(getMediaErrorHandler);
    } else if (navigator.getUserMedia) {
        navigator.getUserMedia(constraints, getUserMediaSuccess, getMediaErrorHandler);
    }



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

    var showFullscreen = document.getElementById('showFullscreen');
    if (showFullscreen === null) {
        var showFullscreen = document.createElement("img");
        showFullscreen.id = "showFullscreen";
        showFullscreen.className = "fullscreenWidget";
        showFullscreen.src = '/images/fullscreen.png';
        video.parentNode.onmouseover = function() {
            showFullscreen.style.display = 'inline-block';
        };
        video.parentNode.onmouseout = function() {
            showFullscreen.style.display = 'none';
        };
    }
    video.parentNode.appendChild(showFullscreen);

    showFullscreen.onclick = function() {
        if (video.requestFullscreen) {
            video.requestFullscreen();
        } else if (video.mozRequestFullScreen) {
            video.mozRequestFullScreen();
        } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
        }
        return false;
    };

    video.onclick = function() {
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
