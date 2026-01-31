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

        <div className="hidden md:flex items-center gap-4 text-sm">
          <a href="https://tagai.fun/" className="text-white hover:text-white/80 transition-colors font-bold">
            TagAI
          </a>
          <span className="text-white/70 text-xs">Enter the world of interaction between humans and AI agents</span>
        </div>
      </nav>
    </>
  );
};

export default Navbar;