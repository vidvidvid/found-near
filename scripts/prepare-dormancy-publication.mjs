import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {summarize,accountKind,namedDistribution} from './dormancy-model.mjs';
import {formatNear,exactNear} from '../dist/rpc.js';
import {dormancyPresentation} from '../dormancy-api.mjs';
const root=new URL('../',import.meta.url),folder=new URL('research/dormancy-2026-11-11/',root);
const text=await readFile(new URL('dist/leaderboard.json',root),'utf8'),snapshot=JSON.parse(text);
const archive=JSON.parse(gunzipSync(await readFile(new URL('archive.json.gz',folder))));
const summary=summarize(archive,snapshot,text),saved=JSON.parse(await readFile(new URL('summary.json',folder),'utf8'));
assert.deepEqual(summary,saved);dormancyPresentation(snapshot,summary);
const run=JSON.parse(await readFile(new URL('run.json',folder),'utf8'));
// This investigation briefly used both public archival providers before the final resumed pass.
delete run.cacheMayIncludeEarlierProvider;
run.cacheProvenance={providers:['https://archival-rpc.mainnet.fastnear.com','https://archival-rpc.mainnet.near.org'],limitation:'Legacy cache records bind method/parameters and pinned block, but do not retain a per-response provider label.'};
await writeFile(new URL('run.json',folder),JSON.stringify(run,null,2));
const n=x=>x.toLocaleString('en-US'),t=x=>formatNear(x,2),focus=summary.buckets.find(b=>b.months===24),year=summary.buckets.find(b=>b.months===12);
const date=x=>new Date(x).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const unknownCauses={};
for(const entry of archive.pairs){
 const last=entry.samples.at(-1),code=last.code?.error,view=last.view?.error;
 const error=code||view;
 if(error){const cause=(code?'code read: ':'view read: ')+(error.rpcError?.cause?.name||error.code||'unavailable');unknownCauses[cause]=(unknownCauses[cause]||0)+1;}
}
const unknown=Object.entries(summary.terminations).filter(([k])=>k.startsWith('unknown:')).reduce((a,[,v])=>a+v,0);
const distribution=summary.buckets.map(b=>namedDistribution(summary,b.months));
await writeFile(new URL('distribution.json',folder),JSON.stringify(distribution,null,2));
const concentration=distribution.map(d=>`| ${d.months} | ${n(d.accountsWithAtLeast100OldNear)} | ${(d.largestShareBasisPoints/100).toFixed(2)}% | ${exactNear(d.totalWithoutLargestYocto)} |`).join('\n');
const table=summary.buckets.flatMap(b=>Object.entries(b.groups).map(([kind,g])=>`| ${b.months} | ${kind} | ${n(g.accounts)} | ${n(g.pairs)} | ${exactNear(g.totalYocto)} |`)).join('\n');
const ladder=summary.buckets.map(b=>`| ${b.months} | ${b.block} | ${b.date} | \`${b.hash}\` |`).join('\n');
const note=`# Sampled balance history — 11 November 2026

**${n(focus.groups.named.accounts)} named accounts** in the 100+ NEAR cohort had at least one balance unchanged and withdrawable at every sampled date from **${date(focus.date)}** through the census on **${date(summary.asOf)}**. Those qualifying source balances total **${exactNear(focus.groups.named.totalYocto)} NEAR**. Named accounts can be contracts; this is not a count of people or evidence that the money was forgotten.

## Reproduce

Run \`npm run census:verify\`, then \`npm run dormancy:verify\`. Both run offline after install. The first verifies the original census archive; the second rebuilds every history bucket and row from [archived RPC responses](archive.json.gz), checking its [summary](summary.json) and archive digest in [run metadata](run.json). These are consistency checks of trusted-provider RPC evidence, not cryptographic light-client proofs. See the [exact verifier output](verification.txt). A [cached resume test](resume-verification.json) with an unreachable RPC endpoint reproduced the identical summary in 55 seconds with zero requests.

Fresh independent reads: \`DORMANCY_RPC=https://archival-rpc.mainnet.fastnear.com npm run dormancy:scan -- --cache-dir /tmp/found-independent-history --output /tmp/found-independent-history-output\`. The public archival service is limited; budget substantial time, respect backoff, or use an authorized archival endpoint. The script never signs transactions. \`DORMANCY_INTERVAL_MS\` controls minimum spacing (default 2,000 ms); four workers share one limiter.

## Cohort and method

The immutable census at block **${summary.censusBlock}** contains ${n(snapshot.accounts.length)} qualifying account IDs. This analysis selects only the **${n(summary.cohort.accounts)}** whose summed census balance is at least 100 NEAR: **${n(summary.cohort.pairs)} account-source pairs**. Smaller accounts were not analysed. Individual sources in a selected account may be less than 100 NEAR; the original per-source threshold remains above 0.01 NEAR. The cohort includes ${Object.entries(summary.cohort.kinds).map(([k,v])=>n(v)+' '+k).join(', ')} account IDs.

Each pair starts with its exact matured census amount and walks backward through the dates below. It qualifies at a date only if its exact unstaked amount matches and \`can_withdraw\` is true there and at every more-recent sample. The first changed, zero, pending or unknown sample stops that pair. An account counts once in each bucket even if several sources qualify; only qualifying sources are summed. Buckets overlap and must not be added together.

Reads use \`get_account\` / \`get_account_details\`. For crowded standard pools, \`get_accounts\` pages supply the same fields more efficiently; the reviewed [reference implementation](https://github.com/near/core-contracts/blob/1b0436c96379c63aee7d2429c6d5d24019031ab8/staking-pool/src/lib.rs) maps those pages through \`get_account\`. Every selected record must match the account ID, with unique page IDs, exact page length, valid unsigned amount and boolean maturity. A missing page row triggers an individual read, never a presumed zero. Repeated page responses are archived once by SHA-256 reference. Pinned header height/hash checks apply to code, pages and individual views.

Historical standard-pool code must match one of the two reviewed factory binaries. Historical protocol code must match that protocol's census-block code. A different unreviewed version, missing contract, failed view or unexpected shape is unknown, not evidence that no money was present. This conservative restriction can understate age. The pool/code gates used for historical interpretation do not authorize new withdrawal adapters.

## Dated ladder

Calendar-month targets were located using actual block-header timestamps, with the selected block at or just before each target. No fixed historical block time is assumed.

| Months before census | Block | UTC timestamp | Hash |
| --- | --- | --- | --- |
${ladder}

## Results

\`implicit\` means 64 lowercase hex characters; \`ethereum\` is the distinct 0x-prefixed NEAR account form; \`lockup\` is the .lockup.near suffix. Other valid IDs are \`named\`, which can include contracts, custodians and protocols. These labels do not establish beneficial ownership.

| At least months | Account kind | Unique IDs | Qualifying pairs | Gross NEAR (exact) |
| --- | --- | ---: | ---: | ---: |
${table}

## Concentration and balance size

These figures aggregate only the qualifying old sources per named account. A more recent balance in another pool does not help an account cross the 100 NEAR threshold here. The original cohort threshold was the full census total; this second check measures the old balance itself. [Recomputed distribution](distribution.json).

| At least months | Named accounts with at least 100 old NEAR | Largest account's share of named sum | Named gross NEAR excluding that account |
| --- | ---: | ---: | ---: |
${concentration}

The amount is concentrated: use the qualified account count as the headline, not a claim that the whole gross total belongs to ordinary individual users. Named accounts may be contracts or institutions, and removing the largest account does not eliminate possible reserve overlap.

## Stops and limits

${Object.entries(summary.terminations).map(([k,v])=>'- '+k+': '+n(v)+' pairs.').join('\n')}

**${n(unknown)} pairs stopped on unknown evidence.** Their more-recent qualifying samples remain valid; nothing older is inferred. Recorded provider error causes: ${Object.entries(unknownCauses).map(([k,v])=>k+' ('+n(v)+')').join('; ')||'none'}. Code-version stops are intentional interpretation limits, not RPC outages. The full cohort still has a recorded stopping outcome, including unknown. These are sampled balances: withdrawals and replenishment could occur between checkpoints, and unchanged balances may be intentional. There is no causal proof of wallet UX, no confirmed lost-money total, and no recovery claim.

Gross sums may include overlapping protocol reserves. Lockups require a different withdrawal path. Historical maturity is not current pool liquidity, pause status, account existence or a promise a transaction will succeed. Recheck live and verify the owner-signed receipt separately.

## Run accounting

The final resumed pass made **${n(run.requests)} outgoing RPC attempts**, reused **${n(run.cacheHits)} request-cache hits**, and observed **${run.rateLimits} rate-limit responses**, over **${n(run.elapsedSeconds)} seconds**. It reused earlier FastNEAR/NEAR archival reads and completed pair checkpoints. These counters describe that pass, not every exploratory probe or interrupted setup attempt. The archive contains the actual evidence needed by the verifier; caches are only an optimization. Setup probes and interrupted runs were not all timed or counted, so no invented whole-investigation RPC total is reported.

The initial three-account probe was independently reproduced: two amounts matched July 2024 and the census exactly, while the third differed (its earlier balance was 1 yoctoNEAR, not literally zero). The ladder above, not that exploratory probe, defines the published buckets.
`;
await writeFile(new URL('README.md',folder),note);
await copyFile(new URL('summary.json',folder),new URL('dist/dormancy.json',root));
const summaryLine=`In the **100+ NEAR cohort (${n(summary.cohort.accounts)} accounts)**, **${n(focus.groups.named.accounts)} named accounts** had at least one balance unchanged and withdrawable at every sampled date from **${date(focus.date)}** through **${date(summary.asOf)}**, totalling **${t(focus.groups.named.totalYocto)} gross NEAR** in those qualifying balances. Named accounts may be contracts; activity between samples is possible. This is sampled history, not proof of abandonment. [Method, all six buckets and archived evidence](research/dormancy-2026-11-11/README.md).`;
let readme=await readFile(new URL('README.md',root),'utf8');
const marker='<!-- sampled-history -->',end='<!-- /sampled-history -->',section=`${marker}\n${summaryLine}\n\nOffline: \`npm run dormancy:verify\`. Historical age is included in paged API rows only where supported by this analysis; it names the qualifying amount rather than assigning an old age to the entire account total.\n${end}`;
if(readme.includes(marker))readme=readme.slice(0,readme.indexOf(marker))+section+readme.slice(readme.indexOf(end)+end.length);else readme=readme.replace('## Visual direction',section+'\n\n## Visual direction');
if(!readme.includes('| Sampled history |'))readme=readme.replace('| Read-only scan API |',`| Sampled history | \`npm run dormancy:verify\` | Verifies ${summary.cohort.accounts} accounts, ${summary.cohort.pairs} pairs and six historical dates from the archived RPC evidence | Offline; a few seconds |\n| Read-only scan API |`);
readme=readme.replace('and no account-age claim.','and no claim about continuous account inactivity.');
readme=readme.replace('The first two checks below then run offline.','The first three checks below then run offline.');
await writeFile(new URL('README.md',root),readme);
let submission=await readFile(new URL('SUBMISSION.md',root),'utf8');
if(!submission.includes(marker))submission=submission.replace('Read-only account links and a JSON scan API',marker+'\n'+summaryLine+'\n'+end+'\n\nRead-only account links and a JSON scan API');
submission=submission.replace('npm run census:verify\ncurl','npm run census:verify\nnpm run dormancy:verify\ncurl');
submission=submission.replace('Tests and the archived census check run offline after setup.','Tests, census verification and sampled-history verification run offline after setup.');
submission=submission.replace('A newly created wallet needs a matured unstaked balance before the final recording can happen.','The owner’s vidvid.near account has pending balances in meteor.poolv1.near and figment.poolv1.near; final recording waits for a real readiness check.');
submission=submission.replace('| Owner-approved public account | Pending |','| Owner-provided account | vidvid.near; final receipt publication review pending |');
submission=submission.replace('| Protocol / contract | Pending |','| Protocol / contract | meteor.poolv1.near and backup figment.poolv1.near; still unlocking at last check |');
submission=submission.replace('**Still required from the owner:** wallet/account and matured withdrawal;','**Still required from the owner:** approval of a matured withdrawal in the wallet;');
const hook=`${n(focus.groups.named.accounts)} named NEAR accounts. Same withdrawable balances at every sampled date over 2 years.\n\nFOUND helps finish the withdrawal.\nBuilt at NEAR HACKATHON\n@NEARProtocol #NEARHackathon\nhttps://foundyours.xyz/\nhttps://github.com/vidvidvid/found-near`;
if(!submission.includes('## Evidence-led post option'))submission+='\n## Evidence-led post option — owner review before posting\n\nUse this only with the final real-withdrawal video. The video/site must explain the 100+ NEAR cohort, account types and sampling limits. This is a draft, not a published claim of abandonment. Verify X length and the handbook tags before posting.\n\n```text\n'+hook+'\n```\n\nThe primary recommendation remains Open Innovation. The history data alone does not establish a long-term investment thesis for NEAR; no Investment Thesis entry has been prepared.\n';
await writeFile(new URL('SUBMISSION.md',root),submission);
const pools=[['LiNEAR','linear-protocol.near'],['Meta Pool','meta-pool.near'],['Rhea','lst.rhealab.near'],['Meteor','meteor.poolv1.near'],['AstroStakers','astro-stakers.poolv1.near'],['HERE','here.poolv1.near'],['Ledger by Figment','ledgerbyfigment.poolv1.near'],['Dragonfly','dragonfly.poolv1.near'],['Electric Capital','electric.poolv1.near']];
const sourceStats=pools.map(([name,contract])=>{
 const owners=snapshot.accounts.filter(a=>a.sources.some(s=>s.contract===contract));
 const yearRows=Object.entries(summary.rows).filter(([id,sources])=>accountKind(id)==='named'&&sources.some(s=>s.contract===contract&&s.oldestMonths>=12));
 return {name,contract,accounts:owners.length,totalYocto:owners.reduce((n,a)=>n+BigInt(a.sources.find(s=>s.contract===contract).amount),0n).toString(),namedYearAccounts:yearRows.length};
});
await mkdir(new URL('outreach/local/',root),{recursive:true});
await writeFile(new URL('outreach/source-counts.json',root),JSON.stringify({block:snapshot.block,asOf:snapshot.asOf,scope:'Dated gross matured census balances; 12-month counts are named IDs in the 100+ cohort, not people.',sources:sourceStats},null,2));
const sourceTable=sourceStats.map(s=>`| ${s.name} | \`${s.contract}\` | ${n(s.accounts)} | ${t(s.totalYocto)} | ${n(s.namedYearAccounts)} |`).join('\n');
const drafts=sourceStats.map(s=>`### ${s.name}\n\nHi ${s.name} team—FOUND helps people find and finish unstaked NEAR withdrawals with their own wallet. The 10 November census lists ${n(s.accounts)} account IDs with matured balances in ${s.contract}${s.namedYearAccounts?`; ${n(s.namedYearAccounts)} named ${s.namedYearAccounts===1?'ID':'IDs'} in the 100+ NEAR cohort had qualifying balances matching at every sampled date over a year`:''} (a dated snapshot, not proof of lost funds). Would you share the read-only checker with your delegators/users: https://foundyours.xyz/ ? The official protocol/wallet app is also a valid way to withdraw.\n`).join('\n');
await writeFile(new URL('outreach/README.md',root),`# Outreach drafts — owner sends, nothing sent\n\nRecheck the account/pool evidence before contacting anyone. Drafts do not imply endorsement. Mention a judge's firm only as a factual validator source, never as a personalized appeal or a claim about a judge's own wallet. Wait until the repository is public before adding its link: https://github.com/vidvidvid/found-near.\n\n## Verified source counts\n\nCensus block ${snapshot.block}, ${date(snapshot.asOf)}. IDs can include contracts and institutions; accounts can overlap between rows, and gross amounts can overlap protocol reserves. The year column is a limited analysed cohort, not the entire pool population.\n\n| Team | Pool / contract | Census IDs | Gross NEAR | Named IDs matching at 12-month samples |\n| --- | --- | ---: | ---: | ---: |\n${sourceTable}\n\n${drafts}\n### FastNEAR\n\nHi FastNEAR team—FOUND uses your staking discovery and RPC to help NEAR users finish unfinished withdrawals. Our pinned census and sampled-history archive are independently checkable offline; ${n(focus.groups.named.accounts)} named IDs in the 100+ NEAR cohort had balances unchanged and withdrawable at every sampled date over two years, with the sampling limits disclosed. Would you review/share the checker with wallet builders: https://foundyours.xyz/ ?\n\n## Private individual template\n\nOptional local enrichment: \`node scripts/prepare-outreach-profiles.mjs\` reads the candidates’ self-published SocialDB profiles in batches of 25 and checks current code presence for at most 20 returned profiles, writing only to ignored \`outreach/local/\`. No profile is proof of identity. [SocialDB’s documented view](https://github.com/NearSocial/social-db#reading-data) accepts \`get({keys:[\"account.near/profile/**\"]})\`; results were checked for account-keyed objects and string leaves.\n\nHi—I’m building FOUND, a small open-source withdrawal checker, and noticed a public staking record that may have an unfinished withdrawal. You can check your own account without connecting a wallet at https://foundyours.xyz/, or use the protocol’s official app directly. I will never ask for keys, a recovery phrase, a payment, or a screenshot of your wallet secrets.\n\nSend privately after manually verifying the recipient/account association and current balance. Do not put an individual's name, account and amount into a public post. Public profile links are self-published hints, not verified identity. The local shortlist is excluded from Git. No unsolicited messages were sent.\n`);
const shortlist=Object.entries(summary.rows).filter(([id])=>accountKind(id)==='named'&&!['linear-protocol.near','meta-pool.near','lst.rhealab.near'].includes(id)).map(([account,sources])=>({account,sources:sources.filter(s=>s.oldestMonths>=12)})).map(r=>({...r,totalYocto:r.sources.reduce((n,s)=>n+BigInt(s.amount),0n).toString()})).filter(r=>BigInt(r.totalYocto)>=100n*10n**24n).sort((a,b)=>BigInt(a.totalYocto)>BigInt(b.totalYocto)?-1:1);
await writeFile(new URL('outreach/local/shortlist.json',root),JSON.stringify({asOf:snapshot.asOf,warning:'Local draft only. Public records and unverified names; not proof of human ownership, current balance or inactivity between samples. Recheck before private contact.',accounts:shortlist},null,2));
const demoPath=new URL('demo/README.md',root);let demo=await readFile(demoPath,'utf8');
if(!demo.includes('## Evidence-led opening')){demo+='\n## Evidence-led opening — optional edited cut\n\nOpen with the real finding: **'+n(focus.groups.named.accounts)+' named accounts; qualifying balances matched at every sampled date over two years**. Keep “100+ NEAR cohort · sampled dates, not continuous inactivity” legible alongside it. Then show the owner’s real scan → approval → verified receipt as the payoff. Match narration and captions exactly, and preserve the uncut transaction take separately. This is a recording plan, not evidence that a withdrawal has happened.\n';await writeFile(demoPath,demo);}
console.log(JSON.stringify({headline:focus.groups.named,year:year.groups.named,unknown,cohort:summary.cohort,shortlist:shortlist.length,sourceStats},null,2));
