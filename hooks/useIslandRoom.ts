import {useEffect,useRef,useState} from 'react';
import type {Point} from '../world/island-path';

export function useIslandRoom(room:string|null,position:Point){
  const socket=useRef<WebSocket|null>(null),latest=useRef(position);
  const [online,setOnline]=useState(false),[peers,setPeers]=useState<Record<string,Point>>({});
  const [lines,setLines]=useState<string[]>([]);
  useEffect(()=>{
    if(!room)return;
    let stopped=false,timer:ReturnType<typeof setTimeout>,attempt=0;
    function connect(){
      const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/rooms/aipro/'+room);
      socket.current=ws;
      ws.onmessage=({data})=>{
        if(stopped)return;
        const msg=JSON.parse(data);
        if(msg.type==='welcome'){
          attempt=0;setOnline(true);setPeers(Object.fromEntries(msg.peers.map((p:Point&{id:string})=>[p.id,p])));
          ws.send(JSON.stringify({type:'position',...latest.current}));
        }
        if(msg.type==='position')setPeers(old=>({...old,[msg.id]:{x:msg.x,y:msg.y}}));
        if(msg.type==='leave')setPeers(old=>{const next={...old};delete next[msg.id];return next;});
        if(msg.type==='chat'||msg.type==='notice')setLines(old=>[...old.slice(-49),msg.type==='chat'?'访客 '+msg.id.slice(0,5)+' · '+msg.text:msg.text]);
      };
      ws.onclose=()=>{if(stopped)return;setOnline(false);setPeers({});timer=setTimeout(connect,Math.min(15000,1000*2**attempt++));};
    }
    connect();
    return ()=>{stopped=true;clearTimeout(timer);socket.current?.close();socket.current=null;};
  },[room]);
  useEffect(()=>{
    latest.current=position;
    if(socket.current?.readyState===1)socket.current.send(JSON.stringify({type:'position',...position}));
  },[position]);
  function send(text:string){
    if(!online||socket.current?.readyState!==1||!text.trim())return false;
    socket.current.send(JSON.stringify({type:'chat',text:text.trim()}));return true;
  }
  return {online,peers,lines,send};
}
