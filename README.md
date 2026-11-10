# FOUND

A small read-only finder for unfinished LiNEAR and Meta Pool withdrawals on NEAR mainnet.

## Live demo

https://found-production-e549.up.railway.app/

The Open Innovation submission description, demo script, X post draft, and recovery-evidence checklist are in [SUBMISSION.md](SUBMISSION.md).

## Run

`npm run dev` serves `dist/` on http://127.0.0.1:8084.
`npm test` verifies the financial-state and census logic using deterministic RPC fixtures.
No dependencies or build step are required.

Independent verification findings are in [VERIFICATION.md](VERIFICATION.md).

## What it does

- Accepts a named or implicit NEAR account and confirms the account exists.
- Pins LiNEAR and Meta Pool reads to the same finalized block.
- Reads `linear-protocol.near.get_account_details`. For a positive mature balance,
  checks `is_paused` and `can_account_withdraw` with the exact amount at that block.
- Reads `meta-pool.near.get_account`. For a positive mature balance on a regular account,
  checks `get_contract_state` for enough reserved withdrawal funds and contract balance
  including the contract’s possible dust sweep, at that block.
- Identifies Meta Pool lockup accounts separately instead of sending them through a
  regular wallet withdrawal flow.
- Routes owners to the official LiNEAR account page or Meta Pool dashboard for wallet
  connection and withdrawal; includes account copy and a return/recheck action.
- Treats RPC failures as unknown, never as zero. A failure in one protocol does not hide
  a successful result from the other. Zero and pending are shown separately.
- The public example is a fresh read of ru.near, not a recorded or invented balance.

## Limits

Only LiNEAR and Meta Pool are checked. No estimate of missing funds in other protocols,
no claims that the owner forgot, and no account-age claim. All accounts and balances are public.
The public leaderboard contains LiNEAR only and says so wherever it appears.
A view preflight is a snapshot, not a guarantee a future transaction succeeds.
FOUND never connects a wallet, holds funds, signs transactions, or charges a fee.
Withdrawals happen in the official protocol apps or through the appropriate lockup contract;
no real withdrawal was sent in QA.

The page sends the entered public account to two public RPC providers for resilience.
It has no analytics, application backend, or account database. Typography loads from
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

## Public leaderboard

The Waiting room lists all 538 matured LiNEAR balances above 0.01 NEAR, ordered by amount from the verified
9 November 2026 snapshot at block 223800610. It includes the largest account and
discloses its concentration. This snapshot is not automatically refreshed and
is not labelled lost or abandoned money. It uses ten accounts per page, numbered navigation, and Previous/Next controls. Clicking an account performs a live
scan of both protocols and the relevant withdrawal preflights. Sources are public on-chain account state.

Run `npm run census -- --block 223800610 --check` to independently regenerate and verify the complete snapshot without changing it. The generator reads every LiNEAR account at one pinned block and rejects incomplete pages or mixed block heights. See [RESEARCH.md](RESEARCH.md) for the source methodology, inclusion rule, Meta Pool validation, and write/update commands.

## Visual direction

Original generated pixel-art scene, integrated with a dark navy, violet and amber
interface. The clean background plate and small sprite strips animate the lantern
spirit and wallet with a gentle float, blink and nod. Reduced-motion preferences
disable all character motion and ambient fireflies. Financial checks remain read-only and use official protocol handoffs.
