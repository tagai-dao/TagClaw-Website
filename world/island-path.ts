// Coordinates use the island artwork's 150 × 100 ground plane.
export type Point = {x:number;y:number};
const roads = [
  [73,0,77,39],[61,37,89,39],[60,39,65,55],[85,39,90,55],
  [61,55,89,59],[70,59,79,99],[4,48,65,53],[87,48,143,53],
  [40,35,44,50],[99,38,104,50],[109,39,117,50],
  [57,52,61,62],[52,60,61,64],[88,52,92,60],[90,58,111,61]
];
export const walkable=({x,y}:Point)=>roads.some(([left,top,right,bottom])=>x>=left&&x<=right&&y>=top&&y<=bottom);
export function route(start:Point,end:Point,isWalkable:(point:Point)=>boolean=walkable):Point[] {
  const origin={x:Math.round(start.x),y:Math.round(start.y)};
  const goal={x:Math.round(end.x),y:Math.round(end.y)};
  if(!isWalkable(goal))return [];
  const key=(p:Point)=>p.y*151+p.x;
  const seen=new Map<number,Point>([[key(origin),origin]]);
  const queue=[origin];
  for(let i=0;i<queue.length;i++){
    const p=queue[i];
    if(key(p)===key(goal)){
      const path:Point[]=[];
      for(let q=p;key(q)!==key(origin);q=seen.get(key(q))!)path.push(q);
      return path.reverse();
    }
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const q={x:p.x+dx,y:p.y+dy};
      if(!seen.has(key(q))&&isWalkable(q)){seen.set(key(q),p);queue.push(q);}
    }
  }
  return [];
}
