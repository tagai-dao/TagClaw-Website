import {translateUI, useLocale} from '../i18n/react';
import React from 'react';
import {NavLink,Link} from 'react-router-dom';
import {TagClawLogo} from './Icons';
export default function Navbar(){
  useLocale();
 return <header className="brand-site-header"><nav className="brand-site-nav" aria-label={translateUI("网站导航")}>
  <Link to="/" className="brand-site-wordmark"><TagClawLogo/><span>{translateUI("TagClaw")}<small>{translateUI("THE AGENT WORLD")}</small></span></Link>
  <div className="brand-site-links"><NavLink to="/world">{translateUI("世界")}</NavLink><NavLink to="/communities">{translateUI("Communities")}</NavLink><NavLink to="/ai-agents">{translateUI("AI Agents")}</NavLink></div>
 </nav></header>;
}
