import {createPublicClient,http,type Abi} from 'viem';
import {bsc} from 'viem/chains';
import abiJson from './abi/four-tax.json';
import {MULTICALL} from './flap';
import {rawUnits,type ProtocolSnapshot} from './protocol';
const abi=abiJson as Abi;
const rpcClient=createPublicClient({chain:bsc,transport:http('https://bsc-dataseed.binance.org',{timeout:12000,retryCount:1})});
// View-only ABI subset from Four's official tax modal; supports legacy and modular TaxToken.
export async function readFourTax(token:string,signal:AbortSignal,rpc:any=rpcClient):Promise<ProtocolSnapshot>{
 if(signal.aborted)throw new Error('已取消');
 const address=token as `0x${string}`,block=await rpc.getBlockNumber();
 if(await rpc.getChainId()!==56)throw new Error('Four RPC 链不匹配');
 for(const target of [MULTICALL,address]){const code=await rpc.getBytecode({address:target,blockNumber:block});if(!code||code==='0x')throw new Error('Four 查询合约未部署');}
 const functions=abiJson.map(item=>item.name);
 const rows=await rpc.multicall({multicallAddress:MULTICALL,blockNumber:block,allowFailure:true,contracts:functions.map(functionName=>({address,abi,functionName}))});
 if(rows.length!==functions.length)throw new Error('Four 合约返回不完整');
 const values=Object.fromEntries(rows.map((row:any,index:number)=>[functions[index],row.status==='success'?row.result:undefined]));
 for(const name of ['rateHolder','rateBurn','minShare','quote','decimals'])if(values[name]==null)throw new Error('Four 税收合约版本尚未适配，可打开官方页面查看');
 const buy=values.buyFeeRate??values.feeRateBuy??values.feeRate,sell=values.sellFeeRate??values.feeRateSell??values.feeRate;
 if(buy==null||sell==null)throw new Error('Four 税率尚未确认');
 const distribution=['rateHolder','rateBurn','rateFounder','rateLiquidity','rateGiggleCharity','rateBinanceCharity'].reduce((sum,name)=>sum+Number(values[name]??0),0);
 if(distribution!==100)throw new Error('Four 税收分配精度不匹配');
 const quote=values.quote==='0x0000000000000000000000000000000000000000'?'0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c':values.quote;
 const metaAbi=[{type:'function',name:'decimals',stateMutability:'view',inputs:[],outputs:[{type:'uint8'}]},{type:'function',name:'symbol',stateMutability:'view',inputs:[],outputs:[{type:'string'}]}];
 const [decimals,symbol]=await rpc.multicall({multicallAddress:MULTICALL,blockNumber:block,allowFailure:false,contracts:[{address:quote,abi:metaAbi,functionName:'decimals'},{address:quote,abi:metaAbi,functionName:'symbol'}]});
 if(signal.aborted)throw new Error('已取消');
 const total=values.quoteHolder??values.feeHolder,burn=values.tokenBurned??values.feeBurn;
 return {token,platform:'four',mode:'chain',block:Number(block),observedAt:new Date().toISOString(),sourceUrl:`https://four.meme/zh-TW/token/${token}`,
  buyTaxBps:Number(buy),sellTaxBps:Number(sell),taxStatus:Number(buy)>0||Number(sell)>0?'taxed':'untaxed',
  dividendEnabled:Number(values.rateHolder)>0,burnEnabled:Number(values.rateBurn)>0,dividendShareBps:Number(values.rateHolder)*100,burnShareBps:Number(values.rateBurn)*100,
  dividendAsset:symbol,minimumHolding:rawUnits(values.minShare,Number(values.decimals)),totalDividends:total==null?undefined:rawUnits(total,Number(decimals)),totalBurned:burn==null?undefined:rawUnits(burn,Number(values.decimals)),
  note:'按 Four 官方税费组件的只读 ABI 在同一区块读取；累计分红为公开分配账本，不是个人可领取金额。'};
}
