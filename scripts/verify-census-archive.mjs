import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {decodeRnear,decodeFactory,MINIMUM,publishSnapshot} from './census-model.mjs';
import {RNEAR_CODE_HASH,POOL_CODE_HASHES} from '../dist/rpc.js';

const directory=new URL('../research/census-2026-11-10/',import.meta.url);
const json=async name=>JSON.parse(await readFile(new URL(name,directory),'utf8'));
const gzip=async name=>JSON.parse(gunzipSync(await readFile(new URL(name,directory))));
const meta=await json('metadata.json'),raw=await gzip('raw-accounts.json.gz');
const pinned=response=>{assert.equal(response.block_height,meta.block);assert.equal(response.block_hash,meta.hash);return response;};
const rnearState=pinned(await gzip('rnear-state.json.gz'));
const counts=await json('source-counts.json');
for(const [contract,response] of Object.entries(counts)){
 const count=JSON.parse(Buffer.from(pinned(response).result));assert.equal(count,raw[contract].length,contract+' account count');
}
assert.deepEqual(Object.keys(counts).sort(),Object.keys(raw).sort());
const rnear=decodeRnear(rnearState.values,raw['lst.rhealab.near'].length),details=await gzip('rnear-views.json.gz'),rows=new Map(raw['lst.rhealab.near'].map(r=>[r.account_id,r]));
let candidates=0;
for(const account of rnear){
 const actual=rows.get(account.account_id);assert.equal(actual.unstaked_balance,account.unstaked_balance);
 if(BigInt(account.unstaked_balance)>MINIMUM){const view=JSON.parse(Buffer.from(pinned(details[account.account_id]).result));assert.equal(view.account_id,account.account_id);assert.equal(view.unstaked_balance,account.unstaked_balance);assert.equal(view.can_withdraw,actual.can_withdraw);candidates++;}
 else assert.equal(actual.can_withdraw,null);
}
assert.equal(Object.keys(details).length,candidates);
const factoryCounts=await json('factory-counts.json'),inventory=[];
for(const factory of ['poolv1.near','pool.near'])inventory.push(...decodeFactory(pinned(await gzip(factory+'-state.json.gz')).values,JSON.parse(Buffer.from(pinned(factoryCounts[factory]).result)),factory));
const fixed=['linear-protocol.near','meta-pool.near','lst.rhealab.near'];
const accounted=[...Object.keys(raw).filter(s=>!fixed.includes(s)),...meta.unsupported.map(s=>s.contract),...meta.closed];
assert.equal(new Set(accounted).size,accounted.length);assert.deepEqual(accounted.sort(),inventory.sort());
const codes=await gzip('contract-codes.json.gz');
assert.equal(pinned(codes['lst.rhealab.near']).code_hash,RNEAR_CODE_HASH);
for(const source of Object.keys(raw).filter(s=>!fixed.includes(s)))assert.ok(POOL_CODE_HASHES.includes(pinned(codes[source]).code_hash));
for(const source of meta.unsupported){assert.equal(pinned(codes[source.contract]).code_hash,source.codeHash);assert.ok(!POOL_CODE_HASHES.includes(source.codeHash));}
const snapshot=publishSnapshot(meta,raw),published=await readFile(new URL('../dist/leaderboard.json',import.meta.url),'utf8');
assert.equal(JSON.stringify(snapshot),published);
console.log(`Verified archive: ${snapshot.accounts.length} unique qualifying accounts from ${snapshot.uniqueAccountsChecked} unique accounts, ${snapshot.counts.validatorPools} supported pools + 3 protocols, block ${meta.block}.`);
console.log('This is an offline consistency check of archived RPC evidence. Use census:expanded with a fresh cache and --check to re-query the chain independently.');
