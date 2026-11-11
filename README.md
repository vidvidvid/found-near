# FOUND

Find unfinished LiNEAR, Meta Pool, rNEAR and validator-pool withdrawals on NEAR mainnet, then withdraw directly with your own wallet.

Unstaking does not always finish the job: after the unlock period, the account owner still needs to withdraw. FOUND checks these unfinished withdrawals in one place and requests the exact contract call through the owner’s wallet.

## Try it: do this, see this

Use **Node.js 24 (recommended), or 22.13+ on the 22.x line**. Run `npm ci` once to install the pinned connector and build tool; this setup needs network access. The first three checks below then run offline.

| Check | Do this | See this | Access / time |
| --- | --- | --- | --- |
| Application checks | `npm test` | All tests pass: financial states, withdrawal preflights, receipts, census, API and pagination | Offline; a few seconds |
| Census evidence | `npm run census:verify` | `Verified archive: 30681 unique qualifying accounts from 305908 unique accounts, 858 supported pools + 3 protocols, block 223975859.` | Offline; a few seconds |
| Sampled history | `npm run dormancy:verify` | Verifies 2963 accounts, 3703 pairs and six historical dates from the archived RPC evidence | Offline; a few seconds |
| Read-only scan API | `curl -fsS 'https://foundyours.xyz/api/scan/ru.near'` | JSON with `account`, finalized `height`/`block`, `results` per checked source, `pools` coverage and cache metadata; amounts are yoctoNEAR strings | Network; up to 45 seconds |
| Live interface | Open [FOUND](https://foundyours.xyz/), enter `ru.near` and press **Find my NEAR**, or use **Try a real account** | A live check across three protocols and indexed validator pools. LiNEAR showed 500.3072 NEAR at verification; balances can change | Network; usually a few seconds; no wallet needed |
| Optional independent reread | `npm run census:expanded -- --block 223975859 --check` | A new chain reread matches the archived snapshot | Network; potentially tens of minutes; rate-limited archival RPC access may be required |

A shared link also works: [check ru.near](https://foundyours.xyz/?account=ru.near). These steps scan only; they cannot withdraw from someone else’s account.

Submission text, publication checklist and the pending real-withdrawal recording: [SUBMISSION.md](SUBMISSION.md).

## Run locally and find the source

`npm run dev` serves the full app and read-only APIs on http://127.0.0.1:8084. `npm start` uses PORT (default 8080). Both use Node; **Python is not required to run the app**. Recovery tracking is disabled unless RECOVERY_DB is configured. Use the Node server rather than a static file server: the leaderboard fetches ten rows through its API.

**`dist/` is the hand-written application source, served as-is.** Only `dist/near-connector.js` is a generated bundle, built from `src/near-connector.js` by `npm run build`. Server/API modules are at the root; tests are in `tests/`; census tools are in `scripts/`. The checked-in connector bundle is ready to serve. Python is used only to compose/preview the demo video.

## Built with

- Plain JavaScript/HTML/CSS, **Node.js / SQLite**, **NEAR Connect 0.12.0**, **esbuild 0.28.2**; **Railway** hosting.
- **FastNEAR** staking API and RPC; **Intear** fallback RPC/state reads; **dRPC** census reads. Existing LiNEAR, Meta Pool, rNEAR and NEAR staking-pool contracts provide the withdrawal methods.
- **OpenAI Codex / ChatGPT**, **Kimi** and **Anthropic Claude** for coding, research and review assistance; OpenAI image generation for the original art and character assets, animated with CSS/Python.
- **Higgsfield Seed Audio 1.0 / Faye** synthetic narration; Python, Pillow, FFmpeg and faster-whisper for demo production/checks; **DM Sans** via Google Fonts under SIL OFL.

Original code: [MIT](LICENSE). Credits and third-party exclusions: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Asset prompts, voice settings and capture provenance: [demo/README.md](demo/README.md).

Independent verification findings are in [VERIFICATION.md](VERIFICATION.md).

## What it does

- Confirms the account exists and pins all protocol and validator-pool reads to one finalized block.
- Checks maturity, pauses and available withdrawal funds with each protocol’s own methods. rNEAR and validator pools require recognized contract code. Lockup accounts are identified separately because they need their lockup contract.
- Discovers validator relationships through FastNEAR, then checks up to 24 pools directly on-chain. Unsupported code, discovery gaps and failed reads stay explicit: **unknown is never zero**.
- Connects the owner’s wallet without requesting an access key. Before approval, rechecks ownership, readiness, code where required, and the exact amount. Requests only `withdraw({amount})`, with zero attached NEAR.
- Verifies the signer, contract, method, amount, deposit, finalized transaction and complete successful receipt chain. A failed transfer receipt cannot display success.
- Remembers pending requests across reloads and checks confirmation without resubmitting. An uncertain wallet response stays uncertain; a balance change alone does not prove a withdrawal.

Aurora’s balance-only exception: [read-only verification](research/aurora-readonly-2026-11-11/README.md).

Pending balances can show a measured unlock-time estimate and a downloadable calendar reminder. Unknown timing stays unknown; reminders never authorize withdrawals. [Timing verification and limits](verification/unlock-estimates.md).

Adapter methods, gas limits and rejection cases: [direct-withdrawal verification](verification/direct-withdrawals.md) and [coverage evidence](research/coverage-expansion/README.md).

## Limits

Coverage is LiNEAR, Meta Pool, rNEAR and supported indexed validator pools. FastNEAR discovery may lag or omit relationships; at most 24 discovered pools are checked. Aurora’s reviewed custom pool has read-only balance coverage with an official wallet link; direct withdrawal is disabled there. Other custom pool code, tokens, bridges and other protocols are not covered. No estimate of missing funds elsewhere,
no claims that the owner forgot, and no claim about continuous account inactivity. All accounts and balances are public.
The public leaderboard combines the three staking protocols and recognized pools from two standard factories. It counts each account once and explicitly excludes unrecognized implementations.
A view preflight is a snapshot, not a guarantee a future transaction succeeds.
Scanning needs no wallet. Withdrawing requires the controlling wallet and its approval; FOUND does not hold keys, custody funds, request an access key, or charge a fee. Network gas is paid by the account. Lockup accounts still require their lockup contract.

**No real owner-signed withdrawal was executed during QA.** Transaction construction, rejection cases and confirmation handling are covered by fixtures. Live wallet selection and mainnet balance reads are checked separately. See [verification/direct-withdrawals.md](verification/direct-withdrawals.md).

The page sends the entered public account to FastNEAR’s discovery API and public RPC providers (FastNEAR and Intear) for finalized reads.
Scanning has no application account database or browsing analytics. A small server stores withdrawal requests and verified public receipts for recovery totals; see below. Connecting loads the NEAR Connect wallet manifest and the selected wallet’s sandboxed integration. The browser remembers wallet selection and pending transaction metadata, not wallet keys. Typography loads from
Google Fonts with local fallbacks. Amount calculations use BigInt, with exact values
preserved and a truncated display (never rounded up).

## Verification

The test suite covers pinned preflights, exact Meta Pool liquidity checks, zero, pending,
paused, unavailable, malformed responses, lockups, per-protocol failures, missing accounts,
census pagination/filtering, precision, validation, and static-server safety.

Live mainnet QA covers LiNEAR, Meta Pool, rNEAR and recognized validator pools, including mature and pending balances, code checks and reads pinned to a shared block. Independent RPC reads matched the positive rNEAR/pool examples. These are read-only checks, not evidence of a completed withdrawal. Mainnet balances change; no values are hardcoded in the live checker. Browser QA covers wallet selection, result cards, share links and desktop/mobile layout.

New-coverage evidence, code provenance, limitations and live reproduction steps are in [research/coverage-expansion/README.md](research/coverage-expansion/README.md). Run `node scripts/verify-coverage.mjs --output /tmp/found-coverage.json` for a fresh read-only verification.

## Public leaderboard

The Waiting room contains **30,681 unique account IDs** with at least one matured balance above 0.01 NEAR at block **223975859**, 2026-11-10T22:01:36.060Z. The census read 305,908 distinct account IDs across LiNEAR, Meta Pool, rNEAR and **858 recognized validator pools**. Accounts shared across protocols or pools appear once. Each row shows its qualifying sources; ten rows appear per page.

The pool inventory includes all 862 entries in the poolv1.near and pool.near factories: 858 recognized implementations, 4 excluded pools running 2 unrecognized code versions, and 0 deleted accounts. Pools outside these factories are outside the census. Ledger IDs include contract and lockup accounts and are not a count of people or confirmed currently existing wallets. **110 IDs ending in `.lockup.near` hold 777,029.79408724816839127411321 NEAR** in this table. These rows are labelled Lockup: they require their lockup contract and cannot withdraw directly in FOUND. This suffix classification does not identify every possible contract-controlled account.

This is a dated snapshot of matured balances, not proof of abandonment or guaranteed immediate withdrawal. Pool liquidity and current account state are checked when the user scans live. The displayed **10.55M total listed NEAR** sums the table’s balances exactly (10,558,075.187594404327945091284701 NEAR). A protocol’s own balance can represent the same NEAR as its users’ balances, so adding both can count the same money twice. This is a gross listed total, not unique lost assets or confirmed recoveries. K/M values are truncated for display; full exact amounts remain on hover and in account results.

- Fast offline consistency check: `npm run census:verify`.
- Independent chain reread: `npm run census:expanded -- --block 223975859 --check`. Uses a new cache by default; regular RPCs may eventually prune this block, requiring an archival provider through CENSUS_RPC and CENSUS_STATE_RPC.
- Original LiNEAR-only snapshot: `npm run census -- --block 223800610 --check` now compares the preserved file in research/census/linear-2026-11-09.json.

See [the census evidence](research/census-2026-11-10/README.md) for the exact inclusion rule, source counts, decoding safeguards and reproduction commands.

<!-- sampled-history -->
In the **100+ NEAR cohort (2,963 accounts)**, **304 named accounts** had at least one balance unchanged and withdrawable at every sampled date from **10 Nov 2024** through **10 Nov 2026**, totalling **1,829,552.41 gross NEAR** in those qualifying balances. Named accounts may be contracts; activity between samples is possible. This is sampled history, not proof of abandonment. [Method, all six buckets and archived evidence](research/dormancy-2026-11-11/README.md).

Offline: `npm run dormancy:verify`. Historical age is included in paged API rows only where supported by this analysis; it names the qualifying amount rather than assigning an old age to the entire account total.
<!-- /sampled-history -->

## Visual direction

Original generated pixel-art scene, integrated with a dark navy, violet and amber
interface. The clean background plate and small sprite strips animate the lantern
spirit and wallet with a gentle float, blink and nod. Reduced-motion preferences
disable all character motion and ambient fireflies. Balance checks remain read-only; withdrawals require an explicit wallet-approved contract call.

## Recovery tracking

The app issues an anonymous request ID before opening the wallet. After the client confirms a withdrawal, the server independently verifies the exact transaction, every receipt, its timestamp (within 30 minutes of the request), and the execution-time code hash for rNEAR and validator pools. A failed, incomplete, mismatched or replayed receipt cannot inflate the totals. Amounts use exact integers; each transaction and each account is counted once. Totals report requested withdrawal amounts before gas and exclude any additional automatic Meta Pool dust sweep.

The database contains the public account, protocol, requested amount, transaction hash, block and timestamps. It contains no wallet keys, cookies, browsing events or IP-address column. Unconfirmed requests older than 30 days are pruned at startup, daily, and when new withdrawal requests arrive. The public endpoint exposes only aggregate counts and amounts, not individual records. Hosting/RPC providers may maintain their own access logs.

Attribution is **app-reported and receipt-verified**, not a cryptographic guarantee that FOUND was the only UI involved. Tracking is best effort: an outage never blocks withdrawal, and a missed request or a closed browser can leave a successful withdrawal uncounted. The browser queues receipt submissions for retry. The recovery counter stays hidden until a real nonzero confirmed withdrawal occurs; test fixtures never seed production totals.

Production uses Node 24 and SQLite at `/data/recoveries.sqlite` on a Railway persistent volume. The entrypoint prepares volume ownership then runs the server as the unprivileged `node` user. Keep the volume when redeploying; include the database and its WAL in backup procedures or use SQLite's online backup API. For a local full-stack preview: `RECOVERY_DB=/tmp/found-local/recoveries.sqlite PORT=8088 npm start`. `npm run dev` uses the same server without tracking unless RECOVERY_DB is set.

API: `GET /api/recoveries` returns totals; same-origin JSON POSTs to `/api/recoveries/start` and `/api/recoveries/confirm` create requests and submit receipts. These endpoints do not sign or send transactions.

## Read-only API and share links

`GET /api/scan/<account>` returns the same pinned-block scanner’s account, block/hash, check time, protocol results and pool-coverage status. Amounts are exact **yoctoNEAR strings**. A successful HTTP response can contain partial or unknown source results: inspect each `state` and `pools.state`; never treat an error as zero. Responses include `cached` and `cacheAgeMs`; complete results can be reused for up to 30 seconds. Wallet preflights always perform fresh RPC checks and do not use this cache. No signing endpoint is exposed.

Invalid account syntax returns 400; an account absent from mainnet returns 404; capacity limits return 429 with Retry-After; upstream failure returns 503; timeout returns 504. Each caller IP can start up to 10 new scans per minute and hold two concurrent scans. The server also caps work at four concurrent scans, 30 new scans per minute, a 45-second timeout and 128 cached results. Cache hits and requests joining an existing scan do not consume a new-scan allowance. These are capacity protections, not a guarantee against distributed overload; people sharing an IP share its quota.

Caller counters and cached scans are bounded, temporary in-memory records; no IP addresses or scan history are written to the application database. Hosting providers may maintain access logs. Public cross-origin GETs are allowed. The browser still scans directly through RPC. [Proxy configuration and quota verification](verification/api-fairness.md).

`GET /api/leaderboard?page=1` returns ten accounts, counts, the gross listed total, lockup statistics and snapshot block/date. Pages are 1-based; an out-of-range page is 404. The server validates the full snapshot once and caches it in memory. Responses have ETags and a five-minute cache lifetime. The full [leaderboard.json](dist/leaderboard.json) remains available for audit, but the UI does not download it.

`/?account=ru.near` automatically performs a read-only scan. A completed search updates the URL; **Copy link** shares the account for a fresh check, not a promise that its balance stays unchanged.

Machine-readable read-only API schema: [OpenAPI 3.1](https://foundyours.xyz/openapi.json). Wallets and agents could embed this scan API; adoption and a revenue model have not been established.
