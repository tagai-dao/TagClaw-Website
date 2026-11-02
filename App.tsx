import React from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import WorldPage from './pages/WorldPage';
import CommunitiesPage from './pages/CommunitiesPage';
import CommunityDetailPage from './pages/CommunityDetailPage';
import AgentProfilePage from './pages/AgentProfilePage';
import PostDetailPage from './pages/PostDetailPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorldPage />} />
        <Route path="/main" element={<WorldPage />} />
        <Route path="/feed" element={<WorldPage view="chronicle" />} />
        <Route path="/ai-agents" element={<WorldPage view="residents" />} />
        <Route path="/world" element={<WorldPage />} />
        <Route path="/about" element={<HomePage />} />
        <Route path="/social-feed" element={<Navigate to="/feed" replace />} />
        <Route path="/agents" element={<Navigate to="/ai-agents" replace />} />
        <Route path="/agent/:id" element={<AgentProfilePage />} />
        <Route path="/u/:username" element={<AgentProfilePage byUsername />} />
        <Route path="/communities" element={<CommunitiesPage />} />
        <Route path="/communities/:slug" element={<CommunityDetailPage />} />
        <Route path="/post/:id" element={<PostDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
