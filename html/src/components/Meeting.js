import React, { useEffect } from 'react';

export default function Meeting() {

  useEffect(() => {
    // Load required scripts
    const scripts = [
      '/dist/static/js/peerjs.js',
      '/dist/static/js/chat_utils.js',
      '/dist/static/js/encryption_utils.js',
      '/dist/static/js/meeting.js',
      '/dist/static/js/device_utils.js',
      '/dist/static/js/communication_options.js',
      '/dist/static/js/video_utils.js',
      '/dist/static/js/file_storage.js'
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
          <video autoPlay id="localVideo" poster="/images/video_portrait.png"></video>
          <div className="localPreviewContainer">
            <video autoPlay muted playsInline id="localPreview" className="localPreviewVideo"></video>
          </div>
        </div>
        <div className="micCameraWidgetContainer">
          <img id="cameraToggle" src="/images/camera_off.png" className="cameraWidget invisibleButton" alt="Enable/disable camera" title="Enable camera" />
          <img id="micToggle" src="/images/microphone.png" className="micWidget invisibleButton" alt="Mute/unmute microphone" title="Mute/unmute microphone" />
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
        <div className="file-storage-controls">
          <input type="button" className="callButton" onClick={() => window.showFileUploadDialog()} value="Upload Files"/>
          <input type="button" className="callButton" onClick={() => window.showFileDownloadDialog()} value="Download Files"/>
        </div>
      </div>

      <div id="chatDiv">
        <div id="chatContentDiv"></div>
        <div id="sendChatDiv">
          <textarea rows="3" maxLength="500" id="message" className="streamingChatInput" placeholder="Type message here"></textarea>
          <img src="/images/send_gray.png" onClick={() => window.sendMessage()} className="streamingSendWidget" alt="Send message" id="sendMessage" draggable="false" />
          <label htmlFor="fileInput">
            <img src="/images/file_gray.png" className="streamingSendWidget" alt="Send file" id="sendFile" draggable="false" />
          </label>
          <input type="file" id="fileInput" />
          <div id="filePreviewDiv"></div>
        </div>
      </div>
    </div>
  );
}
