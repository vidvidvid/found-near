export const CONTRACT = 'linear-protocol.near';
export const ENDPOINTS = ['https://free.rpc.fastnear.com','https://rpc.mainnet.near.org'];
export function normalizeAccount(value) { return value.trim().toLowerCase(); }
export function validAccount(value) { return !/^0x[0-9a-f]{40}$/.test(value) && value.length >= 2 && value.length <= 64 && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value); }
export function formatNear(yocto, decimals = 4) {
 const n = BigInt(yocto), unit = 10n ** 24n;
 const whole = (n / unit).toLocaleString('en-US');
 if (!n) return '0';
 if (n < 10n ** BigInt(24 - decimals)) return `<0.${'0'.repeat(decimals-1)}1`;
 const fraction = (n % unit).toString().padStart(24,'0').slice(0,decimals).replace(/0+$/,'');
 return whole + (fraction ? `.${fraction}` : '');
}
export function exactNear(yocto) { const n=BigInt(yocto);return `${n/10n**24n}.${(n%10n**24n).toString().padStart(24,'0')}`.replace(/\.?0+$/,'') || '0'; }
export class QueryError extends Error { constructor(message, code) { super(message); this.code=code; } }
export async function rpc(params, {signal, fetcher=fetch, endpoints=ENDPOINTS} = {}) {
 const controllers = endpoints.map(()=>new AbortController());
 const abort=()=>controllers.forEach(c=>c.abort());
 if(signal?.aborted) throw new DOMException('Aborted','AbortError');
 signal?.addEventListener('abort',abort,{once:true});
 try {
  return await Promise.any(endpoints.map(async (endpoint,i)=>{
   const timer=setTimeout(()=>controllers[i].abort(),12000);
   try {
    const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'found',method:'query',params}),signal:controllers[i].signal});
    if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
    const json=await response.json();
    if(json.error)throw new QueryError(JSON.stringify(json.error),json.error.cause?.name || json.error.data?.name);
    if(!json.result || json.result.error)throw new QueryError(json.result?.error || 'Missing RPC result','CONTRACT_ERROR');
    return json.result;
   }finally{clearTimeout(timer);}
  }));
 }catch(error){
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const causes=error.errors || [error];
  const missing=causes.find(e=>/UNKNOWN_ACCOUNT|does not exist/.test(e.message));
  if(missing)throw new QueryError('This NEAR account does not exist. Check the spelling.','UNKNOWN_ACCOUNT');
  throw new QueryError('We couldn’t read NEAR right now. Your balance is unknown — please try again.','UNAVAILABLE');
 }finally{abort();signal?.removeEventListener('abort',abort);}
}
export async function scanAccount(account, options={}) {
 if(!validAccount(account))throw new QueryError('Enter a NEAR account, like you.near, or a 64-character implicit account.','INVALID');
 const call=async(method,args,block)=>{
  const r=await rpc({request_type:'call_function',account_id:CONTRACT,method_name:method,args_base64:btoa(JSON.stringify(args)),...(block?{block_id:block}:{finality:'final'})},options);
  const bytes=new Uint8Array(r.result);const text=new TextDecoder().decode(bytes);
  return {data:text?JSON.parse(text):null,block:r.block_hash,height:r.block_height};
 };
 const [details]=await Promise.all([call('get_account_details',{account_id:account}),rpc({request_type:'view_account',account_id:account,finality:'final'},options)]);
 const d=details.data;
 if(!d || d.account_id!==account || !/^\d+$/.test(d.unstaked_balance) || typeof d.can_withdraw!=='boolean')throw new QueryError('LiNEAR returned an unexpected response. Please try again.','UNAVAILABLE');
 const amount=BigInt(d.unstaked_balance);
 const result={account,amount:d.unstaked_balance,block:details.block,height:details.height,checkedAt:Date.now()};
 if(amount===0n)return {...result,state:'empty'};
 if(!d.can_withdraw)return {...result,state:'pending'};
 try {
  const [paused]=await Promise.all([call('is_paused',{},details.block),call('can_account_withdraw',{account_id:account,amount:d.unstaked_balance},details.block)]);
  return {...result,state:paused.data===false?'found':'unavailable'};
 }catch(error){if(error.name==='AbortError')throw error;return {...result,state:'unavailable'};}
}
