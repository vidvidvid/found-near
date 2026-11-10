# FOUND research

## LiNEAR withdrawal census

The leaderboard is derived entirely from public NEAR mainnet contract state. No account labels, private data, third-party balance database, or inferred abandonment are used.

### Source and method

- Contract: `linear-protocol.near`; [account enumeration and readiness source](https://github.com/linear-protocol/LiNEAR/blob/main/contracts/linear/src/view.rs), [withdrawal source](https://github.com/linear-protocol/LiNEAR/blob/main/contracts/linear/src/stake.rs).
- Snapshot block: `223800610`, whose RPC block timestamp is 9 November 2026 UTC.
- RPC methods: `block` for the timestamp and `query` for `get_number_of_accounts` and `get_accounts`.
- Every account is read sequentially in pages of 1,000 with bounded retries. Every query specifies the same `block_id`; the generator rejects responses from another height and incomplete pages. The page size stays within the contract's view-call gas limit.
- RPC providers: historical regeneration tries [FastNEAR archival RPC](https://docs.fastnear.com/rpc) at `archival-rpc.mainnet.fastnear.com` and NEAR's public archival endpoint. Regular providers may prune old blocks; archival providers preserve the pinned historical state. Every provider is queried for the same block. Public archival tiers are rate-limited, so regeneration is deliberately sequential.
- Inclusion rule: `can_withdraw == true` and `unstaked_balance > 0.01 NEAR` (`10000000000000000000000` yoctoNEAR). Zero, pending, and exactly-at-threshold balances are excluded.
- Entries are sorted by `unstaked_balance` descending using BigInt comparisons. Equal amounts retain contract enumeration order.
- `staked_balance` is preserved as returned by the contract but is not included in the waiting amount.

At this block the contract reports 47,882 accounts. The method above yields 538 qualifying accounts. Their balances are matured according to LiNEAR; the snapshot does not claim that their owners forgot them or intend to withdraw.

### Exact regeneration

From the repository root, run:

```sh
npm run census -- --block 223800610 --check
```

This repeats the full mainnet census and compares the serialized result with `dist/leaderboard.json` without writing a file. A byte-for-byte match was verified on 9 November 2026.

To write the regenerated snapshot instead, run:

```sh
npm run census -- --block 223800610
```

To refresh the leaderboard, choose a finalized block and pass its height explicitly. All accounts and the timestamp then come from that one block. The generator writes atomically and leaves the existing snapshot untouched if a page or provider fails.

Optional `--output PATH` selects another JSON destination, and `--help` prints command usage.

## Meta Pool validation

Meta Pool was selected as the second protocol because its mainnet contract supports both direct account lookup and complete account enumeration. Its official application also exposes a wallet-based withdrawal action for completed delayed unstakes.

### Sources

- Mainnet contract: `meta-pool.near`; [official contract documentation](https://docs.metapool.app/master/for-developers/meta-pool-contracts/near-network).
- Contract source: [account and enumeration methods](https://github.com/Meta-Pool/liquid-staking-contract/blob/master/metapool/src/lib.rs), [withdrawal preconditions](https://github.com/Meta-Pool/liquid-staking-contract/blob/master/metapool/src/account.rs), [withdrawal implementation](https://github.com/Meta-Pool/liquid-staking-contract/blob/master/metapool/src/internal.rs).
- Official withdrawal workflow: [Meta Pool Dashboard](https://docs.metapool.app/master/meta-pool-ecosystem/dashboard) and [Delayed Unstake](https://docs.metapool.app/master/meta-pool-ecosystem/stake/delayed-unstake).
- User destination: `https://www.metapool.app/dashboard`.

### Balance discovery

`get_number_of_accounts` and `get_accounts` expose the same census fields needed for LiNEAR research: `account_id`, `unstaked_balance`, `staked_balance`, and `can_withdraw`. A complete pinned-block validation at block `223892176` read 21,018 accounts and found 457 positive unfinished balances: 455 mature and two pending. This validation informed the live integration; it is not presented as a second public leaderboard.

For an individual scan, FOUND first confirms that the NEAR account exists, then reads both protocols at that account-view block. Meta Pool uses `get_account`, which also returns a well-formed zero result for an unregistered protocol account. RPC or decoding failures remain unknown rather than becoming zero.

### Withdrawal readiness

For a positive balance, FOUND applies these rules in order:

1. `can_withdraw == false` means pending.
2. An account ending in `.lockup.near` is marked as requiring its lockup contract. The regular Meta Pool dashboard handoff is not presented as compatible with that workflow.
3. For a regular account, `get_contract_state` is read at the same block. Both `retrieved_for_unstake_claims` and `contract_account_balance` must be at least the account’s exact `unstaked_balance` before FOUND shows ready.

The reserve requirement comes from `in_memory_try_finish_unstaking`; the contract-balance requirement covers the subsequent native transfer. Missing fields, RPC errors, and insufficient liquidity produce an unavailable result with the balance preserved. Staking pause state is not used because Meta Pool’s delayed-unstake withdrawal method does not require unstaking or staking to be unpaused.

These are read-only snapshot checks, not transaction simulations or guarantees. No withdrawal transaction was sent during validation. Live checks confirmed a mature balance for `lb3.near`, a pending balance for `41a5bf8e8abcd00bd7b9081e944c51c5407bdb7cff80eb64b8ad6543a34dea3e`, and zero for `ru.near`; future scans may differ.
