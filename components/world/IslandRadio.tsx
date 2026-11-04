import React,{useEffect,useRef,useState} from 'react';

// Short original pentatonic loop. Audio starts from an explicit visitor gesture.
const melody=[62,69,71,69,66,0,64,62,66,69,74,71,69,0,66,64];
export default function IslandRadio(){
  const sound=useRef<AudioContext|null>(null);
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{
    if(!playing||!sound.current)return;
    const ctx=sound.current;
    let step=0;
    const pulse=()=>{
      const note=melody[step++%melody.length];
      if(!note)return;
      const tone=ctx.createOscillator(),volume=ctx.createGain(),now=ctx.currentTime;
      tone.type='triangle';tone.frequency.value=440*Math.pow(2,(note-69)/12);
      volume.gain.setValueAtTime(0,now);volume.gain.linearRampToValueAtTime(.045,now+.025);volume.gain.exponentialRampToValueAtTime(.001,now+.36);
      tone.connect(volume);volume.connect(ctx.destination);tone.start();tone.stop(now+.38);
    };
    pulse();const timer=setInterval(pulse,320);return ()=>clearInterval(timer);
  },[playing]);
  useEffect(()=>()=>{void sound.current?.close();},[]);
  return <button className="ip-radio" aria-label="岛上音乐" aria-pressed={playing} onClick={async()=>{
    if(playing){setPlaying(false);return;}
    sound.current??=new AudioContext();
    await sound.current.resume();setPlaying(true);
  }}>{playing?'Ⅱ':'♫'}</button>;
}
