import type {Point} from './island-path';
/** Paths in the manor artwork, expressed as percentages of its fixed world plane. */
export const estateWalkable=({x,y}:Point)=>(x>=10&&x<=70&&y>=44&&y<=47)||(x>=37&&x<=41&&y>=45&&y<=80);
