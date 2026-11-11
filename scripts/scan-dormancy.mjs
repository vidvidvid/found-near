import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {POOL_CODE_HASHES} from '../dist/rpc.js';
import {createArchiveRpc} from './archive-rpc.mjs';
import {MONTHS,cohort,monthsBefore,sha256,viewMethod,pinned,classifySample,summarize} from './dormancy-model.mjs';
const root=new URL('../',import.meta.url);
const args=process.argv.slice(2),cacheDir=args[args.indexOf('--cache-dir')+1]&&args.includes('--cache-dir')?args[args.indexOf('--cache-dir')+1]:'/tmp/found-dormancy-2026-11-11';
const output=args.includes('--output')?args[args.indexOf('--output')+1]:fileURLToPath(new URL('research/dormancy-2026-11-11/',root));
const started=Date.now(),endpoint=process.env.DORMANCY_RPC||'https://archival-rpc.mainnet.fastnear.com';
const text=await readFile(new URL('dist/leaderboard.json',root),'utf8'),snapshot=JSON.parse(text),pairs=cohort(snapshot),headers=new Map();
await mkdir(cacheDir+'/pairs',{recursive:true});await mkdir(output,{recursive:true});
const {request,stats}=await createArchiveRpc({cacheDir,endpoint,intervalMs:Number(process.env.DORMANCY_INTERVAL_MS||2000),validate:(r,method,params)=>{
 if(method==='block'){
  if(r?.header?.height!==params.block_id||typeof r.header.hash!=='string'||!/^\d+$/.test(r.header.timestamp))throw Error('Invalid block header');
 }else if(method==='query')pinned(r,headers.get(params.block_id));
 return r;
}});
setInterval(()=>console.log('RPC progress',JSON.stringify(stats)),30000).unref();
async function header(height){
 if(headers.has(height))return headers.get(height);
 const h=(await request('block',{block_id:height})).header;headers.set(height,h);return h;
}
async function availableHeader(height){for(let n=0;n<32;n++){try{return await header(height-n);}catch(e){if(!/UNKNOWN_BLOCK/.test(e.message))throw e;}}throw Error('No nearby historical block');}
const censusHeader=await header(snapshot.block);
const ladder=[];
for(const months of MONTHS){
 const target=monthsBefore(snapshot.asOf,months),targetNs=BigInt(Date.parse(target))*1000000n;
 let lo=await header(9820210),hi=censusHeader;
 if(BigInt(lo.timestamp)>targetNs)throw Error('Target predates genesis');
 // Header timestamps, not an assumed block time. Interpolation only chooses the next probe.
 while(hi.height-lo.height>8){
  const ratio=Number(targetNs-BigInt(lo.timestamp))/Number(BigInt(hi.timestamp)-BigInt(lo.timestamp));
  const candidate=Math.max(lo.height+1,Math.min(hi.height-1,Math.floor(lo.height+(hi.height-lo.height)*ratio)));
  const mid=await availableHeader(candidate);
  if(mid.height<=lo.height)break;
  if(BigInt(mid.timestamp)<=targetNs)lo=mid;else hi=mid;
 }
 if(Number(targetNs-BigInt(lo.timestamp))/1e9>120)throw Error('Date search did not converge');
 ladder.push({months,target,header:lo});console.log('Ladder',months,lo.height,new Date(Number(BigInt(lo.timestamp)/1000000n)).toISOString());
}
async function record(params){
 try{return {method:'query',params,result:await request('query',params)};}
 catch(error){return {method:'query',params,error:{code:error.code||'UNAVAILABLE',message:error.message,rpcError:error.rpcError??null}};}
}
const codes=new Map();
function codeRecord(contract,block){const key=contract+'@'+block;if(!codes.has(key))codes.set(key,record({request_type:'view_account',account_id:contract,block_id:block}));return codes.get(key);}
const baselineCodes={};
const work=async(items,fn)=>{let n=0;await Promise.all(Array.from({length:4},async()=>{for(;;){const i=n++;if(i>=items.length)return;await fn(items[i],i);}}));};
await work([...new Set(pairs.map(p=>p.contract))],async contract=>{
 const r=await codeRecord(contract,snapshot.block);if(!r.result?.code_hash)throw Error('Missing baseline code: '+contract);baselineCodes[contract]=r;
});
console.log('Cohort',new Set(pairs.map(p=>p.account)).size,'accounts;',pairs.length,'pairs;',Object.keys(baselineCodes).length,'sources');
const records=new Array(pairs.length),groups=new Map(),checkpointPages={};let finished=0;
// Resume without retaining one copy of a large page for every matching account.
// Checkpoints remain self-contained; the final archive stores each page once.
function retainPages(entry){
 for(const sample of entry.samples)if(sample.view?.params.method_name==='get_accounts'){
  const ref=sha256(JSON.stringify(sample.view));checkpointPages[ref]??=sample.view;sample.viewRef=ref;delete sample.view;
 }
 return entry;
}
const pairFile=pair=>cacheDir+'/pairs/'+sha256(JSON.stringify({pair,ladder:ladder.map(s=>s.header.hash)}))+'.json';
function progress(){if(finished%100===0)console.log('Pairs complete',finished,'/',pairs.length);}
for(let index=0;index<pairs.length;index++){
 const pair=pairs[index];
 try{records[index]=retainPages(JSON.parse(await readFile(pairFile(pair),'utf8')));finished++;progress();}
 catch(error){if(error.code!=='ENOENT')throw error;const group=groups.get(pair.contract)||[];group.push({index,pair,samples:[]});groups.set(pair.contract,group);}
}
const initialCounts=new Map(snapshot.sources.map(s=>[s.contract,s.accounts]));
async function individual(pair,block){return record({request_type:'call_function',account_id:pair.contract,method_name:viewMethod(pair.contract),args_base64:Buffer.from(JSON.stringify({account_id:pair.account})).toString('base64'),block_id:block});}
async function pageViews(contract,header,pending){
 const found=new Map();
 if(Math.ceil((initialCounts.get(contract)||Infinity)/1500)+1>=pending.length)return found;
 const countRecord=await record({request_type:'call_function',account_id:contract,method_name:'get_number_of_accounts',args_base64:Buffer.from('{}').toString('base64'),block_id:header.height});
 let count;try{count=JSON.parse(Buffer.from(countRecord.result.result).toString());}catch{return found;}
 if(!Number.isSafeInteger(count)||count<0||count>1000000||Math.ceil(count/1500)+1>=pending.length)return found;
 const wanted=new Set(pending.map(p=>p.pair.account));
 // Page contents are archived once, then referenced by the matching cohort pairs.
 // A missing row falls back to an individual view; it is NEVER inferred to be zero.
 for(let offset=0;offset<count;offset+=1500){
  const limit=Math.min(1500,count-offset);
  const page=await record({request_type:'call_function',account_id:contract,method_name:'get_accounts',args_base64:Buffer.from(JSON.stringify({from_index:offset,limit})).toString('base64'),block_id:header.height});
  let rows;try{rows=JSON.parse(Buffer.from(page.result.result).toString());}catch{continue;}
  if(!Array.isArray(rows)||rows.length!==limit)continue;
  for(const row of rows)if(wanted.has(row?.account_id)){if(found.has(row.account_id))throw Error('Duplicate account across pages');found.set(row.account_id,page);}
 }
 return found;
}
await work([...groups],async([contract,entries])=>{
 let pending=entries;
 for(const step of ladder){
  if(!pending.length)break;
  const code=await codeRecord(contract,step.header.height),hash=code.result?.code_hash;
  const standard=POOL_CODE_HASHES.includes(hash),recognized=standard||['linear-protocol.near','meta-pool.near','lst.rhealab.near'].includes(contract)&&hash===baselineCodes[contract].result.code_hash;
  const pages=standard?await pageViews(contract,step.header,pending):new Map(),next=[];
  for(const entry of pending){
   const sample={code};
   if(recognized)sample.view=pages.get(entry.pair.account)||await individual(entry.pair,step.header.height);
   entry.samples.push(sample);
   const state=classifySample(sample,entry.pair,step.header,baselineCodes[contract].result.code_hash);
   if(state==='stable'&&step.months!==MONTHS.at(-1))next.push(entry);
   else{const saved={pair:entry.pair,samples:entry.samples};records[entry.index]=saved;await writeFile(pairFile(entry.pair),JSON.stringify(saved));retainPages(saved);finished++;progress();}
  }
  pending=next;
  await writeFile(cacheDir+'/progress.json',JSON.stringify({finished,total:pairs.length,elapsedSeconds:Math.round((Date.now()-started)/1000),...stats}));
 }
});
const pages=checkpointPages;
for(const entry of records)for(const sample of entry.samples)if(sample.view?.params.method_name==='get_accounts'){
 const ref=sha256(JSON.stringify(sample.view));pages[ref]=sample.view;sample.viewRef=ref;delete sample.view;
}
const archive={version:1,censusSha256:sha256(text),censusHeader,ladder,baselineCodes,pages,pairs:records};
const summary=summarize(archive,snapshot,text);
await writeFile(output+'/archive.json.gz',gzipSync(JSON.stringify(archive)));
await writeFile(output+'/summary.json',JSON.stringify(summary,null,2));
await writeFile(output+'/run.json',JSON.stringify({endpoint,cachePolicy:'Cache keys bind method and parameters, not provider. A reused cache may contain earlier reads from another endpoint; disclose providers separately.',startedAt:new Date(started).toISOString(),endedAt:new Date().toISOString(),elapsedSeconds:Math.round((Date.now()-started)/1000),...stats,archiveSha256:sha256(JSON.stringify(archive))},null,2));
console.log('Finished',JSON.stringify({...summary,rows:undefined},null,2));
