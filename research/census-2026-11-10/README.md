# Expanded staking census — 10 November 2026

**30,681 unique account IDs** have at least one matured withdrawal balance above 0.01 NEAR within the scanned scope. This is a dated contract-ledger snapshot, not proof that funds are forgotten or immediately transferable.

- Block: 223975859, hash Fh9a2RkBMC3ZPcadGorbh49VHBaGmfNrJbZJiGbQsCgE.
- Timestamp: 2026-11-10T22:01:36.060Z. Every query and state archive is checked against that height and hash.
- 305,908 unique ledger account IDs checked across 858 recognized validator pools and three staking protocols.
- Both factories contain 862 pools in total: 858 supported code versions, 4 excluded versions, 0 deleted accounts. Other factories/custom independent pools are outside this census.

| Source | Registered rows | Qualifying accounts |
| --- | ---: | ---: |
| linear-protocol.near | 47,882 | 538 |
| lst.rhealab.near | 18,630 | 225 |
| meta-pool.near | 21,019 | 435 |
| Validator pools combined | — | 29,627 unique |
| All sources combined | 305,908 unique | **30,681 unique** |

Source counts overlap; adding them would inflate the unique account total. Meta Pool's registered count includes one internal `..NSLP..` record, which is excluded from every account total. It is declared in [Meta Pool's types](https://github.com/Meta-Pool/liquid-staking-contract/blob/e9855e283fb167d5ad01fbc6b76cc86f8cce4182/metapool/src/types.rs) and used by its internal liquidity-pool accounting.

The table sums to **10,558,075.187594404327945091284701 NEAR**, displayed as **10.55M**. This gross listed total includes overlapping protocol reserves; it is not a total of unique lost assets or successful recoveries. All amounts are summed using exact integers.

## Inclusion and limits

Require `can_withdraw === true` and `unstaked_balance > 10000000000000000000000` yoctoNEAR **per source**. Zero, pending, exactly 0.01 and smaller source balances are excluded. An account with two 0.006 NEAR balances is therefore excluded. Qualifying source amounts are summed exactly with BigInt within each account, and accounts are sorted by amount then account ID. Each account appears once across all sources.

Account IDs include contracts and lockups; they are not a count of people. The census does not check each account's current existence, contract liquidity, paused state, ownership or withdrawal route. The live checker performs the adapter-specific preflight before offering a withdrawal. Some protocol reserves can back claims also listed under user accounts, so this dataset must not be summed into an advertised total of unique lost assets. A snapshot is not refreshed automatically.

## Enumeration

1. LiNEAR and Meta Pool: get_number_of_accounts followed by complete, pinned get_accounts pages of 500. Reject incomplete pages, duplicate IDs and invalid balances/maturity fields.
2. rNEAR: its public enumeration uses an iterator that exceeds view gas at high offsets. The full state at this block is archived instead. Decode all 18,630 near-sdk 5.14 IterableMap slots, validate the SHA-256 lookup key and stored index for each, then cross-check every amount above 0.01 against get_account_details at the same block. All 229 candidates are independently checked; small/zero rows retain null maturity because it was not queried. This is code-version-specific and guarded by the recognized rNEAR code hash.
3. Factories: decode the complete `se` vectors in poolv1.near (561) and pool.near (301). Validate every index, account ID and reported factory count. For each pool, read its deployed code hash. Enumerate only the two reviewed standard pool implementations; record all other versions explicitly.
4. Publish only when every factory entry is accounted for and no supported source has a read error. Deduplicate all qualifying IDs before displaying the count.

The rNEAR storage layout is documented in [near-sdk 5.14 IterableMap](https://github.com/near/near-sdk-rs/blob/near-sdk-v5.14.0/near-sdk/src/store/iterable_map/mod.rs). [Coverage verification](../coverage-expansion/README.md) records the exact supported code hashes and deployed-code provenance. No reproducible rNEAR source-build or cryptographic state-proof claim is made.

## Verify

`npm run census:verify` validates archived count replies, factory membership, rNEAR state/view agreement, code hashes, deduplication and the published JSON byte-for-byte. This is offline consistency verification of saved RPC evidence, not an independent live query.

`npm run census:expanded -- --block 223975859 --cache-dir /tmp/found-independent-census --check` rereads public RPC state. Allow several minutes and provider rate limits. Set CENSUS_RPC / CENSUS_STATE_RPC to suitable archival endpoints if public providers have pruned the block. Intear supplied the large state archives; dRPC/FastNEAR supplied pinned view calls. A resumable cache avoids repeating completed reads. Providers are documented in [NEAR's RPC list](https://docs.near.org/api/rpc/providers).

To produce a future snapshot, use a new finalized block and a fresh cache directory. Review the generated data and update the static HTML count/date and this evidence before deployment. Never present a partial scan as a complete total.

## Files

- raw-accounts.json.gz: all supported source records, including nonqualifying rows.
- metadata.json: scope, fixed block, exclusions and completion status.
- source-counts.json / factory-counts.json: pinned contract count replies.
- rnear-state.json.gz and rnear-views.json.gz: full map plus all 229 positive-candidate view replies.
- poolv1.near-state.json.gz / pool.near-state.json.gz: complete factory vectors.
- contract-codes.json.gz: pinned deployed-code hash replies.
- ../../dist/leaderboard.json: compact qualified rows and scope metadata served by the app.

No mainnet transaction was sent to create this snapshot.
