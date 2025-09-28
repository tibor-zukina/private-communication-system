import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Meeting from './components/Meeting';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Meeting />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
