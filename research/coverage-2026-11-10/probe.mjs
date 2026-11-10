import {writeFile} from 'node:fs/promises';
import {rpc} from '../../dist/rpc.js';
const accounts=['ru.near','meomeo.near','lb3.near','pahol.near','ekongmusk.near','within4d45.near','a_liutiev.near','root.near','mob.near','9d9cdaf607efb441f361c951c5b7ed05a6a4b0d8b81339d1a78b4343217b97f7'];
const pinned=process.argv[2]?Number(process.argv[2]):null;
const options={endpoints:(process.env.FOUND_RESEARCH_RPC||(pinned?'https://archival-rpc.mainnet.fastnear.com':'https://free.rpc.fastnear.com')).split(',')};
const block=await rpc({request_type:'view_account',account_id:'ru.near',...(pinned?{block_id:pinned}:{finality:'final'})},options);
const report={createdAt:new Date().toISOString(),block: block.block_height,blockHash:block.block_hash,accounts:[],pools:[],rnear:[],ref:[],storage:[]};
async function call(contract,method,args){const r=await rpc({request_type:'call_function',account_id:contract,method_name:method,args_base64:Buffer.from(JSON.stringify(args)).toString('base64'),block_id:block.block_height},options);const text=Buffer.from(r.result).toString();return text?JSON.parse(text):null;}
async function read(contract,method,args){try{return {data:await call(contract,method,args)}}catch(e){return {error:e.message}}}
for(const account of accounts){
 let pools=[];
 try{const r=await fetch(`https://api.fastnear.com/v1/account/${account}/staking`,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();pools=j.pools||[];report.accounts.push({account,pools});}
 catch(e){report.accounts.push({account,error:e.message});}
 for(const {pool_id} of pools){const result=await read(pool_id,'get_account',{account_id:account});report.pools.push({account,pool:pool_id,...result});if(result.data&&BigInt(result.data.unstaked_balance||'0')>10000000000000000000000n)console.log('POOL',account,pool_id,JSON.stringify(result.data));}
 for(const [kind,contract,method,args] of [['rnear','lst.rhealab.near','get_account_details',{account_id:account}],['ref','v2.ref-finance.near','get_deposits',{account_id:account}],['storage','v2.ref-finance.near','storage_balance_of',{account_id:account}]]){
  const result=await read(contract,method,args);report[kind].push({account,contract,...result});console.log(kind,account,JSON.stringify(result));
 }
 await writeFile(new URL('./probe-latest.json',import.meta.url),JSON.stringify(report,null,2));console.log('Checked',account,pools.length,'pools');
}
console.log('DONE',report.block,report.pools.length,'positions');
