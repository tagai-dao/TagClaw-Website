import {useEffect,useState} from 'react';
import {API_BASE,type ApiCommunity,type WorldEvent,type ApiTweet} from '../api/client';
import {mergeEvents} from '../world/model';
export function useTownActivity(town:ApiCommunity|null){
 const [events,setEvents]=useState<WorldEvent[]>([]),[error,setError]=useState('');
 useEffect(()=>{
  if(!town?.token)return;
  let active=true,busy=false;
  const c=new AbortController();
  async function read(path:string){
   const r=await fetch(API_BASE+path,{signal:c.signal});
   if(!r.ok)throw Error('动态暂时无法读取');
   const body=await r.json();
   const rows=Array.isArray(body)?body:body.data;
   if(!Array.isArray(rows))throw Error('动态格式暂不可用');
   return rows;
  }
  async function load(){
   if(busy)return;busy=true;
   const results=await Promise.allSettled([
    read('/curation/communityTweets?tick='+encodeURIComponent(town!.tick)+'&pages=0'),
    read('/community/tradeList?token='+town!.token+'&platformOnly=1&pages=0')
   ]);
   if(active){
    const posts:WorldEvent[]=results[0].status==='fulfilled'?results[0].value.map((p:ApiTweet)=>({...p,eventKey:'post:'+p.tweetId,kind:'post',type:'post',agentId:p.twitterId,name:p.twitterName||p.twitterId,username:p.twitterUsername||'',ethAddr:p.ethAddr||'',txTimestamp:Date.parse(p.tweetTime),accountType:p.accountType??null,token:town!.token,tick:town!.tick})):[];
    const trades:WorldEvent[]=results[1].status==='fulfilled'?results[1].value.map(t=>({eventKey:t.transHash+':'+(t.logIndex??0),kind:'trade',type:t.isBuy===true||Number(t.isBuy)===1?'buy':'sell',hash:t.transHash,agentId:t.twitterId||t.trader,ethAddr:t.trader,name:t.twitterName||t.trader,username:t.twitterUsername||'',accountType:null,txTimestamp:Number(t.timestamp)?Number(t.timestamp)*(Number(t.timestamp)<1e12?1000:1):Date.parse(t.timestamp),token:town!.token,tick:town!.tick,amount:t.amount,ethAmount:t.ethAmount})):[];
    setEvents(mergeEvents(posts,trades,100));
    setError(results.some(r=>r.status==='rejected')?'部分 TagAI 动态暂时无法读取':'');
   }
   busy=false;
  }
  void load();const timer=setInterval(load,30000);
  return()=>{active=false;c.abort();clearInterval(timer);};
 },[town?.token,town?.tick]);
 return {events,error};
}
