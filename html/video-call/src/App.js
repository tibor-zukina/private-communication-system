import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import StartMeeting from './components/StartMeeting';
import JoinMeeting from './components/JoinMeeting';

export default function App() {
  return (
    <Routes>
      <Route path="/video-call/start-meeting" element={<StartMeeting />} />
      <Route path="/video-call/join-meeting" element={<JoinMeeting />} />
      <Route path="*" element={<Navigate to="/video-call/start-meeting" replace />} />
    </Routes>
  );
}
