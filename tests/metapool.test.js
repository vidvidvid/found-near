import test from 'node:test';
import assert from 'node:assert/strict';
import {scanMetaPoolAccount,scanProtocols} from '../dist/rpc.js';

function fixture({amount='5000000000000000000000000',mature=true,reserve=amount,balance=amount,malformed=false,available='0',claims=amount,totalAvailable=available}={}){
 const requests=[];
 const fetcher=async(_url,options)=>{
  const {params:p}=JSON.parse(options.body);requests.push(p);
  if(p.request_type==='view_account')return {ok:true,json:async()=>({result:{block_hash:'final',block_height:999}})};
  const args=JSON.parse(atob(p.args_base64));
  let data=p.method_name==='get_account_available_balance'?available:p.method_name==='get_account'?{account_id:args.account_id,unstaked_balance:amount,staked_balance:'0',can_withdraw:mature}:{retrieved_for_unstake_claims:reserve,contract_account_balance:balance,total_unstake_claims:claims,total_available:totalAvailable};
  if(malformed&&p.method_name==='get_contract_state')data={};
  return {ok:true,json:async()=>({result:{block_hash:'snapshot',block_height:123,result:[...new TextEncoder().encode(JSON.stringify(data))]}})};
 };
 return {fetcher,endpoints:['mock'],requests};
}

test('Meta Pool ready requires exact reserve and contract balance at the account block',async()=>{
 const f=fixture(),result=await scanMetaPoolAccount('lb3.near',f);
 assert.equal(result.state,'found');
 assert.equal(result.protocol,'metapool');
 const state=f.requests.find(q=>q.method_name==='get_contract_state');
 assert.equal(state.block_id,'snapshot');
});

test('Meta Pool zero and pending never trigger a readiness check',async()=>{
 for(const options of [{amount:'0'},{mature:false}]){
  const f=fixture(options),result=await scanMetaPoolAccount('lb3.near',f);
  assert.equal(result.state,options.amount==='0'?'empty':'pending');
  assert.equal(f.requests.some(q=>q.method_name==='get_contract_state'),false);
 }
});

test('Meta Pool liquidity and malformed responses preserve an unknown availability state',async()=>{
 for(const options of [{reserve:'1'},{balance:'1'},{malformed:true}]){
  const result=await scanMetaPoolAccount('lb3.near',fixture(options));
  assert.equal(result.state,'unavailable');
  assert.notEqual(result.amount,'0');
 }
});

test('Meta Pool lockup balances are not routed through a regular wallet flow',async()=>{
 const f=fixture(),result=await scanMetaPoolAccount('example.lockup.near',f);
 assert.equal(result.state,'unsupported');
 assert.equal(f.requests.some(q=>q.method_name==='get_contract_state'),false);
});

test('combined scan pins both protocols to the account block and isolates protocol failures',async()=>{
 const requests=[];
 const fetcher=async(_url,options)=>{
  const {params:p}=JSON.parse(options.body);requests.push(p);
  if(p.request_type==='view_account')return {ok:true,json:async()=>({result:{block_hash:'final',block_height:999}})};
  const args=JSON.parse(atob(p.args_base64));
  if(p.account_id==='meta-pool.near'&&p.method_name==='get_account')return {ok:true,json:async()=>({result:{block_hash:'final',block_height:999,error:'temporary Meta Pool failure'}})};
  const data=p.account_id==='linear-protocol.near'?{account_id:args.account_id,unstaked_balance:'0',staked_balance:'0',can_withdraw:true}:{};
  return {ok:true,json:async()=>({result:{block_hash:'final',block_height:999,result:[...new TextEncoder().encode(JSON.stringify(data))]}})};
 };
 const result=await scanProtocols('ru.near',{fetcher,endpoints:['mock']});
 assert.equal(result.height,999);
 assert.equal(result.results[0].state,'empty');
 assert.equal(result.results[1].state,'error');
 assert.equal(requests.filter(q=>q.request_type==='view_account').length,1);
 assert.ok(requests.filter(q=>q.request_type==='call_function').every(q=>q.block_id===999));
});

 test('Meta Pool checks the inclusive dust sweep boundary and accounting invariants',async()=>{
  const amount='5000000000000000000000000',dust=10n**21n;
  assert.equal((await scanMetaPoolAccount('lb3.near',fixture({amount,available:String(dust)}))).state,'unavailable');
  assert.equal((await scanMetaPoolAccount('lb3.near',fixture({amount,available:String(dust),balance:String(BigInt(amount)+dust)}))).state,'found');
  assert.equal((await scanMetaPoolAccount('lb3.near',fixture({amount,available:String(dust+1n)}))).state,'found');
  for(const options of [{claims:'0'},{available:'1',totalAvailable:'0',balance:String(BigInt(amount)+1n)},{available:1},{amount:5000000000000000000000000}]){
   if(typeof options.amount==='number')await assert.rejects(scanMetaPoolAccount('lb3.near',fixture(options)));
   else assert.equal((await scanMetaPoolAccount('lb3.near',fixture(options))).state,'unavailable');
  }
 });
 test('a provider ignoring a pinned block cannot produce a ready result',async()=>{
  await assert.rejects(scanMetaPoolAccount('lb3.near',{...fixture(),block:999}));
 });
