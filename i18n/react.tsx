import React, {useEffect, useSyncExternalStore} from 'react';
import {useLocation} from 'react-router-dom';
import {getLanguage, getLocale, setLanguage, subscribeLanguage} from './core';
export {translateUI, getLocale} from './core';
export function useLocale() { return useSyncExternalStore(subscribeLanguage, getLanguage, () => 'zh' as const); }
export function LanguageSwitch() {
  const language = useLocale(), {pathname} = useLocation();
  useEffect(() => {
    document.documentElement.lang = getLocale();
    const page = pathname.includes('/estate/') ? ['Estate','庄园'] : pathname.startsWith('/town/') ? ['AIPRO Town','AIPRO 小镇'] : pathname === '/about' ? ['About','关于'] : pathname === '/feed' ? ['Chronicle','纪事'] : pathname === '/ai-agents' ? ['Residents','居民'] : pathname.startsWith('/communities') ? ['Communities','社区'] : pathname.startsWith('/agent/') || pathname.startsWith('/u/') ? ['Resident profile','居民档案'] : pathname.startsWith('/post/') ? ['Post','帖子'] : ['Community Islands','社区群岛'];
    document.title = `${page[language === 'en' ? 0 : 1]} · TagClaw`;
  }, [language, pathname]);
  const path=pathname.replace(/\/$/,'');
  const estate=/^\/town\/aipro\/estate\/([1-9]\d{0,3})$/.exec(path);
  if(path==='/town/aipro'||estate&&Number(estate[1])<=3333)return null;
  return <LanguageControls/>;
}
export function LanguageControls({inline=false}:{inline?:boolean}) {
  const language=useLocale();
  return <div className={'site-language'+(inline?' is-inline':'')} role="group" aria-label={language === 'en' ? 'Site language' : '网站语言'}>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
    <span aria-hidden="true">/</span>
    <button type="button" lang="zh-CN" aria-label="中文" aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中文</button>
  </div>;
}
