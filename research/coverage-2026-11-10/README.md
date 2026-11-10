# Additional claimable NEAR: verified opportunities

Investigated 10 November 2026. Mainnet snapshot: **223,971,985**. This is read-only research, not added production support and not a record of successful withdrawals.

## Recommendation

Add **rNEAR delayed withdrawals first**, then **standard validator-pool withdrawals**. Both fit FOUND’s existing promise and have concrete balances outside its current coverage. Rhea/Ref internal wrapped NEAR is a worthwhile subsequent adapter. Refundable storage can be an optional small-balance section. Do not advertise bridge recovery until a specific transfer has been traced through its actual claim path.

The individual withdrawal features already exist in protocol apps and staking tools. FOUND’s contribution would be discovery and consistent guidance across them, not inventing a new withdrawal mechanism. [NEAR DevHub’s staking app](https://github.com/NEAR-DevHub/near-staking) already discovers validator positions with FastNEAR and supports wallet withdrawals.

## What was actually found

| Source | Evidence at the recorded block | Coverage decision |
| --- | --- | --- |
| rNEAR (`lst.rhealab.near`) | **124 mature balances above 0.01 NEAR**, totaling **18,890.147230 NEAR**, in **12,700 of 18,630 registered accounts read**. The largest three passed the exact-amount `can_account_withdraw` view; `is_paused` was false. | Strong third protocol. Amount and count are a partial-sample lower bound for matured balances, not a complete census or a guaranteed aggregate payout. |
| Validator pools | `within4d45.near` has **55.479433 NEAR** at `shitzu.pool.near` and **5.788036 NEAR** at `meteor.poolv1.near`: **61.267469 NEAR** outside FOUND’s two existing adapters. Both `get_account.can_withdraw` and `is_account_unstaked_balance_available` were true. | Strong expansion; requires pool discovery plus contract/version-specific withdrawal validation. |
| Rhea/Ref exchange balance | `lb3.near` has **1,000 wNEAR** under `get_deposits` at `v2.ref-finance.near`. The frozen-token list was empty. The exchange’s wNEAR holdings exceeded this balance. | Worth a separate “Exchange balance” adapter. It is wrapped NEAR held inside the exchange, not native NEAR already in the wallet. |
| Rhea/Ref available storage | Seven of ten sampled accounts returned positive `storage_balance_of.available`, totaling **0.1373 NEAR**. Largest example: `root.near`, **0.0975 NEAR** available. | Optional refunds section. Only `available` is counted; occupied storage is excluded. |

These balances may be intentional. No claim is made about abandonment, last use, how long the money has remained, or the total across the NEAR ecosystem. No token prices or dollar savings were estimated.

### rNEAR examples

| Account | Mature NEAR shown by contract | Exact-amount preflight |
| --- | --- | --- |
| `deportivo.near` | 10,651.535901 | Passed |
| `rektdegen.near` | 2,175.400970 | Passed |
| `rektpleb.near` | 1,202.876389 | Passed |

Amounts above are truncated for readability; raw yoctoNEAR is preserved in `rnear-partial.json`. A successful void-returning `can_account_withdraw` returns an empty result; that was treated as success, not a JSON parse failure. Only these three amounts received this extra preflight; the 124-entry list is based on positive amount plus the contract’s maturity flag.

Enumeration used a single pinned block, with exact page-length checks. Pages of 1,000 and then 500 exceeded the view gas budget. A final run with 100-account pages read indices 0–12,699; index 12,700 with limit 100 repeatedly returned `HostError(GasLimitExceeded)`. The error is preserved in `sample.json`. There was no extrapolation, no merging blocks and no substitution of zeros. The remaining 5,930 accounts are unmeasured. Individual account queries and the three preflights still worked at that block, so this limits census enumeration, not the tested individual-account workflow.

Official [rNEAR SDK](https://github.com/rhea-finance/rnear-sdk) documents explicit withdrawal after delayed unstaking. The [account implementation](https://github.com/ref-finance/rnear-contract/blob/main/contracts/lst/src/account.rs) checks the amount, unlock epoch, contract balance and reserve; the internal withdrawal is pause-controlled. [View source](https://github.com/ref-finance/rnear-contract/blob/main/contracts/lst/src/view.rs) exposes the preflight. Before production support, verify the deployed version/code hash against the adapter; this investigation did not prove a reproducible build match.

### Validator pools

[FastNEAR account staking discovery](https://docs.fastnear.com/api/v1/account-staking) supplied 21 account/pool relationships across ten selected public accounts. This is a convenience sample, not random or representative. Every balance came from a direct contract query at the pinned block; the indexer was used only for discovery.

Both positive pools had sufficient liquid account balance for the observed individual withdrawal, even after subtracting the observed storage usage at 10^19 yoctoNEAR per byte. This is a snapshot sanity check, not transaction execution or a guarantee against intervening changes.

The [standard pool implementation](https://github.com/near/core-contracts/blob/master/staking-pool/src/lib.rs) supports `get_account`, `is_account_unstaked_balance_available`, `withdraw({amount})` and `withdraw_all`. An adapter should use exact-amount withdrawals, ownership checks, fresh readiness, and full receipt verification. Do not trust a `.poolv1.near` suffix or arbitrary indexer record as proof that custom code is supported. Start with explicitly verified pool implementations. Lockup-owned stakes need the lockup contract’s path, not ordinary wallet signing.

### Rhea/Ref internal wNEAR

Official [exchange documentation](https://github.com/ref-finance/docs/blob/main/contracts/ref-exchange.md) distinguishes internal deposits from liquidity positions. `get_deposits` is the relevant balance; LP shares and supplied collateral are excluded.

The current official UI’s [withdraw builder](https://github.com/ref-finance/ref-ui/blob/main/src/services/creators/token.ts) sends `withdraw({token_id, amount, unregister:false, skip_unwrap_near:false})` with one yoctoNEAR. Its [wNEAR path](https://github.com/ref-finance/ref-ui/blob/main/src/services/wrap-near.ts) uses that builder and checks storage registration. The old separate `near_withdraw` transaction is commented out: we should follow the deployed protocol’s actual unwrap path, not assume an extra transaction is always needed.

Pre-integration work: inspect the deployed exchange version and pause controls, preflight registration/storage, verify native-NEAR payout and failure/refund receipts, and build an exact-amount adapter. This investigation verifies the 1,000-wNEAR balance and frozen-list status, not a completed redemption. The exchange contract source link in older docs currently returns 404; the official UI source alone is not a complete contract audit.

### Storage refunds

[NEP-145](https://github.com/near/NEPs/blob/master/neps/nep-0145.md) separates `total` from `available`. Use `storage_withdraw` for genuinely available deposits after verifying a specific contract’s behavior. Do not automatically call `storage_unregister`, force-unregister a user, or burn/remove their token positions to create a refund. Ordinary token balances and required registration deposits are not “found NEAR.” Gas must be visible so tiny refunds are not oversold.

### Bridges and other token positions

No specific pending bridge transfer with a verified claim/refund was established in this pass. [Rainbow Bridge’s client](https://github.com/aurora-is-near/rainbow-bridge-client/tree/main/packages/client) documents connector-specific, multi-chain transfer handling. A NEAR account balance lookup alone is not sufficient evidence of a claimable transfer. Defer this adapter until we have a real transaction and a verified remaining action. Active lending collateral, LP positions and normal wallet tokens are also outside this claim-only scope.

## Evidence and reproduction

- `sample.json`: ten selected public accounts, all 21 discovered pool relationships, per-protocol results, storage fields, readiness checks, balances, code hashes, block header and census gas-limit error.
- `rnear-raw-partial.json.gz`: all 12,700 account rows actually read, compressed; unique IDs and field shapes checked. The uncompressed SHA-256 is recorded in `rnear-partial.json`.
- `rnear-partial.json`: all 124 qualifying entries from the partial enumeration and three successful exact-amount preflights. It explicitly records `complete: false`.
- `probe.mjs`: read-only per-account probe. `node research/coverage-2026-11-10/probe.mjs` reads a new finalized block into `probe-latest.json`; an optional block number uses FastNEAR archival RPC. `FOUND_RESEARCH_RPC` can override endpoints. Historical lookup depends on provider access/retention.
- `sources/`: copies of the four official source files inspected, for review alongside the links above. These are research references, not app dependencies.

The legacy `rpc.mainnet.near.org` endpoint returned a deprecation/-429 response during debugging; successful evidence came from FastNEAR. FOUND’s primary RPC remained usable. A replacement for the legacy fallback should be verified as an operational follow-up before broader coverage.

## Small implementation sequence

1. Add the rNEAR adapter using the current exact-amount preflight and receipt model, with ready/pending/unknown states and no changes to the published LiNEAR-only leaderboard.
2. Add FastNEAR pool discovery, verify a bounded set of pool implementations, and display each confirmed mature balance with its source and individual withdrawal action. Preserve partial/unknown coverage explicitly.
3. Add the Rhea exchange wNEAR adapter after its unwrap/failure behavior is verified. Keep storage refunds optional and separate.
4. Re-run a broader measurement after adapters are correct. Update the demo’s coverage only after production support ships.
