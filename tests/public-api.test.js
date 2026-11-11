import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createLeaderboard,createLeaderboardApi} from '../leaderboard-api.mjs';
import {createScanApi,scanCaller} from '../scan-api.mjs';

async function serve(api,run){
 const server=createServer(async(req,res)=>{if(!await api(req,res,new URL(req.url,'http://localhost'))){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await run(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(resolve=>server.close(resolve));}
}
const result=(account)=>({account,height:123,block:'final-block',checkedAt:1000,results:[{account,protocol:'linear',state:'found',amount:'123456789012345678901234567890'}],pools:{state:'complete',checked:0,discovered:0}});

test('census pagination preserves all entries, exact totals and lockup classification',async()=>{
 const snapshot=JSON.parse(await readFile(new URL('../dist/leaderboard.json',import.meta.url),'utf8'));
 const ledger=createLeaderboard(snapshot),first=ledger.page(1),rows=[];
 for(let page=1;page<=first.totalPages;page++)rows.push(...ledger.page(page).accounts);
 assert.equal(rows.length,30681);assert.equal(new Set(rows.map(r=>r.account_id)).size,30681);
 assert.deepEqual(rows.map(({accountKind,...row})=>row),snapshot.accounts);
 assert.equal(first.lockups.accounts,110);assert.equal(first.lockups.totalYocto,'777029794087248168391274113210');
 assert.equal(rows.filter(row=>row.accountKind==='lockup').length,110);
 assert.equal(rows.reduce((sum,row)=>sum+BigInt(row.unstaked_balance),0n).toString(),first.totalListedYocto);
 assert.equal(ledger.page(3069).accounts.length,1);assert.equal(ledger.page(3070),null);assert.equal(ledger.page(0),null);
 assert.throws(()=>createLeaderboard({...snapshot,totalListedYocto:'1'}),/mismatch/);
});

test('leaderboard API sends ten rows, caches immutable pages and rejects invalid ranges',async()=>serve(createLeaderboardApi(),async base=>{
 const response=await fetch(base+'/api/leaderboard');const body=await response.text();assert.ok(Buffer.byteLength(body)<10000);
 assert.equal(JSON.parse(body).accounts.length,10);assert.equal(response.headers.get('access-control-allow-origin'),'*');
 const etag=response.headers.get('etag');assert.equal((await fetch(base+'/api/leaderboard',{headers:{'If-None-Match':etag}})).status,304);
 for(const page of ['0','-1','1.5','1e2','no','1&page=2'])assert.equal((await fetch(base+'/api/leaderboard?page='+page)).status,400);
 assert.equal((await fetch(base+'/api/leaderboard?page=9999')).status,404);
 assert.equal((await (await fetch(base+'/api/leaderboard?page=3069')).json()).accounts.length,1);
 assert.equal((await fetch(base+'/api/leaderboard',{method:'POST'})).status,405);
 const head=await fetch(base+'/api/leaderboard',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
}));

test('leaderboard API exposes the named checkpoints and the half-coverage row label from the shipped dormancy data',async()=>serve(createLeaderboardApi(),async base=>{
 const page=await (await fetch(base+'/api/leaderboard')).json();
 assert.equal(page.dormancy.months,24);assert.equal(page.dormancy.accounts,304);
 assert.deepEqual(page.dormancy.checkpoints.map(c=>[c.months,c.accounts]),[[12,452],[24,304],[36,171]]);
 const alex=page.accounts.find(row=>row.account_id==='alex.near').dormancy;
 assert.deepEqual([alex.months,alex.amountYocto,alex.contracts,alex.listedYocto],[36,'1041737304436942751344525804',['ashert.poolv1.near'],'888703508504436942751344525804']);
 assert.deepEqual(alex.longTerm,{months:24,since:'2024-11-10T22:01:35.404Z',amountYocto:'888703508504436942751344525804',contracts:['ashert.poolv1.near','mockingbird.poolv1.near']});
 assert.deepEqual(alex.sources.map(s=>[s.contract,s.months]),[['ashert.poolv1.near',36],['mockingbird.poolv1.near',24]]);
 const plain=createLeaderboard(JSON.parse(await readFile(new URL('../dist/leaderboard.json',import.meta.url),'utf8'))).page(1);
 assert.equal(plain.dormancy,undefined);assert.ok(plain.accounts.every(row=>!row.dormancy));
}));

test('no named row shows a younger primary date than the 24 and 36 month groups that count it',async()=>{
 const read=name=>readFile(new URL('../dist/'+name,import.meta.url),'utf8').then(JSON.parse);
 const [snapshot,dormancy]=await Promise.all([read('leaderboard.json'),read('dormancy.json')]),ledger=createLeaderboard(snapshot,{dormancy}),first=ledger.page(1);
 const named=id=>!id.endsWith('.lockup.near')&&!/^[a-f0-9]{64}$/.test(id)&&!/^0x[a-f0-9]{40}$/.test(id),counted={24:0,36:0};
 for(let page=1;page<=first.totalPages;page++)for(const row of ledger.page(page).accounts){
  if(!row.dormancy||!named(row.account_id))continue;
  for(const months of [24,36])if(row.dormancy.sources.some(s=>s.months>=months)){counted[months]++;assert.ok(row.dormancy.months>=months,`${row.account_id} counted at ${months} months but labelled ${row.dormancy.months}`);}
  if(row.dormancy.longTerm)assert.ok(row.dormancy.longTerm.months>=12&&BigInt(row.dormancy.longTerm.amountYocto)>BigInt(row.dormancy.amountYocto));
 }
 assert.deepEqual(counted,{24:first.dormancy.checkpoints[1].accounts,36:first.dormancy.checkpoints[2].accounts});
});

test('scan API validates before RPC, returns exact results, expires its cache',async()=>{
 let calls=0,time=0;
 await serve(createScanApi({scan:async account=>{calls++;return result(account);},now:()=>time,ttlMs:30}),async base=>{
  for(const name of ['a','bad%2Fpath','a..near','%ZZ','x'.repeat(65)])assert.equal((await fetch(base+'/api/scan/'+name)).status,400);
  assert.equal(calls,0);
  const one=await (await fetch(base+'/api/scan/RU.NEAR')).json();assert.equal(one.account,'ru.near');assert.equal(one.cached,false);assert.equal(one.results[0].amount,result('ru.near').results[0].amount);
  time=20;const two=await (await fetch(base+'/api/scan/ru.near')).json();assert.equal(two.cached,true);assert.equal(two.cacheAgeMs,20);assert.equal(calls,1);
  time=31;assert.equal((await (await fetch(base+'/api/scan/ru.near')).json()).cached,false);assert.equal(calls,2);
  assert.equal((await fetch(base+'/api/scan/ru.near',{method:'POST'})).status,405);assert.equal(calls,2);
 });
});

test('scan errors remain unknown, missing accounts are 404 and partial scans are not cached',async()=>{
 let calls=0;
 await serve(createScanApi({scan:async account=>{
  calls++;
  if(account==='missing.near')throw Object.assign(Error('upstream details'),{code:'UNKNOWN_ACCOUNT'});
  if(account==='offline.near')throw Error('private upstream detail');
  return {...result(account),pools:{state:'error',checked:0,discovered:0}};
 }}),async base=>{
  assert.equal((await fetch(base+'/api/scan/missing.near')).status,404);
  const failure=await fetch(base+'/api/scan/offline.near');assert.equal(failure.status,503);assert.doesNotMatch(await failure.text(),/private upstream/);
  for(let i=0;i<2;i++){const partial=await (await fetch(base+'/api/scan/partial.near')).json();assert.equal(partial.pools.state,'error');assert.equal(partial.cached,false);}
  assert.equal(calls,4);
 });
});

test('concurrent scans of the same account share RPC work and new accounts are bounded',async()=>{
 let calls=0,release,entered;
 const ready=new Promise(resolve=>entered=resolve);
 await serve(createScanApi({maxConcurrent:1,scan:async account=>{calls++;entered();await new Promise(resolve=>release=resolve);return result(account);}}),async base=>{
  const first=fetch(base+'/api/scan/ru.near');await ready;
  const second=fetch(base+'/api/scan/ru.near');
  const busy=await fetch(base+'/api/scan/lb3.near');assert.equal(busy.status,429);assert.equal(busy.headers.get('retry-after'),'60');
  release();for(const response of await Promise.all([first,second]))assert.equal(response.status,200);
  assert.equal(calls,1);
 });
});

test('scan timeout cancels RPC and rate limit resets without retaining account history',async()=>{
 let aborted=false;
 await serve(createScanApi({timeoutMs:10,scan:(_account,{signal})=>new Promise(()=>signal.addEventListener('abort',()=>{aborted=true;}))}),async base=>{
  assert.equal((await fetch(base+'/api/scan/ru.near')).status,504);assert.equal(aborted,true);
 });
 let time=0;
 await serve(createScanApi({maxPerMinute:1,now:()=>time,scan:async account=>result(account)}),async base=>{
  assert.equal((await fetch(base+'/api/scan/one.near')).status,200);
  assert.equal((await fetch(base+'/api/scan/two.near')).status,429);
  time=60001;assert.equal((await fetch(base+'/api/scan/two.near')).status,200);
 });
});


test('caller identity ignores spoofable headers unless the Railway edge is explicitly trusted',()=>{
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{'x-real-ip':'192.0.2.1','x-forwarded-for':'192.0.2.99'}};
 assert.equal(scanCaller(req),'127.0.0.1');
 assert.equal(scanCaller(req,{trustRailwayProxy:true}),'192.0.2.1');
 for(const value of ['192.0.2.1, 192.0.2.2','192.0.2.1:80','not-an-ip','',undefined,['192.0.2.1']]){
  req.headers['x-real-ip']=value;
  assert.equal(scanCaller(req,{trustRailwayProxy:true}),'127.0.0.1');
 }
 req.headers['x-real-ip']='2001:0db8:0:0:0:0:0:1';
 assert.equal(scanCaller(req,{trustRailwayProxy:true}),'[2001:db8::1]');
});

test('per-caller quotas leave capacity for other callers; cached hits bypass quotas',async()=>{
 let calls=0,time=0;
 const headers=ip=>({'X-Real-IP':ip});
 await serve(createScanApi({trustRailwayProxy:true,maxPerCaller:2,maxPerMinute:4,now:()=>time,scan:async account=>{calls++;return result(account);}}),async base=>{
  const get=(name,ip='192.0.2.1')=>fetch(base+'/api/scan/'+name,{headers:headers(ip)});
  assert.equal((await get('one.near')).status,200);
  assert.equal((await get('two.near')).status,200);
  assert.equal((await get('three.near')).status,429);
  assert.equal((await (await get('one.near')).json()).cached,true);
  assert.equal((await get('three.near','192.0.2.2')).status,200);
  assert.equal((await get('four.near','192.0.2.3')).status,200);
  assert.equal((await get('five.near','192.0.2.4')).status,429); // aggregate bound still applies
  assert.equal(calls,4);
  time=60001;assert.equal((await get('five.near')).status,200);assert.equal(calls,5);
 });
 // A directly exposed server does not let arbitrary forwarded headers reset a quota.
 await serve(createScanApi({maxPerCaller:1,scan:async account=>result(account)}),async base=>{
  assert.equal((await fetch(base+'/api/scan/one.near',{headers:headers('192.0.2.1')})).status,200);
  assert.equal((await fetch(base+'/api/scan/two.near',{headers:headers('192.0.2.2')})).status,429);
 });
});

test('one caller cannot fill every concurrent slot; joined scans do not start more RPC work',async()=>{
 let release,entered,enteredSecond,calls=0;
 const gate=new Promise(resolve=>release=resolve);
 const ready=new Promise(resolve=>entered=resolve),secondReady=new Promise(resolve=>enteredSecond=resolve);
 await serve(createScanApi({trustRailwayProxy:true,maxConcurrent:2,maxConcurrentPerCaller:1,scan:async account=>{calls++;entered();if(calls===2)enteredSecond();await gate;return result(account);}}),async base=>{
  const get=(name,ip)=>fetch(base+'/api/scan/'+name,{headers:{'X-Real-IP':ip}});
  const first=get('one.near','192.0.2.1');await ready;
  let second,joined;
  try{
   assert.equal((await get('two.near','192.0.2.1')).status,429);
   second=get('two.near','192.0.2.2');
   await Promise.race([secondReady,second.then(()=>assert.fail('Second caller rejected while a slot is free'))]);
   assert.equal((await get('three.near','192.0.2.3')).status,429);
   joined=get('one.near','192.0.2.1');
  }finally{release();}
  for(const response of await Promise.all([first,second,joined]))assert.equal(response.status,200);
  assert.equal(calls,2);
  assert.equal((await get('three.near','192.0.2.1')).status,200); // slot released on completion
 });
});

test('caller bookkeeping is bounded and expired idle entries are removed',async()=>{
 let time=0;
 await serve(createScanApi({trustRailwayProxy:true,maxCallers:1,now:()=>time,scan:async account=>result(account)}),async base=>{
  const get=(name,ip)=>fetch(base+'/api/scan/'+name,{headers:{'X-Real-IP':ip}});
  assert.equal((await get('one.near','192.0.2.1')).status,200);
  assert.equal((await get('two.near','192.0.2.2')).status,429);
  assert.equal((await (await get('one.near','192.0.2.2')).json()).cached,true);
  time=60001;assert.equal((await get('two.near','192.0.2.2')).status,200);
 });
});
