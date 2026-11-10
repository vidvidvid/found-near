# rNEAR and validator-pool verification — 10 November 2026

Implemented for FOUND after the earlier [coverage investigation](../coverage-2026-11-10/README.md). This is adapter verification, not a security audit or a successful mainnet recovery claim.

## Scope and readiness

- **rNEAR:** `lst.rhealab.near`. `get_account_details` supplies the exact account balance and maturity. A positive mature result requires `is_paused() === false`, `pa_is_paused({key:"internal_withdraw"}) === false`, successful void `can_account_withdraw({account_id,amount})`, the expected deployed code hash, and enough liquid balance after storage plus 0.01 NEAR execution reserve. The exact-amount `withdraw` uses zero deposit and the official SDK’s 200 TGas limit.
- **Validator pools:** discover relationships using FastNEAR’s account staking endpoint. Legacy rows really do have null heights despite the documented integer schema; these are accepted as unknown relationship age, not as maturity evidence. Account echo, identifiers and numeric heights are validated; duplicates and liquid-staking contract entries are removed. At most 24 pools, four concurrently; capped/future-indexed coverage is visibly partial. An indexer outage is not an empty result.
- For recognized pool code, `get_account` and `is_account_unstaked_balance_available` must agree on availability. Liquid account funds must cover the entire withdrawal, storage at 10^19 yoctoNEAR/byte, and a 0.01 NEAR execution reserve. Staked/locked funds are not counted as liquid. This conservative reserve can defer some otherwise valid withdrawals.
- Standard pool withdrawals use exact `withdraw({amount})`, zero deposit and 100 TGas. This only withdraws already-unstaked funds; FOUND never calls unstake or sells a liquid-staking token.
- Every result is pinned to one finalized block. Funds can change after the view; the wallet performs a fresh ownership/readiness/amount/code check before signing. Lockup accounts cannot use this direct wallet path.

## Contract provenance

Two pool code hashes are enabled:

| Hash | Evidence |
| --- | --- |
| `J1arLz48fgXcGyCPVckFwLnewNH6j1uw79thsvwqGYTY` | The deployed `meteor.poolv1.near` WASM is byte-for-byte embedded in the deployed `poolv1.near` factory. |
| `AjD4YJaXgpiRdiArqnzyDi7Bkr1gJms9Z2w7Ev5esTKB` | The deployed `shitzu.pool.near` WASM exactly matches `pool.near.get_code({code_hash})`. |

The verifier independently SHA-256/base58 hashes downloaded WASM. It does not assume that a `.pool.near` suffix proves behavior. Unknown implementations, including the observed `aurora.pool.near`, have no withdrawal button. Official reference source: [withdraw](https://github.com/near/core-contracts/blob/1b0436c96379c63aee7d2429c6d5d24019031ab8/staking-pool/src/lib.rs), [internal checks](https://github.com/near/core-contracts/blob/1b0436c96379c63aee7d2429c6d5d24019031ab8/staking-pool/src/internal.rs). Factory byte matching is deployment provenance; this work does not claim a reproducible source build of both historical binaries.

rNEAR is pinned to `EPLT4C61pkVYf5Km6dC4X9x5PMo6rfBwuEwo7vgKpmuv`. [Official SDK transaction builder](https://github.com/rhea-finance/rnear-sdk/blob/d26924151c58443f6a6d4892ff1b82ac6e7793cb/src/client.ts) agrees on exact amount and zero deposit. Reviewed public source: [account checks and transfer](https://github.com/ref-finance/rnear-contract/blob/341cd8c970895e1b6bcb433699b20253922d621d/contracts/lst/src/account.rs), [public interface](https://github.com/ref-finance/rnear-contract/blob/341cd8c970895e1b6bcb433699b20253922d621d/contracts/lst/src/stake_pool_itf.rs). The deployed NEP-330 metadata reports version 1.0.2 and commit c04e9008…, but its linked source revision returned 404. We have not reproduced that build. Known deployed code, live preflight methods and the SDK are the evidence used; a future code change disables withdrawals until reviewed.

## Reproduce and inspect

```sh
npm test
node scripts/verify-coverage.mjs --output /tmp/found-coverage.json
```

The second command is read-only: downloads deployed code, checks factory provenance and storage cost, scans five real public accounts, then independently repeats each new positive balance read through Intear at the exact same block. No keys or broadcasts. See [saved verification](live-verification.json).

Verified examples include:

- `deportivo.near`: 10,651.535901265475072115647348 NEAR at rNEAR and 813.990621000000000000000002 at Lonk’s validator pool.
- `within4d45.near`: 55.479433000000000000000002 at Shitzu and 5.788036000000000000000003 at Meteor, in addition to LiNEAR.
- `ru.near` and `lb3.near`: regression checks for existing LiNEAR and Meta Pool behavior.
- `root.near`: a 1-yoctoNEAR validator remainder is treated as a tiny balance in the UI, not a prominent recovery opportunity. Tiny balances stay inspectable and actionable, with a fee qualification.

These are current availability examples, not evidence of abandonment or age. The later [expanded census](../census-2026-11-10/README.md) completed rNEAR enumeration and the standard factory-pool inventory. The public leaderboard now contains 30,681 deduplicated accounts across three protocols and 858 recognized pools; the old 538-account LiNEAR snapshot is preserved separately.

## Verification coverage

44 tests cover prior behavior plus rNEAR pause/method-pause/liquidity/code checks, standard-pool maturity/liquidity/code checks, null indexer heights, malformed identities, duplicates, caps, outages, cancellation, independent pool failures, exact transaction targets, reload-safe pending metadata, changed code/amount rejection, and failure/incomplete/mismatched receipt handling.

Browser QA uses actual mainnet views separately from a clearly labeled local wallet simulator. The simulator verified rNEAR approval at the correct contract and amount with 200 TGas/zero deposit, successful complete-receipt confirmation and balance refresh; a downstream validator transfer failure produced failure rather than success. No real owner-signed withdrawal was performed. A mainnet owner should approve and document the first real recovery before claiming one.

The result card keeps its previous desktop footprint (454px) before and after search. Only its result list scrolls. Positive balances lead; empty sources and tiny balances are expandable. A 390px responsive frame was checked without horizontal overflow. Existing artwork, blur validation, explicit refresh, and repeated-search reuse are retained.

## Remaining limits

Discovery may omit recent or unindexed relationships. Unknown custom contracts and lockups need additional adapters. No tokens, bridges, Ref deposits, wNEAR unwrapping, or other chains are implemented. Native-pool views do not simulate the full asynchronous transaction or future epoch changes; final receipt verification remains mandatory. Public RPC/indexer dependencies can fail.

FastNEAR and Intear replace the retired `rpc.mainnet.near.org` fallback; both returned valid live mainnet reads, and browser scans verified the integrated flow. [Provider list](https://docs.near.org/api/rpc/providers), [discovery API](https://docs.fastnear.com/api/v1/account-staking).

Next validation, agreed with the user: one external-chain recovery plus optional NEAR Intents consolidation, compared with its best existing tool and net of fees. No all-chain coverage claim.
