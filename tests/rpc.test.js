import test from 'node:test';import assert from 'node:assert/strict';
import {scanAccount,formatNear,exactNear,validAccount,rpc} from '../dist/rpc.js';
function fixture({amount='500307262171597331335415343',mature=true,paused=false,missing=false,failPreflight=false,offline=false}={}){
 const requests=[];const fetcher=async(_url,options)=>{const {params:p}=JSON.parse(options.body);requests.push(p);if(offline)throw Error('network down');
 if(missing&&p.request_type==='view_account')return {ok:true,json:async()=>({error:{cause:{name:'UNKNOWN_ACCOUNT'}}})};
 let data=p.request_type==='view_account'?{}:p.method_name==='get_account_details'?{account_id:p.account_id==='linear-protocol.near'?'ru.near':p.account_id,unstaked_balance:amount,can_withdraw:mature}:p.method_name==='is_paused'?paused:null;
 const result={block_hash:'snapshot',block_height:123,result:data===null?[]:[...new TextEncoder().encode(JSON.stringify(data))]};
 if(failPreflight&&p.method_name==='can_account_withdraw')result.error='Not enough contract balance';
 return {ok:true,json:async()=>({result})};};return {fetcher,endpoints:['mock'],requests};
}
test('ready only after exact-amount preflight and pause check at the same block',async()=>{const f=fixture();const r=await scanAccount('ru.near',f);assert.equal(r.state,'found');for(const q of f.requests.filter(x=>['is_paused','can_account_withdraw'].includes(x.method_name)))assert.equal(q.block_id,'snapshot');const q=f.requests.find(x=>x.method_name==='can_account_withdraw');assert.equal(JSON.parse(atob(q.args_base64)).amount,r.amount);});
test('zero mature flag is not money waiting',async()=>{assert.equal((await scanAccount('ru.near',fixture({amount:'0'}))).state,'empty');});
test('pending cannot become ready',async()=>{assert.equal((await scanAccount('ru.near',fixture({mature:false}))).state,'pending');});
test('pause and liquidity failures preserve balance but prohibit ready state',async()=>{for(const opts of [{paused:true},{failPreflight:true}]){const r=await scanAccount('ru.near',fixture(opts));assert.equal(r.state,'unavailable');assert.notEqual(r.amount,'0');}});
test('outage and missing account are never a zero balance',async()=>{await assert.rejects(scanAccount('ru.near',fixture({offline:true})),e=>e.code==='UNAVAILABLE');await assert.rejects(scanAccount('ru.near',fixture({missing:true})),e=>e.code==='UNKNOWN_ACCOUNT');});
test('amounts retain integer precision and reveal dust',()=>{assert.equal(formatNear('500307262171597331335415343'),'500.3072');assert.equal(formatNear('1'),'<0.0001');assert.equal(exactNear('100000000000000000000000000'),'100');assert.equal(exactNear('1'),'0.000000000000000000000001');});
test('account grammar rejects markup and invalid separators',()=>{for(const a of ['<script>','a..near','a-.near',' ru.near','a'])assert.equal(validAccount(a),false);assert.equal(validAccount('ru.near'),true);});

test('NEAR Ethereum-style implicit accounts are accepted',()=>{assert.equal(validAccount('0x9fbbf4b8330dedc4dbcbca778c8a21bbd25cffbc'),true);});

test('RPC rejects wrong hashes and falls back to a matching provider',async()=>{
 const params={request_type:'call_function',block_id:'expected'};
 const fetcher=async url=>({ok:true,json:async()=>({result:{block_height:123,block_hash:url==='good'?'expected':'wrong',result:[]}})});
 await assert.rejects(rpc(params,{fetcher,endpoints:['bad']}));
 assert.equal((await rpc(params,{fetcher,endpoints:['bad','good']})).block_hash,'expected');
});
