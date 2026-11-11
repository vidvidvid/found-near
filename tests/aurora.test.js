import test from 'node:test';
import assert from 'node:assert/strict';
import {scanValidatorPool,AURORA_READ_CODE_HASH,POOL_CODE_HASHES} from '../dist/rpc.js';
import {withdrawalTransaction,prepareWithdrawal,validPending} from '../dist/withdrawal.js';
function fixture({amount='0',mature=true,echo='owner.near',code=AURORA_READ_CODE_HASH,wrongBlock=false}={}){
 const calls=[];
 return {calls,endpoints:['fixture'],block:123,fetcher:async(_url,{body})=>{
  const {params:p}=JSON.parse(body);calls.push(p);
  const result={block_height:123,block_hash:p.request_type==='call_function'&&wrongBlock?'other':'pinned'};
  if(p.request_type==='view_account')Object.assign(result,{code_hash:code});
  else result.result=[...Buffer.from(JSON.stringify({account_id:echo,unstaked_balance:amount,can_withdraw:mature}))];
  return {ok:true,json:async()=>({result})};
 }};
}
test('Aurora reads zero, positive and pending balances at the same block without enabling withdrawal',async()=>{
 assert.ok(!POOL_CODE_HASHES.includes(AURORA_READ_CODE_HASH));
 for(const [amount,mature] of [['0',true],['1000000000000000000000000',true],['1000000000000000000000000',false]]){
  const f=fixture({amount,mature}),r=await scanValidatorPool('owner.near','aurora.pool.near',f);
  assert.equal(r.state,'readonly');assert.equal(r.amount,amount);assert.equal(r.reportedCanWithdraw,mature);assert.equal(r.withdrawalSupported,false);
  assert.deepEqual(f.calls.map(p=>p.block_id),[123,'pinned']);
  assert.throws(()=>withdrawalTransaction(r,'owner.near'),{code:'NOT_READY'});
  assert.throws(()=>withdrawalTransaction({...r,state:'found',amount:'1'},'owner.near'),{code:'UNSUPPORTED_CODE'});
  await assert.rejects(prepareWithdrawal(r,{getAccounts:()=>{throw Error('must not reach wallet');}}),{code:'NOT_READY'});
  assert.equal(validPending({...r,network:'mainnet',hash:null,createdAt:1}),false);
 }
});
test('Aurora read access is bound to both contract and code, with strict view validation',async()=>{
 for(const [contract,code] of [['aurora.pool.near','changed'],['another.pool.near',AURORA_READ_CODE_HASH]]){
  const f=fixture({code});assert.equal((await scanValidatorPool('owner.near',contract,f)).state,'unsupported');assert.equal(f.calls.length,1);
 }
 for(const options of [{echo:'other.near'},{amount:'-1'},{amount:1},{amount:(2n**128n).toString()},{mature:'true'},{wrongBlock:true}])await assert.rejects(scanValidatorPool('owner.near','aurora.pool.near',fixture(options)));
});
