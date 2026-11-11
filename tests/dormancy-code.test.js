import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCode,summarizeCode,namedAccounts,NO_CODE_HASH} from '../scripts/dormancy-code-model.mjs';
import {sha256} from '../scripts/dormancy-model.mjs';
const header={height:100,hash:'census',timestamp:'1'};
const params=account=>({request_type:'view_account',account_id:account,block_id:100});
const ok=(account,code_hash=NO_CODE_HASH,extra={})=>({method:'query',params:params(account),result:{amount:'1',locked:'0',code_hash,storage_usage:182,storage_paid_at:0,block_height:100,block_hash:'census',...extra}});
const failed=(account,error)=>({method:'query',params:params(account),error});
const SOME_CODE='55E7imniT2uuYrECn17qJAk9fLcwQW4ftNSwmCJL5Di';

test('only a pinned, well-formed empty code hash is "no code"',()=>{
 assert.equal(classifyCode(ok('a.near'),'a.near',header),'no-code');
 assert.equal(classifyCode(ok('a.near',SOME_CODE),'a.near',header),'code');
});
test('missing account, RPC error, malformed response and wrong block all end as unknown, never no code',()=>{
 const missing={code:'UNKNOWN_ACCOUNT',message:'{"name":"HANDLER_ERROR"}',rpcError:{name:'HANDLER_ERROR',cause:{name:'UNKNOWN_ACCOUNT',info:{requested_account_id:'a.near',block_height:100,block_hash:'census'}}}};
 const cases=[
  [failed('a.near',missing),'unknown:missing-account'],
  [failed('a.near',{code:'HTTP_503',message:'RPC HTTP 503',rpcError:null}),'unknown:rpc-error'],
  [failed('a.near',{code:'RATE_LIMIT',message:'Provider rate limit',rpcError:'retry after 60'}),'unknown:rpc-error'],
  [failed('a.near',{code:'ERR_ASSERTION',message:'Wrong block hash',rpcError:null}),'unknown:rpc-error'],
  [ok('a.near',NO_CODE_HASH,{block_hash:'other'}),'unknown:wrong-block'],
  [ok('a.near',NO_CODE_HASH,{block_height:99}),'unknown:wrong-block'],
  [ok('a.near',NO_CODE_HASH,{block_height:'100'}),'unknown:wrong-block'],
  [ok('a.near',NO_CODE_HASH,{code_hash:undefined}),'unknown:shape'],
  [ok('a.near',''),'unknown:shape'],
  [ok('a.near','0OIl'+'1'.repeat(30)),'unknown:shape'],
  [ok('a.near',{hash:NO_CODE_HASH}),'unknown:shape'],
  [{method:'query',params:params('a.near'),result:[NO_CODE_HASH]},'unknown:shape'],
  [{method:'query',params:params('a.near'),result:'11111111111111111111111111111111'},'unknown:shape']
 ];
 for(const [record,expected] of cases)assert.equal(classifyCode(record,'a.near',header),expected,JSON.stringify(record));
});
test('evidence for another account, block or method is rejected rather than counted',()=>{
 for(const mutate of [r=>r.params.account_id='b.near',r=>r.params.block_id=99,r=>r.params.request_type='view_code',r=>r.method='block',r=>r.error={message:'x'},r=>delete r.result]){
  const r=ok('a.near');mutate(r);assert.throws(()=>classifyCode(r,'a.near',header));
 }
});

function fixture(){
 const unit=10n**24n,n=v=>(BigInt(v)*unit).toString();
 const summary={censusBlock:100,censusHash:'census',
  buckets:[1,3,6,12,24,36].map(months=>({months,groups:{named:months<=12?{accounts:3,totalYocto:n(600)}:months===24?{accounts:2,totalYocto:n(300)}:{accounts:1,totalYocto:n(100)}}})),
  rows:{'plain.near':[{amount:n(100),oldestMonths:36},{amount:n(500),oldestMonths:1}],'dao.near':[{amount:n(200),oldestMonths:24}],'gone.near':[{amount:n(300),oldestMonths:12}],['a'.repeat(64)]:[{amount:n(9),oldestMonths:36}]}};
 for(const b of summary.buckets)if(b.months<=12)b.groups.named.totalYocto=n(b.months===1?1100:600);
 const summaryText=JSON.stringify(summary);
 const archive={version:1,summarySha256:sha256(summaryText),censusHeader:header,accounts:[
  {account:'dao.near',record:ok('dao.near',SOME_CODE)},
  {account:'gone.near',record:failed('gone.near',{code:'UNKNOWN_ACCOUNT',message:'x',rpcError:{cause:{name:'UNKNOWN_ACCOUNT'}}})},
  {account:'plain.near',record:ok('plain.near')}]};
 return {summary,summaryText,archive,n};
}
test('summary partitions each named bucket exactly and sums only qualifying sources',()=>{
 const {summary,summaryText,archive,n}=fixture();
 assert.deepEqual(namedAccounts(summary),['dao.near','gone.near','plain.near']);
 const s=summarizeCode(archive,summary,summaryText),by=m=>s.buckets.find(b=>b.months===m);
 assert.deepEqual(by(1).classes,{'no-code':{accounts:1,totalYocto:n(600)},code:{accounts:1,totalYocto:n(200)},unknown:{accounts:1,totalYocto:n(300)}});
 assert.deepEqual(by(12).classes,{'no-code':{accounts:1,totalYocto:n(100)},code:{accounts:1,totalYocto:n(200)},unknown:{accounts:1,totalYocto:n(300)}});
 assert.deepEqual(by(12).unknownReasons,{'unknown:missing-account':1});
 assert.deepEqual(by(24).classes,{'no-code':{accounts:1,totalYocto:n(100)},code:{accounts:1,totalYocto:n(200)},unknown:{accounts:0,totalYocto:'0'}});
 assert.deepEqual(by(24).topCodeHashes,[{codeHash:SOME_CODE,accounts:1,totalYocto:n(200)}]);
 assert.deepEqual(by(36).classes['no-code'],{accounts:1,totalYocto:n(100)});
});
test('offline summary rejects a different dormancy summary, census block or account list',()=>{
 for(const mutate of [f=>f.summaryText+=' ',f=>f.archive.censusHeader={...header,hash:'other'},f=>f.archive.accounts.pop(),f=>f.archive.accounts.reverse(),f=>f.archive.accounts[0].record.params.block_id=99,f=>{f.summary.buckets[0].groups.named.accounts=4;f.summaryText=JSON.stringify(f.summary);f.archive.summarySha256=sha256(f.summaryText);}]){
  const f=fixture();mutate(f);assert.throws(()=>summarizeCode(f.archive,f.summary,f.summaryText));
 }
});
