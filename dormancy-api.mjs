import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const kind=id=>id.endsWith('.lockup.near')?'lockup':/^[a-f0-9]{64}$/.test(id)?'implicit':/^0x[a-f0-9]{40}$/.test(id)?'ethereum':'named';
// Validate the shipped derivative against the immutable census before exposing it.
// The raw historical evidence is independently checked by dormancy:verify offline.
export function dormancyPresentation(snapshot,data){
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
  const months=Math.max(...sources.map(s=>s.oldestMonths)),oldest=sources.filter(s=>s.oldestMonths===months);
  rows.set(id,{months,since:buckets.get(months).date,amountYocto:oldest.reduce((n,s)=>n+BigInt(s.amount),0n).toString(),contracts:oldest.map(s=>s.contract)});
 }
 for(const b of data.buckets)for(const [k,g] of Object.entries(groups.get(b.months)))assert.deepEqual(b.groups[k],{accounts:g.ids.size,pairs:g.pairs,totalYocto:g.total.toString()},'Different dormancy aggregation');
 const focus=buckets.get(24);
 return {rows,revision:createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0,20),metadata:{asOf:data.asOf,cohortAccounts:cohort.length,minimumAccountTotalYocto:data.minimumAccountTotalYocto,months:24,since:focus.date,...focus.groups.named,limitation:'At least one balance per named account, unchanged and withdrawable at every sampled date. Only the 100+ NEAR cohort was analysed. Activity between samples and intentional waiting are possible; named accounts may be contracts.'}};
}
