# FOUND

A small read-only finder for unfinished LiNEAR withdrawals on NEAR mainnet.

## Run

`npm run dev` serves `dist/` on http://127.0.0.1:8084.
`npm test` verifies the financial-state logic using deterministic RPC fixtures.
No dependencies or build step are required.

## What it does

- Accepts a named or implicit NEAR account; confirms the account exists.
- Reads `linear-protocol.near.get_account_details` at finalized state.
- For a positive mature balance, checks `is_paused` and `can_account_withdraw`
  with the exact amount at the same block before showing ready.
- Routes the owner to https://app.linearprotocol.org/account for wallet connection
  and withdrawal; includes account copy and a return/recheck action.
- Treats RPC failures as unknown, never as zero. Shows zero and pending separately.
- The public example is a fresh read of ru.near, not a recorded or invented balance.

## Limits

Only LiNEAR is checked. No estimate of missing funds in other protocols, no claims
that the owner forgot, and no account-age claim. All accounts and balances are public.
A view preflight is a snapshot, not a guarantee a future transaction succeeds.
FOUND never connects a wallet, holds funds, signs transactions, or charges a fee.
Withdrawal happens in the official LiNEAR app; no real withdrawal was sent in QA.

The page sends the entered public account to two public RPC providers for resilience.
It has no analytics, application backend, or account database. Typography loads from
Google Fonts with local fallbacks. Amount calculations use BigInt, with exact values
preserved and a truncated display (never rounded up).

## Verification

Seven unit tests cover pinned preflight, zero, pending, paused, unavailable, missing
accounts, precision and validation. Browser QA verified live ru.near and empty
 treasury.linear-protocol.near results, withdrawal dialog, official destination,
and desktop/mobile layout. Mainnet balances change; no values are hardcoded.
