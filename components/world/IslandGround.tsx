import React,{useEffect,useRef} from 'react';

// Render once at the authored pixel resolution; the camera moves the cached surface.
export default function IslandGround({src='/town/aipro-island.webp'}:{src?:string}){
  const surface=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const image=new Image();
    image.onload=()=>{
      const canvas=surface.current;
      if(!canvas)return;
      canvas.width=image.naturalWidth;
      canvas.height=image.naturalHeight;
      const context=canvas.getContext('2d');
      if(!context)return;
      context.imageSmoothingEnabled=false;
      context.drawImage(image,0,0);
    };
    image.src=src;
    return ()=>{image.onload=null;};
  },[src]);
  return <canvas aria-hidden="true" className="ip-ground" ref={surface}/>;
}
