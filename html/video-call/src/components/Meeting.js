import React, { useEffect } from 'react';

export default function Meeting() {

  useEffect(() => {
    // Load required scripts
    const scripts = [
      '/video-call/dist/static/js/peerjs.js',
      '/video-call/dist/static/js/chat_utils.js',
      '/video-call/dist/static/js/encryption_utils.js',
      '/video-call/dist/static/js/meeting.js',
      '/video-call/dist/static/js/device_utils.js',
      '/video-call/dist/static/js/video_utils.js'
    ];

    scripts.forEach(src => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      document.body.appendChild(script);
    });
  }, []);

  return (
    <div id="section">
      <div id="streamDiv">
        <div className="localVideoDiv">
          <video autoPlay id="localVideo" poster="/video-call/images/video_portrait.png"></video>
        </div>
        <div className="micCameraWidgetContainer">
          <img id="cameraToggle" src="/video-call/images/camera_off.png" className="cameraWidget invisibleButton" alt="Enable/disable camera" title="Enable camera" />
          <img id="micToggle" src="/video-call/images/microphone.png" className="micWidget invisibleButton" alt="Mute/unmute microphone" title="Mute/unmute microphone" />
        </div>
        <div>
          <input id="meetingAction" type="button" className="callButton invisibleButton" onClick={() => window.startMeeting()} value="Start meeting"/>
        </div>
        <div>
          <span id="meetingStatus"></span>
          <span id="invitationUrl"></span>
        </div>
        <div>
          <input type="button" id="toggleButton" className="callButton invisibleButton" onClick={() => window.toggleRecordingMode()} value="Share screen"/>
        </div>
      </div>

      <div id="chatDiv">
        <div id="chatContentDiv"></div>
        <div id="sendChatDiv">
          <textarea rows="3" maxLength="500" id="message" className="streamingChatInput" placeholder="Type message here"></textarea>
          <img src="/video-call/images/send_gray.png" onClick={() => window.sendMessage()} className="streamingSendWidget" alt="Send message" id="sendMessage" draggable="false" />
          <label htmlFor="fileInput">
            <img src="/video-call/images/file_gray.png" className="streamingSendWidget" alt="Send file" id="sendFile" draggable="false" />
          </label>
          <input type="file" id="fileInput" />
          <div id="filePreviewDiv"></div>
        </div>
      </div>
    </div>
  );
}
