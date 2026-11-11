import assert from 'node:assert/strict';
import {validAccount} from '../dist/rpc.js';
import {MONTHS,accountKind,sha256} from './dormancy-model.mjs';

// view_account reports this code_hash (base58 of 32 zero bytes) when no contract is deployed.
export const NO_CODE_HASH='11111111111111111111111111111111';
export const CODE_CLASSES=['no-code','code','unknown'];
const BASE58_HASH=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Every named account with at least one qualifying source, sorted. The 1-month
// bucket is the widest, so this list is the upper bound for every bucket.
export function namedAccounts(summary){
 return Object.keys(summary.rows).filter(id=>accountKind(id)==='named').sort();
}
// Dormant amount = only the sources that qualified for at least `months`, as namedDistribution sums them.
export function dormantYocto(sources,months){return sources.filter(s=>s.oldestMonths>=months).reduce((n,s)=>n+BigInt(s.amount),0n);}
export const viewParams=(account,block)=>({request_type:'view_account',account_id:account,block_id:block});

// One account's evidence -> 'no-code' | 'code' | 'unknown:<reason>'.
// Any doubt is unknown. Only a pinned, well-formed result whose code_hash equals
// NO_CODE_HASH is 'no-code'. A record for a different question throws: it is not
// evidence about this account at all, and an archive containing it is corrupt.
export function classifyCode(record,account,header){
 assert.deepEqual(record?.params,viewParams(account,header.height),'Wrong RPC request');
 assert.equal(record.method,'query');
 assert.notEqual(!!record.error,!!record.result,'Exactly one result or error is required');
 if(record.error){
  const text=JSON.stringify(record.error);
  return /"UNKNOWN_ACCOUNT"/.test(text)?'unknown:missing-account':'unknown:rpc-error';
 }
 const r=record.result;
 if(!r||typeof r!=='object'||Array.isArray(r))return 'unknown:shape';
 if(r.block_height!==header.height||r.block_hash!==header.hash)return 'unknown:wrong-block';
 if(typeof r.code_hash!=='string'||!BASE58_HASH.test(r.code_hash))return 'unknown:shape';
 return r.code_hash===NO_CODE_HASH?'no-code':'code';
}
export const codeClass=state=>state.startsWith('unknown')?'unknown':state;

export function summarizeCode(archive,summary,summaryText=JSON.stringify(summary)){
 assert.equal(archive.version,1);
 assert.equal(archive.summarySha256,sha256(summaryText),'Code archive was built from a different dormancy summary');
 assert.equal(archive.censusHeader.height,summary.censusBlock);assert.equal(archive.censusHeader.hash,summary.censusHash);
 const accounts=namedAccounts(summary);
 assert.deepEqual(archive.accounts.map(a=>a.account),accounts,'Missing, extra or unordered account');
 const states=new Map();
 for(const {account,record} of archive.accounts){
  assert.ok(validAccount(account));
  states.set(account,{state:classifyCode(record,account,archive.censusHeader),hash:record.result?.code_hash});
 }
 const buckets=MONTHS.map(months=>{
  const classes=Object.fromEntries(CODE_CLASSES.map(c=>[c,{accounts:0,totalYocto:0n}])),reasons={},hashes=new Map();
  for(const account of accounts){
   const amount=dormantYocto(summary.rows[account],months);if(amount===0n)continue;
   const {state,hash}=states.get(account),c=classes[codeClass(state)];c.accounts++;c.totalYocto+=amount;
   if(state.startsWith('unknown'))reasons[state]=(reasons[state]||0)+1;
   if(state==='code'){const h=hashes.get(hash)||{codeHash:hash,accounts:0,totalYocto:0n};h.accounts++;h.totalYocto+=amount;hashes.set(hash,h);}
  }
  const group=summary.buckets.find(b=>b.months===months).groups.named;
  const total=CODE_CLASSES.reduce((n,c)=>n+classes[c].totalYocto,0n);
  // Cross-check against the published named bucket; the code split must partition it exactly.
  assert.equal(CODE_CLASSES.reduce((n,c)=>n+classes[c].accounts,0),group.accounts);assert.equal(total.toString(),group.totalYocto);
  return {months,namedAccounts:group.accounts,namedTotalYocto:group.totalYocto,
   classes:Object.fromEntries(CODE_CLASSES.map(c=>[c,{accounts:classes[c].accounts,totalYocto:classes[c].totalYocto.toString()}])),
   unknownReasons:Object.fromEntries(Object.entries(reasons).sort()),
   distinctCodeHashes:hashes.size,
   topCodeHashes:[...hashes.values()].sort((a,b)=>b.accounts-a.accounts||(b.totalYocto>a.totalYocto?1:b.totalYocto<a.totalYocto?-1:0)||a.codeHash.localeCompare(b.codeHash)).slice(0,10).map(h=>({...h,totalYocto:h.totalYocto.toString()}))};
 });
 return {version:1,censusBlock:summary.censusBlock,censusHash:summary.censusHash,dormancySummarySha256:archive.summarySha256,noCodeHash:NO_CODE_HASH,accountsRead:accounts.length,
  definition:'view_account at the census block for every named account with a qualifying sampled-history source. no-code: pinned result with code_hash '+NO_CODE_HASH+'. code: any other well-formed code_hash. unknown: missing account, RPC error, malformed response or wrong block. Read at the census block only, not at the historical sample dates. Neither class establishes who controls an account.',
  buckets};
}
