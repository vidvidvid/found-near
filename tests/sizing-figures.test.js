import test from 'node:test';
import assert from 'node:assert/strict';
import {near,pct,checkValidators,computeFigures,load,report} from '../scripts/sizing-figures.mjs';

test('amounts and shares truncate and never round up',()=>{
 assert.equal(near('1999999999999999999999999'),'1.99');
 assert.equal(near(10n**24n*5n,0),'5');
 assert.equal(pct(2,3,2),'66.66');
 assert.equal(pct(1,1000,3),'0.100');
 assert.equal(pct(0,7,1),'0.0');
});

test('validator archive must belong to the census epoch',()=>{
 const header={height:100,epoch_id:'E1'};
 const ok={method:'validators',params:{epoch_id:'E1'},result:{epoch_start_height:90,current_validators:[{account_id:'a.pool.near',stake:'5'}]}};
 assert.equal(checkValidators(ok,header),ok);
 for(const bad of [
  {...ok,params:{epoch_id:'E2'}},
  {...ok,result:{...ok.result,epoch_start_height:101}},
  {...ok,result:{...ok.result,current_validators:[]}},
  {...ok,result:{...ok.result,current_validators:[{account_id:'a',stake:'1'},{account_id:'a',stake:'1'}]}},
  {...ok,result:{...ok.result,current_validators:[{account_id:'a',stake:'1.5'}]}}
 ])assert.throws(()=>checkValidators(bad,header));
});

test('sizing figures rebuild from the archived evidence',async()=>{
 const f=computeFigures(await load({validatorsRequired:true}));
 assert.equal(f.block,223975859);
 assert.equal(f.qualifying,30681);
 assert.equal(f.accountsChecked,305908);
 assert.equal(f.gross.toString(),'10558075187594404327945091284701');
 assert.equal(f.supply.toString(),'1311369673957064299767841505144239');
 assert.equal(pct(f.gross,f.supply,3),'0.805');
 assert.equal(f.validatorCount,338);
 const b24=f.buckets.find(b=>b.months===24);
 assert.equal(b24.named.accounts,304);
 assert.equal(near(b24.named.yocto),'1829552.41');
 assert.equal(near(b24.namedWithoutLargest),'940848.90');
 const text=report(f);
 assert.doesNotMatch(text,/\$|USD/);
 assert.match(text,/A5 gross listed as share of total supply: 0\.805%/);
});
