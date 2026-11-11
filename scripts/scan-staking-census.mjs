import {createArchiveRpc} from './archive-rpc.mjs';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {POOL_CODE_HASHES,RNEAR_CODE_HASH} from '../dist/rpc.js';
import {decodeRnear,decodeFactory,MINIMUM,publishSnapshot} from './census-model.mjs';

const DEFAULT_BLOCK=223975859;
export async function scanCensus({block=DEFAULT_BLOCK,cacheDir='/tmp/found-expanded-census',rpcUrl=process.env.CENSUS_RPC||'https://near.drpc.org',stateUrl=process.env.CENSUS_STATE_RPC||'https://rpc.intea.rs',intervalMs=250}={}){
 let header;
 const {request,stats}=await createArchiveRpc({cacheDir,endpoint:rpcUrl,intervalMs,validate:(r,method)=>{
  if(method==='query'&&(r.block_height!==block||r.block_hash!==header.hash))throw Error('RPC ignored the pinned block');return r;
 }});
 const blockData=await request('block',{block_id:block});header=blockData.header;
 if(header.height!==block||typeof header.hash!=='string'||!/^\d+$/.test(header.timestamp))throw Error('Invalid block header');
 const query=(account_id,request_type,extra={},endpoint)=>request('query',{request_type,account_id,...extra,block_id:block},endpoint);
 const call=async(account,method,args={})=>{const r=await query(account,'call_function',{method_name:method,args_base64:Buffer.from(JSON.stringify(args)).toString('base64')});return JSON.parse(Buffer.from(r.result).toString());};
 const state=async(account,prefix,file)=>{
  let result;try{result=JSON.parse(gunzipSync(await readFile(cacheDir+'/'+file)).toString());}catch(error){if(error.code!=='ENOENT')throw error;result=await query(account,'view_state',{prefix_base64:Buffer.from(prefix).toString('base64')},stateUrl);}
  if(result.block_height!==block||result.block_hash!==header.hash)throw Error('State archive belongs to another block');
  await writeFile(cacheDir+'/'+file,gzipSync(JSON.stringify(result)));return result;
 };
 const meta={block,hash:header.hash,asOf:new Date(Number(BigInt(header.timestamp)/1000000n)).toISOString(),complete:false,errors:[],unsupported:[],closed:[],discoveredPools:0};
 const raw={};
 const enumerate=async account=>{
  const count=await call(account,'get_number_of_accounts');if(!Number.isSafeInteger(count)||count<0||count>1000000)throw Error('Invalid account count');
  const rows=[];
  for(let start=0;start<count;start+=500){const expected=Math.min(500,count-start),page=await call(account,'get_accounts',{from_index:start,limit:expected});if(!Array.isArray(page)||page.length!==expected)throw Error('Incomplete account page');rows.push(...page);}
  raw[account]=rows;
 };
 const work=async(items,fn)=>{let index=0;await Promise.all(Array.from({length:4},async()=>{for(;;){const i=index++;if(i>=items.length)return;await fn(items[i]);}}));};
 console.log('Reading finalized block',block);
 if((await query('lst.rhealab.near','view_account')).code_hash!==RNEAR_CODE_HASH)throw Error('Unreviewed rNEAR version');
 const rnear=decodeRnear((await state('lst.rhealab.near','','rnear-state.json.gz')).values,await call('lst.rhealab.near','get_number_of_accounts'));
 await work(rnear.filter(r=>BigInt(r.unstaked_balance)>MINIMUM),async row=>{const detail=await call('lst.rhealab.near','get_account_details',{account_id:row.account_id});if(detail.account_id!==row.account_id||detail.unstaked_balance!==row.unstaked_balance||typeof detail.can_withdraw!=='boolean')throw Error('Decoded rNEAR record differs from public view');row.can_withdraw=detail.can_withdraw;});
 raw['lst.rhealab.near']=rnear;
 await Promise.all(['linear-protocol.near','meta-pool.near'].map(enumerate));
 const pools=[];
 for(const factory of ['poolv1.near','pool.near'])pools.push(...decodeFactory((await state(factory,'se',factory+'-state.json.gz')).values,await call(factory,'get_number_of_staking_pools_created'),factory));
 if(new Set(pools).size!==pools.length)throw Error('Duplicate pool');meta.discoveredPools=pools.length;
 let finished=0;
 await work(pools,async pool=>{
  let account;
  try{account=await query(pool,'view_account');}catch(error){if(error.missingAccount)meta.closed.push(pool);else meta.errors.push({contract:pool,error:error.message});}
  if(account){if(!POOL_CODE_HASHES.includes(account.code_hash))meta.unsupported.push({contract:pool,codeHash:account.code_hash});else try{await enumerate(pool);}catch(error){meta.errors.push({contract:pool,error:error.message});}}
  if(++finished%25===0){console.log('Pools',finished,'/',pools.length,'errors',meta.errors.length);await writeFile(cacheDir+'/progress.json',JSON.stringify({...meta,finishedPools:finished}));}
 });
 meta.complete=meta.errors.length===0;meta.unsupported.sort((a,b)=>(a.contract<b.contract?-1:a.contract>b.contract?1:0));meta.closed.sort();meta.errors.sort((a,b)=>(a.contract<b.contract?-1:a.contract>b.contract?1:0));
 await writeFile(cacheDir+'/raw-accounts.json.gz',gzipSync(JSON.stringify(raw)));await writeFile(cacheDir+'/metadata.json',JSON.stringify(meta,null,2));
 const snapshot=publishSnapshot(meta,raw);
 console.log(snapshot.accounts.length,'unique accounts with qualifying balances;',stats.requests,'new RPC reads');
 return snapshot;
}

async function main(){
 let block=DEFAULT_BLOCK,cacheDir='/tmp/found-expanded-census',output=fileURLToPath(new URL('../dist/leaderboard.json',import.meta.url)),check=false;
 const args=process.argv.slice(2);
 for(let i=0;i<args.length;i++){
  if(args[i]==='--block')block=Number(args[++i]);
  else if(args[i]==='--cache-dir')cacheDir=resolve(args[++i]);
  else if(args[i]==='--output')output=resolve(args[++i]);
  else if(args[i]==='--check')check=true;
  else if(args[i]==='--help'){console.log('node scripts/scan-staking-census.mjs [--block HEIGHT] [--cache-dir PATH] [--output PATH] [--check]');return;}
  else throw Error('Unknown argument '+args[i]);
 }
 if(!Number.isSafeInteger(block)||block<=0)throw Error('Invalid block');
 const serialized=JSON.stringify(await scanCensus({block,cacheDir}));
 if(check){if(await readFile(output,'utf8')!==serialized)throw Error('Census differs from published snapshot');console.log('Snapshot verified');return;}
 await mkdir(dirname(output),{recursive:true});const temporary=output+'.'+process.pid+'.tmp';await writeFile(temporary,serialized);await rename(temporary,output);console.log('Wrote',output);
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
