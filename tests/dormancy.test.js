import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyView,classifySample,accountKind,monthsBefore,cohort,summarize,sha256,MONTHS} from '../scripts/dormancy-model.mjs';
import {POOL_CODE_HASHES} from '../dist/rpc.js';
const pair={account:'owner.near',contract:'test.pool.near',amount:'100'};
const header={height:10,hash:'pinned'};
function sample({amount='100',can=true,code=POOL_CODE_HASHES[0],echo=pair.account,error=false}={}){
 const record=(params,result)=>({method:'query',params:{...params,account_id:pair.contract,block_id:10},result:{block_height:10,block_hash:'pinned',...result}});
 const codeRecord=record({request_type:'view_account'},{code_hash:code});
 const view=record({request_type:'call_function',method_name:'get_account',args_base64:Buffer.from(JSON.stringify({account_id:pair.account})).toString('base64')},{result:[...Buffer.from(JSON.stringify({account_id:echo,unstaked_balance:amount,can_withdraw:can}))]});
 if(error){delete view.result;view.error={message:'archival gap'};}
 return {code:codeRecord,view};
}
test('historical classification distinguishes exact, changed, zero, pending and unknown',()=>{
 for(const [options,expected] of [[{},'stable'],[{amount:'99'},'changed'],[{amount:'0'},'zero'],[{can:false},'pending'],[{amount:100},'unknown:shape'],[{can:'true'},'unknown:shape'],[{echo:'other.near'},'unknown:shape'],[{error:true},'unknown:view-read'],[{code:'different'},'unknown:code-version']])assert.equal(classifySample(sample(options),pair,header,'baseline'),expected);
 assert.equal(classifyView(null,pair),'unknown:shape');
});
test('historical evidence cannot cross blocks, account queries or pool identities',()=>{
 for(const mutate of [s=>s.view.result.block_hash='wrong',s=>s.code.result.block_height=9,s=>s.view.params.account_id='other.pool.near',s=>s.view.params.args_base64='e30=',s=>s.code.params.block_id=11]){
  const s=sample();mutate(s);assert.throws(()=>classifySample(s,pair,header,'baseline'));
 }
});
test('calendar thresholds clamp month ends and account kinds do not imply human owners',()=>{
 assert.equal(monthsBefore('2024-03-31T12:00:00.000Z',1),'2024-02-29T12:00:00.000Z');
 assert.equal(monthsBefore('2025-03-31T12:00:00.000Z',1),'2025-02-28T12:00:00.000Z');
 for(const [id,kind] of [['owner.near','named'],['a'.repeat(64),'implicit'],['0x'+'b'.repeat(40),'ethereum'],['a.lockup.near','lockup']])assert.equal(accountKind(id),kind);
 assert.equal(cohort({accounts:[{account_id:'a.near',unstaked_balance:(100n*10n**24n).toString(),sources:[{contract:'x.near',amount:'1'}]},{account_id:'b.near',unstaked_balance:'1',sources:[]}]}).length,1);
});

function archiveFixture(){
 const unit=100n*10n**24n,asOf='2026-11-10T22:01:36.060Z';
 const snapshot={block:100,hash:'census',asOf,accounts:[{account_id:'owner.near',unstaked_balance:(unit*2n).toString(),sources:[{contract:'a.pool.near',amount:unit.toString()},{contract:'b.pool.near',amount:unit.toString()}]}]};
 const header=(height,timestamp,hash)=>({height,timestamp:(BigInt(Date.parse(timestamp))*1000000n).toString(),hash});
 const query=(contract,h,extra,result)=>({method:'query',params:{request_type:'view_account',account_id:contract,block_id:h.height,...extra},result:{block_height:h.height,block_hash:h.hash,...result}});
 const current=header(100,asOf,'census'),ladder=MONTHS.map((months,i)=>({months,target:monthsBefore(asOf,months),header:header(90-i,monthsBefore(asOf,months),'sample'+i)}));
 const baselineCodes=Object.fromEntries(['a.pool.near','b.pool.near'].map(c=>[c,query(c,current,{}, {code_hash:POOL_CODE_HASHES[0]})]));
 const pairs=cohort(snapshot).map(pair=>({pair,samples:ladder.map(({header:h})=>({code:query(pair.contract,h,{}, {code_hash:POOL_CODE_HASHES[0]}),view:query(pair.contract,h,{request_type:'call_function',method_name:'get_account',args_base64:Buffer.from(JSON.stringify({account_id:pair.account})).toString('base64')},{result:[...Buffer.from(JSON.stringify({account_id:pair.account,unstaked_balance:pair.amount,can_withdraw:true}))]})}))}));
 return {snapshot,archive:{version:1,censusSha256:sha256(JSON.stringify(snapshot)),censusHeader:current,ladder,baselineCodes,pairs}};
}
test('summary deduplicates an account but sums only pairs qualifying at each historical date',()=>{
 const {snapshot,archive}=archiveFixture();
 const p=archive.pairs[1];p.samples=p.samples.slice(0,2);delete p.samples[1].view.result;p.samples[1].view.error={message:'unavailable'};
 const s=summarize(archive,snapshot);
 assert.equal(s.cohort.accounts,1);assert.equal(s.cohort.pairs,2);
 assert.equal(s.buckets[0].groups.named.accounts,1);assert.equal(s.buckets[0].groups.named.pairs,2);
 assert.equal(s.buckets[1].groups.named.totalYocto,(100n*10n**24n).toString());
 assert.equal(s.terminations['unknown:view-read'],1);
 assert.equal(s.rows['owner.near'][1].oldestMonths,1);
});
test('offline summary rejects missing pairs, skipped samples, forged hashes and truncated stable histories',()=>{
 for(const mutate of [a=>a.pairs.pop(),a=>a.pairs[0].samples.pop(),a=>a.censusSha256='changed',a=>a.pairs[0].samples[0].view.result.block_hash='wrong',a=>a.ladder[0].target='2020-01-01T00:00:00.000Z']){
  const {snapshot,archive}=archiveFixture();mutate(archive);assert.throws(()=>summarize(archive,snapshot));
 }
});

test('paged pool reads select the exact account and reject missing, duplicate and oversized pages',()=>{
 const s=sample(),args={from_index:0,limit:2};
 s.view.params.method_name='get_accounts';s.view.params.args_base64=Buffer.from(JSON.stringify(args)).toString('base64');
 const rows=[{account_id:'other.near',unstaked_balance:'999',can_withdraw:true},{account_id:pair.account,unstaked_balance:pair.amount,can_withdraw:true}];
 s.view.result.result=[...Buffer.from(JSON.stringify(rows))];assert.equal(classifySample(s,pair,header,'baseline'),'stable');
 s.view.result.result=[...Buffer.from(JSON.stringify([rows[0],rows[0]]))];assert.equal(classifySample(s,pair,header,'baseline'),'unknown:shape');
 s.view.params.args_base64=Buffer.from(JSON.stringify({...args,limit:1501})).toString('base64');assert.throws(()=>classifySample(s,pair,header,'baseline'));
});

test('named concentration excludes recent sources and other account kinds',async()=>{
 const {namedDistribution}=await import('../scripts/dormancy-model.mjs'),unit=10n**24n;
 const amount=n=>(BigInt(n)*unit).toString();
 const summary={rows:{'one.near':[{amount:amount(100),oldestMonths:24},{amount:amount(900),oldestMonths:1}],'two.near':[{amount:amount(50),oldestMonths:36}],['a'.repeat(64)]:[{amount:amount(9999),oldestMonths:36}]},buckets:[{months:24,groups:{named:{accounts:2,totalYocto:amount(150)}}}]};
 assert.deepEqual(namedDistribution(summary,24),{months:24,accounts:2,accountsWithAtLeast100OldNear:1,totalYocto:amount(150),largestAccountYocto:amount(100),largestShareBasisPoints:6666,totalWithoutLargestYocto:amount(50)});
});
