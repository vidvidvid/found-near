# Sampled balance history — 11 November 2026

**304 named accounts** in the 100+ NEAR cohort had at least one balance unchanged and withdrawable at every sampled date from **10 Nov 2024** through the census on **10 Nov 2026**. Those qualifying source balances total **1829552.415900001658677150756549 NEAR**. Named accounts can be contracts; this is not a count of people or evidence that the money was forgotten.

## Reproduce

Run `npm run census:verify`, then `npm run dormancy:verify`. Both run offline after install. The first verifies the original census archive; the second rebuilds every history bucket and row from [archived RPC responses](archive.json.gz), checking its [summary](summary.json) and archive digest in [run metadata](run.json). These are consistency checks of trusted-provider RPC evidence, not cryptographic light-client proofs. See the [exact verifier output](verification.txt). A [cached resume test](resume-verification.json) with an unreachable RPC endpoint reproduced the identical summary in 55 seconds with zero requests.

Fresh independent reads: `DORMANCY_RPC=https://archival-rpc.mainnet.fastnear.com npm run dormancy:scan -- --cache-dir /tmp/found-independent-history --output /tmp/found-independent-history-output`. The public archival service is limited; budget substantial time, respect backoff, or use an authorized archival endpoint. The script never signs transactions. `DORMANCY_INTERVAL_MS` controls minimum spacing (default 2,000 ms); four workers share one limiter.

## Cohort and method

The immutable census at block **223975859** contains 30,681 qualifying account IDs. This analysis selects only the **2,963** whose summed census balance is at least 100 NEAR: **3,703 account-source pairs**. Smaller accounts were not analysed. Individual sources in a selected account may be less than 100 NEAR; the original per-source threshold remains above 0.01 NEAR. The cohort includes 662 named, 2,238 implicit, 1 ethereum, 62 lockup account IDs.

Each pair starts with its exact matured census amount and walks backward through the dates below. It qualifies at a date only if its exact unstaked amount matches and `can_withdraw` is true there and at every more-recent sample. The first changed, zero, pending or unknown sample stops that pair. An account counts once in each bucket even if several sources qualify; only qualifying sources are summed. Buckets overlap and must not be added together.

Reads use `get_account` / `get_account_details`. For crowded standard pools, `get_accounts` pages supply the same fields more efficiently; the reviewed [reference implementation](https://github.com/near/core-contracts/blob/1b0436c96379c63aee7d2429c6d5d24019031ab8/staking-pool/src/lib.rs) maps those pages through `get_account`. Every selected record must match the account ID, with unique page IDs, exact page length, valid unsigned amount and boolean maturity. A missing page row triggers an individual read, never a presumed zero. Repeated page responses are archived once by SHA-256 reference. Pinned header height/hash checks apply to code, pages and individual views.

Historical standard-pool code must match one of the two reviewed factory binaries. Historical protocol code must match that protocol's census-block code. A different unreviewed version, missing contract, failed view or unexpected shape is unknown, not evidence that no money was present. This conservative restriction can understate age. The pool/code gates used for historical interpretation do not authorize new withdrawal adapters.

## Dated ladder

Calendar-month targets were located using actual block-header timestamps, with the selected block at or just before each target. No fixed historical block time is assumed.

| Months before census | Block | UTC timestamp | Hash |
| --- | --- | --- | --- |
| 1 | 219435381 | 2026-10-10T22:01:35.947Z | `74ZNzNnukymSbgXmAhMgSGS7PE74duvPdDikQUrZSv3Q` |
| 3 | 210792528 | 2026-08-10T22:01:35.483Z | `EKE3eND7hMq4V7HtJLt4ftWNhSsmRv9L4aUMVL1KxZst` |
| 6 | 197778871 | 2026-05-10T22:01:35.671Z | `2yrwWLjzBzRjeoionAMYCZzALX4HKthZDsQitHULhf9K` |
| 12 | 172093189 | 2025-11-10T22:01:35.438Z | `2g5oLvJryyc7D9A3pPPeriymMTmcnh7SoKn27v412yVW` |
| 24 | 132407698 | 2024-11-10T22:01:35.404Z | `9gCYCWmR7oAYkoExJxcfmYVHmB4eLJ4MG7NbpaWYF4FS` |
| 36 | 105404736 | 2023-11-10T22:01:35.157Z | `7cfgeWXU2aRzo78QRd1G8ZYULSppxJPq15iMvsoVif57` |

## Results

`implicit` means 64 lowercase hex characters; `ethereum` is the distinct 0x-prefixed NEAR account form; `lockup` is the .lockup.near suffix. Other valid IDs are `named`, which can include contracts, custodians and protocols. These labels do not establish beneficial ownership.

| At least months | Account kind | Unique IDs | Qualifying pairs | Gross NEAR (exact) |
| --- | --- | ---: | ---: | ---: |
| 1 | named | 574 | 802 | 2217394.126133345201155097879623 |
| 1 | implicit | 2,012 | 2,474 | 2251019.859897549319964583126549 |
| 1 | ethereum | 0 | 0 | 0 |
| 1 | lockup | 55 | 55 | 737784.974596945605152636128509 |
| 3 | named | 510 | 714 | 2148854.558600970006628131517813 |
| 3 | implicit | 1,712 | 2,119 | 1609458.417538592868702724208575 |
| 3 | ethereum | 0 | 0 | 0 |
| 3 | lockup | 54 | 54 | 727371.756286981064466052026271 |
| 6 | named | 487 | 686 | 2127497.134417952300760205779176 |
| 6 | implicit | 1,571 | 1,959 | 1472976.181271820493254218291891 |
| 6 | ethereum | 0 | 0 | 0 |
| 6 | lockup | 53 | 53 | 727257.772395385952550877147078 |
| 12 | named | 452 | 639 | 2047553.785691784800678910396534 |
| 12 | implicit | 1,338 | 1,686 | 1282928.889038928772477426031023 |
| 12 | ethereum | 0 | 0 | 0 |
| 12 | lockup | 50 | 50 | 589707.360601350420252360505449 |
| 24 | named | 304 | 435 | 1829552.415900001658677150756549 |
| 24 | implicit | 431 | 568 | 323810.224921300003462768723104 |
| 24 | ethereum | 0 | 0 | 0 |
| 24 | lockup | 42 | 42 | 263535.312377430624939812041142 |
| 36 | named | 171 | 245 | 742382.693157632430128235326566 |
| 36 | implicit | 151 | 191 | 59387.247067584686675926416872 |
| 36 | ethereum | 0 | 0 | 0 |
| 36 | lockup | 31 | 31 | 236390.156067147632980615637942 |

## Concentration and balance size

These figures aggregate only the qualifying old sources per named account. A more recent balance in another pool does not help an account cross the 100 NEAR threshold here. The original cohort threshold was the full census total; this second check measures the old balance itself. [Recomputed distribution](distribution.json).

| At least months | Named accounts with at least 100 old NEAR | Largest account's share of named sum | Named gross NEAR excluding that account |
| --- | ---: | ---: | ---: |
| 1 | 574 | 40.07% | 1328690.617628908258403753353819 |
| 3 | 509 | 41.35% | 1260151.050096533063876786992009 |
| 6 | 485 | 41.77% | 1238793.625913515358008861253372 |
| 12 | 450 | 43.40% | 1158850.27718734785792756587073 |
| 24 | 299 | 48.57% | 940848.907395564715925806230745 |
| 36 | 170 | 81.10% | 140293.205382207513392929176747 |

The amount is concentrated: use the qualified account count as the headline, not a claim that the whole gross total belongs to ordinary individual users. Named accounts may be contracts or institutions, and removing the largest account does not eliminate possible reserve overlap.

## Stops and limits

- changed: 2,530 pairs.
- oldest-sample: 467 pairs.
- zero: 589 pairs.
- unknown:code-version: 79 pairs.
- unknown:code-read: 11 pairs.
- pending: 27 pairs.

**90 pairs stopped on unknown evidence.** Their more-recent qualifying samples remain valid; nothing older is inferred. Recorded provider error causes: code read: UNKNOWN_ACCOUNT (11). Code-version stops are intentional interpretation limits, not RPC outages. The full cohort still has a recorded stopping outcome, including unknown. These are sampled balances: withdrawals and replenishment could occur between checkpoints, and unchanged balances may be intentional. There is no causal proof of wallet UX, no confirmed lost-money total, and no recovery claim.

Gross sums may include overlapping protocol reserves. Lockups require a different withdrawal path. Historical maturity is not current pool liquidity, pause status, account existence or a promise a transaction will succeed. Recheck live and verify the owner-signed receipt separately.

## Run accounting

The final resumed pass made **4,116 outgoing RPC attempts**, reused **401 request-cache hits**, and observed **29 rate-limit responses**, over **10,058 seconds**. It reused earlier FastNEAR/NEAR archival reads and completed pair checkpoints. These counters describe that pass, not every exploratory probe or interrupted setup attempt. The archive contains the actual evidence needed by the verifier; caches are only an optimization. Setup probes and interrupted runs were not all timed or counted, so no invented whole-investigation RPC total is reported.

The initial three-account probe was independently reproduced: two amounts matched July 2024 and the census exactly, while the third differed (its earlier balance was 1 yoctoNEAR, not literally zero). The ladder above, not that exploratory probe, defines the published buckets.

## Contract code at the census block

Named accounts can be contracts. To measure how many are, `view_account` was read for every one of the **574** named accounts with any qualifying source (the 1-month group, which contains every longer group), pinned to census block **223975859** (`Fh9a2RkBMC3ZPcadGorbh49VHBaGmfNrJbZJiGbQsCgE`). The block header hash is checked against the census, and each response must carry that exact height and hash. A `code_hash` of `11111111111111111111111111111111` means no contract is deployed. A missing account, RPC error, malformed response or response from another block is **unknown**, never "no code". Dormant amounts are the same qualifying-source sums as the table above, so each row splits the published named bucket exactly.

| At least months | Named accounts | No contract code | NEAR (exact) | Has code | NEAR (exact) | Unknown |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 12 | 452 | **394** | 1970086.989716709973311801445571 | 58 | 77466.795975074827367108950963 | 0 |
| 24 | 304 | **261** | 1774340.109078870881779314914212 | 43 | 55212.306821130776897835842337 | 0 |
| 36 | 171 | **145** | 714908.238041362187047574411997 | 26 | 27474.455116270243080660914569 | 0 |

The 1, 3 and 6-month splits are in [code-summary.json](code-summary.json) (502 / 446 / 426 no code). All 574 reads returned a pinned, well-formed result, so there are no unknowns in this run.

Only four distinct code hashes appear. Labels were assigned only where the hash was independently reproduced:

| Code hash | Accounts (12 / 24 / 36 mo) | What it is, and how verified |
| --- | --- | --- |
| `E8jZ1giWcVrps8PcV75ATauu6gFRkcwjNtKp7NKmipZG` | 32 / 21 / 7 | NEAR Wallet's 86-byte **empty contract**. It exports no callable methods (only `memory`, `__data_end` and `__heap_base`). Equal to base58(sha256) of `packages/frontend/src/wasm/main.wasm` in `near/near-wallet` (master `98b2cf9d92d7bfe347fdef1fe32b1d4915653b09`), which `twoFactorBase.js` deploys when a user disables two-factor authentication. The accounts' `storage_usage` (for example 268 = 182 + 86) is consistent with this size. |
| `55E7imniT2uuYrECn17qJAk9fLcwQW4ftNSwmCJL5Di` | 25 / 22 / 19 | NEAR Wallet **two-factor (2FA) multisig**. Equal to base58(sha256) of `packages/frontend/src/wasm/multisig.wasm` at the same commit, which `deployMultisig()` deploys when a user enables 2FA. |
| `EV4eXNuKVkcYisktcT4sk9XfFFRvcefy51Qs2hQkhnK1` | 0 / 0 / 0 (2 at 1 and 3 mo) | veNEAR lockup. Equal to `lockup_contract_config.contract_hash` returned by `venear.dao` `get_config` at the census block (one read-only call, not part of the archive). Both accounts are `<hex>.venear.dao`. |
| `4zSoHkLjJWZm34Psd4Eq2WUXHELt6LxtKmUXpsZWAECp` | 1 / 0 / 0 | Not labelled. Its one account is `neat.sputnik-dao.near`. The hash is **not** the factory's current default (`sputnik-dao.near` `get_default_code_hash` returned `DtHZA1mUmGYeScEaUoUZYQGGFHSMpnjMCvkr5U9hJXuF` at the census block). |

A matching hash proves byte-identical code. It does not prove who deployed it. On these figures, most "has code" accounts carry NEAR Wallet artifacts that were deployed to personal accounts (57 of 58 at 12 months, all 43 at 24, all 26 at 36), not DAOs or exchange contracts. Core-contract builds from `near/core-contracts` master (multisig, multisig2, lockup, staking-pool, voting, whitelist, multisig-factory) matched none of the observed hashes.

**Limits.**

- "No contract code" does not prove that an individual controls the account. A company, custodian, validator operator or protocol can hold a plain key, and several of the largest no-code balances sit on names that read as service or operator accounts.
- "Has contract code" does not prove that the owner is not a person: the wallet artifacts above are exactly that case.
- The code hash is read at the census block, not at the historical sample dates, so code deployed or removed in between is not seen.
- The no-code NEAR totals inherit the concentration described above: one no-code account holds about 40% of the 1-month named sum.

The check narrows the "named accounts can be contracts" objection. It does not settle who owns the balances.

Reproduce offline: `npm run dormancy:verify`, then `node scripts/verify-dormancy-code.mjs`. The second command recomputes [code-summary.json](code-summary.json) from [code-archive.json.gz](code-archive.json.gz) and the dormancy `summary.json`, which it binds by SHA-256. It makes no network requests and finishes in under a second. Fresh reads: `DORMANCY_RPC=https://archival-rpc.mainnet.fastnear.com node scripts/scan-dormancy-code.mjs --cache-dir /tmp/found-independent-code --output /tmp/found-independent-code-output`. The original pass ([code-run.json](code-run.json)) made **583 outgoing requests** (1 block header, 574 `view_account` reads and 8 retries after rate-limit responses) with 0 cache hits, over **1,063 seconds** at 1,000 ms spacing. A resume from that cache with an unreachable endpoint made 0 requests and reproduced the identical summary.
