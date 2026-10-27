import {createPublicClient,http,parseAbi} from 'viem';
import {bsc} from 'viem/chains';
import {rawUnits,type ProtocolSnapshot} from './protocol';
// ABI and helper are pinned to Flap's official BNB tax-info component (2026-10-27).
export const FLAP_HELPER='0x53841c73217735F37BC1775538b03b23feFD8346' as const;
export const MULTICALL='0xcA11bde05977b3631167028862bE2a173976CA11' as const;
const abi=parseAbi([
 'function getTaxTokenInfo(address taxToken) view returns ((uint16 marketBps,uint16 deflationBps,uint16 lpBps,uint16 dividendBps,uint16 feeRate,uint256 burntTokenAmount,uint256 totalQuoteSentToDividend,uint256 totalQuoteAddedToLiquidity,uint256 totalTokenAddedToLiquidity,uint256 totalQuoteSentToMarketing,address marketingWallet,address quoteToken,uint256 minimumShareBalance))',
 'function getTaxTokenInfoV2(address taxToken) view returns ((uint16 marketBps,uint16 deflationBps,uint16 lpBps,uint16 dividendBps,uint16 buyTaxRate,uint16 sellTaxRate,uint256 burntTokenAmount,uint256 totalQuoteSentToDividend,uint256 totalQuoteAddedToLiquidity,uint256 totalTokenAddedToLiquidity,uint256 totalQuoteSentToMarketing,address dividendToken,address quoteToken,uint256 minimumShareBalance,(address addr,address factory,uint8 riskLevel,bool isOfficialVault,bool isVault,bool isAIConsumer) vaultInfo))',
 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'
]);
const client=createPublicClient({chain:bsc,transport:http('https://bsc-dataseed.binance.org',{timeout:12000,retryCount:1})});
export async function readFlapTax(token:string,signal:AbortSignal,rpc:any=client):Promise<ProtocolSnapshot> {
 const address=token as `0x${string}`;
 if(signal.aborted)throw new Error('已取消');
 const block=await rpc.getBlockNumber();
 if(await rpc.getChainId()!==56)throw new Error('Flap RPC 链不匹配');
 for(const target of [MULTICALL,FLAP_HELPER]){const code=await rpc.getBytecode({address:target,blockNumber:block});if(!code||code==='0x')throw new Error('Flap 查询合约未部署');}
 const [info,decimals]=await rpc.multicall({multicallAddress:MULTICALL,blockNumber:block,allowFailure:false,contracts:[{address:FLAP_HELPER,abi,functionName:'getTaxTokenInfo',args:[address]},{address,abi,functionName:'decimals'}]});
 if([info.marketBps,info.deflationBps,info.lpBps,info.dividendBps].reduce((a:number,b:number)=>a+Number(b),0)!==10000)throw new Error('Flap 税收配置尚未确认');
 const optional=await rpc.multicall({multicallAddress:MULTICALL,blockNumber:block,allowFailure:true,contracts:[{address:FLAP_HELPER,abi,functionName:'getTaxTokenInfoV2',args:[address]}]});
 const v2=optional[0]?.status==='success'?optional[0].result:null;
 const asset=info.quoteToken;
 const quote=asset==='0x0000000000000000000000000000000000000000'?'0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c':asset;
 const [assetDecimals,symbol]=await rpc.multicall({multicallAddress:MULTICALL,blockNumber:block,allowFailure:false,contracts:[{address:quote,abi,functionName:'decimals'},{address:quote,abi,functionName:'symbol'}]});
 if(signal.aborted)throw new Error('已取消');
 return {token,platform:'flap',mode:'chain',block:Number(block),observedAt:new Date().toISOString(),sourceUrl:`https://flap.sh/bnb/${token}/taxinfo?lang=zh`,
  taxStatus:Number(v2?.buyTaxRate??info.feeRate)>0||Number(v2?.sellTaxRate??info.feeRate)>0?'taxed':'untaxed',buyTaxBps:Number(v2?.buyTaxRate??info.feeRate),sellTaxBps:Number(v2?.sellTaxRate??info.feeRate),
  dividendEnabled:Number(info.dividendBps)>0,burnEnabled:Number(info.deflationBps)>0,dividendShareBps:Number(info.dividendBps),burnShareBps:Number(info.deflationBps),
  dividendAsset:symbol,minimumHolding:rawUnits(info.minimumShareBalance,Number(decimals)),totalDividends:rawUnits(info.totalQuoteSentToDividend,Number(assetDecimals)),totalBurned:rawUnits(info.burntTokenAmount,Number(decimals)),
  note:'通过 Flap 官方 Helper 在同一区块读取配置及累计账本。所有合约读取均通过 Multicall；个人可领取金额尚未查询。'};
}
