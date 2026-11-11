import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePoolEpoch,estimateUnlockTime,calendarReminder,readUnlockEpoch,unlockEstimate} from '../dist/unlock.js';
import {POOL_CODE_HASHES} from '../dist/rpc.js';
const raw={index:{values:[{key:'dWkLAAAAdmlkdmlkLm5lYXI=',value:'HnMAAAAAAAA='}]},key:{values:[{key:'dWsecwAAAAAAAA==',value:'CwAAAHZpZHZpZC5uZWFy'}]},value:{values:[{key:'dXYecwAAAAAAAA==',value:'AgCc+TkW7g3C0wAAAAAAAPoWKmr99a8LAAAAAAAAAABhEwAAAAAAAA=='}]}};
const amount='999999000000000000000002';
const clock={currentEpoch:100,epochStartHeight:1000,epochLength:1000,head:{height:1500,timestamp:'1500000000000'},earlier:{height:1000,timestamp:'1000000000000'}};
test('pool unlock decoding requires exact account key, index, layout and public-view amount',()=>{
 assert.equal(decodePoolEpoch(raw,'vidvid.near',amount),4961);
 assert.throws(()=>decodePoolEpoch(raw,'other.near',amount));assert.throws(()=>decodePoolEpoch(raw,'vidvid.near','1'));
 for(const mutate of [r=>r.value.values[0].value='AA==',r=>r.index.values.push(r.index.values[0]),r=>r.key.values[0].key='wrong']){const r=structuredClone(raw);mutate(r);assert.throws(()=>decodePoolEpoch(r,'vidvid.near',amount));}
});
test('time estimates use measured block time and reject missing, past and mismatched epoch inputs',()=>{
 const result=estimateUnlockTime({...clock,unlockEpoch:102});assert.equal(result.estimatedAt,'1970-01-01T00:50:00.000Z');
 for(const extra of [{unlockEpoch:null},{unlockEpoch:100},{unlockEpoch:131},{unlockEpoch:102,currentEpoch:null},{unlockEpoch:102,epochStartHeight:2000},{unlockEpoch:102,epochLength:400},{unlockEpoch:102,earlier:{height:1499,timestamp:'1'}},{unlockEpoch:102,head:{height:1500,timestamp:'NaN'}}])assert.equal(estimateUnlockTime({...clock,...extra}),null);
});
test('unsupported timing never invents a four-epoch deadline or changes financial state',async()=>{
 const row={account:'vidvid.near',protocol:'pool:meteor.poolv1.near',state:'pending',amount,codeHash:'unknown',block:'pinned'};
 assert.equal(await readUnlockEpoch(row),null);assert.equal(await unlockEstimate(row,{timing:Promise.resolve(clock)}),null);assert.equal(row.state,'pending');
 assert.equal(await unlockEstimate({...row,codeHash:POOL_CODE_HASHES[0]},{timing:Promise.resolve(clock),fetcher:async()=>{throw Error('offline');}}),null);
});
test('protocol timing validates account, amount, maturity and a numeric unlock epoch',async()=>{
 const row={account:'vidvid.near',protocol:'metapool',state:'pending',amount,block:'pinned'};
 const options=(extra={})=>({endpoints:['fixture'],fetcher:async()=>({ok:true,json:async()=>({result:{block_height:10,block_hash:'pinned',result:[...Buffer.from(JSON.stringify({account_id:row.account,unstaked:amount,can_withdraw:false,unstaked_requested_unlock_epoch:'4961',...extra}))]}})})});
 assert.equal(await readUnlockEpoch(row,options()),4961);
 for(const extra of [{unstaked:'1'},{account_id:'other.near'},{can_withdraw:true},{unstaked_requested_unlock_epoch:null},{unstaked_requested_unlock_epoch:'1.5'}])assert.equal(await readUnlockEpoch(row,options(extra)),null);
});
test('calendar file is UTC, bounded, correctly folded and explicitly requests a recheck',()=>{
 const data=calendarReminder({account:'vidvid.near',protocol:'pool:meteor.poolv1.near',estimatedAt:'2026-11-12T00:02:39.780Z',now:'2026-11-11T09:00:00.000Z'});
 const unfolded=data.replace(/\r\n /g,'');assert.match(unfolded,/DTSTART:20261112T000239Z/);assert.match(unfolded,/DTEND:20261112T001739Z/);
 assert.match(unfolded,/Timing may change/);assert.match(unfolded,/No automatic transaction\.\\nhttps:/);assert.match(unfolded,/URL:https:\/\/foundyours.xyz\/\?account=vidvid.near/);
 assert.match(unfolded,/BEGIN:VALARM/);assert.ok(data.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
 assert.throws(()=>calendarReminder({account:'bad\nSUMMARY:hacked',protocol:'linear',estimatedAt:'2026-11-12'}));
});
