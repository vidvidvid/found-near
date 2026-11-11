import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {summarize,sha256,namedDistribution} from './dormancy-model.mjs';
const folder=new URL('../research/dormancy-2026-11-11/',import.meta.url);
const snapshotText=await readFile(new URL('../dist/leaderboard.json',import.meta.url),'utf8');
const archiveText=gunzipSync(await readFile(new URL('archive.json.gz',folder))).toString();
const run=JSON.parse(await readFile(new URL('run.json',folder),'utf8'));
assert.equal(sha256(archiveText),run.archiveSha256);
const summary=summarize(JSON.parse(archiveText),JSON.parse(snapshotText),snapshotText);
assert.deepEqual(summary,JSON.parse(await readFile(new URL('summary.json',folder),'utf8')));
try{assert.deepEqual(summary.buckets.map(b=>namedDistribution(summary,b.months)),JSON.parse(await readFile(new URL('distribution.json',folder),'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}
console.log(`Verified dormancy archive: ${summary.cohort.accounts} accounts, ${summary.cohort.pairs} account-source pairs, ${summary.buckets.length} historical dates; census block ${summary.censusBlock}.`);
for(const b of summary.buckets)console.log(`${b.months} months: ${b.groups.named.accounts} named accounts; ${b.groups.named.totalYocto} yoctoNEAR; sampled since ${b.date}.`);
console.log('Offline consistency check. Equal balances at samples do not establish inactivity between samples, abandonment, ownership type, or current availability.');
