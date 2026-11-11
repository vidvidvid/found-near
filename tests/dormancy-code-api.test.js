import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {codePresentation,dormancyPresentation} from '../dormancy-api.mjs';
import {createLeaderboard,createLeaderboardApi} from '../leaderboard-api.mjs';
import {codeSentence,findingLimitation} from '../dist/finding.js';
const dist=name=>readFile(new URL('../dist/'+name,import.meta.url),'utf8');
const load=async()=>{const [census,text,code]=await Promise.all([dist('leaderboard.json'),dist('dormancy.json'),dist('dormancy-code.json')]);return {snapshot:JSON.parse(census),text,data:JSON.parse(text),code:JSON.parse(code)};};
const wallet='261 of the 304 had no contract code at the census block; the other 43 carry NEAR Wallet’s own two-factor or empty contract. No code does not prove an individual owner.';

test('shipped contract-code split yields 261 / 43 / 0 for the 24-month named group, all NEAR Wallet code',async()=>{
 const {snapshot,text,data,code}=await load(),page=createLeaderboard(snapshot,{dormancy:data,dormancyText:text,dormancyCode:code}).page(1),split=page.dormancy.contractCode;
 assert.deepEqual([split.months,split.namedAccounts,split.noCode.accounts,split.code.accounts,split.unknown.accounts],[24,304,261,43,0]);
 assert.deepEqual(split.codeHashes.map(h=>[h.label,h.accounts]).sort(),[['nearWalletEmptyContract',21],['nearWalletTwoFactorMultisig',22]]);
 assert.equal(codeSentence(page.dormancy),wallet);
 assert.match(findingLimitation(page.dormancy),/Activity between samples is possible\.$/);
});

test('validation refuses a contract-code derivative that does not split the named groups exactly or binds other data',async()=>{
 const base=await load();
 const mutations=[c=>c.buckets[4].classes['no-code'].accounts++,c=>c.buckets[4].classes.code.totalYocto=(BigInt(c.buckets[4].classes.code.totalYocto)+1n).toString(),c=>{c.buckets[4].classes['no-code'].accounts--;c.buckets[4].classes.unknown.accounts++;c.buckets[4].codeHashes[0].accounts++;},
  c=>c.buckets[4].codeHashes.pop(),c=>c.buckets[2].classes.unknown.accounts=-1,c=>c.dormancySha256='0'.repeat(64),c=>c.censusBlock++,c=>c.buckets.pop(),c=>c.buckets[4].codeHashes.push({...c.buckets[4].codeHashes[0]})];
 for(const mutate of mutations){
  const code=structuredClone(base.code);mutate(code);
  assert.throws(()=>codePresentation(base.data,base.text,code));
  // The rest of the finding stays; only the split is withheld.
  const result=dormancyPresentation(base.snapshot,base.data,{text:base.text,code});assert.equal(result.metadata.accounts,304);assert.equal(result.metadata.contractCode,undefined);
 }
 assert.throws(()=>codePresentation(base.data,base.text+' ',base.code),/different dormancy data/);
 assert.equal(codePresentation(base.data,base.text,base.code).noCode.accounts,261);
});

test('leaderboard API omits the split when the file is absent or malformed and still serves the finding',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'found-code-'));
 try{
  await writeFile(join(folder,'broken.json'),'{not json');
  for(const codeFile of [pathToFileURL(join(folder,'missing.json')),pathToFileURL(join(folder,'broken.json'))]){
   const api=createLeaderboardApi({codeFile}),server=createServer(async(req,res)=>{await api(req,res,new URL(req.url,'http://localhost'));});
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   try{const page=await (await fetch(`http://127.0.0.1:${server.address().port}/api/leaderboard`)).json();assert.equal(page.dormancy.accounts,304);assert.equal(page.dormancy.contractCode,undefined);}
   finally{await new Promise(resolve=>server.close(resolve));}
  }
 }finally{await rm(folder,{recursive:true});}
});

test('finding text falls back to counts, or to the original limitation, whenever the split is missing or unexplained',async()=>{
 const {snapshot,text,data,code}=await load(),dormancy=createLeaderboard(snapshot,{dormancy:data,dormancyText:text,dormancyCode:code}).page(1).dormancy;
 const without={...dormancy,contractCode:undefined};
 assert.equal(codeSentence(without),null);assert.match(findingLimitation(without),/Activity between samples is possible; named accounts can be contracts\.$/);
 assert.equal(codeSentence({...dormancy,contractCode:{...dormancy.contractCode,namedAccounts:303}}),null);
 const other={...dormancy,contractCode:{...dormancy.contractCode,codeHashes:dormancy.contractCode.codeHashes.map((h,i)=>i?h:{...h,label:null})}};
 assert.equal(codeSentence(other),'261 of the 304 had no contract code at the census block, 43 had contract code. No code does not prove an individual owner.');
 const unread={...dormancy,contractCode:{...dormancy.contractCode,noCode:{accounts:259,totalYocto:'0'},unknown:{accounts:2,totalYocto:'0'}}};
 assert.equal(codeSentence(unread),'259 of the 304 had no contract code at the census block, 43 had contract code and 2 could not be read. No code does not prove an individual owner.');
 assert.match(findingLimitation(unread),/possible\.$/);
});
