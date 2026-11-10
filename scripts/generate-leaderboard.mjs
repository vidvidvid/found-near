import {readFile,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTRACT,rpc,isU128,validAccount} from '../dist/rpc.js';

const DEFAULT_BLOCK=223800610;
const PAGE_SIZE=1000;
const MINIMUM_BALANCE=10n**22n;
const OUTPUT=fileURLToPath(new URL('../dist/leaderboard.json',import.meta.url));
const SCOPE='LiNEAR only; matured balances, not proven abandoned funds';

export function buildSnapshot(accounts,block,asOf){
 const seen=new Set();
 for(const account of accounts){
  if(!account||typeof account.account_id!=='string'||!validAccount(account.account_id)||!isU128(account.unstaked_balance)||!isU128(account.staked_balance)||typeof account.can_withdraw!=='boolean')throw new Error('Invalid census account record.');
  if(seen.has(account.account_id))throw new Error(`Duplicate census account: ${account.account_id}`);
  seen.add(account.account_id);
 }
 const qualified=accounts.filter(account=>account.can_withdraw&&BigInt(account.unstaked_balance)>MINIMUM_BALANCE);
 qualified.sort((a,b)=>{
  const left=BigInt(a.unstaked_balance),right=BigInt(b.unstaked_balance);
  return left===right?0:left>right?-1:1;
 });
 return {block,asOf,scope:SCOPE,accounts:qualified.map(account=>({
  account_id:account.account_id,
  unstaked_balance:account.unstaked_balance,
  staked_balance:account.staked_balance,
  can_withdraw:account.can_withdraw
 }))};
}

async function retry(operation){
 for(let attempt=0;attempt<5;attempt++){
  try{return await operation();}
  catch(error){
   if(attempt===4)throw error;
   await new Promise(resolve=>setTimeout(resolve,750*2**attempt));
  }
 }
}

async function fetchBlock(block,endpoints){
 const errors=[];
 for(const endpoint of endpoints){
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'found-census-block',method:'block',params:{block_id:block}}),signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
   const json=await response.json();
   if(json.error||!json.result?.header)throw new Error(JSON.stringify(json.error||'Missing block result'));
   return json.result;
  }catch(error){errors.push(error);}
 }
 throw new AggregateError(errors,'Could not read the snapshot block from any RPC provider.');
}

export async function generateSnapshot({block=DEFAULT_BLOCK,endpoints=['https://archival-rpc.mainnet.fastnear.com','https://archival-rpc.mainnet.near.org'],query=rpc,blockQuery=fetchBlock}={}){
 const header=await retry(()=>blockQuery(block,endpoints));
 if(header.header.height!==block||typeof header.header.hash!=='string'||!header.header.hash)throw new Error('Snapshot header does not match requested block.');
 const asOf=new Date(Number(BigInt(header.header.timestamp)/1000000n)).toISOString().slice(0,10);
 const call=async(method,args)=>{
  const result=await retry(()=>query({request_type:'call_function',account_id:CONTRACT,method_name:method,args_base64:Buffer.from(JSON.stringify(args)).toString('base64'),block_id:block},{endpoints}));
  if(result.block_height!==block||result.block_hash!==header.header.hash)throw new Error(`RPC returned block ${result.block_height} instead of ${block}.`);
  const bytes=new Uint8Array(result.result);
  return JSON.parse(new TextDecoder().decode(bytes));
 };
 const total=await call('get_number_of_accounts',{});
 if(!Number.isSafeInteger(total)||total<0)throw new Error('LiNEAR returned an invalid account count.');
 const accounts=[];
 for(let fromIndex=0;fromIndex<total;fromIndex+=PAGE_SIZE){
  const expected=Math.min(PAGE_SIZE,total-fromIndex);
  const page=await call('get_accounts',{from_index:fromIndex,limit:expected});
  if(!Array.isArray(page)||page.length!==expected)throw new Error(`Incomplete account page at index ${fromIndex}.`);
  accounts.push(...page);
 }
 const snapshot=buildSnapshot(accounts,block,asOf);
 return {snapshot,total};
}

function usage(){
 console.log('Usage: node scripts/generate-leaderboard.mjs [--block HEIGHT] [--output PATH] [--check]');
}

async function main(){
 let block=DEFAULT_BLOCK,output=OUTPUT,check=false;
 const args=process.argv.slice(2);
 for(let i=0;i<args.length;i++){
  if(args[i]==='--block'){
   block=Number(args[++i]);
   if(!Number.isSafeInteger(block)||block<=0)throw new Error('--block requires a positive integer height.');
  }else if(args[i]==='--output'){
   if(!args[++i])throw new Error('--output requires a path.');
   output=resolve(args[i]);
  }else if(args[i]==='--check')check=true;
  else if(args[i]==='--help'){usage();return;}
  else throw new Error(`Unknown argument: ${args[i]}`);
 }
 const {snapshot,total}=await generateSnapshot({block});
 const serialized=JSON.stringify(snapshot);
 if(check){
  const existing=await readFile(output,'utf8');
  if(serialized!==existing)throw new Error(`Regenerated snapshot differs from ${output}.`);
  console.log(`Verified ${snapshot.accounts.length} qualifying accounts from ${total} accounts at block ${block} (${snapshot.asOf}).`);
  return;
 }
 await mkdir(dirname(output),{recursive:true});
 const temporary=`${output}.${process.pid}.tmp`;
 try{
  await writeFile(temporary,serialized);
  await rename(temporary,output);
 }finally{await rm(temporary,{force:true});}
 console.log(`Wrote ${snapshot.accounts.length} qualifying accounts from ${total} accounts at block ${block} (${snapshot.asOf}) to ${output}.`);
}

if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
