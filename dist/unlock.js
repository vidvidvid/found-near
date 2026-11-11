import {rpc,protocolInfo,POOL_CODE_HASHES,RNEAR_CODE_HASH,validAccount,isU128} from './rpc.js';
// Advisory only. These functions never change readiness or construct transactions.
const encoder=new TextEncoder(),decoder=new TextDecoder();
const encode=bytes=>btoa(String.fromCharCode(...bytes));
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const join=(...parts)=>{const bytes=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes;};
export function accountBytes(account){const text=encoder.encode(account),prefix=new Uint8Array(4);new DataView(prefix.buffer).setUint32(0,text.length,true);return join(prefix,text);}
function exactEntry(response,key){
 if(!Array.isArray(response?.values)||response.values.length!==1||response.values[0].key!==encode(key))throw Error('Missing or ambiguous state entry');
 return decode(response.values[0].value);
}
export function decodePoolEpoch({index,key,value},account,amount){
 const id=accountBytes(account),slot=exactEntry(index,join(encoder.encode('ui'),id));if(slot.length!==8)throw Error('Invalid pool index');
 const stored=exactEntry(key,join(encoder.encode('uk'),slot));
 if(encode(stored)!==encode(id))throw Error('Pool account mismatch');
 const bytes=exactEntry(value,join(encoder.encode('uv'),slot));if(bytes.length!==40)throw Error('Unsupported pool layout');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),balance=view.getBigUint64(0,true)+(view.getBigUint64(8,true)<<64n);
 if(!isU128(amount)||balance!==BigInt(amount))throw Error('Pool balance mismatch');
 const epoch=Number(view.getBigUint64(32,true));if(!Number.isSafeInteger(epoch)||epoch<=0)throw Error('Invalid unlock epoch');return epoch;
}
export function estimateUnlockTime({unlockEpoch,currentEpoch,epochStartHeight,epochLength,head,earlier}){
 if(![unlockEpoch,currentEpoch,epochStartHeight,epochLength,head?.height,earlier?.height].every(Number.isSafeInteger))return null;
 const epochs=unlockEpoch-currentEpoch,span=head.height-earlier.height;
 if(epochs<=0||epochs>30||epochLength<=0||head.height<epochStartHeight||head.height>=epochStartHeight+epochLength||span<100||span>50000)return null;
 if(!/^\d+$/.test(head.timestamp)||!/^\d+$/.test(earlier.timestamp))return null;
 const seconds=Number(BigInt(head.timestamp)-BigInt(earlier.timestamp))/1e9/span;
 if(!Number.isFinite(seconds)||seconds<0.1||seconds>10)return null;
 const remainingBlocks=epochStartHeight+epochs*epochLength-head.height;
 const estimatedAtMs=Number(BigInt(head.timestamp)/1000000n)+remainingBlocks*seconds*1000;
 if(!Number.isFinite(estimatedAtMs))return null;
 return {estimatedAt:new Date(estimatedAtMs).toISOString(),unlockEpoch,currentEpoch,secondsPerBlock:seconds,checkedBlock:head.height,checkedAt:new Date(Number(BigInt(head.timestamp)/1000000n)).toISOString(),method:'Projected from the observed time between two block headers; epoch duration can change.'};
}
async function chainRead(method,params,{fetcher=fetch,signal}={}){
 const response=await fetcher('https://free.rpc.fastnear.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'found-unlock-estimate',method,params}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('Timing unavailable');const data=await response.json();if(data.error||!data.result)throw Error('Timing unavailable');return data.result;
}
export async function readTiming(block,options={}){
 const [blockData,validators,config]=await Promise.all([chainRead('block',{block_id:block},options),chainRead('validators',[null],options),chainRead('EXPERIMENTAL_protocol_config',{block_id:block},options)]);
 const head=blockData.header;if(head?.hash!==block||config.chain_id!=='mainnet')throw Error('Timing identity mismatch');
 const earlier=(await chainRead('block',{block_id:head.height-5000},options)).header;
 if(earlier?.height!==head.height-5000)throw Error('Earlier block mismatch');
 return {head,earlier,currentEpoch:validators.epoch_height,epochStartHeight:validators.epoch_start_height,epochLength:config.epoch_length};
}
export async function readUnlockEpoch(row,options={}){
 if(row?.state!=='pending'||!validAccount(row.account||'')||!isU128(row.amount)||!row.block)return null;
 const protocol=protocolInfo(row.protocol);if(!protocol)return null;
 const query=(request_type,extra={},overrides={})=>rpc({request_type,account_id:protocol.contract,block_id:row.block,...extra},{...options,...overrides});
 if(protocol.kind==='pool'){
  // This layout has live evidence for the original factory binary only.
  if(row.codeHash!==POOL_CODE_HASHES[0])return null;
  const id=accountBytes(row.account),index=await query('view_state',{prefix_base64:encode(join(encoder.encode('ui'),id))},{endpoints:['https://rpc.intea.rs']});
  const slot=exactEntry(index,join(encoder.encode('ui'),id));if(slot.length!==8)return null;
  const [key,value]=await Promise.all(['uk','uv'].map(prefix=>query('view_state',{prefix_base64:encode(join(encoder.encode(prefix),slot))},{endpoints:['https://rpc.intea.rs']})));
  return decodePoolEpoch({index,key,value},row.account,row.amount);
 }
 if(!['linear','rnear','metapool'].includes(row.protocol))return null;
 if(row.protocol==='rnear'&&(await query('view_account')).code_hash!==RNEAR_CODE_HASH)return null;
 const response=await query('call_function',{method_name:row.protocol==='metapool'?'get_account_info':'get_account_details',args_base64:btoa(JSON.stringify({account_id:row.account}))});
 const data=JSON.parse(decoder.decode(new Uint8Array(response.result))),amount=row.protocol==='metapool'?data.unstaked:data.unstaked_balance;
 const rawEpoch=row.protocol==='metapool'?data.unstaked_requested_unlock_epoch:data.unstaked_available_epoch_height;
 if(data.account_id!==row.account||amount!==row.amount||data.can_withdraw!==false||!/^\d+$/.test(String(rawEpoch)))return null;
 const epoch=Number(rawEpoch);return Number.isSafeInteger(epoch)&&epoch>0?epoch:null;
}
export async function unlockEstimate(row,{timing,...options}={}){
 try{
  const [unlockEpoch,clock]=await Promise.all([readUnlockEpoch(row,options),timing||readTiming(row.block,options)]);
  return unlockEpoch===null?null:estimateUnlockTime({...clock,unlockEpoch});
 }catch{return null;}
}
const escape=text=>text.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function calendarReminder({account,protocol,estimatedAt,now=new Date().toISOString()}){
 if(!validAccount(account)||!protocolInfo(protocol)||!Number.isFinite(Date.parse(estimatedAt)))throw Error('Invalid reminder');
 const url='https://foundyours.xyz/?account='+encodeURIComponent(account);
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FOUND//Withdrawal reminder//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',
  'UID:'+account+'-'+protocol.replace(/[^a-z0-9.-]/g,'-')+'-'+stamp(estimatedAt)+'@found-near',
  'DTSTAMP:'+stamp(now),'DTSTART:'+stamp(estimatedAt),'DTEND:'+stamp(Date.parse(estimatedAt)+15*60000),
  'SUMMARY:Check your NEAR withdrawal',
  'DESCRIPTION:'+escape(`Estimated unlock time for ${account} at ${protocolInfo(protocol).name}. Timing may change; this reminder does not mean withdrawal is ready. Open FOUND and check again. No automatic transaction.\n${url}`),
  'URL:'+url,'BEGIN:VALARM','TRIGGER:PT0S','ACTION:DISPLAY','DESCRIPTION:Check readiness in FOUND; unlock time is an estimate.','END:VALARM','END:VEVENT','END:VCALENDAR'];
 // Fold UTF-8 lines at 75 octets, retaining complete code points.
 return lines.map(line=>{let out='',bytes=0;for(const ch of line){const n=encoder.encode(ch).length;if(bytes+n>75){out+='\r\n ';bytes=1;}out+=ch;bytes+=n;}return out;}).join('\r\n')+'\r\n';
}
