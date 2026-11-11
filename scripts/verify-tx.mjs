import assert from 'node:assert/strict';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {validAccount} from '../dist/rpc.js';
import {validHash} from '../dist/withdrawal.js';
import {verifyWithdrawalEvidence,fetchWithdrawalEvidence,report} from './verify-tx-model.mjs';

// npm run verify:tx                          verify every archived withdrawal, offline
// npm run verify:tx -- <hash>                verify one archived withdrawal, offline
// npm run verify:tx -- <hash> --live         reread it from an archival RPC and compare
// npm run verify:tx -- <hash> --account <id> [--save]   first read of a new transaction
const folder=new URL('../verification/withdrawals/',import.meta.url);
const args=process.argv.slice(2),flag=name=>args.includes(name),option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const hash=args.find(a=>!a.startsWith('--')&&a!==option('--account')),account=option('--account');
const endpoints=process.env.VERIFY_RPC?[process.env.VERIFY_RPC]:['https://archival-rpc.mainnet.fastnear.com','https://archival-rpc.mainnet.near.org'];
async function read(method,params){
 let last;
 for(const endpoint of endpoints){
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'found-verify-tx',method,params}),signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error(`${endpoint} answered HTTP ${response.status}`);
   const data=await response.json();if(data.error||!data.result||data.result.error)throw Error(`${endpoint}: ${JSON.stringify(data.error||data.result?.error).slice(0,200)}`);
   return data.result;
  }catch(error){last=error;}
 }
 // An unreachable provider is an unknown, never a failed or missing withdrawal.
 throw Error(`Could not read ${method} from an archival RPC (${last.message}). The result is unknown, not negative.`);
}
const file=h=>new URL(`${h}.json`,folder);
const archived=async h=>{try{return JSON.parse(await readFile(file(h),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}};

try{
 if(!hash){
  let names=[];try{names=(await readdir(folder)).filter(n=>n.endsWith('.json')).sort();}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!names.length){console.log('No archived withdrawal evidence in verification/withdrawals/ yet. Check a transaction with: npm run verify:tx -- <hash> --account <signer>');process.exit(0);}
  for(const name of names){const evidence=JSON.parse(await readFile(new URL(name,folder),'utf8'));assert.equal(`${evidence.hash}.json`,name);console.log(report(verifyWithdrawalEvidence(evidence)));}
  console.log(`Verified ${names.length} archived withdrawal${names.length===1?'':'s'} offline with FOUND's receipt verifier. Add -- <hash> --live to reread one from the chain.`);
 }else{
  if(!validHash(hash))throw Error('That is not a transaction hash.');
  if(account!==undefined&&!validAccount(account))throw Error('That is not a NEAR account ID.');
  const saved=await archived(hash);
  if(saved&&!flag('--live')&&!flag('--save')){
   console.log(report(verifyWithdrawalEvidence(saved,{account})));
   console.log('Verified offline from the archived RPC responses. Add --live to reread it from the chain.');
  }else{
   const signer=account||saved?.tx?.transaction?.signer_id;
   if(!signer)throw Error('A first read needs the signer: npm run verify:tx -- <hash> --account <signer>');
   const evidence=await fetchWithdrawalEvidence(hash,signer,read),result=verifyWithdrawalEvidence(evidence,{account:signer});
   console.log(report(result));
   // Merkle proofs differ between providers; everything that decides the verdict must match.
   const core=e=>({hash:e.hash,status:e.tx.status,final:e.tx.final_execution_status,transaction:e.tx.transaction,receipts:e.tx.receipts,outcomes:[e.tx.transaction_outcome,...e.tx.receipts_outcome].map(r=>({id:r.id,block:r.block_hash,outcome:r.outcome})),block:e.block.header.hash,height:e.block.header.height,timestamp:e.block.header.timestamp,code:e.contract?.code_hash,codeBlock:e.contract?.block_hash});
   if(saved){assert.deepEqual(core(evidence),core(saved),'The chain reread differs from the archived evidence.');console.log('Reread from an archival RPC: matches the archived evidence.');}
   if(flag('--save')&&!saved){await mkdir(folder,{recursive:true});await writeFile(file(hash),JSON.stringify(evidence,null,1)+'\n');console.log(`Saved verification/withdrawals/${hash}.json`);}
   console.log("Confirmed by FOUND's receipt verifier against a fresh archival read.");
  }
 }
}catch(error){console.error(`Not verified: ${error.message}`);process.exit(1);}
