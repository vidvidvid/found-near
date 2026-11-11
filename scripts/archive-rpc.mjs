import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

// Shared by the census and historical analysis. Cache keys include every RPC
// parameter; callers validate a query's height AND hash against an archived header.
export async function createArchiveRpc({cacheDir,endpoint,intervalMs=250,validate=(r)=>r,fetcher=fetch,retries=5,timeoutMs=45000}={}){
 await mkdir(cacheDir+'/cache',{recursive:true});
 let nextRequest=0;
 const stats={requests:0,cacheHits:0,rateLimits:0};
 async function request(method,params,url=endpoint){
  const file=cacheDir+'/cache/'+createHash('sha256').update(JSON.stringify({method,params})).digest('hex')+'.json';
  try{const r=validate(JSON.parse(await readFile(file,'utf8')),method,params);stats.cacheHits++;return r;}catch(error){if(error.code!=='ENOENT')throw error;}
  for(let attempt=0;attempt<retries;attempt++){
   while(Date.now()<nextRequest)await new Promise(r=>setTimeout(r,Math.min(1000,nextRequest-Date.now())));
   nextRequest=Date.now()+intervalMs;stats.requests++;
   try{
    const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'found-research',method,params}),signal:AbortSignal.timeout(timeoutMs)});
    if(response.status===429){const message=await response.text(),delay=Number(response.headers.get('retry-after'))||Number(message.match(/retry after (\d+)/i)?.[1])||60;nextRequest=Date.now()+(delay+1)*1000;stats.rateLimits++;throw Object.assign(Error('Provider rate limit'),{code:'RATE_LIMIT',rpcError:message,retryAfterSeconds:delay});}
    if(!response.ok)throw Object.assign(Error('RPC HTTP '+response.status),{code:'HTTP_'+response.status});
    const body=await response.json();
    if(body.error||body.result?.error){const payload=body.error||body.result.error,text=JSON.stringify(payload);throw Object.assign(Error(text),{code:body.error?.cause?.name||'RPC_ERROR',rpcError:payload,permanent:/UNKNOWN_ACCOUNT|UNKNOWN_BLOCK|MethodNotFound|METHOD_NOT_FOUND|GasLimitExceeded|TooLargeContractState|ContractExecutionError/.test(text),missingAccount:/"name":"UNKNOWN_ACCOUNT"/.test(text)});}
    const result=validate(body.result,method,params);await writeFile(file,JSON.stringify(result));return result;
   }catch(error){stats.lastProblem={at:new Date().toISOString(),code:error.code||'ERROR',message:error.message.slice(0,180),retryAfterSeconds:error.retryAfterSeconds};if(error.permanent||attempt===retries-1)throw error;await new Promise(r=>setTimeout(r,3000*2**attempt));}
  }
 }
 return {request,stats};
}
