import {useEffect,useState} from 'react';
import {getCommunityCatalog,type ApiCommunity} from '../api/client';

// Use the same complete Agent Launch catalog as TagAI's Token → Coin directory.
export function useTownCatalog(){
  const [towns,setTowns]=useState<ApiCommunity[]|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true,busy=false;
    async function load(){
      if(busy)return;
      busy=true;
      try{
        let page=0,id:string|undefined;
        const visited=new Set<number>(),all=new Map<string,ApiCommunity>();
        while(active){
          if(visited.has(page))throw new Error('目录分页重复');
          visited.add(page);
          const result=await getCommunityCatalog('new',page,'agent',id);
          if(!active)return;
          for(const town of result.rows)all.set(String(town.chainId??56)+':'+(town.token||town.tick).toLowerCase(),town);
          if(!result.hasMore){setTowns([...all.values()]);setError('');return;}
          id=result.catalogId;page=result.nextPage;
        }
      }catch{if(active)setError('Agent Launch 目录暂不可用，显示已保存目录');}finally{busy=false;}
    }
    void load();
    const timer=setInterval(load,60000);
    return ()=>{active=false;clearInterval(timer);};
  },[]);
  return {towns,error};
}
