<!DOCTYPE HTML>
<html>
<head>
<title>Private meeting</title>
<link rel="shortcut icon" href="/video-call/images/favicon.ico">
</head>
<body>
<div id="section">
<div id="streamDiv">
<div class="localVideoDiv">
<video autoPlay id="localVideo" poster="/video-call/images/video_portrait.png"></video>
<div class="micCameraWidgetContainer">
    <img id="cameraToggle" src="/video-call/images/camera_off.png" class="cameraWidget invisibleButton" alt="Enable/disable camera" title="Enable camera" />
    <img id="micToggle" src="/video-call/images/microphone.png" class="micWidget invisibleButton" alt="Mute/unmute microphone" title="Mute/unmute microphone" />
</div>
</div>
<input type="hidden" id="meetingId" value="<?php echo $_GET['id'];?>"/>
<div>
<input type="button" class="callButton invisibleButton" onClick="joinMeeting()" value="Join meeting"/>
</div>
<div>
<span id="meetingStatus"></span>
</div>
<div>
<input type="button" id="toggleButton" class="callButton invisibleButton" onClick="toggleRecordingMode();" value="Share screen"/>
</div>
</div>

<div id="chatDiv">
<div id="chatContentDiv">
</div>
<div id="sendChatDiv">
<textarea type="text" rows="3" maxlength="500" id="message" class="streamingChatInput" placeholder="Type message here"></textarea>
<img src="/video-call/images/send_gray.png" onclick="sendMessage()" class="streamingSendWidget" alt="Send message" id="sendMessage" draggable="false">
<label for="fileInput">
    <img src="/video-call/images/file_gray.png" class="streamingSendWidget" alt="Send file" id="sendFile" draggable="false" style="cursor:pointer;">
</label>
<input type="file" id="fileInput" style="display:none" />
<div id="filePreviewDiv"></div>
</div>
</div>
</div>
</div>
<link rel="stylesheet" type="text/css" href="/video-call/design/design.css" />
<script src="/video-call/scripts/peerjs.js"></script>
<script src="/video-call/scripts/video_utils.js"></script>
<script src="/video-call/scripts/chat_utils.js"></script>
<script src="/video-call/scripts/encryption_utils.js"></script>
<script src="/video-call/scripts/join_meeting.js"></script>
</body>
</html>
