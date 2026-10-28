export async function readWorldJson(response:Response):Promise<unknown>{
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('世界数据接口返回了网页，生产环境尚未配置 /world-data 服务');
 const value=await response.json();
 if(!response.ok)throw new Error(typeof value?.error==='string'?value.error:'世界数据服务暂不可用');
 return value;
}
