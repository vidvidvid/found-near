import {protocolInfo,POOL_CODE_HASHES,RNEAR_CODE_HASH,ENDPOINTS,scanProtocols,validAccount,isU128} from './rpc.js';
export const WITHDRAW_GAS='100000000000000';
export const NETWORK='mainnet';
export const withdrawalGas=protocol=>protocol==='rnear'?'200000000000000':WITHDRAW_GAS;
export class WithdrawalError extends Error{constructor(message,code){super(message);this.code=code;}}
function assertReady(result){
 if(!result||!protocolInfo(result.protocol)||!validAccount(result.account||'')||result.state!=='found'||!isU128(result.amount)||BigInt(result.amount)<=0n)throw new WithdrawalError('This withdrawal is not ready. Check the balance again.','NOT_READY');
 if(result.protocol.startsWith('pool:')&&!POOL_CODE_HASHES.includes(result.codeHash)||result.protocol==='rnear'&&result.codeHash!==RNEAR_CODE_HASH)throw new WithdrawalError('This contract version has not been verified for withdrawals.','UNSUPPORTED_CODE');
 if(/\.lockup\.near$/.test(result.account))throw new WithdrawalError('This account must withdraw through its lockup contract.','LOCKUP');
}
export function withdrawalTransaction(result,signerId){
 assertReady(result);
 if(signerId!==result.account)throw new WithdrawalError('Connect the wallet that controls this account.','WRONG_ACCOUNT');
 return {network:NETWORK,signerId,receiverId:protocolInfo(result.protocol).contract,actions:[{type:'FunctionCall',params:{methodName:'withdraw',args:{amount:result.amount},gas:withdrawalGas(result.protocol),deposit:'0'}}]};
}
export async function prepareWithdrawal(result,{getAccounts,read=scanProtocols}){
 assertReady(result);
 const owns=accounts=>Array.isArray(accounts)&&accounts.some(a=>a.accountId===result.account);
 if(!owns(await getAccounts({network:NETWORK})))throw new WithdrawalError('Connect the wallet that controls this account.','WRONG_ACCOUNT');
 const fresh=await read(result.account);
 if(fresh?.account!==result.account||!Array.isArray(fresh.results))throw new WithdrawalError('The refreshed account did not match. Please check again.','WRONG_ACCOUNT');
 const updated=fresh.results.find(r=>r.protocol===result.protocol);
 if(updated?.account!==result.account)throw new WithdrawalError('The refreshed account did not match. Please check again.','WRONG_ACCOUNT');
 try{assertReady(updated);}catch(error){error.fresh=fresh;throw error;}
 if(updated.codeHash!==result.codeHash)throw new WithdrawalError('The contract changed since this check. Refresh before withdrawing.','CONTRACT_CHANGED');
 if(updated.amount!==result.amount){const error=new WithdrawalError('The balance changed. Review the updated amount and try again.','BALANCE_CHANGED');error.fresh=fresh;throw error;}
 if(!owns(await getAccounts({network:NETWORK})))throw new WithdrawalError('Your wallet account changed. Check it before withdrawing.','WRONG_ACCOUNT');
 return {fresh,transaction:withdrawalTransaction(updated,result.account)};
}
export const validHash=value=>typeof value==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
export function validPending(value){
 return !!value&&value.network===NETWORK&&!!protocolInfo(value.protocol)&&(value.protocol.startsWith('pool:')?POOL_CODE_HASHES.includes(value.codeHash):value.protocol==='rnear'?value.codeHash===RNEAR_CODE_HASH:true)&&validAccount(value.account||'')&&!/\.lockup\.near$/.test(value.account)&&isU128(value.amount)&&BigInt(value.amount)>0n&&Number.isSafeInteger(value.createdAt)&&value.createdAt>0&&(value.hash===null||validHash(value.hash));
}
export function inspectWithdrawal(outcome,pending){
 if(!validPending(pending)||!validHash(pending.hash))throw new Error('Invalid withdrawal receipt request.');
 const tx=outcome?.transaction,call=tx?.actions?.[0]?.FunctionCall;
 let args;try{args=JSON.parse(atob(call?.args||''));}catch{throw new Error('Unrecognized transaction arguments.');}
 if(tx?.hash!==pending.hash||tx.signer_id!==pending.account||tx.receiver_id!==protocolInfo(pending.protocol).contract||tx.actions.length!==1||call?.method_name!=='withdraw'||call.deposit!=='0'||String(call.gas)!==withdrawalGas(pending.protocol)||args.amount!==pending.amount||Object.keys(args).length!==1)throw new Error('The receipt does not match this withdrawal.');
 if(outcome.final_execution_status!=='FINAL')return {state:'pending',hash:pending.hash};
 const receipts=outcome.receipts_outcome;
 if(!Array.isArray(receipts)||!receipts.length||!outcome.transaction_outcome?.outcome?.status)throw new Error('Missing execution receipts.');
 const statuses=[outcome.status,outcome.transaction_outcome.outcome.status,...receipts.map(r=>r?.outcome?.status)];
 if(statuses.some(s=>s&&Object.hasOwn(s,'Failure')))return {state:'failed',hash:pending.hash};
 if(!Object.hasOwn(outcome.status||{},'SuccessValue')||statuses.some(s=>!s||!(Object.hasOwn(s,'SuccessValue')||Object.hasOwn(s,'SuccessReceiptId'))))return {state:'pending',hash:pending.hash};
 // Confirm all receipt references are present, including the native transfer and refunds.
 const ids=new Set(receipts.map(r=>r.id));
 for(const r of [outcome.transaction_outcome,...receipts]){
  if(!Array.isArray(r.outcome.receipt_ids)||r.outcome.receipt_ids.some(id=>!ids.has(id)))throw new Error('Incomplete receipt chain.');
 }
 return {state:'confirmed',hash:pending.hash};
}
export async function checkWithdrawal(pending,{fetcher=fetch,endpoints=ENDPOINTS}={}){
 if(!validPending(pending)||!validHash(pending.hash))throw new Error('A transaction hash is required.');
 const controllers=endpoints.map(()=>new AbortController());
 try{return await Promise.any(endpoints.map(async(endpoint,i)=>{
  const timer=setTimeout(()=>controllers[i].abort(),10000);
  try{
   const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'found-withdrawal',method:'tx',params:{tx_hash:pending.hash,sender_account_id:pending.account,wait_until:'FINAL'}}),signal:controllers[i].signal});
   if(!response.ok)throw Error('Receipt service unavailable.');
   const data=await response.json();if(data.error)throw Error('Receipt not available yet.');
   return inspectWithdrawal(data.result,pending);
  }finally{clearTimeout(timer);}
 }));}catch{throw new WithdrawalError('Confirmation is taking longer. Check the transaction before trying again.','CONFIRMATION_UNKNOWN');}
 finally{controllers.forEach(c=>c.abort());}
}
