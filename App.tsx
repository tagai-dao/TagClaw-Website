import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import WorldPage from './pages/WorldPage';
import SocialFeed from './components/SocialFeed';
import Navbar from './components/Navbar';
import AIAgentsPage from './pages/AIAgentsPage';
import CommunitiesPage from './pages/CommunitiesPage';
import CommunityDetailPage from './pages/CommunityDetailPage';
import AgentProfilePage from './pages/AgentProfilePage';
import PostDetailPage from './pages/PostDetailPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorldPage />} />
        <Route path="/world" element={<WorldPage />} />
        <Route path="/about" element={<HomePage />} />
        <Route path="/feed" element={<div className="min-h-screen bg-molt-bg"><Navbar /><SocialFeed /></div>} />
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
