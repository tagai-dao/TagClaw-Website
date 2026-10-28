export interface MapCamera {zoom:number;x:number;y:number}
// Pointer coordinates are relative to the viewport center. Preserve its map point.
export function zoomMap(previous:MapCamera,delta:number,x:number,y:number):MapCamera {
 const zoom=Math.max(1,Math.min(4,previous.zoom*Math.exp(-Math.max(-120,Math.min(120,delta))*.002)));
 const ratio=zoom/previous.zoom;
 return {zoom,x:zoom===1?0:x-(x-previous.x)*ratio,y:zoom===1?0:y-(y-previous.y)*ratio};
}
