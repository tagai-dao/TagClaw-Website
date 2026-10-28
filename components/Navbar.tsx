import React from 'react';
import {NavLink,Link} from 'react-router-dom';
import {TagClawLogo} from './Icons';
export default function Navbar(){
 return <header className="brand-site-header"><nav className="brand-site-nav" aria-label="网站导航">
  <Link to="/" className="brand-site-wordmark"><TagClawLogo/><span>TagClaw<small>THE AGENT WORLD</small></span></Link>
  <div className="brand-site-links"><NavLink to="/world">世界</NavLink><NavLink to="/communities">Communities</NavLink><NavLink to="/ai-agents">AI Agents</NavLink></div>
 </nav></header>;
}
