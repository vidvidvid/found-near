import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {sha256} from './dormancy-model.mjs';
import {summarizeCode} from './dormancy-code-model.mjs';
// Offline, zero RPC. Recomputes code-summary.json from code-archive.json.gz and the
// dormancy summary.json. summary.json itself is proven from the history archive by
// `npm run dormancy:verify`; this check binds to it by SHA-256, so run that first.
const folder=new URL('../research/dormancy-2026-11-11/',import.meta.url);
const summaryText=await readFile(new URL('summary.json',folder),'utf8');
const archiveText=gunzipSync(await readFile(new URL('code-archive.json.gz',folder))).toString();
const run=JSON.parse(await readFile(new URL('code-run.json',folder),'utf8'));
assert.equal(sha256(archiveText),run.archiveSha256);
const result=summarizeCode(JSON.parse(archiveText),JSON.parse(summaryText),summaryText);
assert.deepEqual(result,JSON.parse(await readFile(new URL('code-summary.json',folder),'utf8')));
console.log(`Verified contract-code archive: ${result.accountsRead} named accounts read with view_account at census block ${result.censusBlock}; dormancy summary sha256 ${result.dormancySummarySha256}.`);
for(const b of result.buckets)console.log(`${b.months} months: ${b.namedAccounts} named; no code ${b.classes['no-code'].accounts} (${b.classes['no-code'].totalYocto} yoctoNEAR); code ${b.classes.code.accounts} (${b.classes.code.totalYocto}); unknown ${b.classes.unknown.accounts} (${b.classes.unknown.totalYocto})${Object.keys(b.unknownReasons).length?' '+JSON.stringify(b.unknownReasons):''}.`);
console.log('Offline consistency check. No contract code does not prove an individual owner; deployed code does not prove the owner is not a person. Code is read at the census block, not at the sample dates.');
