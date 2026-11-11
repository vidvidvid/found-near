import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isU128,validAccount,POOL_CODE_HASHES} from '../dist/rpc.js';
export const MONTHS=[1,3,6,12,24,36];
export const MIN_TOTAL=100n*10n**24n;
export const accountKind=id=>id.endsWith('.lockup.near')?'lockup':/^[a-f0-9]{64}$/.test(id)?'implicit':/^0x[a-f0-9]{40}$/.test(id)?'ethereum':'named';
export const sha256=text=>createHash('sha256').update(text).digest('hex');
export function monthsBefore(iso,months){
 const d=new Date(iso),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString();
}
export function cohort(snapshot){return snapshot.accounts.filter(a=>BigInt(a.unstaked_balance)>=MIN_TOTAL).flatMap(a=>a.sources.map(s=>({account:a.account_id,contract:s.contract,amount:s.amount})));}
export const viewMethod=contract=>['linear-protocol.near','lst.rhealab.near'].includes(contract)?'get_account_details':'get_account';
export function pinned(result,header){assert.equal(result?.block_height,header.height,'Wrong block height');assert.equal(result?.block_hash,header.hash,'Wrong block hash');return result;}
function checkRecord(record,params,header){
 assert.deepEqual(record?.params,params,'Wrong RPC request');
 assert.equal(record.method,'query');
 assert.notEqual(!!record.error,!!record.result,'Exactly one result or error is required');
 if(record.error)return null;
 return pinned(record.result,header);
}
export function classifyView(data,pair){
 if(!data||data.account_id!==pair.account||!isU128(data.unstaked_balance)||typeof data.can_withdraw!=='boolean')return 'unknown:shape';
 if(BigInt(data.unstaked_balance)===0n)return 'zero';
 if(data.unstaked_balance!==pair.amount)return 'changed';
 if(!data.can_withdraw)return 'pending';
 return 'stable';
}
export function classifySample(sample,pair,header,baselineCode,pageCache){
 const code=checkRecord(sample.code,{request_type:'view_account',account_id:pair.contract,block_id:header.height},header);
 if(!code)return 'unknown:code-read';
 const recognized=['linear-protocol.near','meta-pool.near','lst.rhealab.near'].includes(pair.contract)?code.code_hash===baselineCode:POOL_CODE_HASHES.includes(code.code_hash);
 if(!recognized)return 'unknown:code-version';
 const params=sample.view?.params;
 let view;
 if(params?.method_name==='get_accounts'){
  // Only the already-reviewed standard pool implementation uses this fast path.
  assert.ok(POOL_CODE_HASHES.includes(code.code_hash));
  let args;try{args=JSON.parse(Buffer.from(params.args_base64,'base64').toString());}catch{throw Error('Invalid page arguments');}
  assert.deepEqual(Object.keys(args).sort(),['from_index','limit']);
  assert.ok(Number.isSafeInteger(args.from_index)&&args.from_index>=0&&Number.isSafeInteger(args.limit)&&args.limit>0&&args.limit<=1500);
  view=checkRecord(sample.view,{request_type:'call_function',account_id:pair.contract,method_name:'get_accounts',args_base64:Buffer.from(JSON.stringify(args)).toString('base64'),block_id:header.height},header);
  if(!view)return 'unknown:view-read';
  if(pageCache?.has(view))return classifyView(pageCache.get(view).get(pair.account),pair);
  let rows;try{rows=JSON.parse(Buffer.from(view.result).toString());}catch{return 'unknown:shape';}
  if(!Array.isArray(rows)||rows.length!==args.limit||new Set(rows.map(r=>r?.account_id)).size!==rows.length||rows.some(r=>!validAccount(r?.account_id||'')||!isU128(r.unstaked_balance)||typeof r.can_withdraw!=='boolean'))return 'unknown:shape';
  const byAccount=new Map(rows.map(row=>[row.account_id,row]));pageCache?.set(view,byAccount);
  return classifyView(byAccount.get(pair.account),pair);
 }
 view=checkRecord(sample.view,{request_type:'call_function',account_id:pair.contract,method_name:viewMethod(pair.contract),args_base64:Buffer.from(JSON.stringify({account_id:pair.account})).toString('base64'),block_id:header.height},header);
 if(!view)return 'unknown:view-read';
 try{return classifyView(JSON.parse(Buffer.from(view.result).toString()),pair);}catch{return 'unknown:shape';}
}
export function summarize(archive,snapshot,snapshotText=JSON.stringify(snapshot)){
 assert.equal(archive.version,1);assert.equal(archive.censusSha256,sha256(snapshotText));
 const pairs=cohort(snapshot);assert.equal(archive.pairs.length,pairs.length,'Incomplete cohort');
 assert.equal(archive.censusHeader.height,snapshot.block);assert.equal(archive.censusHeader.hash,snapshot.hash);
 const date=h=>new Date(Number(BigInt(h.timestamp)/1000000n)).toISOString();
 assert.equal(date(archive.censusHeader),snapshot.asOf);
 assert.deepEqual(archive.ladder.map(x=>x.months),MONTHS);
 for(const step of archive.ladder){
  assert.equal(step.target,monthsBefore(snapshot.asOf,step.months));assert.ok(date(step.header)<=step.target);
  assert.ok(Date.parse(step.target)-Date.parse(date(step.header))<120000,'Historical block too far from target');
 }
 for(const [contract,record] of Object.entries(archive.baselineCodes))checkRecord(record,{request_type:'view_account',account_id:contract,block_id:snapshot.block},archive.censusHeader);
 const kinds=['named','implicit','ethereum','lockup'];
 const buckets=archive.ladder.map(step=>({...step,date:date(step.header),groups:Object.fromEntries(kinds.map(k=>[k,{ids:new Set(),pairs:0,total:0n}]))}));
 const terminations={},rowGroups=new Map(),pageCache=new WeakMap();
 for(const [ref,page] of Object.entries(archive.pages||{}))assert.equal(sha256(JSON.stringify(page)),ref,'Changed page archive');
 for(let i=0;i<pairs.length;i++){
  const pair=pairs[i],entry=archive.pairs[i];assert.deepEqual(entry.pair,pair,'Wrong or duplicate cohort pair');
  assert.ok(entry.samples.length>0&&entry.samples.length<=MONTHS.length);
  const baseline=archive.baselineCodes[pair.contract]?.result?.code_hash;assert.equal(typeof baseline,'string');
  let stopped=false,oldest=-1;
  for(let j=0;j<entry.samples.length;j++){
   const saved=entry.samples[j],sample=saved.viewRef?{...saved,view:archive.pages?.[saved.viewRef]}:saved;
   if(saved.viewRef)assert.ok(sample.view,'Missing page archive');
   const state=classifySample(sample,pair,archive.ladder[j].header,baseline,pageCache);
   if(state!=='stable'){assert.equal(j,entry.samples.length-1,'Queries continued after stopping');terminations[state]=(terminations[state]||0)+1;stopped=true;break;}
   oldest=j;const group=buckets[j].groups[accountKind(pair.account)];group.ids.add(pair.account);group.pairs++;group.total+=BigInt(pair.amount);
  }
  if(!stopped){assert.equal(entry.samples.length,MONTHS.length,'Incomplete sample chain');terminations['oldest-sample']=(terminations['oldest-sample']||0)+1;}
  if(oldest>=0){const rows=rowGroups.get(pair.account)||[];rows.push({contract:pair.contract,amount:pair.amount,oldestMonths:MONTHS[oldest],since:date(archive.ladder[oldest].header)});rowGroups.set(pair.account,rows);}
 }
 const cohortKinds=Object.fromEntries(kinds.map(k=>[k,new Set(pairs.filter(p=>accountKind(p.account)===k).map(p=>p.account)).size]));
 return {version:1,censusBlock:snapshot.block,censusHash:snapshot.hash,censusSha256:archive.censusSha256,asOf:snapshot.asOf,minimumAccountTotalYocto:MIN_TOTAL.toString(),cohort:{accounts:new Set(pairs.map(p=>p.account)).size,pairs:pairs.length,kinds:cohortKinds},
  definition:'Exact unstaked balance and can_withdraw=true at every sampled date through the census. Activity between samples and intentional waiting are not excluded. Gross amounts may overlap protocol reserves. Named accounts may be contracts.',
  buckets:buckets.map(({months,date,header,groups})=>({months,date,block:header.height,hash:header.hash,groups:Object.fromEntries(Object.entries(groups).map(([k,g])=>[k,{accounts:g.ids.size,pairs:g.pairs,totalYocto:g.total.toString()}]))})),
  terminations,rows:Object.fromEntries([...rowGroups].sort(([a],[b])=>a.localeCompare(b)))};
}
