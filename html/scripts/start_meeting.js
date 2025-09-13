navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
var deviceIds = [];
var localStream;
var chatConn;
var callerPeerId;
var chatStarted = false;
var counterInterval;
var startTime = 0;
var previousState = 'not started';
var lastCallTime;
var callPeerConnection;
var host = 'management.cumnsee.com';
var peer;

function makeRandomId(length) {
    var result = '';
    var characters = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function setUpPeer(peerServerPath, peerServerKey) {
    var peerId = makeRandomId(32);

    peer = new Peer(peerId, {
        host: host,
        port: 3728,
        path: peerServerPath,
        key: peerServerKey
    });
    peer.on('open', function(id) {
        callButton = document.getElementsByClassName('callButton invisibleButton')[0];
        callButton.className = 'callButton';
    });
}

setUpPeer(window.queryParams['path'], window.queryParams['key']);

function startMeeting() {
    callButton = document.getElementsByClassName('callButton')[0];
    callButton.disabled = true;
    callButton.value = 'Meeting started';
    navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(enumerationErrorHandler);
}

function startChat() {
    chatStarted = true;
    peer.on('connection', function(conn) {
        chatConn = conn;
        chatConn.on('data', function(data) {
            addReceivedMessage(data);
        });
        chatConn.on('close', function(data) {
            
        });
    });

    document.getElementById('message').onkeydown = function(e) {
        if (e.keyCode == 13 && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
            return false;
        }
    };
}

function sendMessage() {

    if (chatStarted === false) return;

    messageText = document.getElementById('message').value;
    document.getElementById('message').value = '';
    addSentMessage(messageText);
    chatConn.send(messageText);

}

function addReceivedMessage(text) {

    messageDiv = document.createElement('div');
    messageDiv.className = 'receivedMessageDiv';
    messageDiv.innerHTML = '<div class="receivedMessageText"><div class="chatTextDiv"><span class="chatTextDiv">' + text + '</span></div></div>';
    chatContentDiv = document.getElementById('chatContentDiv');
    chatContentDiv.appendChild(messageDiv);
    chatContentDiv.scrollTop = document.getElementById('chatContentDiv').scrollHeight;

}

function addSentMessage(text) {

    messageDiv = document.createElement('div');
    messageDiv.className = 'sentMessageDiv';
    messageDiv.innerHTML = '<div class="sentMessageText"><div class="chatTextDiv"><span class="chatTextDiv">' + text + '</span></div></div>';
    chatContentDiv = document.getElementById('chatContentDiv');
    chatContentDiv.appendChild(messageDiv);
    chatContentDiv.scrollTop = document.getElementById('chatContentDiv').scrollHeight;
}

function getUserMediaSuccess(capturedStream) {

    document.getElementById('meetingStatus').innerHTML = 'Waiting for the other side to join...';
    document.getElementById('invitationUrl').innerHTML = 'Invitation url: https://' + host + '/video-call/join-meeting.php?path=<secret-path>&key=<secret-key>&id=' + peerId;
    localStream = makeCallStream(capturedStream);
    peer.on('call', function(call) {
        lastCallTime = Date.now();
        call.timeStarted = lastCallTime;
        callerPeerId = call.peer;
        call.answer(localStream);
        call.on('stream', function(remoteStream) {
            localVideo = document.getElementById('localVideo');
            localVideo.srcObject = remoteStream;
            enableFullscreen(localVideo);
            enableToggle();
            startCounter();
        });
        callPeerConnection = call.peerConnection;
        call.peerConnection.oniceconnectionstatechange = function() {
            if (call.peerConnection.iceConnectionState == 'disconnected') {
                if (call.timeStarted == lastCallTime) connectionLost();
            } else if (call.peerConnection.iceConnectionState == 'connected') {
                if (chatStarted === false) startChat();
                startCounter();
            }
            previousState = call.peerConnection.iceConnectionState;
        }
    }, function(err) {
        console.log('Failed to get local stream', err);
    });

}

function enumerationErrorHandler(error) {
    console.log('Some enumeration error:' + error);
}

function getMediaErrorHandler(error) {
    console.log('Failed to get local stream', error);
}

function startCounter() {

    document.getElementById('invitationUrl').style.display = 'none';
    meetingStatus = document.getElementById('meetingStatus');
    if (startTime == 0) startTime = Date.now();
    seconds = Math.floor((Date.now() - startTime) / 1000);
    setTimer(seconds, meetingStatus);
    if (counterInterval !== null) clearInterval(counterInterval);
    counterInterval = setInterval(function() {
        seconds = Math.floor((Date.now() - startTime) / 1000);
        setTimer(seconds, meetingStatus);
    }, 1000);
}

function setTimer(seconds, timer) {

    var s = seconds % 60;
    var m = (Math.floor(seconds / 60)) % 60;
    var h = Math.floor(seconds / 3600);
    if (s < 10) s = '0' + s;
    if (m < 10) m = '0' + m;
    if (h < 10) h = '0' + h;
    var timePassed = h + ':' + m + ':' + s;
    timer.innerHTML = timePassed;
}

function connectionLost() {
    clearInterval(counterInterval);
    document.getElementById('meetingStatus').innerHTML = 'Connection to the other side lost';
    setTimeout(function() {
        if (previousState == 'disconnected') meetingStatus.innerHTML = 'Reconnecting ...';
    }, 1000);
}

function enableToggle() {

    toggleButton = document.getElementById('toggleButton');
    toggleButton.className = 'callButton';

}
