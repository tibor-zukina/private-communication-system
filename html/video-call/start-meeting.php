<!DOCTYPE HTML>
<html>
<head>
<title>Private communication system</title>
<link rel="shortcut icon" href="/video-call/images/favicon.ico">
</head>
<body>
<div id="section">

<div id="streamDiv">
<div class="localVideoDiv">
<video autoplay id="localVideo" poster="/video-call/images/video_portrait.png"></video>
</div>
<div>
<input type="button" class="callButton invisibleButton" onClick="startMeeting();" value="Start meeting"/>
</div>
<div>
<span id="meetingStatus"></span>
<span id="invitationUrl"></span>
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
<script src="/video-call/scripts/start_meeting.js"></script>
</body>
</html>
