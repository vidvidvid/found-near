# FOUND

Find unfinished LiNEAR, Meta Pool, rNEAR and validator-pool withdrawals on NEAR mainnet, then withdraw directly with your own wallet.

## Live demo

https://found-production-e549.up.railway.app/

The Open Innovation submission description, demo script, X post draft, and recovery-evidence checklist are in [SUBMISSION.md](SUBMISSION.md).

## Run

`npm run dev` serves `dist/` on http://127.0.0.1:8084.
`npm test` verifies the financial-state and census logic using deterministic RPC fixtures.
The checked-in `dist/` runs directly. After changing the pinned wallet connector, run `npm ci` and `npm run build` to rebuild its local browser bundle.

Independent verification findings are in [VERIFICATION.md](VERIFICATION.md).

## What it does

- Accepts a named or implicit NEAR account and confirms the account exists.
- Pins all protocol and validator-pool reads to the same finalized block.
- Reads `linear-protocol.near.get_account_details`. For a positive mature balance,
  checks `is_paused` and `can_account_withdraw` with the exact amount at that block.
- Reads `meta-pool.near.get_account`. For a positive mature balance on a regular account,
  checks `get_contract_state` for enough reserved withdrawal funds and contract balance
  including the contract’s possible dust sweep, at that block.
- Identifies lockup accounts separately instead of sending them through a
  regular wallet withdrawal flow.
- Reads `lst.rhealab.near.get_account_details` for rNEAR. Requires maturity, global and withdrawal-method pause checks, exact `can_account_withdraw` success, a recognized code hash, and liquid funds after storage/execution reserves.
- Discovers validator relationships through FastNEAR, then reads balances directly on-chain. Supports the two verified standard pool implementations, including legacy `poolv1.near` and newer `pool.near` deployments. Requires maturity, the independent availability view, and liquid funds after reserves. Unknown implementations remain visibly unsupported.
- Checks up to 24 discovered pools, four at a time. Discovery outages and truncated coverage are explicit, never reported as zero funds. Empty sources are collapsed; amounts below 0.00001 NEAR remain accessible as tiny balances with a fee note.
- Connects through NEAR Connect without requesting an access key. Owners can withdraw directly from FOUND; official apps remain available in optional Help.
- Rechecks ownership, readiness and the exact balance immediately before asking the wallet to approve. Every supported contract receives `withdraw({amount})` with zero attached NEAR. rNEAR uses its SDK’s 200 TGas limit; the other adapters use 100 TGas. New adapters also require a recognized contract code hash and reject a code change during preflight.
- Verifies the transaction on public RPC: matching signer, contract, method, amount, zero deposit, finalized status, and the complete successful receipt chain. A failed transfer receipt cannot display success.
- Remembers pending requests through reloads and checks confirmation without submitting again. An uncertain wallet response remains uncertain; it never becomes a successful withdrawal just because the balance changed.
- Treats RPC failures as unknown, never as zero. A failure in one protocol does not hide
  successful results from other sources. Zero and pending are shown separately.
- Account validation runs on blur (and submit), never while typing. Format and mainnet existence errors stay beside the input; previous results remain visible. No guessed addresses. Service failures are distinguished from nonexistent accounts.
- A completed account search remains on screen when submitted again. The button says Checked; editing the account enables another search. Refresh balance explicitly rereads the shown account without replaying its discovery animation. Incomplete checks can still be retried. Wallet-driven checks and post-withdrawal refreshes always bypass this reuse.
- The public example reads ru.near from mainnet, not a recorded or invented balance. Repeating the same completed example keeps its displayed snapshot until refreshed.

## Limits

Coverage is LiNEAR, Meta Pool, rNEAR and supported indexed validator pools. FastNEAR discovery may lag or omit relationships; at most 24 discovered pools are checked. Custom pool code, tokens, bridges and other protocols are not covered. No estimate of missing funds elsewhere,
no claims that the owner forgot, and no account-age claim. All accounts and balances are public.
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

Live mainnet QA verified the LiNEAR result for ru.near, a matured Meta Pool result for
lb3.near, a pending Meta Pool account, and shared block heights across both protocols.
Mainnet balances change; no values are hardcoded in the live checker. Browser QA verified
the withdrawal dialog, official destinations, and desktop/mobile layout.

New-coverage evidence, code provenance, limitations and live reproduction steps are in [research/coverage-expansion/README.md](research/coverage-expansion/README.md). Run `node scripts/verify-coverage.mjs --output /tmp/found-coverage.json` for a fresh read-only verification.

## Public leaderboard

The Waiting room contains **30,681 unique account IDs** with at least one matured balance above 0.01 NEAR at block **223975859**, 2026-11-10T22:01:36.060Z. The census read 305,908 distinct account IDs across LiNEAR, Meta Pool, rNEAR and **858 recognized validator pools**. Accounts shared across protocols or pools appear once. Each row shows its qualifying sources; ten rows appear per page.

The pool inventory includes all 862 entries in the poolv1.near and pool.near factories: 858 recognized implementations, 4 unsupported versions, and 0 deleted accounts. Pools outside these factories are outside the census. Ledger IDs include contract and lockup accounts and are not a count of people or confirmed currently existing wallets.

This is a dated snapshot of matured balances, not proof of abandonment or guaranteed immediate withdrawal. Pool liquidity and current account state are checked when the user scans live. The displayed **10.55M total listed NEAR** sums the table’s balances exactly (10,558,075.187594404327945091284701 NEAR). Protocol reserves can overlap user claims, so this is a gross listed total, not unique lost assets or confirmed recoveries. K/M values are truncated for display; full exact amounts remain on hover and in account results.

- Fast offline consistency check: `npm run census:verify`.
- Independent chain reread: `npm run census:expanded -- --block 223975859 --check`. Uses a new cache by default; regular RPCs may eventually prune this block, requiring an archival provider through CENSUS_RPC and CENSUS_STATE_RPC.
- Original LiNEAR-only snapshot: `npm run census -- --block 223800610 --check` now compares the preserved file in research/census/linear-2026-11-09.json.

See [the census evidence](research/census-2026-11-10/README.md) for the exact inclusion rule, source counts, decoding safeguards and reproduction commands.

## Visual direction

Original generated pixel-art scene, integrated with a dark navy, violet and amber
interface. The clean background plate and small sprite strips animate the lantern
spirit and wallet with a gentle float, blink and nod. Reduced-motion preferences
disable all character motion and ambient fireflies. Balance checks remain read-only; withdrawals require an explicit wallet-approved contract call.

## Recovery tracking

The app issues an anonymous request ID before opening the wallet. After the client confirms a withdrawal, the server independently verifies the exact transaction, every receipt, its timestamp (within 30 minutes of the request), and the execution-time code hash for rNEAR and validator pools. A failed, incomplete, mismatched or replayed receipt cannot inflate the totals. Amounts use exact integers; each transaction and each account is counted once. Totals report requested withdrawal amounts before gas and exclude any additional automatic Meta Pool dust sweep.

The database contains the public account, protocol, requested amount, transaction hash, block and timestamps. It contains no wallet keys, cookies, browsing events or IP-address column. Unconfirmed requests older than 30 days are pruned at startup, daily, and when new withdrawal requests arrive. The public endpoint exposes only aggregate counts and amounts, not individual records. Hosting/RPC providers may maintain their own access logs.

Attribution is **app-reported and receipt-verified**, not a cryptographic guarantee that FOUND was the only UI involved. Tracking is best effort: an outage never blocks withdrawal, and a missed request or a closed browser can leave a successful withdrawal uncounted. The browser queues receipt submissions for retry. Zero is shown until real confirmed withdrawals occur; test fixtures never seed production totals.

Production uses Node 24 and SQLite at `/data/recoveries.sqlite` on a Railway persistent volume. The entrypoint prepares volume ownership then runs the server as the unprivileged `node` user. Keep the volume when redeploying; include the database and its WAL in backup procedures or use SQLite's online backup API. For a local full-stack preview: `RECOVERY_DB=/tmp/found-local/recoveries.sqlite PORT=8088 npm start`. Static `npm run dev` still works; tracking is unavailable in that preview.

API: `GET /api/recoveries` returns totals; same-origin JSON POSTs to `/api/recoveries/start` and `/api/recoveries/confirm` create requests and submit receipts. These endpoints do not sign or send transactions.
