export const PROTOCOLS={
 linear:{id:'linear',name:'LiNEAR',contract:'linear-protocol.near',appUrl:'https://app.linearprotocol.org/account',appHost:'app.linearprotocol.org'},
 rnear:{id:'rnear',name:'rNEAR',contract:'lst.rhealab.near',appUrl:'https://app.rhea.finance/stake',appHost:'app.rhea.finance'},
 metapool:{id:'metapool',name:'Meta Pool',contract:'meta-pool.near',appUrl:'https://www.metapool.app/dashboard',appHost:'www.metapool.app/dashboard'}
};
export const CONTRACT=PROTOCOLS.linear.contract;
export const ENDPOINTS=['https://free.rpc.fastnear.com','https://rpc.intea.rs'];
// These exact bytes were verified against NEAR's pool factories. See research/coverage-expansion.
export const POOL_CODE_HASHES=Object.freeze(['J1arLz48fgXcGyCPVckFwLnewNH6j1uw79thsvwqGYTY','AjD4YJaXgpiRdiArqnzyDi7Bkr1gJms9Z2w7Ev5esTKB']);
// Balance reads only: this is deliberately NOT in the withdrawal allowlist.
export const AURORA_READ_CODE_HASH='5vf2Jkqpk11H7szLnY4XdPA6maJi1ND8xe346xtbtX8e';
export const RNEAR_CODE_HASH='EPLT4C61pkVYf5Km6dC4X9x5PMo6rfBwuEwo7vgKpmuv';
export const MAX_POOLS=24;
export const STAKING_API='https://api.fastnear.com/v1/account/';
// Mainnet storage cost, confirmed from protocol config; also retain 0.01 NEAR for execution.
const STORAGE_BYTE_COST=10n**19n,EXECUTION_RESERVE=10n**22n;
export function protocolInfo(id){
 if(Object.hasOwn(PROTOCOLS,id))return PROTOCOLS[id];
 const contract=typeof id==='string'&&id.startsWith('pool:')?id.slice(5):'';
 if(contract==='aurora.pool.near')return {id,name:'Aurora pool',contract,kind:'pool',appUrl:'https://app.mynearwallet.com/staking/aurora.pool.near',appHost:'app.mynearwallet.com'};
 if(validAccount(contract)&&!Object.values(PROTOCOLS).some(p=>p.contract===contract))return {id,name:contract,contract,kind:'pool',appUrl:'https://near-staking.trezu.org',appHost:'near-staking.trezu.org'};
 return null;
}
function hasLiquidBalance(view,amount){
 return isU128(view.amount)&&Number.isSafeInteger(view.storage_usage)&&view.storage_usage>=0&&BigInt(view.amount)>=BigInt(amount)+BigInt(view.storage_usage)*STORAGE_BYTE_COST+EXECUTION_RESERVE;
}
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
export function compactNear(yocto){
 const n=BigInt(yocto),unit=n>=10n**30n?10n**30n:n>=10n**27n?10n**27n:0n;
 if(!unit)return formatNear(yocto,4);
 const hundredths=n*100n/unit,whole=hundredths/100n,fraction=(hundredths%100n).toString().padStart(2,'0').replace(/0+$/,'');
 return whole.toString()+(fraction?'.'+fraction:'')+(unit===10n**30n?'M':'K');
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
 if(/\.lockup\.near$/.test(account))return {...result,state:'unsupported',reason:'lockup'};
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

export async function scanRnearAccount(account,options={}){
 validateAccount(account);
 const call=caller(PROTOCOLS.rnear.contract,options);
 const details=await call('get_account_details',{account_id:account},options.block),d=details.data;
 validateDetails(d,account,'rNEAR');
 const result={account,protocol:'rnear',amount:d.unstaked_balance,block:details.block,height:details.height,checkedAt:Date.now()};
 if(BigInt(d.unstaked_balance)===0n)return {...result,state:'empty'};
 if(!d.can_withdraw)return {...result,state:'pending'};
 if(/\.lockup\.near$/.test(account))return {...result,state:'unsupported',reason:'lockup'};
 try{
  const [view,paused,methodPaused,preflight]=await Promise.all([
   rpc({request_type:'view_account',account_id:PROTOCOLS.rnear.contract,block_id:details.block},options),
   call('is_paused',{},details.block),
   call('pa_is_paused',{key:'internal_withdraw'},details.block),
   call('can_account_withdraw',{account_id:account,amount:d.unstaked_balance},details.block)
  ]);
  if(view.code_hash!==RNEAR_CODE_HASH)return {...result,state:'unsupported',reason:'implementation'};
  const ready=paused.data===false&&methodPaused.data===false&&preflight.data===null&&hasLiquidBalance(view,result.amount);
  return {...result,codeHash:view.code_hash,state:ready?'found':'unavailable'};
 }catch(error){if(error.name==='AbortError')throw error;return {...result,state:'unavailable'};}
}
export async function discoverPools(account,{signal,fetcher=fetch}={}){
 validateAccount(account);
 const controller=new AbortController(),abort=()=>controller.abort();
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,10000);
 try{
  const response=await fetcher(STAKING_API+encodeURIComponent(account)+'/staking',{signal:controller.signal});
  if(!response.ok)throw Error('Pool discovery unavailable');
  const data=await response.json();
  if(data?.account_id!==account||!Array.isArray(data.pools)||data.pools.length>10000)throw Error('Unexpected pool discovery response');
  const pools=new Map();
  for(const row of data.pools){
   if(!validAccount(row?.pool_id||'')||row.last_update_block_height!==null&&(!Number.isSafeInteger(row.last_update_block_height)||row.last_update_block_height<0))throw Error('Unexpected pool discovery row');
   if(Object.values(PROTOCOLS).some(p=>p.contract===row.pool_id))continue;
   pools.set(row.pool_id,Math.max(pools.get(row.pool_id)||0,row.last_update_block_height||0));
  }
  return [...pools].map(([pool_id,last_update_block_height])=>({pool_id,last_update_block_height}));
 }catch(error){
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  throw new QueryError('Validator pool discovery is unavailable. These pools have not been checked.','DISCOVERY_UNAVAILABLE');
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function scanValidatorPool(account,contract,options={}){
 validateAccount(account);
 const protocol='pool:'+contract;
 if(!protocolInfo(protocol))throw new QueryError('Unsupported validator pool.','INVALID');
 const view=await rpc({request_type:'view_account',account_id:contract,...(options.block?{block_id:options.block}:{finality:'final'})},options);
 const result={account,protocol,codeHash:view.code_hash,block:view.block_hash,height:view.block_height,checkedAt:Date.now()};
 // A reviewed balance view is not approval to sign against a custom implementation.
 if(contract==='aurora.pool.near'&&view.code_hash===AURORA_READ_CODE_HASH){
  const details=await caller(contract,options)('get_account',{account_id:account},view.block_hash);
  validateDetails(details.data,account,contract);
  return {...result,state:'readonly',amount:details.data.unstaked_balance,reportedCanWithdraw:details.data.can_withdraw,withdrawalSupported:false};
 }
 // Never classify any other unknown implementation as empty or expose a signing action.
 if(!POOL_CODE_HASHES.includes(view.code_hash))return {...result,state:'unsupported',reason:'implementation'};
 const call=caller(contract,options),details=await call('get_account',{account_id:account},view.block_hash),d=details.data;
 validateDetails(d,account,contract);
 result.amount=d.unstaked_balance;
 if(BigInt(result.amount)===0n)return {...result,state:'empty'};
 if(!d.can_withdraw)return {...result,state:'pending'};
 if(/\.lockup\.near$/.test(account))return {...result,state:'unsupported',reason:'lockup'};
 try{
  const ready=await call('is_account_unstaked_balance_available',{account_id:account},view.block_hash);
  return {...result,state:ready.data===true&&hasLiquidBalance(view,result.amount)?'found':'unavailable'};
 }catch(error){if(error.name==='AbortError')throw error;return {...result,state:'unavailable'};}
}
async function poolResults(account,discovery,block,options){
 const all=discovery.status==='fulfilled'?discovery.value:[];
 const selected=all.filter(row=>row.last_update_block_height<=block).slice(0,MAX_POOLS);
 const results=new Array(selected.length);let next=0;
 await Promise.all(Array.from({length:Math.min(4,selected.length)},async()=>{
  for(;;){
   if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
   const index=next++;if(index>=selected.length)return;
   const contract=selected[index].pool_id;
   try{results[index]=await scanValidatorPool(account,contract,{...options,block});}
   catch(error){if(error.name==='AbortError')throw error;results[index]={account,protocol:'pool:'+contract,state:'error',message:error.message,height:block};}
  }
 }));
 return {results,coverage:{state:discovery.status==='rejected'?'error':selected.length<all.length?'partial':'complete',discovered:all.length,checked:selected.length,limit:MAX_POOLS}};
}
export async function scanProtocols(account,options={}){
 validateAccount(account);
 // Discovery happens alongside account verification; every balance is pinned to one finalized block.
 const [viewResult,discovery]=await Promise.allSettled([
  rpc({request_type:'view_account',account_id:account,finality:'final'},options),discoverPools(account,options)
 ]);
 if(viewResult.status==='rejected')throw viewResult.reason;
 const view=viewResult.value,block=view.block_height;
 const names=['linear','metapool','rnear'];
 const [scans,pools]=await Promise.all([
  Promise.allSettled([scanAccount(account,{...options,block}),scanMetaPoolAccount(account,{...options,block}),scanRnearAccount(account,{...options,block})]),
  poolResults(account,discovery,block,options)
 ]);
 if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
 const results=scans.map((result,index)=>result.status==='fulfilled'?result.value:{account,protocol:names[index],state:'error',message:result.reason.message,block:view.block_hash,height:block,checkedAt:Date.now()});
 return {account,block:view.block_hash,height:block,checkedAt:Date.now(),results:[...results,...pools.results],pools:pools.coverage};
}
