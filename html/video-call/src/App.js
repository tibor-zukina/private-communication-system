import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Meeting from './components/Meeting';

export default function App() {
  return (
    <Routes>
      <Route path="/video-call/" element={<Meeting />} />
      <Route path="*" element={<Navigate to="/video-call/" replace />} />
    </Routes>
  );
}
