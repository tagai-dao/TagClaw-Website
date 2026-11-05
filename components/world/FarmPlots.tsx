import React from 'react';

/** Two fenced pixel-art beds occupy the existing farm footprint, below the town road. */
export default function FarmPlots(){
 const posts=Array.from({length:9},(_,i)=>12+i*24);
 return <svg className="town-farm-plots" viewBox="0 0 220 164" shapeRendering="crispEdges" aria-hidden="true">
  <defs>
   <g id="farm-post"><path d="M-3 0h6v17h-6z" fill="#503920"/><path d="M-2-2h4v17h-4z" fill="#ad7438"/><path d="M-2-2h4v3h-4z" fill="#edd395"/><path d="M-1 3h1v9h-1z" fill="#d4a454"/></g>
   <g id="farm-wheat"><path d="M0 0h2v13H0z" fill="#758329"/><path d="M-5 2h4v3h-4zM3 0h4v3H3zM-4-3h4v4h-4zM2-5h4v4H2zM0-8h2v6H0z" fill="#efb632"/><path d="M-4-3h2v2h-2zM2-5h2v2H2zM0-8h2v2H0zM-5 2h2v2h-2z" fill="#ffe589"/></g>
   <g id="farm-cabbage"><path d="M-6 1h12v6H-6zM-4-2h8v12h-8z" fill="#2b6538"/><path d="M-5 0h10v6H-5zM-3-3h6v11h-6z" fill="#76b94b"/><path d="M-2-2h4v6h-4zM-4 0h2v3h-2z" fill="#b4dc75"/><path d="M1 1h2v5H1z" fill="#4b913d"/></g>
   <g id="farm-pumpkin"><path d="M-7 0h14v7H-7zM-5-2h10v11H-5z" fill="#a85324"/><path d="M-6 0h12v6H-6zM-4-2h8v10H-4z" fill="#ed8b2c"/><path d="M-3-1h2v8h-2zM2-1h2v8H2z" fill="#ffbc51"/><path d="M-1-5h3v4h-3zM1-5h4v2H1z" fill="#456d31"/></g>
  </defs>
  <path d="M3 3h214v157H3z" fill="#5e9139"/>
  {[4,86].map((y,bed)=><g key={y} transform={`translate(0 ${y})`}>
   <path d="M9 6h202v62H9z" fill="#3f6d30"/>
   <path d="M15 13h190v48H15z" fill="#a77942"/>
   {[17,34,51].map(row=><g key={row}><path d={`M18 ${row}h184v10H18z`} fill="#65462e"/><path d={`M18 ${row+9}h184v2H18z`} fill="#c28c4c"/>
    {Array.from({length:12},(_,i)=><use key={i} href={bed===0?'#farm-wheat':i%3===0?'#farm-pumpkin':'#farm-cabbage'} transform={`translate(${24+i*15} ${row+3})`}/>)}</g>)}
   {/* Separate complete enclosures, each with a gate on its east side. */}
   {[1,64].map(rail=><g key={rail}><path d={`M9 ${rail+6}h202v5H9z`} fill="#513b24"/><path d={`M9 ${rail+5}h202v2H9z`} fill="#d5aa64"/>{posts.map(x=><use key={x} href="#farm-post" x={x} y={rail}/>)}</g>)}
   <path d="M9 12h4v52H9zM207 12h4v18h-4zM207 49h4v15h-4z" fill="#714b2b"/>
   {[24,45].map(y=><use key={y} href="#farm-post" x="12" y={y}/>)}
   <path d="M203 31h17v17h-17z" fill="#c7a164"/><path d="M204 34h16v2h-16zM204 42h16v2h-16z" fill="#edca88"/>
   <use href="#farm-post" x="208" y="18"/><use href="#farm-post" x="208" y="47"/>
  </g>)}
  <path d="M5 81h213v5H5z" fill="#d3b16a"/>
 </svg>;
}
