import {scanProtocols,normalizeAccount,validAccount} from './dist/rpc.js';

// Public, read-only convenience endpoint. Wallet preflights still read fresh RPC state.
// No disk persistence. Bounds cap RPC work, memory and the lifetime of each request.
export function createScanApi({scan=scanProtocols,now=Date.now,maxConcurrent=4,maxPerMinute=30,ttlMs=30000,timeoutMs=45000,maxCache=128}={}){
 const cache=new Map(),pending=new Map();let windowStart=now(),started=0;
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/scan/'))return false;
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','no-store');
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(req.method==='HEAD'?undefined:JSON.stringify(body));return true;};
  if(req.method!=='GET'){res.setHeader('Allow','GET');return send(405,{error:'Use GET.'});}
  let account;
  try{account=normalizeAccount(decodeURIComponent(url.pathname.slice('/api/scan/'.length)));}catch{return send(400,{error:'Invalid NEAR account.',code:'INVALID'});}
  if(!validAccount(account))return send(400,{error:'Invalid NEAR account.',code:'INVALID'});
  for(const [key,item] of cache)if(now()-item.savedAt>=ttlMs)cache.delete(key);
  const saved=cache.get(account);
  if(saved)return send(200,{...saved.result,cached:true,cacheAgeMs:now()-saved.savedAt});
  if(!pending.has(account)){
   if(now()-windowStart>=60000){windowStart=now();started=0;}
   if(pending.size>=maxConcurrent||started>=maxPerMinute){res.setHeader('Retry-After','60');return send(429,{error:'Scanner busy. Retry shortly.',code:'RATE_LIMITED'});}
   started++;
   const controller=new AbortController();let timer;
   const work=Promise.race([
    Promise.resolve().then(()=>scan(account,{signal:controller.signal})),
    new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();const error=Error('Scan timed out.');error.code='TIMEOUT';reject(error);},timeoutMs);})
   ]).then(result=>{
    // Partial or failed checks must be retried, never cached as a complete result.
    if(result.pools?.state==='complete'&&result.results.every(row=>!['error','unavailable'].includes(row.state))){
     if(cache.size>=maxCache)cache.delete(cache.keys().next().value);
     cache.set(account,{result,savedAt:now()});
    }
    return result;
   }).finally(()=>{clearTimeout(timer);pending.delete(account);});
   pending.set(account,work);
  }
  try{return send(200,{...await pending.get(account),cached:false,cacheAgeMs:0});}
  catch(error){
   const messages={INVALID:[400,'Invalid NEAR account.'],UNKNOWN_ACCOUNT:[404,'Account not found on NEAR mainnet.'],TIMEOUT:[504,'Scan timed out. Please retry.']};
   const [status,message]=messages[error.code]||[503,'Could not read NEAR. Balances are unknown; please retry.'];
   return send(status,{error:message,code:messages[error.code]?error.code:'UNAVAILABLE'});
  }
 };
}
