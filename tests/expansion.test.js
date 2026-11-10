import test from 'node:test';
import assert from 'node:assert/strict';
import {scanRnearAccount,scanValidatorPool,scanProtocols,discoverPools,POOL_CODE_HASHES,RNEAR_CODE_HASH,MAX_POOLS} from '../dist/rpc.js';
import {withdrawalTransaction,prepareWithdrawal,validPending,inspectWithdrawal,WITHDRAW_GAS,withdrawalGas} from '../dist/withdrawal.js';
const amount='1234567890123456789012345',height=111,block='pinned';
function fixture({mature=true,paused=false,methodPaused=false,liquid='1000000000000000000000000000',storage=1000,code,preflightError=false,preflightValue=null,available=true,malformed=false,rows=[],discoveryError=false,echo='owner.near',sourceError,zero=false}={}){
 const requests=[];
 const fetcher=async(url,options={})=>{
  if(!options.body){if(discoveryError)throw Error('offline');return {ok:true,json:async()=>({account_id:echo,pools:rows})};}
  const {params:p}=JSON.parse(options.body);requests.push(p);
  const identity={block_height:height,block_hash:block};
  if(p.request_type==='view_account')return {ok:true,json:async()=>({result:{...identity,amount:liquid,storage_usage:storage,code_hash:code??(p.account_id==='lst.rhealab.near'?RNEAR_CODE_HASH:POOL_CODE_HASHES[0])}})};
  const args=JSON.parse(atob(p.args_base64));let data;
  if(['get_account','get_account_details'].includes(p.method_name))data={account_id:malformed?'wrong.near':args.account_id,unstaked_balance:zero?'0':amount,can_withdraw:mature};
  else if(p.method_name==='is_paused')data=paused;
  else if(p.method_name==='pa_is_paused'){assert.equal(args.key,'internal_withdraw');data=methodPaused;}
  else if(p.method_name==='can_account_withdraw'){assert.equal(args.amount,amount);data=preflightValue;}
  else if(p.method_name==='is_account_unstaked_balance_available')data=available;
  else if(p.method_name==='get_account_available_balance')data='0';
  else if(p.method_name==='get_contract_state')data={retrieved_for_unstake_claims:liquid,contract_account_balance:liquid,total_unstake_claims:liquid,total_available:'0'};
  const result={...identity,result:data===null?[]:[...new TextEncoder().encode(JSON.stringify(data))]};
  if(preflightError&&p.method_name==='can_account_withdraw'||sourceError===p.account_id)result.error='cannot execute';
  return {ok:true,json:async()=>({result})};
 };
 return {fetcher,endpoints:['mock'],requests,block:height};
}
test('rNEAR requires exact amount, global and method pause checks, known code and liquid storage reserve at one block',async()=>{
 const f=fixture(),r=await scanRnearAccount('owner.near',f);assert.equal(r.state,'found');assert.equal(r.codeHash,RNEAR_CODE_HASH);
 assert.ok(f.requests.every(q=>q.block_id===height||q.block_id===block));
 for(const opt of [{paused:true},{methodPaused:true},{preflightError:true},{preflightValue:false},{liquid:amount},{storage:-1}])assert.equal((await scanRnearAccount('owner.near',fixture(opt))).state,'unavailable');
 assert.equal((await scanRnearAccount('owner.near',fixture({code:'changed'}))).state,'unsupported');
});
test('rNEAR distinguishes zero, waiting, lockup and malformed identity',async()=>{
 for(const [options,account,expected] of [[{zero:true},'owner.near','empty'],[{mature:false},'owner.near','pending'],[{},'owner.lockup.near','unsupported']])assert.equal((await scanRnearAccount(account,fixture(options))).state,expected);
 await assert.rejects(scanRnearAccount('owner.near',fixture({malformed:true})));
});
test('both factory pool codes require maturity, secondary readiness and usable liquidity',async()=>{
 for(const code of POOL_CODE_HASHES){const f=fixture({code});assert.equal((await scanValidatorPool('owner.near','validator.pool.near',f)).state,'found');assert.ok(f.requests.every(q=>[height,block].includes(q.block_id)));}
 for(const [options,state] of [[{mature:false},'pending'],[{zero:true},'empty'],[{available:false},'unavailable'],[{available:'true'},'unavailable'],[{liquid:amount},'unavailable'],[{code:'custom'},'unsupported']])assert.equal((await scanValidatorPool('owner.near','validator.pool.near',fixture(options))).state,state);
 const unknown=fixture({code:'custom'});await scanValidatorPool('owner.near','validator.pool.near',unknown);assert.equal(unknown.requests.length,1);
 assert.equal((await scanValidatorPool('owner.lockup.near','validator.pool.near',fixture())).state,'unsupported');
 await assert.rejects(scanValidatorPool('owner.near','validator.pool.near',fixture({malformed:true})));
});
test('pool discovery accepts real legacy null heights, deduplicates and excludes liquid-staking contracts',async()=>{
 const rows=[{pool_id:'one.pool.near',last_update_block_height:null},{pool_id:'one.pool.near',last_update_block_height:4},{pool_id:'linear-protocol.near',last_update_block_height:2}];
 assert.deepEqual(await discoverPools('owner.near',fixture({rows})),[{pool_id:'one.pool.near',last_update_block_height:4}]);
 for(const options of [{echo:'wrong.near'},{discoveryError:true},{rows:[{pool_id:'bad..near',last_update_block_height:1}]},{rows:[{pool_id:'valid.near',last_update_block_height:'1'}]}])await assert.rejects(discoverPools('owner.near',fixture(options)),{code:'DISCOVERY_UNAVAILABLE'});
});
test('a discovery outage cannot become no pools, and an individual pool failure cannot hide other money',async()=>{
 const failure=await scanProtocols('owner.near',fixture({discoveryError:true}));assert.equal(failure.pools.state,'error');assert.ok(failure.results.some(r=>r.protocol==='rnear'&&r.state==='found'));
 const rows=['good.pool.near','bad.pool.near'].map(pool_id=>({pool_id,last_update_block_height:1}));
 const r=await scanProtocols('owner.near',fixture({rows,sourceError:'bad.pool.near'}));assert.equal(r.results.find(r=>r.protocol==='pool:good.pool.near').state,'found');assert.equal(r.results.find(r=>r.protocol==='pool:bad.pool.near').state,'error');
});
test('pool discovery is bounded and future-indexed relationships are explicitly incomplete',async()=>{
 const rows=Array.from({length:MAX_POOLS+2},(_,i)=>({pool_id:`pool${i}.near`,last_update_block_height:i===0?height+1:1}));
 const r=await scanProtocols('owner.near',fixture({rows}));assert.equal(r.pools.state,'partial');assert.equal(r.pools.checked,MAX_POOLS);assert.equal(r.pools.discovered,MAX_POOLS+2);assert.ok(!r.results.some(r=>r.protocol==='pool:pool0.near'));
});
test('aborted discovery and scans do not render false complete results',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(discoverPools('owner.near',{...fixture(),signal:controller.signal}),{name:'AbortError'});
 await assert.rejects(scanProtocols('owner.near',{...fixture(),signal:controller.signal}),{name:'AbortError'});
});
function ready(protocol='rnear',codeHash=RNEAR_CODE_HASH){return {protocol,codeHash,account:'owner.near',state:'found',amount};}
const hash='A'.repeat(44);
function pending(r){return {...r,network:'mainnet',createdAt:1,hash};}
function receipt(r){return {final_execution_status:'FINAL',status:{SuccessValue:''},transaction:{hash,signer_id:r.account,receiver_id:withdrawalTransaction(r,r.account).receiverId,actions:[{FunctionCall:{method_name:'withdraw',args:btoa(JSON.stringify({amount})),gas:withdrawalGas(r.protocol),deposit:'0'}}]},transaction_outcome:{outcome:{status:{SuccessReceiptId:'call'},receipt_ids:['call']}},receipts_outcome:[{id:'call',outcome:{status:{SuccessValue:''},receipt_ids:['transfer']}},{id:'transfer',outcome:{status:{SuccessValue:''},receipt_ids:[]}}]};}
test('new targets sign only exact withdrawals, retain the target on reload and verify their complete receipt chain',()=>{
 for(const r of [ready(),ready('pool:one.pool.near',POOL_CODE_HASHES[0]),ready('pool:two.pool.near',POOL_CODE_HASHES[1])]){
  const tx=withdrawalTransaction(r,r.account);assert.equal(tx.receiverId,r.protocol==='rnear'?'lst.rhealab.near':r.protocol.slice(5));assert.deepEqual(tx.actions,[{type:'FunctionCall',params:{methodName:'withdraw',args:{amount},gas:withdrawalGas(r.protocol),deposit:'0'}}]);
  assert.equal(validPending(pending(r)),true);assert.equal(inspectWithdrawal(receipt(r),pending(r)).state,'confirmed');
  const failed=receipt(r);failed.receipts_outcome[1].outcome.status={Failure:{}};assert.equal(inspectWithdrawal(failed,pending(r)).state,'failed');
  const wrong=receipt(r);wrong.transaction.receiver_id='other.pool.near';assert.throws(()=>inspectWithdrawal(wrong,pending(r)));
  const incomplete=receipt(r);incomplete.receipts_outcome.pop();assert.throws(()=>inspectWithdrawal(incomplete,pending(r)));
 }
});
test('unverified code, lockups and forged target identities never authorize a new withdrawal',()=>{
 for(const r of [ready('rnear','unknown'),ready('pool:one.pool.near','unknown'),ready('pool:linear-protocol.near',POOL_CODE_HASHES[0]),{...ready(),account:'owner.lockup.near'}]){assert.throws(()=>withdrawalTransaction(r,r.account));assert.equal(validPending(pending(r)),false);}
});
test('fresh pool preflight cannot select another pool or silently accept a new implementation or amount',async()=>{
 const r=ready('pool:one.pool.near',POOL_CODE_HASHES[0]),getAccounts=async()=>[{accountId:r.account}];
 for(const updated of [ready('pool:two.pool.near',POOL_CODE_HASHES[0]),ready(r.protocol,POOL_CODE_HASHES[1]),{...r,amount:'1'},{...r,state:'pending'}])await assert.rejects(prepareWithdrawal(r,{getAccounts,read:async()=>({account:r.account,results:[updated]})}));
 assert.equal((await prepareWithdrawal(r,{getAccounts,read:async()=>({account:r.account,results:[r]})})).transaction.receiverId,'one.pool.near');
});
