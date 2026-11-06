import {translateUI, useLocale} from '../../i18n/react';
import React,{useRef,useState} from 'react';

/** Original 72 BPM instrumental; playback only starts after a visitor gesture. */
export default function IslandRadio(){
  useLocale();
  const audio=useRef<HTMLAudioElement|null>(null);
  const [playing,setPlaying]=useState(false),[pending,setPending]=useState(false),[failed,setFailed]=useState(false);
  async function toggle(){
    const player=audio.current;if(!player||pending)return;
    if(!player.paused){player.pause();return;}
    setPending(true);setFailed(false);player.volume=.45;
    try{await player.play();}catch{setFailed(true);}finally{setPending(false);}
  }
  return <>
    <button className="ip-radio" aria-label={translateUI('岛上音乐')} aria-pressed={playing} aria-busy={pending} disabled={pending}
      title={translateUI(failed?'音乐暂不可用，请重试':playing?'暂停音乐 · 庄园微风':'播放音乐 · 庄园微风 · 72 BPM')}
      onClick={toggle}>{pending?'…':failed?'↻':playing?'Ⅱ':'♫'}</button>
    <audio ref={audio} src="/audio/aipro-garden.m4a" preload="none" loop onPlay={()=>{setPlaying(true);setFailed(false);}} onPause={()=>setPlaying(false)} onError={()=>{setFailed(true);setPlaying(false);setPending(false);}}/>
  </>;
}
