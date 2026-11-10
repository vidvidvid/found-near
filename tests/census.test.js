import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSnapshot,generateSnapshot} from '../scripts/generate-leaderboard.mjs';

const account=(id,amount,mature=true)=>({account_id:id,unstaked_balance:String(amount),staked_balance:'0',can_withdraw:mature});

test('census keeps only matured balances above 0.01 NEAR and sorts exact integers',()=>{
 const snapshot=buildSnapshot([
  account('small.near',10n**22n),
  account('pending.near',10n**24n,false),
  account('large.near',3n*10n**24n),
  account('medium.near',2n*10n**24n),
  account('zero.near',0)
 ],123,'2026-11-09');
 assert.deepEqual(snapshot.accounts.map(a=>a.account_id),['large.near','medium.near']);
 assert.equal(snapshot.block,123);
 assert.equal(snapshot.asOf,'2026-11-09');
 assert.match(snapshot.scope,/not proven abandoned/);
});

test('census reads every account at one block and rejects incomplete pages',async()=>{
 const accounts=Array.from({length:1001},(_,i)=>account(`a${i}.near`,BigInt(i)*10n**22n));
 const blocks=[];
 const options={
  block:123,
  blockQuery:async()=>({header:{timestamp:'1794246879959368700'}}),
  query:async params=>{
   blocks.push(params.block_id);
   const args=JSON.parse(Buffer.from(params.args_base64,'base64').toString());
   const data=params.method_name==='get_number_of_accounts'?accounts.length:accounts.slice(args.from_index,args.from_index+args.limit);
   return {block_height:123,result:[...new TextEncoder().encode(JSON.stringify(data))]};
  }
 };
 const {snapshot,total}=await generateSnapshot(options);
 assert.equal(total,1001);
 assert.equal(snapshot.accounts.length,999);
 assert.equal(snapshot.asOf,'2026-11-09');
 assert.ok(blocks.every(block=>block===123));
 options.query=async()=>({block_height:124,result:[]});
 await assert.rejects(generateSnapshot(options),/instead of 123/);
});
