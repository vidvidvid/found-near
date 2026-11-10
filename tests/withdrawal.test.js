import test from 'node:test';
import assert from 'node:assert/strict';
import {withdrawalTransaction,prepareWithdrawal,inspectWithdrawal,checkWithdrawal,validPending,WITHDRAW_GAS} from '../dist/withdrawal.js';
const amount='5000000000000000000000000',hash='A'.repeat(44);
const ready=(protocol='linear',changes={})=>({account:'owner.near',protocol,state:'found',amount,...changes});
const pending=(changes={})=>({network:'mainnet',account:'owner.near',protocol:'linear',amount,hash,createdAt:1000,...changes});
const accounts=async()=>[{accountId:'owner.near'}];
const fresh=result=>({account:result.account,height:123,results:[result]});
function receipt(changes={}){
 return {final_execution_status:'FINAL',status:{SuccessValue:''},transaction:{hash,signer_id:'owner.near',receiver_id:'linear-protocol.near',actions:[{FunctionCall:{method_name:'withdraw',args:btoa(JSON.stringify({amount})),deposit:'0',gas:WITHDRAW_GAS}}]},transaction_outcome:{id:hash,outcome:{status:{SuccessReceiptId:'r1'},receipt_ids:['r1']}},receipts_outcome:[{id:'r1',outcome:{status:{SuccessValue:''},receipt_ids:['r2']}},{id:'r2',outcome:{status:{SuccessValue:''},receipt_ids:[]}}],...changes};
}
test('withdrawals target only the known mainnet contract, exact amount, zero deposit, and connected signer',()=>{
 for(const [protocol,receiverId] of [['linear','linear-protocol.near'],['metapool','meta-pool.near']]){
  assert.deepEqual(withdrawalTransaction(ready(protocol),'owner.near'),{network:'mainnet',signerId:'owner.near',receiverId,actions:[{type:'FunctionCall',params:{methodName:'withdraw',args:{amount},deposit:'0',gas:WITHDRAW_GAS}}]});
 }
});
test('wrong owner is rejected before any preflight or signing',async()=>{
 let reads=0;
 await assert.rejects(prepareWithdrawal(ready(),{getAccounts:async()=>[{accountId:'other.near'}],read:async()=>{reads++;}}),{code:'WRONG_ACCOUNT'});
 assert.equal(reads,0);assert.throws(()=>withdrawalTransaction(ready(),'other.near'),{code:'WRONG_ACCOUNT'});
});
test('pending, zero, error, lockup, invalid values, and arbitrary contracts cannot build a withdrawal',()=>{
 for(const changes of [{state:'pending'},{state:'empty'},{state:'unavailable'},{state:'error'},{amount:'0'},{amount:42},{amount:String(2n**128n)},{protocol:'__proto__'},{protocol:'attacker.near'},{account:'invalid..near'}])assert.throws(()=>withdrawalTransaction(ready('linear',changes),'owner.near'));
 for(const protocol of ['linear','metapool'])assert.throws(()=>withdrawalTransaction(ready(protocol,{account:'owner.lockup.near'}),'owner.lockup.near'),{code:'LOCKUP'});
});
test('a fresh exact balance and a second wallet-account check are required before signing',async()=>{
 let checks=0,reads=0;
 const r=await prepareWithdrawal(ready(),{getAccounts:async options=>{assert.equal(options.network,'mainnet');checks++;return accounts();},read:async account=>{assert.equal(account,'owner.near');reads++;return fresh(ready());}});
 assert.equal(checks,2);assert.equal(reads,1);assert.equal(r.transaction.actions[0].params.args.amount,amount);
});
test('a changed balance, readiness, or wallet account aborts instead of silently changing the payment',async()=>{
 await assert.rejects(prepareWithdrawal(ready(),{getAccounts:accounts,read:async()=>fresh(ready('linear',{amount:'6'}))}),{code:'BALANCE_CHANGED'});
 await assert.rejects(prepareWithdrawal(ready(),{getAccounts:accounts,read:async()=>fresh(ready('linear',{state:'pending'}))}),{code:'NOT_READY'});
 let checks=0;await assert.rejects(prepareWithdrawal(ready(),{getAccounts:async()=>[++checks===1?{accountId:'owner.near'}:{accountId:'other.near'}],read:async()=>fresh(ready())}),{code:'WRONG_ACCOUNT'});
});
test('a refreshed result for another account cannot authorize a withdrawal',async()=>{
 for(const data of [{...fresh(ready()),account:'other.near'},fresh(ready('linear',{account:'other.near'}))]){
  await assert.rejects(prepareWithdrawal(ready(),{getAccounts:accounts,read:async()=>data}),{code:'WRONG_ACCOUNT'});
 }
});
test('only a finalized matching transaction with a complete successful receipt chain is confirmed',()=>{
 assert.equal(inspectWithdrawal(receipt(),pending()).state,'confirmed');
 for(const status of ['EXECUTED_OPTIMISTIC','EXECUTED','INCLUDED_FINAL'])assert.equal(inspectWithdrawal(receipt({final_execution_status:status}),pending()).state,'pending');
 const incomplete=receipt();incomplete.receipts_outcome.pop();assert.throws(()=>inspectWithdrawal(incomplete,pending()),/Incomplete receipt/);
 assert.throws(()=>inspectWithdrawal(receipt({receipts_outcome:[]}),pending()),/Missing execution/);
});
test('a failed downstream native transfer is not reported as recovered funds',()=>{
 const r=receipt();r.receipts_outcome[1].outcome.status={Failure:{ActionError:{}}};
 assert.equal(inspectWithdrawal(r,pending()).state,'failed');
 assert.equal(inspectWithdrawal(receipt({status:{Failure:{ActionError:{}}}}),pending()).state,'failed');
});
test('a hash, signer, contract, action, amount, gas or deposit mismatch cannot confirm a withdrawal',()=>{
 for(const mutate of [r=>r.transaction.hash='B'.repeat(44),r=>r.transaction.signer_id='other.near',r=>r.transaction.receiver_id='attacker.near',r=>r.transaction.actions.push({Transfer:{deposit:'1'}}),r=>r.transaction.actions[0].FunctionCall.method_name='unstake',r=>r.transaction.actions[0].FunctionCall.deposit='1',r=>r.transaction.actions[0].FunctionCall.gas='1',r=>r.transaction.actions[0].FunctionCall.args=btoa(JSON.stringify({amount:'1'})),r=>r.transaction.actions[0].FunctionCall.args=btoa(JSON.stringify({amount,receiver_id:'attacker.near'}))]){
  const r=receipt();mutate(r);assert.throws(()=>inspectWithdrawal(r,pending()));
 }
});
test('receipt lookup falls back from a mismatched provider and never broadcasts a transaction',async()=>{
 const requests=[];
 const fetcher=async(endpoint,options)=>{requests.push(JSON.parse(options.body));const result=receipt();if(endpoint==='bad')result.transaction.signer_id='other.near';return {ok:true,json:async()=>({result})};};
 assert.equal((await checkWithdrawal(pending(),{fetcher,endpoints:['bad','good']})).state,'confirmed');
 assert.ok(requests.every(r=>r.method==='tx'&&r.params.wait_until==='FINAL'&&r.params.sender_account_id==='owner.near'&&r.params.tx_hash===hash));
});
test('unavailable confirmation remains unknown rather than success or a new submission',async()=>{
 await assert.rejects(checkWithdrawal(pending(),{fetcher:async()=>({ok:false}),endpoints:['offline']}),{code:'CONFIRMATION_UNKNOWN'});
});
test('persisted requests are mainnet-only, bounded and restricted to supported withdrawals',()=>{
 assert.equal(validPending(pending()),true);assert.equal(validPending(pending({hash:null})),true);
 for(const change of [{network:'testnet'},{protocol:'__proto__'},{protocol:'custom'},{account:'x.lockup.near'},{hash:'javascript:alert(1)'},{amount:'0'},{createdAt:undefined}])assert.equal(validPending(pending(change)),false);
});
