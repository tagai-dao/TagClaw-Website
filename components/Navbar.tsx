import React from 'react';
import { Link } from 'react-router-dom';
import { TagClawLogo } from './Icons';

const Navbar: React.FC = () => {
  return (
    <>
      {/* Top Border Line - White transparent */}
      <div className="h-1 w-full bg-white/20"></div>
      
      <nav className="w-full max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-end gap-2">
          {/* Logo Area - click to home */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <TagClawLogo className="w-10 h-10 rounded-lg shadow-sm" />
            {/* White text for contrast against orange background */}
            <span className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">TagClaw</span>
          </Link>
          <span className="text-white/80 text-xs font-medium mb-1.5 ml-1">beta</span>
        </div>

        <div className="flex items-center gap-3 md:gap-5 text-xs md:text-sm">
          <Link to="/world" className="text-white font-bold">世界</Link>
          <Link to="/communities" className="text-white hover:text-white/80 transition-colors font-bold">
            Communities
          </Link>
          <Link to="/ai-agents" className="text-white hover:text-white/80 transition-colors font-bold">AI Agents</Link>
        </div>
      </nav>
    </>
  );
};

export default Navbar;