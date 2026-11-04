import {walkable,type Point} from '../world/island-path';

type Guest = Point & {id:string;lastMove:number;lastChat:number};
interface RoomSocket extends WebSocket {
  serializeAttachment(value:Guest):void;
  deserializeAttachment():Guest;
}
interface RoomState {
  acceptWebSocket(socket:RoomSocket):void;
  getWebSockets():RoomSocket[];
}
declare const WebSocketPair:{new():{0:WebSocket;1:RoomSocket}};

export class IslandRoom {
  constructor(private state:RoomState){}
  private broadcast(message:object,except?:RoomSocket){
    const payload=JSON.stringify(message);
    for(const peer of this.state.getWebSockets()){
      if(peer!==except && peer.readyState===1)peer.send(payload);
    }
  }
  fetch(){
    const existing=this.state.getWebSockets().filter(s=>s.readyState===1);
    if(existing.length>=100)return new Response('Room full',{status:503});
    const pair=new WebSocketPair(),socket=pair[1];
    const guest:Guest={id:crypto.randomUUID(),x:75,y:62,lastMove:0,lastChat:0};
    this.state.acceptWebSocket(socket);
    socket.serializeAttachment(guest);
    socket.send(JSON.stringify({type:'welcome',id:guest.id,peers:existing.map(s=>s.deserializeAttachment())}));
    this.broadcast({type:'position',id:guest.id,x:guest.x,y:guest.y},socket);
    return new Response(null,{status:101,webSocket:pair[0]} as ResponseInit);
  }
  webSocketMessage(socket:RoomSocket,raw:string|ArrayBuffer){
    if(typeof raw!=='string'||raw.length>1024){socket.close(1008,'Invalid message');return;}
    let msg;
    try{msg=JSON.parse(raw);}catch{return;}
    if(!msg||typeof msg!=='object')return;
    const guest=socket.deserializeAttachment(),now=Date.now();
    if(msg.type==='position'&&Number.isInteger(msg.x)&&Number.isInteger(msg.y)&&walkable(msg)&&now-guest.lastMove>=40){
      guest.x=msg.x;guest.y=msg.y;guest.lastMove=now;
      socket.serializeAttachment(guest);
      this.broadcast({type:'position',id:guest.id,x:guest.x,y:guest.y},socket);
    }
    if(msg.type==='chat'&&typeof msg.text==='string'&&msg.text.trim()&&msg.text.length<=200){
      if(now-guest.lastChat<750){socket.send(JSON.stringify({type:'notice',text:'发送太快，请稍后重试。'}));return;}
      guest.lastChat=now;socket.serializeAttachment(guest);
      this.broadcast({type:'chat',id:guest.id,text:msg.text.trim()});
    }
  }
  webSocketClose(socket:RoomSocket){this.broadcast({type:'leave',id:socket.deserializeAttachment().id},socket);}
  webSocketError(socket:RoomSocket){socket.close(1011,'Connection error');}
}
