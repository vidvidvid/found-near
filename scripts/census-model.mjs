import {createHash} from 'node:crypto';
import {validAccount,isU128} from '../dist/rpc.js';

export const MINIMUM=10n**22n;

// rNEAR's near-sdk 5.14 IterableMap: Vector<AccountId> at [2,'v'],
// and SHA256([2,'m'] + borsh(AccountId)) -> {u128,u64,u32} values.
// Decode every slot; verify every qualifying value with its public view later.
export function decodeRnear(values,count){
 if(!Array.isArray(values)||!Number.isSafeInteger(count)||count<0||count>1000000)throw Error('Invalid rNEAR state');
 const state=new Map(values.map(r=>[Buffer.from(r.key,'base64').toString('hex'),Buffer.from(r.value,'base64')]));
 if(state.size!==values.length)throw Error('Duplicate state key');
 if([...state.keys()].filter(k=>k.startsWith('0276')&&k.length===12).length!==count)throw Error('rNEAR count mismatch');
 const accounts=[],seen=new Set();
 for(let index=0;index<count;index++){
  const key=Buffer.alloc(6);key[0]=2;key[1]=0x76;key.writeUInt32LE(index,2);
  const value=state.get(key.toString('hex'));
  if(!value||value.length<4||value.readUInt32LE(0)!==value.length-4)throw Error('Missing rNEAR account slot');
  const account=value.subarray(4).toString();if(!validAccount(account)||seen.has(account))throw Error('Invalid rNEAR account');seen.add(account);
  const digest=createHash('sha256').update(Buffer.concat([Buffer.from([2,0x6d]),value])).digest('hex'),entry=state.get(digest);
  if(!entry||entry.length!==28||entry.readUInt32LE(24)!==index)throw Error('rNEAR map index mismatch');
  const amount=entry.readBigUInt64LE(0)+(entry.readBigUInt64LE(8)<<64n);
  accounts.push({account_id:account,unstaked_balance:amount.toString(),can_withdraw:null});
 }
 return accounts;
}

export function decodeFactory(values,count,factory){
 if(!['poolv1.near','pool.near'].includes(factory)||!Array.isArray(values)||!Number.isSafeInteger(count)||count<0||values.length!==count)throw Error('Factory count mismatch');
 const indexes=new Set(),ids=new Set();
 for(const item of values){
  const key=Buffer.from(item.key,'base64'),value=Buffer.from(item.value,'base64');
  if(key.length!==10||key.subarray(0,2).toString()!=='se'||value.length<4||value.readUInt32LE(0)!==value.length-4)throw Error('Malformed factory record');
  const index=Number(key.readBigUInt64LE(2)),id=value.subarray(4).toString();
  if(!Number.isSafeInteger(index)||index>=count||indexes.has(index)||!validAccount(id)||!id.endsWith('.'+factory)||ids.has(id))throw Error('Invalid factory slot');
  indexes.add(index);ids.add(id);
 }
 return [...ids].sort();
}

export function aggregateSources(raw){
 const accounts=new Map(),checked=new Set(),sources=[];
 for(const [contract,rows] of Object.entries(raw).sort(([a],[b])=>(a<b?-1:a>b?1:0))){
  if(!validAccount(contract)||!Array.isArray(rows))throw Error('Invalid source');
  const seen=new Set();let qualifying=0,virtual=0;
  for(const row of rows){
   if(!row||!isU128(row.unstaked_balance)||seen.has(row.account_id))throw Error('Invalid or duplicate account record');
   seen.add(row.account_id);
   if(row.account_id==='..NSLP..'&&contract==='meta-pool.near'){virtual++;continue;}
   if(!validAccount(row.account_id)||typeof row.can_withdraw!=='boolean'&&!(contract==='lst.rhealab.near'&&row.can_withdraw===null&&BigInt(row.unstaked_balance)<=MINIMUM))throw Error('Invalid maturity or account');
   checked.add(row.account_id);
   if(row.can_withdraw!==true||BigInt(row.unstaked_balance)<=MINIMUM)continue;
   qualifying++;
   const account=accounts.get(row.account_id)||{account_id:row.account_id,unstaked_balance:'0',sources:[]};
   account.sources.push({contract,amount:row.unstaked_balance});
   account.unstaked_balance=(BigInt(account.unstaked_balance)+BigInt(row.unstaked_balance)).toString();
   accounts.set(row.account_id,account);
  }
  sources.push({contract,accounts:rows.length,virtual,qualified:qualifying});
 }
 return {uniqueAccountsChecked:checked.size,sources,accounts:[...accounts.values()].sort((a,b)=>BigInt(a.unstaked_balance)>BigInt(b.unstaked_balance)?-1:BigInt(a.unstaked_balance)<BigInt(b.unstaked_balance)?1:(a.account_id<b.account_id?-1:a.account_id>b.account_id?1:0))};
}

export function publishSnapshot(meta,raw){
 if(meta.complete!==true||!Array.isArray(meta.errors)||meta.errors.length||!Number.isSafeInteger(meta.block)||meta.block<=0||!meta.hash||!Number.isFinite(Date.parse(meta.asOf)))throw Error('Incomplete census cannot be published');
 for(const contract of ['linear-protocol.near','meta-pool.near','lst.rhealab.near'])if(!Object.hasOwn(raw,contract))throw Error('Missing protocol');
 const result=aggregateSources(raw),poolSources=result.sources.filter(s=>!['linear-protocol.near','meta-pool.near','lst.rhealab.near'].includes(s.contract));
 if(poolSources.length+meta.unsupported.length+meta.closed.length!==meta.discoveredPools)throw Error('Incomplete pool inventory');
 return {version:2,block:meta.block,hash:meta.hash,asOf:meta.asOf,complete:true,scope:'LiNEAR, Meta Pool, rNEAR and recognized pools created by poolv1.near and pool.near. Matured balances, not proven abandoned funds.',minimumExclusiveYocto:MINIMUM.toString(),inclusion:'At least one matured balance above 0.01 NEAR. Each account is counted once; only qualifying source balances are summed.',...result,totalListedYocto:result.accounts.reduce((n,a)=>n+BigInt(a.unstaked_balance),0n).toString(),counts:{accountsWithWaiting:result.accounts.length,accountsChecked:result.uniqueAccountsChecked,protocols:3,validatorPools:poolSources.length,unsupportedPools:meta.unsupported.length,closedPools:meta.closed.length},unsupported:meta.unsupported,closed:meta.closed};
}
