navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
var deviceIds = [];
var meetingId;
var chatConn;
var chatStarted = false;
var chatActive = false;
var counterInterval;
var reconnectInterval;
var startTime = 0;
var previousState = 'not started';
var callPeerConnection;
var host = '64.176.216.148';
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
    peer = new Peer(makeRandomId(32), {
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

var params = new URLSearchParams(window.location.search);
setUpPeer(params.get('path'), params.get('key'));

function joinMeeting() {
    callButton = document.getElementsByClassName('callButton')[0];
    callButton.disabled = true;
    callButton.value = 'Meeting started';
    meetingId = document.getElementById('meetingId').value;
    navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(enumerationErrorHandler);
}

function startChat(meetingId) {
    chatStarted = true;
    chatConn = peer.connect(meetingId);
    
    openChatConnection(meetingId);

    document.getElementById('message').onkeydown = function(e) {
        if (e.keyCode == 13 && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
            return false;
        }
    };
}

function openChatConnection(meetingId) {

    if(chatConn !== null) chatConn.close();
    chatConn = null;

    chatConn = peer.connect(meetingId);

    chatConn.on('open', function() {

        chatActive = true;

        chatConn.on('data', function(data) {
           addReceivedMessage(data);
        });
        chatConn.on('close', function(data) {
            chatActive = false;
            openChatConnection(meetingId);
            reconnectInterval = setInterval(function(){ 
                if(chatActive) clearInterval(reconnectInterval);
                else openChatConnection(meetingId); 
            }, 
            5000); 
        });

    });

}

function sendMessage() {

    if (chatActive === false) return;
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

    localStream = makeCallStream(capturedStream);
    var call = peer.call(meetingId, localStream);
    call.on('stream', function(remoteStream) {
        callPeerConnection = call.peerConnection;
        localVideo = document.getElementById('localVideo');
        localVideo.srcObject = remoteStream;
        enableFullscreen(localVideo);
        enableToggle();
        startCounter();
    });
    call.peerConnection.oniceconnectionstatechange = function() {
        if (call.peerConnection.iceConnectionState == 'disconnected') {
            connectionLost();
        } else if (call.peerConnection.iceConnectionState == 'connected') {
            if (chatStarted === false) startChat(meetingId);
            startCounter();
        }
        previousState = call.peerConnection.iceConnectionState;
    }
}

function startCounter() {

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

function enumerationErrorHandler(error) {
    console.log('Some enumeration error:' + error);
}

function getMediaErrorHandler(error) {
    console.log('Failed to get local stream', error);
}

function connectionLost() {
    clearInterval(counterInterval);
    meetingStatus = document.getElementById('meetingStatus');
    meetingStatus.innerHTML = 'Connection to the other side lost';
    setTimeout(function() {
        if (previousState == 'disconnected') meetingStatus.innerHTML = 'Reconnecting ...';
    }, 1000);
}

function enableToggle() {

    toggleButton = document.getElementById('toggleButton');
    toggleButton.className = 'callButton';

}
