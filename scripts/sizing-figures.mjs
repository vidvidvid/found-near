// Recomputes every figure quoted in research/sizing-2026-11-11/README.md from archived evidence, offline.
//   node scripts/sizing-figures.mjs           print the figures
//   node scripts/sizing-figures.mjs --json    print them as JSON
//   node scripts/sizing-figures.mjs --fetch-validators [--rpc URL]
//                                             re-archive the census-epoch validator set (network)
// No prices, no dollar values. NEAR amounts are truncated, never rounded up.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {summarize,namedDistribution,accountKind,sha256,MONTHS,MIN_TOTAL} from './dormancy-model.mjs';

const YOCTO=10n**24n;
const KINDS=['named','implicit','ethereum','lockup'];
const PROTOCOL_CONTRACTS=['linear-protocol.near','meta-pool.near','lst.rhealab.near'];
const SIZE_EDGES=[1n,10n,100n,1000n,10000n].map(n=>n*YOCTO);
const root=new URL('../',import.meta.url);
const VALIDATORS_FILE=new URL('research/sizing-2026-11-11/validators-epoch.json.gz',root);

const sum=values=>values.reduce((n,v)=>n+BigInt(v),0n);
// Truncated decimal NEAR string from yoctoNEAR.
export function near(yocto,dp=2){
 const y=BigInt(yocto),whole=y/YOCTO,frac=(y%YOCTO)*10n**BigInt(dp)/YOCTO;
 return dp?`${whole}.${frac.toString().padStart(dp,'0')}`:whole.toString();
}
// Truncated percentage n/d with dp decimals.
export function pct(n,d,dp=2){
 const scaled=BigInt(n)*100n*10n**BigInt(dp)/BigInt(d),s=scaled.toString().padStart(dp+1,'0');
 return dp?`${s.slice(0,-dp)}.${s.slice(-dp)}`:s;
}

export function checkValidators(record,censusHeader){
 assert.equal(record.method,'validators');
 assert.equal(record.params.epoch_id,censusHeader.epoch_id,'Validator set is not the census epoch');
 assert.ok(record.result.epoch_start_height<=censusHeader.height,'Epoch starts after census block');
 assert.ok(Array.isArray(record.result.current_validators)&&record.result.current_validators.length>0);
 const ids=new Set(record.result.current_validators.map(v=>v.account_id));
 assert.equal(ids.size,record.result.current_validators.length,'Duplicate validator');
 for(const v of record.result.current_validators)assert.match(v.stake,/^\d+$/);
 return record;
}

export function computeFigures({leaderboard,archive,summary,distribution,validators}){
 const census=archive.censusHeader;
 assert.equal(census.height,leaderboard.block);assert.equal(census.hash,leaderboard.hash);
 const supply=BigInt(census.total_supply);
 const accounts=leaderboard.accounts;
 assert.equal(accounts.length,leaderboard.counts.accountsWithWaiting);
 assert.equal(new Set(accounts.map(a=>a.account_id)).size,accounts.length,'Duplicate census account');
 for(const a of accounts)assert.equal(sum(a.sources.map(s=>s.amount)),BigInt(a.unstaked_balance),'Row does not sum its sources');
 const gross=sum(accounts.map(a=>a.unstaked_balance));
 assert.equal(gross,BigInt(leaderboard.totalListedYocto));
 const sorted=[...accounts].sort((a,b)=>{const x=BigInt(a.unstaked_balance),y=BigInt(b.unstaked_balance);return x>y?-1:x<y?1:0;});
 const top=n=>sum(sorted.slice(0,n).map(a=>a.unstaked_balance));
 const byKind=Object.fromEntries(KINDS.map(k=>{const rows=accounts.filter(a=>accountKind(a.account_id)===k);return [k,{accounts:rows.length,yocto:sum(rows.map(a=>a.unstaked_balance))}];}));
 const protocolRows=accounts.filter(a=>PROTOCOL_CONTRACTS.includes(a.account_id));
 const sizes=[];
 for(let i=0;i<=SIZE_EDGES.length;i++){
  const lo=i?SIZE_EDGES[i-1]:0n,hi=SIZE_EDGES[i];
  const rows=accounts.filter(a=>{const v=BigInt(a.unstaked_balance);return v>lo&&(hi===undefined||v<=hi);});
  sizes.push({label:hi===undefined?`> ${lo/YOCTO} NEAR`:`${i?lo/YOCTO:'0.01'} to ${hi/YOCTO} NEAR`,accounts:rows.length,yocto:sum(rows.map(a=>a.unstaked_balance))});
 }
 assert.equal(sum(sizes.map(s=>s.yocto)),gross);
 const cohortRows=accounts.filter(a=>BigInt(a.unstaked_balance)>=MIN_TOTAL);
 const cohortYocto=sum(cohortRows.map(a=>a.unstaked_balance));
 assert.equal(cohortRows.length,summary.cohort.accounts);

 let stake=null,validatorCount=null;
 if(validators){checkValidators(validators,census);validatorCount=validators.result.current_validators.length;stake=sum(validators.result.current_validators.map(v=>v.stake));}

 const buckets=summary.buckets.map(b=>{
  const step=archive.ladder.find(s=>s.months===b.months);assert.equal(step.header.height,b.block);
  const all=sum(KINDS.map(k=>b.groups[k].totalYocto)),allAccounts=KINDS.reduce((n,k)=>n+b.groups[k].accounts,0);
  const dist=distribution.find(d=>d.months===b.months);
  const supplyThen=BigInt(step.header.total_supply);
  return {months:b.months,date:b.date,block:b.block,supplyThen,
   named:{accounts:b.groups.named.accounts,yocto:BigInt(b.groups.named.totalYocto)},
   implicit:{accounts:b.groups.implicit.accounts,yocto:BigInt(b.groups.implicit.totalYocto)},
   lockup:{accounts:b.groups.lockup.accounts,yocto:BigInt(b.groups.lockup.totalYocto)},
   allAccounts,allYocto:all,largestNamed:BigInt(dist.largestAccountYocto),namedWithoutLargest:BigInt(dist.totalWithoutLargestYocto)};
 });
 return {block:census.height,hash:census.hash,asOf:leaderboard.asOf,epochId:census.epoch_id,supply,
  accountsChecked:leaderboard.uniqueAccountsChecked,sources:leaderboard.sources.length,qualifying:accounts.length,gross,
  top1:top(1),top10:top(10),byKind,protocolRows:{accounts:protocolRows.length,yocto:sum(protocolRows.map(a=>a.unstaked_balance))},
  sizes,cohort:{accounts:cohortRows.length,pairs:summary.cohort.pairs,yocto:cohortYocto},
  stake,validatorCount,buckets,terminations:summary.terminations};
}

export function report(f){
 const L=[],b=m=>f.buckets.find(x=>x.months===m);
 L.push(`FOUND sizing figures — census block ${f.block} (${f.hash}), ${f.asOf}`);
 L.push('Offline recomputation from archived RPC evidence. Gross sums may count the same NEAR twice; no prices.');
 L.push('');
 L.push('[A] Census scope');
 L.push(`A1 accounts checked: ${f.accountsChecked}; sources: ${f.sources} (3 protocols + ${f.sources-3} pools)`);
 L.push(`A2 accounts with a matured, withdrawable balance above 0.01 NEAR: ${f.qualifying}`);
 L.push(`A3 gross listed matured NEAR: ${near(f.gross)}`);
 L.push(`A4 total_supply in census block header: ${near(f.supply,0)} NEAR`);
 L.push(`A5 gross listed as share of total supply: ${pct(f.gross,f.supply,3)}%`);
 if(f.stake!==null){
  L.push(`A6 stake of the ${f.validatorCount} validators active in census epoch ${f.epochId}: ${near(f.stake,0)} NEAR (${pct(f.stake,f.supply,1)}% of supply)`);
  L.push(`A7 gross listed as share of that active stake: ${pct(f.gross,f.stake,2)}%`);
 }else L.push('A6/A7 validator archive missing; run with --fetch-validators');
 L.push('');
 L.push('[B] Concentration and account kinds (full census)');
 L.push(`B1 largest single account: ${near(f.top1)} NEAR (${pct(f.top1,f.gross,1)}% of gross)`);
 L.push(`B2 top 10 accounts: ${near(f.top10)} NEAR (${pct(f.top10,f.gross,1)}% of gross)`);
 for(const k of KINDS)L.push(`B3 ${k}: ${f.byKind[k].accounts} accounts, ${near(f.byKind[k].yocto)} NEAR (${pct(f.byKind[k].yocto,f.gross,2)}% of gross)`);
 L.push(`B4 rows whose account is a staking-protocol contract (${PROTOCOL_CONTRACTS.join(', ')}): ${f.protocolRows.accounts} accounts, ${near(f.protocolRows.yocto)} NEAR`);
 for(const s of f.sizes)L.push(`B5 account total ${s.label}: ${s.accounts} accounts, ${near(s.yocto)} NEAR (${pct(s.yocto,f.gross,2)}% of gross)`);
 L.push('');
 L.push('[C] Sampled history, 100+ NEAR cohort');
 L.push(`C1 cohort: ${f.cohort.accounts} accounts, ${f.cohort.pairs} account-source pairs, ${near(f.cohort.yocto)} NEAR (${pct(f.cohort.yocto,f.gross,1)}% of gross)`);
 for(const x of f.buckets){
  L.push(`C2 unchanged at every sampled date for ${x.months} month${x.months===1?'':'s'} (since ${x.date}): all kinds ${x.allAccounts} accounts, ${near(x.allYocto)} NEAR (${pct(x.allYocto,f.supply,3)}% of supply); named ${x.named.accounts} accounts, ${near(x.named.yocto)} NEAR; implicit ${x.implicit.accounts}, ${near(x.implicit.yocto)} NEAR; lockup ${x.lockup.accounts}, ${near(x.lockup.yocto)} NEAR`);
 }
 for(const m of [12,24,36]){const x=b(m);L.push(`C3 ${m} months, largest named account: ${near(x.largestNamed)} NEAR (${pct(x.largestNamed,x.named.yocto,1)}% of named); named without it: ${near(x.namedWithoutLargest)} NEAR (${pct(x.namedWithoutLargest,f.supply,3)}% of supply)`);}
 const one=b(1);
 for(const k of ['named','implicit'])L.push(`C4 ${k}: of the amount unchanged for 1 month, ${pct(b(24)[k].yocto,one[k].yocto,1)}% was also unchanged for 24 months and ${pct(b(36)[k].yocto,one[k].yocto,1)}% for 36 months; accounts ${one[k].accounts} -> ${b(24)[k].accounts} -> ${b(36)[k].accounts}`);
 L.push(`C5 stop reasons: ${Object.entries(f.terminations).map(([k,v])=>`${k} ${v}`).join(', ')}`);
 L.push('');
 L.push('[D] Supply growth from archived block headers');
 for(const m of [12,24,36]){const x=b(m);L.push(`D1 total_supply ${x.date.slice(0,10)}: ${near(x.supplyThen,0)} NEAR; a balance unchanged since then lost ${pct(f.supply-x.supplyThen,f.supply,2)}% of its share of supply by the census`);}
 return L.join('\n');
}

async function readJson(rel,gz=false){const buf=await readFile(new URL(rel,root));return JSON.parse(gz?gunzipSync(buf).toString():buf.toString());}

export async function load({validatorsRequired=false}={}){
 const leaderboardText=await readFile(new URL('dist/leaderboard.json',root),'utf8');
 const archiveText=gunzipSync(await readFile(new URL('research/dormancy-2026-11-11/archive.json.gz',root))).toString();
 const run=await readJson('research/dormancy-2026-11-11/run.json');
 assert.equal(sha256(archiveText),run.archiveSha256,'Dormancy archive digest mismatch');
 const leaderboard=JSON.parse(leaderboardText),archive=JSON.parse(archiveText);
 // Rebuild the history buckets from raw responses rather than trusting summary.json.
 const summary=summarize(archive,leaderboard,leaderboardText);
 assert.deepEqual(summary,await readJson('research/dormancy-2026-11-11/summary.json'));
 const distribution=MONTHS.map(m=>namedDistribution(summary,m));
 assert.deepEqual(distribution,await readJson('research/dormancy-2026-11-11/distribution.json'));
 let validators=null;
 try{validators=JSON.parse(gunzipSync(await readFile(VALIDATORS_FILE)).toString());}catch(error){if(error.code!=='ENOENT'||validatorsRequired)throw error;}
 return {leaderboard,archive,summary,distribution,validators};
}

async function fetchValidators(endpoint){
 const archive=JSON.parse(gunzipSync(await readFile(new URL('research/dormancy-2026-11-11/archive.json.gz',root))).toString());
 const params={epoch_id:archive.censusHeader.epoch_id};
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'found-research',method:'validators',params}),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('RPC HTTP '+response.status);
 const body=await response.json();if(body.error)throw Error(JSON.stringify(body.error));
 const record=checkValidators({version:1,endpoint,fetchedAt:new Date().toISOString(),method:'validators',params,result:body.result},archive.censusHeader);
 await mkdir(new URL('.',VALIDATORS_FILE),{recursive:true});
 await writeFile(VALIDATORS_FILE,gzipSync(JSON.stringify(record),{level:9}));
 console.log(`Archived ${record.result.current_validators.length} validators for epoch ${params.epoch_id} from ${endpoint}.`);
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.includes('--fetch-validators')){const i=args.indexOf('--rpc');await fetchValidators(i>=0?args[i+1]:'https://archival-rpc.mainnet.fastnear.com');}
 const figures=computeFigures(await load());
 if(args.includes('--json'))console.log(JSON.stringify(figures,(k,v)=>typeof v==='bigint'?v.toString():v,1));
 else console.log(report(figures));
}
