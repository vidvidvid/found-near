import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {aggregateSources,decodeRnear,decodeFactory,publishSnapshot,MINIMUM} from '../scripts/census-model.mjs';
const row=(account_id,amount,can_withdraw=true)=>({account_id,unstaked_balance:String(amount),can_withdraw});
const str=value=>{const bytes=Buffer.from(value),data=Buffer.alloc(4+bytes.length);data.writeUInt32LE(bytes.length);bytes.copy(data,4);return data;};
const entry=(key,value)=>({key:key.toString('base64'),value:value.toString('base64')});
test('expanded census deduplicates overlapping accounts and preserves exact source amounts',()=>{
 const n=12345678901234567890123456789n;
 const result=aggregateSources({'linear-protocol.near':[row('alice.near',n),row('pending.near',n,false)],'meta-pool.near':[row('alice.near',n),row('bob.near',MINIMUM+1n),row('..NSLP..',n)],'lst.rhealab.near':[row('dust.near',MINIMUM,null)]});
 assert.equal(result.uniqueAccountsChecked,4);assert.equal(result.accounts.length,2);
 assert.equal(result.accounts[0].account_id,'alice.near');assert.equal(result.accounts[0].unstaked_balance,String(n*2n));assert.equal(result.accounts[0].sources.length,2);
 assert.equal(result.sources.find(s=>s.contract==='meta-pool.near').virtual,1);
});
test('threshold applies per source, excludes unmatured balances and never guesses unknown maturity',()=>{
 const source={'linear-protocol.near':[row('small.near',MINIMUM),row('pending.near',MINIMUM+1n,false)],'meta-pool.near':[row('small.near',MINIMUM)]};
 assert.equal(aggregateSources(source).accounts.length,0);
 assert.throws(()=>aggregateSources({'lst.rhealab.near':[row('alice.near',MINIMUM+1n,null)]}));
 assert.throws(()=>aggregateSources({'linear-protocol.near':[row('alice.near',1,null)]}));
});
test('malformed and duplicate source rows fail closed',()=>{
 for(const rows of [[row('alice.near',1),row('alice.near',2)],[row('..NSLP..',1)],[row('bad..near',1)],[row('alice.near',2n**128n)],[row('alice.near',1,'true')]])assert.throws(()=>aggregateSources({'linear-protocol.near':rows}));
});
test('rNEAR decoding requires the complete vector and matching lookup-map indices',()=>{
 const account=str('alice.near'),key=Buffer.from([2,0x76,0,0,0,0]),mapKey=createHash('sha256').update(Buffer.concat([Buffer.from([2,0x6d]),account])).digest(),value=Buffer.alloc(28);value.writeBigUInt64LE(1n,8);value.writeBigUInt64LE(42n,16);
 const values=[entry(key,account),entry(mapKey,value)],decoded=decodeRnear(values,1);
 assert.equal(decoded[0].unstaked_balance,String(1n<<64n));assert.equal(decoded[0].can_withdraw,null);
 assert.throws(()=>decodeRnear(values,2));assert.throws(()=>decodeRnear(values.slice(0,1),1));
 value.writeUInt32LE(4,24);assert.throws(()=>decodeRnear([values[0],entry(mapKey,value)],1));
});
test('factory decoding rejects missing slots, duplicate pools and foreign IDs',()=>{
 const key=Buffer.alloc(10);key.write('se');const values=[entry(key,str('a.pool.near'))];assert.deepEqual(decodeFactory(values,1,'pool.near'),['a.pool.near']);
 assert.throws(()=>decodeFactory(values,2,'pool.near'));assert.throws(()=>decodeFactory(values,1,'poolv1.near'));
 key.writeBigUInt64LE(1n,2);assert.throws(()=>decodeFactory([values[0],entry(key,str('a.pool.near'))],2,'pool.near'));
});
test('publishing requires all protocols and a fully accounted-for pool inventory',()=>{
 const meta={complete:true,errors:[],block:123,hash:'block',asOf:'2026-11-10',discoveredPools:1,unsupported:[{contract:'custom.pool.near',codeHash:'custom'}],closed:[]};
 const raw={'linear-protocol.near':[row('alice.near',MINIMUM+1n)],'meta-pool.near':[],'lst.rhealab.near':[]};
 assert.equal(publishSnapshot(meta,raw).counts.accountsWithWaiting,1);assert.equal(publishSnapshot(meta,raw).totalListedYocto,String(MINIMUM+1n));
 for(const patch of [{complete:false},{errors:[{}]},{discoveredPools:2}])assert.throws(()=>publishSnapshot({...meta,...patch},raw));
 const missing={...raw};delete missing['meta-pool.near'];assert.throws(()=>publishSnapshot(meta,missing));
});
