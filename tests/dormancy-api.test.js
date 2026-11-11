import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {dormancyPresentation} from '../dormancy-api.mjs';
const unit=10n**24n,yocto=n=>(BigInt(n)*unit).toString();
function fixture(){
 const snapshot={block:100,hash:'pinned',asOf:'2026-11-10T22:01:36.060Z',accounts:[{account_id:'owner.near',unstaked_balance:yocto(300),sources:[{contract:'old.pool.near',amount:yocto(100)},{contract:'new.pool.near',amount:yocto(200)}]}]};
 const bucket=months=>({months,date:`${months===36?2023:months===24?2024:2025}-11-10T22:01:35.000Z`,groups:{named:{accounts:1,pairs:months<=12?2:1,totalYocto:yocto(months<=12?300:100)},implicit:{accounts:0,pairs:0,totalYocto:'0'},ethereum:{accounts:0,pairs:0,totalYocto:'0'},lockup:{accounts:0,pairs:0,totalYocto:'0'}}});
 const data={version:1,censusBlock:100,censusHash:'pinned',asOf:snapshot.asOf,censusSha256:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),minimumAccountTotalYocto:yocto(100),cohort:{accounts:1,pairs:2},buckets:[1,3,6,12,24,36].map(bucket),rows:{'owner.near':[{contract:'old.pool.near',amount:yocto(100),oldestMonths:36,since:bucket(36).date},{contract:'new.pool.near',amount:yocto(200),oldestMonths:12,since:bucket(12).date}]}};
 return {snapshot,data};
}
test('presentation identifies only the amount with the oldest evidence, not the entire account total',()=>{
 const {snapshot,data}=fixture(),result=dormancyPresentation(snapshot,data);
 assert.equal(result.metadata.accounts,1);assert.equal(result.metadata.totalYocto,yocto(100));
 assert.deepEqual(result.rows.get('owner.near'),{months:36,since:data.buckets.at(-1).date,amountYocto:yocto(100),contracts:['old.pool.near']});
 assert.equal(dormancyPresentation(snapshot,null).metadata,null);
});
test('presentation refuses a stale census, altered sums, repeated sources or ages outside the cohort',()=>{
 for(const mutate of [d=>d.censusHash='wrong',d=>d.cohort.accounts=2,d=>d.buckets[0].groups.named.accounts=2,d=>d.rows['owner.near'][0].amount=yocto(999),d=>d.rows['owner.near'].push(d.rows['owner.near'][0]),d=>d.rows['stranger.near']=d.rows['owner.near'],d=>d.rows['owner.near'][0].since='wrong']){
  const {snapshot,data}=fixture();mutate(data);assert.throws(()=>dormancyPresentation(snapshot,data));
 }
});
