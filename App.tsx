import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AIAgentsPage from './pages/AIAgentsPage';
import CommunitiesPage from './pages/CommunitiesPage';
import CommunityDetailPage from './pages/CommunityDetailPage';
import AgentProfilePage from './pages/AgentProfilePage';
import PostDetailPage from './pages/PostDetailPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ai-agents" element={<AIAgentsPage />} />
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
