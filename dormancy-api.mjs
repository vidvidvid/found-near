import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const kind=id=>id.endsWith('.lockup.near')?'lockup':/^[a-f0-9]{64}$/.test(id)?'implicit':/^0x[a-f0-9]{40}$/.test(id)?'ethereum':'named';
const sumYocto=list=>list.reduce((n,s)=>n+BigInt(s.amount),0n);
// The primary statement is the row's oldest bucket, so a row never shows a younger date than the group counting it.
// longTerm adds every source unchanged for 12+ months, dated by the youngest of them, only when it says more.
// Sources younger than 12 months never reach the label; sources keeps the full breakdown.
export function rowLabel(sources,listedYocto,buckets){
 const months=Math.max(...sources.map(s=>s.oldestMonths)),oldest=sources.filter(s=>s.oldestMonths===months),amount=sumYocto(oldest);
 const long=sources.filter(s=>s.oldestMonths>=12),longAmount=sumYocto(long),longMonths=Math.min(...long.map(s=>s.oldestMonths));
 return {months,since:buckets.get(months).date,amountYocto:amount.toString(),contracts:oldest.map(s=>s.contract),listedYocto:listedYocto.toString(),
  ...(longAmount>amount?{longTerm:{months:longMonths,since:buckets.get(longMonths).date,amountYocto:longAmount.toString(),contracts:long.map(s=>s.contract)}}:{}),
  sources:[...sources].sort((a,b)=>b.oldestMonths-a.oldestMonths||(BigInt(b.amount)>BigInt(a.amount)?1:-1)).map(s=>({contract:s.contract,amountYocto:s.amount,months:s.oldestMonths,since:s.since}))};
}
// Code hashes independently reproduced from near/near-wallet (see research/dormancy-2026-11-11/README.md).
export const KNOWN_CODE={'55E7imniT2uuYrECn17qJAk9fLcwQW4ftNSwmCJL5Di':'nearWalletTwoFactorMultisig','E8jZ1giWcVrps8PcV75ATauu6gFRkcwjNtKp7NKmipZG':'nearWalletEmptyContract'};
const NO_CODE_HASH='11111111111111111111111111111111',CODE_CLASSES=['no-code','code','unknown'],count=n=>Number.isSafeInteger(n)&&n>=0,yoctoText=v=>typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v);
// The contract-code derivative must be built from these exact dormancy bytes and split every named group exactly.
// Returns the 24-month split for the API; throws on any mismatch.
export function codePresentation(data,dormancyText,code){
 assert.equal(code?.version,1);assert.equal(code.censusBlock,data.censusBlock);assert.equal(code.censusHash,data.censusHash);assert.equal(code.noCodeHash,NO_CODE_HASH);
 assert.equal(code.dormancySha256,createHash('sha256').update(dormancyText).digest('hex'),'Code split built from different dormancy data');
 assert.deepEqual(code.buckets.map(b=>b.months),data.buckets.map(b=>b.months));
 for(const b of code.buckets){
  const group=data.buckets.find(x=>x.months===b.months).groups.named;
  assert.equal(b.namedAccounts,group.accounts);assert.equal(b.namedTotalYocto,group.totalYocto);
  assert.deepEqual(Object.keys(b.classes).sort(),[...CODE_CLASSES].sort());
  for(const c of CODE_CLASSES){assert.ok(count(b.classes[c].accounts));assert.ok(yoctoText(b.classes[c].totalYocto));}
  assert.equal(CODE_CLASSES.reduce((n,c)=>n+b.classes[c].accounts,0),group.accounts,'Code classes do not split the named group');
  assert.equal(CODE_CLASSES.reduce((n,c)=>n+BigInt(b.classes[c].totalYocto),0n).toString(),group.totalYocto,'Code totals do not split the named group');
  assert.equal(new Set(b.codeHashes.map(h=>h.codeHash)).size,b.codeHashes.length,'Repeated code hash');
  for(const h of b.codeHashes){assert.match(h.codeHash,/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);assert.notEqual(h.codeHash,NO_CODE_HASH);assert.ok(count(h.accounts)&&h.accounts>0);assert.ok(yoctoText(h.totalYocto));}
  assert.equal(b.codeHashes.reduce((n,h)=>n+h.accounts,0),b.classes.code.accounts,'Code hashes do not split the code class');
  assert.equal(b.codeHashes.reduce((n,h)=>n+BigInt(h.totalYocto),0n).toString(),b.classes.code.totalYocto,'Code hash totals do not split the code class');
 }
 const focus=code.buckets.find(b=>b.months===24),c=focus.classes;
 return {months:24,censusBlock:code.censusBlock,namedAccounts:focus.namedAccounts,noCode:c['no-code'],code:c.code,unknown:c.unknown,codeHashes:focus.codeHashes.map(h=>({...h,label:KNOWN_CODE[h.codeHash]??null}))};
}
// Validate the shipped derivative against the immutable census before exposing it.
// The raw historical evidence is independently checked by dormancy:verify offline.
// The optional contract-code split is dropped, never shown, if it is absent or fails validation.
export function dormancyPresentation(snapshot,data,{text=null,code=null}={}){
 if(!data)return {metadata:null,rows:new Map(),revision:''};
 const hash=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 assert.equal(data.version,1);assert.equal(data.censusSha256,hash);assert.equal(data.censusBlock,snapshot.block);assert.equal(data.censusHash,snapshot.hash);assert.equal(data.asOf,snapshot.asOf);
 assert.equal(data.minimumAccountTotalYocto,(100n*10n**24n).toString());
 const cohort=snapshot.accounts.filter(a=>BigInt(a.unstaked_balance)>=BigInt(data.minimumAccountTotalYocto));
 assert.equal(data.cohort.accounts,cohort.length);assert.equal(data.cohort.pairs,cohort.reduce((n,a)=>n+a.sources.length,0));
 assert.deepEqual(data.buckets.map(b=>b.months),[1,3,6,12,24,36]);
 const accounts=new Map(cohort.map(row=>[row.account_id,row])),buckets=new Map(data.buckets.map(b=>[b.months,b]));
 const groups=new Map(data.buckets.map(b=>[b.months,Object.fromEntries(['named','implicit','ethereum','lockup'].map(k=>[k,{ids:new Set(),pairs:0,total:0n}]))]));
 const rows=new Map();
 for(const [id,sources] of Object.entries(data.rows)){
  const original=accounts.get(id);assert.ok(original,'Age outside analysed cohort');assert.ok(sources.length>0);
  assert.equal(new Set(sources.map(s=>s.contract)).size,sources.length,'Repeated historical source');
  for(const source of sources){
   assert.equal(source.amount,original.sources.find(s=>s.contract===source.contract)?.amount,'Different source amount');
   assert.equal(source.since,buckets.get(source.oldestMonths)?.date,'Different historical date');
   for(const [months,kinds] of groups)if(source.oldestMonths>=months){const g=kinds[kind(id)];g.ids.add(id);g.pairs++;g.total+=BigInt(source.amount);}
  }
  rows.set(id,rowLabel(sources,BigInt(original.unstaked_balance),buckets));
 }
 for(const b of data.buckets)for(const [k,g] of Object.entries(groups.get(b.months)))assert.deepEqual(b.groups[k],{accounts:g.ids.size,pairs:g.pairs,totalYocto:g.total.toString()},'Different dormancy aggregation');
 const focus=buckets.get(24);
 let contractCode=null;
 if(code&&text){try{contractCode=codePresentation(data,text,code);}catch(error){console.error('Contract-code split withheld: '+error.message);}}
 return {rows,revision:createHash('sha256').update(JSON.stringify(data)+JSON.stringify(contractCode)).digest('hex').slice(0,20),metadata:{asOf:data.asOf,cohortAccounts:cohort.length,minimumAccountTotalYocto:data.minimumAccountTotalYocto,months:24,since:focus.date,...focus.groups.named,checkpoints:[12,24,36].map(m=>({months:m,since:buckets.get(m).date,...buckets.get(m).groups.named})),limitation:'At least one balance per named account, unchanged and withdrawable at every sampled date. Only the 100+ NEAR cohort was analysed. Activity between samples and intentional waiting are possible; named accounts may be contracts.',...(contractCode?{contractCode}:{})}};
}
