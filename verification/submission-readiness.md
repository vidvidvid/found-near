# Submission preparation checks — 10 November 2026

## Current documents and history

Updated current README, SUBMISSION, VERIFICATION, RESEARCH, direct-withdrawal notes, census methodology, credits and demo status. Added the owner-approved MIT license, Node engine requirement, `.nvmrc`, and setup guard. Credits include Codex/ChatGPT, Kimi and Claude, generated art/animation/narration, data providers, libraries and fonts.

Preserved earlier reports under `docs/history/`: the two-protocol verification (`7255178` and corrections), research as of `bf2956e`, and recorded-demo notes from `8a4fcf8`. Relative Markdown links were adjusted and checked. The dated initial coverage investigation remains in its dated research folder with a historical banner and links to current implementation evidence. Historical counts are not substituted for current results.

The old video remains a clearly labelled draft. Its artwork and voice were not replaced, and no completed withdrawal was invented. The final one-take recording and public transaction proof remain pending.

## Reproduction

A fresh local Git clone at `/tmp/found-clean-submission-20261110` was installed with `npm ci` using a separate temporary npm cache. Installation output:

```text
added 3 packages, and audited 4 packages in 564ms
found 0 vulnerabilities
```

`npm test` passed on Node 24.22.2. The suite also passed on 22.13.0 and 22.21.0. Node 22.13 is the minimum supported 22.x release because the SQLite statement iterator used for recovery totals was introduced there. Node 24 is recommended and used in the Dockerfile. Unsupported Node versions receive a clear message through npm's pretest/prestart/predev/prebuild scripts.

`npm run census:verify` output:

```text
Verified archive: 30681 unique qualifying accounts from 305908 unique accounts, 858 supported pools + 3 protocols, block 223975859.
This is an offline consistency check of archived RPC evidence. Use census:expanded with a fresh cache and --check to re-query the chain independently.
```

`npm run build` output:

```text
Built the pinned NEAR wallet connector.
```

The rebuild left the checked-in browser bundle unchanged. A full archival census reread was not repeated in this preparation pass; it is optional, slow and provider-dependent, and the README says so.

## Live and browser checks

- Public scan and leaderboard APIs returned HTTP 200 after deployment. A read of `ru.near` at block 223981724 returned the documented exact LiNEAR balance and all four checked sources at that same block. Pool discovery was complete (1/1). This is a dated read, not a future balance promise.
- An independent README-first reviewer ran the coverage verifier: factory-code checks passed, and five positive rNEAR/pool balances independently matched Intear. Its output is live verification, not a transaction simulation.
- The first leaderboard page is 3,122 bytes of JSON, rather than the previous approximately 1.3 MB gzip download. The complete census file remains downloadable for audit. Page 2, final page, row counts and previous/next boundaries were checked.
- Account deep links start a read-only scan. Search updates the URL and exposes Copy link. Blur validation, completed-search reuse, current result cards and the NEAR Connect wallet selector remain functional. No wallet was connected and no transaction signed in this UI check.
- Lockup badges and their exact census total are derived from the snapshot. Zero recovery totals remain hidden. No production recovery was seeded by tests.
- Public repository visibility, X publication and hackathon submission were not changed. The GitHub description now describes the expanded withdrawal workflow.

## Review and limitations

The independent reviewer found no broken local Markdown targets. It found a stale test count, wording that called dated balances current, and an unavailable brand-page URL; all were corrected. NEAR's mark remains a third-party trademark, excluded from the project's MIT grant. Its general terms reserve trademark rights; no separate broad logo license or endorsement was verified or claimed. The wallet package declares MIT in its metadata but ships no standalone license file; that fact is disclosed in the notices.

A redacted Gitleaks scan of full Git history and the working files found no credentials. This is a tool result, not a guarantee that secret detection is exhaustive. `.openai/hosting.json` is retained locally, untracked and excluded from future commits; its existing historical hosting ID is not a credential, and history was not rewritten.

The remaining owner-dependent items are recorded in [SUBMISSION.md](../SUBMISSION.md): a matured withdrawal and approved public receipt, final demo, public repo/X post, final tag, and confirmed submission details/consent. No real owner-signed withdrawal was sent in QA.
