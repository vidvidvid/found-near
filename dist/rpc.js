export const PROTOCOLS={
 linear:{id:'linear',name:'LiNEAR',contract:'linear-protocol.near',appUrl:'https://app.linearprotocol.org/account',appHost:'app.linearprotocol.org'},
 metapool:{id:'metapool',name:'Meta Pool',contract:'meta-pool.near',appUrl:'https://www.metapool.app/dashboard',appHost:'www.metapool.app/dashboard'}
};
export const CONTRACT=PROTOCOLS.linear.contract;
export const ENDPOINTS=['https://free.rpc.fastnear.com','https://rpc.mainnet.near.org'];
export function normalizeAccount(value){return value.trim().toLowerCase();}
export function validAccount(value){return value.length>=2&&value.length<=64&&/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);}
export function formatNear(yocto,decimals=4){
 const n=BigInt(yocto),unit=10n**24n;
 const whole=(n/unit).toLocaleString('en-US');
 if(!n)return '0';
 if(n<10n**BigInt(24-decimals))return `<0.${'0'.repeat(decimals-1)}1`;
 const fraction=(n%unit).toString().padStart(24,'0').slice(0,decimals).replace(/0+$/,'');
 return whole+(fraction?`.${fraction}`:'');
}
export function exactNear(yocto){const n=BigInt(yocto);return `${n/10n**24n}.${(n%10n**24n).toString().padStart(24,'0')}`.replace(/\.?0+$/,'')||'0';}
export class QueryError extends Error{constructor(message,code){super(message);this.code=code;}}
export async function rpc(params,{signal,fetcher=fetch,endpoints=ENDPOINTS}={}){
 const controllers=endpoints.map(()=>new AbortController());
 const abort=()=>controllers.forEach(c=>c.abort());
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 signal?.addEventListener('abort',abort,{once:true});
 try{
  return await Promise.any(endpoints.map(async(endpoint,i)=>{
   const timer=setTimeout(()=>controllers[i].abort(),12000);
   try{
    const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'found',method:'query',params}),signal:controllers[i].signal});
    if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
    const json=await response.json();
    if(json.error)throw new QueryError(JSON.stringify(json.error),json.error.cause?.name||json.error.data?.name);
    if(!json.result||json.result.error)throw new QueryError(json.result?.error||'Missing RPC result','CONTRACT_ERROR');
    const result=json.result;
    if(!Number.isSafeInteger(result.block_height)||typeof result.block_hash!=='string'||!result.block_hash)throw new Error('Missing RPC block identity');
    if(params.block_id!==undefined&&(typeof params.block_id==='number'?result.block_height!==params.block_id:result.block_hash!==params.block_id))throw new Error('RPC returned a different block');
    return result;
   }finally{clearTimeout(timer);}
  }));
 }catch(error){
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const causes=error.errors||[error];
  const missing=causes.find(e=>/UNKNOWN_ACCOUNT|does not exist/.test(e.message));
  if(missing)throw new QueryError('This NEAR account does not exist. Check the spelling.','UNKNOWN_ACCOUNT');
  throw new QueryError('We couldn’t read NEAR right now. Your balance is unknown — please try again.','UNAVAILABLE');
 }finally{abort();signal?.removeEventListener('abort',abort);}
}
function caller(contract,options){
 return async(method,args,block)=>{
  const r=await rpc({request_type:'call_function',account_id:contract,method_name:method,args_base64:btoa(JSON.stringify(args)),...(block?{block_id:block}:{finality:'final'})},options);
  const bytes=new Uint8Array(r.result),text=new TextDecoder().decode(bytes);
  return {data:text?JSON.parse(text):null,block:r.block_hash,height:r.block_height};
 };
}
function validateAccount(account){if(!validAccount(account))throw new QueryError('Enter a NEAR account, like you.near, or a NEAR implicit account.','INVALID');}
export function isU128(value){return typeof value==='string'&&/^\d+$/.test(value)&&BigInt(value)<2n**128n;}
function validateDetails(data,account,protocol){
 if(!data||data.account_id!==account||!isU128(data.unstaked_balance)||typeof data.can_withdraw!=='boolean')throw new QueryError(`${protocol} returned an unexpected response. Please try again.`,'UNAVAILABLE');
}
export async function scanAccount(account,options={}){
 validateAccount(account);
 const call=caller(CONTRACT,options);
 const requests=[call('get_account_details',{account_id:account},options.block)];
 if(!options.block)requests.push(rpc({request_type:'view_account',account_id:account,finality:'final'},options));
 const [details]=await Promise.all(requests),d=details.data;
 validateDetails(d,account,'LiNEAR');
 const amount=BigInt(d.unstaked_balance);
 const result={account,protocol:'linear',amount:d.unstaked_balance,block:details.block,height:details.height,checkedAt:Date.now()};
 if(amount===0n)return {...result,state:'empty'};
 if(!d.can_withdraw)return {...result,state:'pending'};
 try{
  const [paused]=await Promise.all([call('is_paused',{},details.block),call('can_account_withdraw',{account_id:account,amount:d.unstaked_balance},details.block)]);
  return {...result,state:paused.data===false?'found':'unavailable'};
 }catch(error){if(error.name==='AbortError')throw error;return {...result,state:'unavailable'};}
}
export async function scanMetaPoolAccount(account,options={}){
 validateAccount(account);
 const call=caller(PROTOCOLS.metapool.contract,options);
 const requests=[call('get_account',{account_id:account},options.block)];
 if(!options.block)requests.push(rpc({request_type:'view_account',account_id:account,finality:'final'},options));
 const [details]=await Promise.all(requests),d=details.data;
 validateDetails(d,account,'Meta Pool');
 const amount=BigInt(d.unstaked_balance);
 const result={account,protocol:'metapool',amount:d.unstaked_balance,block:details.block,height:details.height,checkedAt:Date.now()};
 if(amount===0n)return {...result,state:'empty'};
 if(!d.can_withdraw)return {...result,state:'pending'};
 if(/\.lockup\.near$/.test(account))return {...result,state:'unsupported'};
 try{
  const [state,availableResult]=await Promise.all([call('get_contract_state',{},details.block),call('get_account_available_balance',{account_id:account},details.block)]),data=state.data;
  if(!data||!['retrieved_for_unstake_claims','contract_account_balance','total_unstake_claims','total_available'].every(key=>isU128(data[key]))||!isU128(availableResult.data))throw new QueryError('Meta Pool returned an unexpected response. Please try again.','UNAVAILABLE');
  // take_from_available includes an existing balance within 0.001 NEAR (inclusive).
  const available=BigInt(availableResult.data),payout=amount+(available<=10n**21n?available:0n);
  const ready=BigInt(data.retrieved_for_unstake_claims)>=amount&&BigInt(data.total_unstake_claims)>=amount&&BigInt(data.total_available)+amount>=payout&&BigInt(data.contract_account_balance)>=payout;
  return {...result,state:ready?'found':'unavailable'};
 }catch(error){if(error.name==='AbortError')throw error;return {...result,state:'unavailable'};}
}
export async function scanProtocols(account,options={}){
 validateAccount(account);
 const view=await rpc({request_type:'view_account',account_id:account,finality:'final'},options);
 const block=view.block_height;
 const scans=await Promise.allSettled([scanAccount(account,{...options,block}),scanMetaPoolAccount(account,{...options,block})]);
 if(scans.every(result=>result.status==='rejected')){
  const error=scans[0].reason;
  if(error.name==='AbortError')throw error;
  throw new QueryError('We couldn’t check LiNEAR or Meta Pool right now. Your balances are unknown — please try again.','UNAVAILABLE');
 }
 return {account,block:view.block_hash,height:block,checkedAt:Date.now(),results:scans.map((result,index)=>{
  if(result.status==='fulfilled')return result.value;
  const protocol=index===0?'linear':'metapool';
  return {account,protocol,state:'error',message:result.reason.message,block:view.block_hash,height:block,checkedAt:Date.now()};
 })};
}
