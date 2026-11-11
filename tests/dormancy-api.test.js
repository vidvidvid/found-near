import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {dormancyPresentation,rowLabel} from '../dormancy-api.mjs';
const unit=10n**24n,yocto=n=>(BigInt(n)*unit).toString();
function fixture(){
 const snapshot={block:100,hash:'pinned',asOf:'2026-11-10T22:01:36.060Z',accounts:[{account_id:'owner.near',unstaked_balance:yocto(300),sources:[{contract:'old.pool.near',amount:yocto(100)},{contract:'new.pool.near',amount:yocto(200)}]}]};
 const bucket=months=>({months,date:`${months===36?2023:months===24?2024:2025}-11-10T22:01:35.000Z`,groups:{named:{accounts:1,pairs:months<=12?2:1,totalYocto:yocto(months<=12?300:100)},implicit:{accounts:0,pairs:0,totalYocto:'0'},ethereum:{accounts:0,pairs:0,totalYocto:'0'},lockup:{accounts:0,pairs:0,totalYocto:'0'}}});
 const data={version:1,censusBlock:100,censusHash:'pinned',asOf:snapshot.asOf,censusSha256:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),minimumAccountTotalYocto:yocto(100),cohort:{accounts:1,pairs:2},buckets:[1,3,6,12,24,36].map(bucket),rows:{'owner.near':[{contract:'old.pool.near',amount:yocto(100),oldestMonths:36,since:bucket(36).date},{contract:'new.pool.near',amount:yocto(200),oldestMonths:12,since:bucket(12).date}]}};
 return {snapshot,data};
}
test('presentation labels the oldest bucket first, adds the 12+ month sum and exposes the named checkpoints',()=>{
 const {snapshot,data}=fixture(),result=dormancyPresentation(snapshot,data);
 assert.equal(result.metadata.accounts,1);assert.equal(result.metadata.totalYocto,yocto(100));assert.equal(result.metadata.months,24);
 assert.deepEqual(result.metadata.checkpoints,[12,24,36].map(months=>({months,since:data.buckets.find(b=>b.months===months).date,...data.buckets.find(b=>b.months===months).groups.named})));
 const row=result.rows.get('owner.near');
 assert.deepEqual({...row,sources:undefined},{months:36,since:data.buckets[5].date,amountYocto:yocto(100),contracts:['old.pool.near'],listedYocto:yocto(300),longTerm:{months:12,since:data.buckets[3].date,amountYocto:yocto(300),contracts:['old.pool.near','new.pool.near']},sources:undefined});
 assert.deepEqual(row.sources.map(s=>[s.contract,s.months,s.amountYocto]),[['old.pool.near',36,yocto(100)],['new.pool.near',12,yocto(200)]]);
 assert.equal(dormancyPresentation(snapshot,null).metadata,null);
});
const buckets=new Map([1,3,6,12,24,36].map(months=>[months,{months,date:'d'+months}]));
const source=(contract,amount,oldestMonths)=>({contract,amount:yocto(amount),oldestMonths,since:'d'+oldestMonths});
test('row label keeps the oldest bucket and adds the larger 12+ month sum dated by its youngest source (alex.near shape)',()=>{
 const row=rowLabel([source('small.pool.near',1041,36),source('large.pool.near',887662,24)],BigInt(yocto(888703)),buckets);
 assert.deepEqual([row.months,row.since,row.amountYocto,row.contracts],[36,'d36',yocto(1041),['small.pool.near']]);
 assert.deepEqual(row.longTerm,{months:24,since:'d24',amountYocto:yocto(888703),contracts:['small.pool.near','large.pool.near']});
});
test('row label never lets sources under 12 months into the label (kayleigh.near shape)',()=>{
 const row=rowLabel([source('a.near',21,36),source('b.near',1099,1)],BigInt(yocto(1120)),buckets);
 assert.deepEqual([row.months,row.amountYocto,row.contracts,row.longTerm],[36,yocto(21),['a.near'],undefined]);
 assert.deepEqual(row.sources.map(s=>s.contract),['a.near','b.near']);
});
test('row label has no second clause when the oldest bucket is under 12 months or already holds every 12+ month source',()=>{
 const young=rowLabel([source('a.near',100,1)],BigInt(yocto(100)),buckets);
 assert.deepEqual([young.months,young.since,young.amountYocto,young.longTerm],[1,'d1',yocto(100),undefined]);
 const same=rowLabel([source('a.near',10,24),source('b.near',20,24),source('c.near',70,6)],BigInt(yocto(100)),buckets);
 assert.deepEqual([same.months,same.amountYocto,same.contracts,same.longTerm,same.listedYocto],[24,yocto(30),['a.near','b.near'],undefined,yocto(100)]);
});
test('presentation refuses a stale census, altered sums, repeated sources or ages outside the cohort',()=>{
 for(const mutate of [d=>d.censusHash='wrong',d=>d.cohort.accounts=2,d=>d.buckets[0].groups.named.accounts=2,d=>d.rows['owner.near'][0].amount=yocto(999),d=>d.rows['owner.near'].push(d.rows['owner.near'][0]),d=>d.rows['stranger.near']=d.rows['owner.near'],d=>d.rows['owner.near'][0].since='wrong']){
  const {snapshot,data}=fixture();mutate(data);assert.throws(()=>dormancyPresentation(snapshot,data));
 }
});
