import React from 'react';
import atlasPreview from '../../assets/world-atlas-preview.webp?inline';
import townPreview from '../../assets/aipro-island-preview.webp?inline';

export default function IslandGround({src='/town/aipro-island.webp'}:{src?:string}){
  const preview=src==='/town/world-atlas.webp'?atlasPreview:townPreview;
  return <div className="ip-ground" aria-hidden="true"
    style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',backgroundImage:`url(${preview})`,backgroundSize:'100% 100%',imageRendering:'pixelated'}}>
    <img alt="" src={src} fetchPriority="high" style={{width:'100%',height:'100%',display:'block'}}/>
  </div>;
}
