import test from 'node:test';
import assert from 'node:assert/strict';
import {compactNear} from '../dist/rpc.js';
const unit=10n**24n;
test('leaderboard compacts large amounts without rounding up or changing small balances',()=>{
 assert.equal(compactNear(2592938353n*10n**21n),'2.59M');
 assert.equal(compactNear(8887035085n*10n**20n),'888.7K');
 assert.equal(compactNear(120000n*unit),'120K');
 assert.equal(compactNear(1000n*unit),'1K');
 assert.equal(compactNear(1000000n*unit),'1M');
 assert.equal(compactNear(1000000n*unit-1n),'999.99K');
 assert.equal(compactNear(1000n*unit-1n),'999.9999');
 assert.equal(compactNear(1n),'<0.0001');
 assert.equal(compactNear(0n),'0');
});
