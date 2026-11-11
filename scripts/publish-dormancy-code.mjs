import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {sha256} from './dormancy-model.mjs';
import {summarizeCode} from './dormancy-code-model.mjs';
import {codePresentation} from '../dormancy-api.mjs';
// Offline. Recomputes the contract-code summary from its archive (as dormancy:code:verify does),
// then writes the compact derivative the server exposes: dist/dormancy-code.json.
// It is bound by SHA-256 to dist/dormancy.json, which must be byte-identical to the research summary.
const root=new URL('../',import.meta.url),folder=new URL('research/dormancy-2026-11-11/',root);
const summaryText=await readFile(new URL('summary.json',folder),'utf8'),shipped=await readFile(new URL('dist/dormancy.json',root),'utf8');
assert.equal(shipped,summaryText,'dist/dormancy.json differs from the research summary');
const archiveText=gunzipSync(await readFile(new URL('code-archive.json.gz',folder))).toString();
assert.equal(sha256(archiveText),JSON.parse(await readFile(new URL('code-run.json',folder),'utf8')).archiveSha256);
const codeText=await readFile(new URL('code-summary.json',folder),'utf8'),code=summarizeCode(JSON.parse(archiveText),JSON.parse(summaryText),summaryText);
assert.deepEqual(code,JSON.parse(codeText),'code-summary.json does not match its archive');
const derivative={version:1,censusBlock:code.censusBlock,censusHash:code.censusHash,dormancySha256:code.dormancySummarySha256,codeSummarySha256:sha256(codeText),noCodeHash:code.noCodeHash,definition:code.definition,
 buckets:code.buckets.map(b=>{
  // topCodeHashes is capped at ten; the derivative must list every hash so its counts can be checked.
  assert.equal(b.topCodeHashes.length,b.distinctCodeHashes,'Code hash list is truncated');
  return {months:b.months,namedAccounts:b.namedAccounts,namedTotalYocto:b.namedTotalYocto,classes:b.classes,codeHashes:b.topCodeHashes};
 })};
codePresentation(JSON.parse(summaryText),summaryText,derivative);
await writeFile(new URL('dist/dormancy-code.json',root),JSON.stringify(derivative,null,2)+'\n');
const focus=derivative.buckets.find(b=>b.months===24);
console.log(`Wrote dist/dormancy-code.json. 24 months: ${focus.namedAccounts} named; no code ${focus.classes['no-code'].accounts}; code ${focus.classes.code.accounts}; unknown ${focus.classes.unknown.accounts}.`);
