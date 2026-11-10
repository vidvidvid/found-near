import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {protocolInfo,ENDPOINTS} from './dist/rpc.js';
import {withdrawalTransaction,inspectWithdrawal,validHash} from './dist/withdrawal.js';
const MAX_BODY=2048,INTENT_WINDOW=30*60*1000;
export function createRecoveryStore(path){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
 CREATE TABLE IF NOT EXISTS intents(id TEXT PRIMARY KEY, account TEXT NOT NULL, protocol TEXT NOT NULL, amount TEXT NOT NULL, code_hash TEXT, created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS recoveries(hash TEXT PRIMARY KEY, intent_id TEXT UNIQUE NOT NULL, account TEXT NOT NULL, protocol TEXT NOT NULL, amount TEXT NOT NULL, block_height INTEGER NOT NULL, confirmed_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS intents_created ON intents(created_at);`);
 return {
  close:()=>db.close(),
  start(item,now){const id=randomBytes(24).toString('hex');db.prepare('INSERT INTO intents VALUES(?,?,?,?,?,?)').run(id,item.account,item.protocol,item.amount,item.codeHash||null,now);return id;},
  get:id=>db.prepare('SELECT * FROM intents WHERE id=?').get(id),
  recorded:hash=>db.prepare('SELECT hash,intent_id FROM recoveries WHERE hash=?').get(hash),
  forIntent:id=>db.prepare('SELECT hash FROM recoveries WHERE intent_id=?').get(id),
  record(item,hash,height,now){db.prepare('INSERT INTO recoveries VALUES(?,?,?,?,?,?,?) ON CONFLICT(hash) DO NOTHING').run(hash,item.id,item.account,item.protocol,item.amount,height,now);},
  prune:now=>db.prepare('DELETE FROM intents WHERE created_at<? AND id NOT IN (SELECT intent_id FROM recoveries)').run(now-30*24*60*60*1000),
  summary(){const totals=db.prepare('SELECT COUNT(*) AS withdrawals, COUNT(DISTINCT account) AS accounts, MAX(confirmed_at) AS updatedAt FROM recoveries').get();let amount=0n;for(const row of db.prepare('SELECT amount FROM recoveries').iterate())amount+=BigInt(row.amount);return {...totals,totalYocto:amount.toString()};}
 };
}
export async function readChain(method,params,{fetcher=fetch,endpoints=ENDPOINTS}={}){
 return Promise.any(endpoints.map(async endpoint=>{
  const r=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'found-recovery',method,params}),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('RPC unavailable');
  const data=await r.json();if(data.error||!data.result||data.result.error)throw Error('RPC unavailable');return data.result;
 }));
}
export async function verifyRecovery(intent,hash,{read=readChain}={}){
 const pending={network:'mainnet',account:intent.account,protocol:intent.protocol,amount:intent.amount,codeHash:intent.code_hash,createdAt:intent.created_at,hash};
 const tx=await read('tx',{tx_hash:hash,sender_account_id:intent.account,wait_until:'FINAL'});
 const verdict=inspectWithdrawal(tx,pending);if(verdict.state!=='confirmed')return verdict;
 const blockHash=tx.transaction_outcome.block_hash;if(!validHash(blockHash))throw Error('Missing transaction block');
 const block=await read('block',{block_id:blockHash});if(block.header?.hash!==blockHash||!Number.isSafeInteger(block.header.height)||!/^\d+$/.test(block.header.timestamp))throw Error('Invalid transaction block');
 const timestamp=Number(BigInt(block.header.timestamp)/1000000n);
 if(timestamp<intent.created_at-10000||timestamp>intent.created_at+INTENT_WINDOW)throw Error('Transaction falls outside this app request');
 const receiver=protocolInfo(intent.protocol).contract;
 if(intent.protocol==='rnear'||intent.protocol.startsWith('pool:')){
  const callReceipt=tx.receipts_outcome.find(r=>r.outcome.executor_id===receiver);if(!validHash(callReceipt?.block_hash))throw Error('Missing contract execution block');
  const view=await read('query',{request_type:'view_account',account_id:receiver,block_id:callReceipt.block_hash});
  if(view.block_hash!==callReceipt.block_hash||view.code_hash!==intent.code_hash)throw Error('Contract code does not match this request');
 }
 return {...verdict,height:block.header.height};
}
async function body(req){let value='';for await(const part of req){value+=part;if(Buffer.byteLength(value)>MAX_BODY)throw Error('BODY_TOO_LARGE');}return JSON.parse(value);}
export function createRecoveryApi({store,now=Date.now,verify=verifyRecovery}={}){
 let windowStart=0,requests=0;
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 return async(req,res,path)=>{
  if(!path.startsWith('/api/recoveries'))return false;
  if(!store){send(res,503,{error:'Recovery tracking unavailable'});return true;}
  if(path==='/api/recoveries'&&['GET','HEAD'].includes(req.method)){if(req.method==='HEAD'){res.writeHead(200);res.end();}else send(res,200,store.summary());return true;}
  if(req.method!=='POST'||!['/api/recoveries/start','/api/recoveries/confirm'].includes(path)){send(res,404,{error:'Not found'});return true;}
  let origin;try{origin=new URL(req.headers.origin);}catch{}
  if(!origin||!['http:','https:'].includes(origin.protocol)||origin.host!==req.headers.host){send(res,403,{error:'Same-origin requests only'});return true;}
  const time=now();if(time-windowStart>60000){windowStart=time;requests=0;}if(++requests>120){send(res,429,{error:'Try again later'});return true;}
  if(!req.headers['content-type']?.startsWith('application/json')){send(res,415,{error:'JSON required'});return true;}
  try{
   const data=await body(req);
   if(path.endsWith('/start')){
    // Reuse the exact transaction whitelist. A client-supplied arbitrary target is never accepted.
    const item={account:data.account,protocol:data.protocol,amount:data.amount,codeHash:data.codeHash,state:'found'};withdrawalTransaction(item,item.account);
    store.prune(time);send(res,201,{intentId:store.start(item,time)});return true;
   }
   if(typeof data.intentId!=='string'||! /^[a-f0-9]{48}$/.test(data.intentId)||!validHash(data.hash)){send(res,400,{error:'Invalid confirmation'});return true;}
   const intent=store.get(data.intentId);if(!intent){send(res,404,{error:'Request not found'});return true;}
   const existing=store.recorded(data.hash);
   if(existing){send(res,existing.intent_id===intent.id?200:409,existing.intent_id===intent.id?{recorded:true}:{error:'Receipt belongs to another request'});return true;}
   if(store.forIntent(intent.id)){send(res,409,{error:'Request already confirmed'});return true;}
   let result;try{result=await verify(intent,data.hash);}catch(error){send(res,error instanceof AggregateError||error.name==='AbortError'?503:422,{error:'Receipt could not be verified'});return true;}
   if(result.state==='pending'){send(res,202,{recorded:false});return true;}
   if(result.state!=='confirmed'){send(res,422,{error:'Withdrawal did not succeed'});return true;}
   store.record(intent,data.hash,result.height,time);send(res,200,{recorded:true});
  }catch(error){send(res,error.message==='BODY_TOO_LARGE'?413:400,{error:'Invalid recovery request'});}
  return true;
 };
}
