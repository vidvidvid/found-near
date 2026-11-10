import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createRecoveryStore,createRecoveryApi,verifyRecovery} from '../recoveries.mjs';
import {RNEAR_CODE_HASH} from '../dist/rpc.js';
import {withdrawalGas} from '../dist/withdrawal.js';
const now=1794347000000,hash='A'.repeat(44),blockHash='B'.repeat(44);
const item={account:'owner.near',protocol:'rnear',amount:'12345678901234567890123456',codeHash:RNEAR_CODE_HASH};
const intent={id:'a'.repeat(48),account:item.account,protocol:item.protocol,amount:item.amount,code_hash:item.codeHash,created_at:now};
function receipt(){return {final_execution_status:'FINAL',status:{SuccessValue:''},transaction:{hash,signer_id:item.account,receiver_id:'lst.rhealab.near',actions:[{FunctionCall:{method_name:'withdraw',args:btoa(JSON.stringify({amount:item.amount})),gas:withdrawalGas('rnear'),deposit:'0'}}]},transaction_outcome:{block_hash:blockHash,outcome:{status:{SuccessReceiptId:'call'},receipt_ids:['call']}},receipts_outcome:[{id:'call',block_hash:blockHash,outcome:{executor_id:'lst.rhealab.near',status:{SuccessValue:''},receipt_ids:['transfer']}},{id:'transfer',block_hash:blockHash,outcome:{executor_id:item.account,status:{SuccessValue:''},receipt_ids:[]}}]};}
function reader({tx=receipt(),timestamp=now+1000,code=RNEAR_CODE_HASH}={}){return async(method,params)=>method==='tx'?tx:method==='block'?{header:{hash:blockHash,height:123,timestamp:(BigInt(timestamp)*1000000n).toString()}}:{block_hash:blockHash,code_hash:code};}
test('server verifies the exact completed receipt, request time and deployed contract code',async()=>{
 assert.equal((await verifyRecovery(intent,hash,{read:reader()})).state,'confirmed');
 for(const options of [{timestamp:now-60000},{timestamp:now+31*60000},{code:'unreviewed'}])await assert.rejects(verifyRecovery(intent,hash,{read:reader(options)}));
 const wrong=receipt();wrong.transaction.receiver_id='other.near';await assert.rejects(verifyRecovery(intent,hash,{read:reader({tx:wrong})}));
});
test('pending and downstream-failed transfers are never counted',async()=>{
 const tx=receipt();tx.final_execution_status='EXECUTED';assert.equal((await verifyRecovery(intent,hash,{read:reader({tx})})).state,'pending');
 tx.final_execution_status='FINAL';tx.receipts_outcome[1].outcome.status={Failure:{}};assert.equal((await verifyRecovery(intent,hash,{read:reader({tx})})).state,'failed');
 const incomplete=receipt();incomplete.receipts_outcome.pop();await assert.rejects(verifyRecovery(intent,hash,{read:reader({tx:incomplete})}));
});
test('persistent recovery totals are exact, unique by transaction, and count each account once',()=>{
 const dir=mkdtempSync(join(tmpdir(),'found-tracking-')),path=join(dir,'recovery.sqlite');let store=createRecoveryStore(path);
 try{
  const first=store.start(item,now),entry=store.get(first);store.record(entry,hash,123,now);store.record(entry,hash,123,now);
  const second=store.start({...item,amount:'1'},now);store.record(store.get(second),'C'.repeat(44),124,now);
  assert.deepEqual(store.summary(),{withdrawals:2,accounts:1,totalYocto:(BigInt(item.amount)+1n).toString(),updatedAt:now});
  store.close();store=createRecoveryStore(path);assert.equal(store.summary().withdrawals,2);
  const third=store.start({...item,account:'another.near'},now);store.record(store.get(third),'D'.repeat(44),125,now);assert.equal(store.summary().accounts,2);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('the same request cannot claim two unrelated withdrawals',()=>{
 const store=createRecoveryStore(':memory:');try{const id=store.start(item,now),r=store.get(id);store.record(r,hash,123,now);assert.throws(()=>store.record(r,'C'.repeat(44),123,now));assert.equal(store.summary().withdrawals,1);}finally{store.close();}
});
test('tracking API rejects cross-origin and malformed submissions; only independently verified confirmations count',async()=>{
 const store=createRecoveryStore(':memory:');let state='failed',verifications=0;
 const api=createRecoveryApi({store,now:()=>now,verify:async()=>{verifications++;return {state,height:123};}});
 const server=createServer(async(req,res)=>{await api(req,res,req.url);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const post=(path,data,origin=base)=>fetch(base+'/api/recoveries/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)});
 try{
  assert.equal((await post('start',item,'https://attacker.example')).status,403);
  assert.equal((await post('start',{...item,protocol:'pool:attacker.near',codeHash:'fake'})).status,400);
  const started=await post('start',item);assert.equal(started.status,201);const {intentId}=await started.json();
  assert.equal(store.summary().withdrawals,0);
  assert.equal((await post('confirm',{intentId,hash})).status,422);assert.equal(store.summary().withdrawals,0);
  state='pending';assert.equal((await post('confirm',{intentId,hash})).status,202);assert.equal(store.summary().withdrawals,0);
  state='confirmed';assert.equal((await post('confirm',{intentId,hash})).status,200);assert.equal((await post('confirm',{intentId,hash})).status,200);assert.equal(verifications,3);assert.equal(store.summary().withdrawals,1);
  const another=await (await post('start',item)).json();assert.equal((await post('confirm',{intentId:another.intentId,hash})).status,409);assert.equal((await post('confirm',{intentId,hash:'C'.repeat(44)})).status,409);assert.equal(store.summary().withdrawals,1);
  const summary=await (await fetch(base+'/api/recoveries')).json();assert.equal(summary.accounts,1);assert.equal(summary.totalYocto,item.amount);assert.equal('account' in summary,false);
 }finally{await new Promise(r=>server.close(r));store.close();}
});
test('the tracking service stores no pageviews and returns unavailable when persistent storage is disabled',async()=>{
 const api=createRecoveryApi();let status,body;const res={writeHead:value=>status=value,end:value=>body=value};assert.equal(await api({method:'GET'},res,'/'),false);await api({method:'GET'},res,'/api/recoveries');assert.equal(status,503);assert.match(body,/unavailable/);
});
