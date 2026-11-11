import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createArchiveRpc} from './archive-rpc.mjs';
import {sha256,pinned} from './dormancy-model.mjs';
import {namedAccounts,viewParams,summarizeCode} from './dormancy-code-model.mjs';
// Reads view_account for every named account in the published sampled-history
// summary, pinned to the census block. Successful reads are cached per request,
// so an interrupted run resumes; errors are re-asked on resume and archived as unknown.
const root=new URL('../',import.meta.url);
const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const cacheDir=option('--cache-dir','/tmp/found-dormancy-code-2026-11-11');
const folder=option('--folder',fileURLToPath(new URL('research/dormancy-2026-11-11/',root)));
const output=option('--output',folder);
const started=Date.now(),endpoint=process.env.DORMANCY_RPC||'https://archival-rpc.mainnet.fastnear.com';
const summaryText=await readFile(folder+'/summary.json','utf8'),summary=JSON.parse(summaryText);
await mkdir(output,{recursive:true});
let censusHeader;
const {request,stats}=await createArchiveRpc({cacheDir,endpoint,intervalMs:Number(process.env.DORMANCY_INTERVAL_MS||2000),validate:(r,method,params)=>{
 if(method==='block'){
  if(r?.header?.height!==params.block_id||r.header.hash!==summary.censusHash||!/^\d+$/.test(r.header.timestamp))throw Error('Invalid census block header');
 }else if(method==='query')pinned(r,censusHeader);
 return r;
}});
setInterval(()=>console.log('RPC progress',JSON.stringify(stats)),30000).unref();
const {height,hash,timestamp}=(await request('block',{block_id:summary.censusBlock})).header;
censusHeader={height,hash,timestamp};
const accounts=namedAccounts(summary),records=new Array(accounts.length);
console.log('Named accounts',accounts.length,'at census block',height,hash);
let next=0,done=0;
await Promise.all(Array.from({length:4},async()=>{for(;;){
 const i=next++;if(i>=accounts.length)return;
 const params=viewParams(accounts[i],height);
 // A failed, mismatched or missing-account read is archived as an error and classified unknown, never as no code.
 try{records[i]={account:accounts[i],record:{method:'query',params,result:await request('query',params)}};}
 catch(error){records[i]={account:accounts[i],record:{method:'query',params,error:{code:error.code||'UNAVAILABLE',message:error.message,rpcError:error.rpcError??null}}};}
 if(++done%50===0)console.log('Accounts read',done,'/',accounts.length);
}}));
const archive={version:1,summarySha256:sha256(summaryText),censusHeader,accounts:records};
const codeSummary=summarizeCode(archive,summary,summaryText),archiveText=JSON.stringify(archive);
await writeFile(output+'/code-archive.json.gz',gzipSync(archiveText));
await writeFile(output+'/code-summary.json',JSON.stringify(codeSummary,null,2)+'\n');
await writeFile(output+'/code-run.json',JSON.stringify({endpoint,cachePolicy:'Cache keys bind method and parameters, not provider. A reused cache may contain earlier reads from another endpoint; disclose providers separately.',startedAt:new Date(started).toISOString(),endedAt:new Date().toISOString(),elapsedSeconds:Math.round((Date.now()-started)/1000),...stats,archiveSha256:sha256(archiveText)},null,2)+'\n');
for(const b of codeSummary.buckets)console.log(`${b.months} months: ${JSON.stringify(b.classes)} unknown=${JSON.stringify(b.unknownReasons)}`);
