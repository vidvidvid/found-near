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
