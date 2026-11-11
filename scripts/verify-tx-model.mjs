import {PROTOCOLS,protocolInfo,exactNear} from '../dist/rpc.js';
import {inspectWithdrawal,validPending,validHash,withdrawalGas} from '../dist/withdrawal.js';

// Evidence for one withdrawal: the raw EXPERIMENTAL_tx_status result, the header of the
// transaction's block and the contract's view_account at the block that executed the call.
// The verdict comes from inspectWithdrawal, the same function the app and the server use;
// this module adds the checks that need data the browser never sees (receipt actions).
export const protocolFor=contract=>Object.values(PROTOCOLS).find(p=>p.contract===contract)?.id||`pool:${contract}`;

export function verifyWithdrawalEvidence(evidence,{account}={}){
 const {hash,tx,block,contract}=evidence||{};
 if(!validHash(hash)||!tx?.transaction)throw Error('Evidence is missing the transaction.');
 const t=tx.transaction,call=t.actions?.[0]?.FunctionCall;
 if(account&&t.signer_id!==account)throw Error(`Signed by ${t.signer_id}, not ${account}.`);
 const protocol=protocolFor(t.receiver_id);
 if(!protocolInfo(protocol))throw Error(`${t.receiver_id} is not a contract FOUND withdraws from.`);
 let args;try{args=JSON.parse(atob(call?.args||''));}catch{throw Error('Unrecognized transaction arguments.');}
 const needsCode=protocol==='rnear'||protocol.startsWith('pool:');
 const callReceipt=tx.receipts_outcome?.find(r=>r.outcome?.executor_id===t.receiver_id);
 if(needsCode&&(!validHash(callReceipt?.block_hash)||contract?.block_hash!==callReceipt.block_hash))throw Error('Contract code was not read at the block that executed the call.');
 const pending={network:'mainnet',account:t.signer_id,protocol,amount:args.amount,codeHash:needsCode?contract.code_hash:undefined,createdAt:1,hash};
 if(!validPending(pending))throw Error('Not a withdrawal FOUND would build: unsupported contract code, account or amount.');
 const verdict=inspectWithdrawal(tx,pending);
 if(verdict.state!=='confirmed')throw Error(`Receipt verifier returned "${verdict.state}", not "confirmed".`);
 // The contract must have paid the signer. Meta Pool may add its documented dust sweep.
 const succeeded=new Set(tx.receipts_outcome.filter(r=>Object.hasOwn(r.outcome.status,'SuccessValue')).map(r=>r.id));
 const transfers=(tx.receipts||[]).filter(r=>r.predecessor_id===t.receiver_id&&r.receiver_id===t.signer_id&&succeeded.has(r.receipt_id)).map(r=>({id:r.receipt_id,actions:r.receipt?.Action?.actions||[]})).filter(r=>r.actions.length===1&&/^\d+$/.test(r.actions[0]?.Transfer?.deposit||''));
 const paid=transfers.find(r=>protocol==='metapool'?BigInt(r.actions[0].Transfer.deposit)>=BigInt(args.amount):r.actions[0].Transfer.deposit===args.amount);
 if(!paid)throw Error('No successful transfer of the withdrawn amount from the contract to the signer.');
 const header=block?.header;
 if(header?.hash!==tx.transaction_outcome.block_hash||!Number.isSafeInteger(header.height)||!/^\d+$/.test(header.timestamp||''))throw Error('Block header does not match the transaction.');
 return {hash,account:t.signer_id,contract:t.receiver_id,protocol,name:protocolInfo(protocol).name,codeHash:pending.codeHash||null,amountYocto:args.amount,amountNear:exactNear(args.amount),gas:withdrawalGas(protocol),receipts:tx.receipts_outcome.length,transferReceipt:paid.id,transferredYocto:paid.actions[0].Transfer.deposit,height:header.height,time:new Date(Number(BigInt(header.timestamp)/1000000n)).toISOString(),explorer:`https://nearblocks.io/txns/${hash}`};
}

export async function fetchWithdrawalEvidence(hash,account,read){
 const tx=await read('EXPERIMENTAL_tx_status',{tx_hash:hash,sender_account_id:account,wait_until:'FINAL'});
 const blockHash=tx?.transaction_outcome?.block_hash;if(!validHash(blockHash))throw Error('Transaction block not available.');
 const block=await read('block',{block_id:blockHash});
 const callReceipt=tx.receipts_outcome?.find(r=>r.outcome?.executor_id===tx.transaction.receiver_id);
 const contract=validHash(callReceipt?.block_hash)?await read('query',{request_type:'view_account',account_id:tx.transaction.receiver_id,block_id:callReceipt.block_hash}):null;
 return {hash,tx,block:{header:block.header},contract};
}

export function report(r){
 return [`Withdrawal ${r.hash}`,
  `  signer     ${r.account}`,
  `  contract   ${r.contract} (${r.name})${r.codeHash?` · reviewed code ${r.codeHash}`:''}`,
  `  call       withdraw {"amount":"${r.amountYocto}"} · deposit 0 · gas ${r.gas}`,
  `  amount     ${r.amountNear} NEAR`,
  `  receipts   ${r.receipts}, all successful, every referenced receipt present`,
  `  transfer   ${r.transferReceipt}: ${r.contract} -> ${r.account}, ${exactNear(r.transferredYocto)} NEAR`,
  `  block      ${r.height} · ${r.time}`,
  `  explorer   ${r.explorer}`].join('\n');
}
