import React,{useEffect,useRef,useState} from 'react';
import {zoomMap} from '../../world/map-camera';
export default function SceneViewport({children,sceneKey}:{children:React.ReactNode;sceneKey?:string}){
 const viewport=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;originX:number;originY:number}|null>(null),moved=useRef(false);
 const [size,setSize]=useState({width:1000,height:650}),[camera,setCamera]=useState({zoom:1,x:0,y:0});
 useEffect(()=>{setCamera({zoom:1,x:0,y:0});},[sceneKey]);
 useEffect(()=>{
  const node=viewport.current;if(!node)return;
  const observer=new ResizeObserver(([entry])=>{setSize({width:entry.contentRect.width,height:entry.contentRect.height});setCamera({zoom:1,x:0,y:0});});observer.observe(node);
  const wheel=(event:WheelEvent)=>{event.preventDefault();const bounds=node.getBoundingClientRect();setCamera(previous=>zoomMap(previous,event.deltaY,event.clientX-bounds.left-bounds.width/2,event.clientY-bounds.top-bounds.height/2));};
  node.addEventListener('wheel',wheel,{passive:false});return()=>{observer.disconnect();node.removeEventListener('wheel',wheel);};
 },[]);
 const scale=Math.min(size.width/1000,size.height/650)*camera.zoom;
 return <div ref={viewport} className={`town-camera ${camera.zoom>1?'is-zoomed':''}`} tabIndex={0} aria-label="小镇场景：滚轮缩放，拖动探索，双击空白处恢复全景"
  onDoubleClick={event=>{if((event.target as HTMLElement).closest('button'))return;setCamera({zoom:1,x:0,y:0});}}
  onKeyDown={event=>{if(event.key==='Escape'||event.key==='0')setCamera({zoom:1,x:0,y:0});}}
  onPointerDown={event=>{if(event.button!==0)return;moved.current=false;drag.current={x:event.clientX,y:event.clientY,originX:camera.x,originY:camera.y};}}
  onPointerMove={event=>{if(!drag.current||camera.zoom===1)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;if(Math.hypot(dx,dy)<5)return;moved.current=true;event.currentTarget.setPointerCapture(event.pointerId);setCamera(previous=>({...previous,x:drag.current!.originX+dx,y:drag.current!.originY+dy}));}}
  onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
  onClickCapture={event=>{if(moved.current){event.preventDefault();event.stopPropagation();moved.current=false;}}}>
  <div className="town-camera-content" style={{left:(size.width-1000*scale)/2+camera.x,top:(size.height-650*scale)/2+camera.y,transform:`scale(${scale})`}}>{children}</div>
 </div>;
}
