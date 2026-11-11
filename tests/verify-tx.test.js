import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {POOL_CODE_HASHES,RNEAR_CODE_HASH} from '../dist/rpc.js';
import {withdrawalGas} from '../dist/withdrawal.js';
import {verifyWithdrawalEvidence,fetchWithdrawalEvidence,protocolFor,report} from '../scripts/verify-tx-model.mjs';
const hash='A'.repeat(44),txBlock='B'.repeat(44),callBlock='C'.repeat(44),amount='999999000000000000000002';
// Shaped like a real EXPERIMENTAL_tx_status answer for a validator-pool withdrawal:
// the call receipt, the pool's transfer to the owner, and a gas refund from "system".
function evidence({contract='meteor.poolv1.near',code=POOL_CODE_HASHES[0],paid=amount,gas=Number(withdrawalGas(protocolFor(contract)))}={}){
 const ok={SuccessValue:''};
 return {hash,contract:{block_hash:callBlock,code_hash:code},block:{header:{hash:txBlock,height:224100000,timestamp:'1794441600000000000'}},tx:{
  final_execution_status:'FINAL',status:ok,
  transaction:{hash,signer_id:'owner.near',receiver_id:contract,actions:[{FunctionCall:{method_name:'withdraw',args:btoa(JSON.stringify({amount})),deposit:'0',gas}}]},
  transaction_outcome:{id:hash,block_hash:txBlock,outcome:{executor_id:'owner.near',status:{SuccessReceiptId:'call'},receipt_ids:['call']}},
  receipts:[
   {receipt_id:'call',predecessor_id:'owner.near',receiver_id:contract,receipt:{Action:{actions:[{FunctionCall:{method_name:'withdraw'}}]}}},
   {receipt_id:'pay',predecessor_id:contract,receiver_id:'owner.near',receipt:{Action:{actions:[{Transfer:{deposit:paid}}]}}},
   {receipt_id:'refund',predecessor_id:'system',receiver_id:'owner.near',receipt:{Action:{actions:[{Transfer:{deposit:'1'}}]}}}],
  receipts_outcome:[
   {id:'call',block_hash:callBlock,outcome:{executor_id:contract,status:ok,receipt_ids:['pay','refund']}},
   {id:'pay',block_hash:callBlock,outcome:{executor_id:'owner.near',status:ok,receipt_ids:[]}},
   {id:'refund',block_hash:callBlock,outcome:{executor_id:'owner.near',status:ok,receipt_ids:[]}}]}};
}
test('a finalized pool withdrawal with the exact transfer to its signer is verified',()=>{
 const r=verifyWithdrawalEvidence(evidence(),{account:'owner.near'});
 assert.deepEqual({protocol:r.protocol,amountNear:r.amountNear,transferReceipt:r.transferReceipt,transferredYocto:r.transferredYocto,height:r.height,time:r.time,codeHash:r.codeHash},{protocol:'pool:meteor.poolv1.near',amountNear:'0.999999000000000000000002',transferReceipt:'pay',transferredYocto:amount,height:224100000,time:'2026-11-12T00:00:00.000Z',codeHash:POOL_CODE_HASHES[0]});
 assert.match(report(r),/meteor\.poolv1\.near -> owner\.near, 0\.999999000000000000000002 NEAR/);
 assert.equal(verifyWithdrawalEvidence(evidence({contract:'lst.rhealab.near',code:RNEAR_CODE_HASH})).protocol,'rnear');
 assert.equal(verifyWithdrawalEvidence(evidence({contract:'linear-protocol.near',code:'unused'})).codeHash,null);
});
test('another signer, unreviewed code, a different gas limit or a code read at another block is rejected',()=>{
 assert.throws(()=>verifyWithdrawalEvidence(evidence(),{account:'other.near'}),/Signed by owner\.near/);
 assert.throws(()=>verifyWithdrawalEvidence(evidence({code:'unreviewed'})),/unsupported contract code/);
 assert.throws(()=>verifyWithdrawalEvidence(evidence({gas:30000000000000})),/does not match/);
 const moved=evidence();moved.contract.block_hash=txBlock;assert.throws(()=>verifyWithdrawalEvidence(moved),/not read at the block/);
 const header=evidence();header.block.header.hash=callBlock;assert.throws(()=>verifyWithdrawalEvidence(header),/Block header/);
});
test('a missing, short, failed or misdirected transfer is never reported as a withdrawal',()=>{
 assert.throws(()=>verifyWithdrawalEvidence(evidence({paid:'999999000000000000000001'})),/No successful transfer/);
 const none=evidence();none.tx.receipts.splice(1,1);assert.throws(()=>verifyWithdrawalEvidence(none),/No successful transfer/);
 const elsewhere=evidence();elsewhere.tx.receipts[1].receiver_id='other.near';assert.throws(()=>verifyWithdrawalEvidence(elsewhere),/No successful transfer/);
 const failed=evidence();failed.tx.receipts_outcome[1].outcome.status={Failure:{ActionError:{}}};assert.throws(()=>verifyWithdrawalEvidence(failed),/"failed"/);
 const early=evidence();early.tx.final_execution_status='EXECUTED';assert.throws(()=>verifyWithdrawalEvidence(early),/"pending"/);
 const cut=evidence();cut.tx.receipts_outcome.pop();assert.throws(()=>verifyWithdrawalEvidence(cut),/Incomplete receipt chain/);
 // The system gas refund goes to the signer but is not the withdrawal.
 const refundOnly=evidence({paid:'1'});assert.throws(()=>verifyWithdrawalEvidence(refundOnly),/No successful transfer/);
});
test('evidence is read at the transaction block and at the block that executed the call',async()=>{
 const source=evidence(),calls=[];
 const read=async(method,params)=>{calls.push([method,params.block_id||params.tx_hash]);return method==='EXPERIMENTAL_tx_status'?source.tx:method==='block'?{header:source.block.header,chunks:[]}:source.contract;};
 const fetched=await fetchWithdrawalEvidence(hash,'owner.near',read);
 assert.deepEqual(calls,[['EXPERIMENTAL_tx_status',hash],['block',txBlock],['query',callBlock]]);
 assert.deepEqual(fetched,source);
});
test('the command runs offline and explains itself when no evidence is archived',()=>{
 const out=execFileSync(process.execPath,['scripts/verify-tx.mjs'],{encoding:'utf8'});
 assert.match(out,/No archived withdrawal evidence|Verified \d+ archived withdrawal/);
 assert.throws(()=>execFileSync(process.execPath,['scripts/verify-tx.mjs','not-a-hash'],{encoding:'utf8',stdio:'pipe'}),/not a transaction hash/);
});
