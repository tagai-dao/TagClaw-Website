import type { ApiCommunity } from '../api/client';
import { protocolUrl } from './protocol';
export interface TownFacility {
  status:'confirmed'|'pending';
  description:string;
  sourceUrl?:string;
  contract?:string;
}
export interface TownFacilities {vault?:TownFacility;burn?:TownFacility}
// Only exact chain + contract identifies the official GANG token. A symbol is not evidence.
const GANG='0x0c6302401aa5325c2e36f170f52c00b1d220b405';
export function townFacilities(town:ApiCommunity|null):TownFacilities {
  if(!town?.token||Number(town.chainId??56)!==56)return {};
  const config=town.worldCapabilities;
  const officialGang=town.token.toLowerCase()===GANG;
  const platform=officialGang||['flap-id-agent-curve','four-agent-id','gang','gang-agent'].includes(town.launchProtocol||'')||([15,16,17].includes(Number(town.version))&&Number(town.isImport||0)===0);
  const result:TownFacilities={};
  if(config?.holderDividends?.enabled===true){
    result.vault={status:'confirmed',description:'该代币已配置持仓分红。金库余额、分配记录和个人可领取金额等待索引接入。',...config.holderDividends};
  }else if(platform&&config?.holderDividends?.enabled!==false&&config?.taxStatus!=='untaxed'){
    result.vault={status:'pending',sourceUrl:protocolUrl(town),description:'持仓分红金库预留场所。该代币的税制、持仓门槛、分红资产与分配合约尚待核验；平台来源不代表已启用分红。'};
  }
  if(config?.autoBurn?.enabled===true&&['tax-burn','buyback-burn','protocol-burn'].includes(config.autoBurn.mechanism)){
    result.burn={status:'confirmed',description:'协议已配置自动销毁机制。累计销毁量、触发记录与本次销毁金额等待索引接入。',...config.autoBurn};
  }else if(officialGang&&config?.autoBurn?.enabled!==false){
    result.burn={status:'confirmed',sourceUrl:'https://gang.fun/burn',description:'GANG 协议将部分平台费用用于回购 GANG 并发送至销毁地址，由 Keeper 定时触发。销毁目标是 GANG，不表示其他 Gang 发行的代币会自动销毁自身。实时累计量与流水尚未接入。'};
  }
  return result;
}
