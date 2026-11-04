import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import './aipro-town.css';

const cid = 'bafybeiak2mtomvg4fjshos23t6hbw3kcsdcszy4jej2pa362o5wab3wpya';
const streets = [
  '~~~~~~~~~~~',
  '~T....T...~',
  '~.H...H.T.~',
  '~.........~',
  '~....+....~',
  '~.T.....T.~',
  '~.........~',
  '~~~~~~~~~~~',
];
const garden = [
  '~~~~~~~~~~~',
  '~T.....T..~',
  '~.F...M...~',
  '~.........~',
  '~....+....~',
  '~..T....T.~',
  '~.........~',
  '~~~~~~~~~~~',
];
const directions = [-11, 11, -1, 1];
const sprites: Record<string,string[]> = {
  T:['...g....','..ggg...','.gglgg..','ggllggg.','.ggggg..','...bb...','...bb...'],
  H:['...r....','..rrr...','.rryrr..','rrrrrrr.','.yybyy..','.ywbwy..','.yybyy..'],
  F:['........','.y..y.y.','yy.yy.y.','.b..b.b.','gg.gg.g.','.b..b.b.','bbbbbbb.'],
  M:['..bbb...','.bsssb..','.sssss..','.sssss..','.srrrs..','.sryrs..','bbbbbbb.'],
  visitor:['..bbb...','.bbbyb..','..yyby..','...yy...','..cccc..','.yccccy.','..b..b..'],
  '+':['........','...y....','..yyy...','.yyyyy..','..yyy...','...y....','........'],
};
const colors: Record<string,string> = {g:'#376546',l:'#73a65b',b:'#67442d',r:'#b85c39',y:'#f4cb75',w:'#c5e6db',s:'#60666b',c:'#276985'};
function Sprite({kind}:{kind:string}) {
  const rows=sprites[kind];
  return rows && <svg viewBox="0 0 8 8" aria-hidden="true" shapeRendering="crispEdges">
    {rows.flatMap((row,y)=>Array.from(row,(color,x)=>color==='.'?null:<rect key={y*8+x} x={x} y={y} width="1" height="1" fill={colors[color]}/>))}
  </svg>;
}
function passable(map: string[], cell: number) {
  return ['.', '+'].includes(map[Math.floor(cell / 11)]?.[cell % 11]);
}
function pathTo(map: string[], start: number, target: number) {
  const queue = [start], parents = new Map<number, number>([[start,start]]);
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    if (cell === target) {
      const path: number[] = [];
      for (let step = cell; step !== start; step = parents.get(step)!) path.unshift(step);
      return path;
    }
    for (const offset of directions) {
      const next = cell + offset;
      if (passable(map,next) && !parents.has(next)) {
        parents.set(next,cell);
        queue.push(next);
      }
    }
  }
  return [];
}

export default function AiproTown() {
  const { id } = useParams();
  return <Walk key={id ?? 'street'} id={id}/>;
}
function Walk({id}: {id?:string}) {
  const navigate = useNavigate();
  const valid = !!id && /^[1-9]\d{0,3}$/.test(id) && Number(id)<=3333;
  const map = valid ? garden : streets;
  const [cell,setCell] = useState(60);
  const [info,setInfo] = useState('');
  const [door,setDoor] = useState('1');
  const timer = useRef<ReturnType<typeof setInterval>|undefined>(undefined);
  const board = useRef<HTMLDivElement>(null);
  useEffect(()=>()=>clearInterval(timer.current),[]);
  function visit(target: number) {
    clearInterval(timer.current);
    board.current?.focus();
    const tile = map[Math.floor(target/11)]?.[target%11];
    const facility = ['H','F','M'].includes(tile);
    const destination = facility ? target+11 : target;
    if (!passable(map,destination)) return;
    const path = pathTo(map,cell,destination);
    const arrive = () => {
      if (tile==='H') navigate('/town/aipro/estate/'+(target%11===2?'1':'2'));
      if (tile==='F') setInfo('农田待开放。居民 NFT 与 AIPRO 质押接入后，这里将展示质押量和已确认的收获记录。');
      if (tile==='M') setInfo('金矿待开放。指定流动性池接入后，这里将展示庄园的 LP 仓位与奖励记录。');
    };
    if (!path.length) { if (cell===destination) arrive(); return; }
    let index=0;
    timer.current=setInterval(()=>{
      setCell(path[index++]);
      if(index===path.length){clearInterval(timer.current);arrive();}
    },95);
  }
  if(id && !valid) return <main className="aipro-walk"><h1>没有这个门牌</h1><Link to="/town/aipro">返回广场</Link></main>;
  return <main className="aipro-walk">
    <Link to={valid?'/town/aipro':'/main?town=AIPRO'}>← {valid?'返回广场':'小镇总览'}</Link>
    <h1>{valid?'庄园 #'+id:'AIPRO · 居民广场'}</h1>
    <p>访客开放日 · {valid?'庄园预览，归属待链上确认':'点击地面行走，点房屋拜访庄园。地图获得焦点后可用方向键。'}</p>
    <div className="aipro-grid" ref={board} tabIndex={0} aria-label="访客步行地图" onKeyDown={e=>{
      const delta:Record<string,number>={ArrowUp:-11,ArrowDown:11,ArrowLeft:-1,ArrowRight:1};
      if(delta[e.key]){e.preventDefault();clearInterval(timer.current);const next=cell+delta[e.key];if(passable(map,next))setCell(next);}
    }}>
      {map.join('').split('').map((tile,i)=>{
        const content=<Sprite kind={cell===i?'visitor':tile}/>;
        const name=tile==='H'?'拜访庄园 '+(i%11===2?'1':'2'):tile==='F'?'查看农田':tile==='M'?'查看金矿':'';
        return name?<button className="building" key={i} onClick={()=>visit(i)} aria-label={name}>{content}</button>:
          <span key={i} className={tile==='~'?'water':tile==='T'?'tree':'grass'} onClick={()=>visit(i)}>{content}</span>;
      })}
    </div>
    {valid?<section><img width="96" height="96" alt={'AIPRO 系列肖像 #'+id} src={'https://ipfs.4everland.io/ipfs/'+cid+'/'+id.padStart(4,'0')+'.png'}/><h2>庄园设施</h2><p>点选田地或矿炉查看开放进度。</p><p role="status">{info}</p></section>:
    <form onSubmit={e=>{e.preventDefault();navigate('/town/aipro/estate/'+Number(door));}}><label>庄园门牌（1–3333） <input required type="number" min="1" max="3333" value={door} onChange={e=>setDoor(e.target.value)}/></label> <button>前往庄园</button></form>}
    <p>居民 NFT 等待 TagAI NFT AMM Pool 上线。计划由持有 Binance Agent ID 的 Agent 铸造；Pool 买卖向所有交易者开放。</p>
    <Link to="/feed?town=AIPRO">查看 AIPRO 城中纪事 →</Link>
  </main>;
}
