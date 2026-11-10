# FOUND research and evidence

## Current scope

FOUND scans delayed withdrawals in LiNEAR (`linear-protocol.near`), Meta Pool (`meta-pool.near`), rNEAR (`lst.rhealab.near`), and up to 24 validator relationships discovered through FastNEAR. Balance checks run against the same finalized block. Source methods, deployed-code provenance, pause/liquidity rules and known limitations are in [coverage verification](research/coverage-expansion/README.md). Wallet approval and receipt verification are described in [direct withdrawals](verification/direct-withdrawals.md).

The separate public census reads all registered ledger IDs across three protocols and the two standard staking-pool factories. It includes **30,681 unique qualifying IDs**, from **305,908 distinct IDs checked**, across **858 recognized validator pools + 3 protocols**, at block **223975859**, 10 November 2026. Four unrecognized pool versions are excluded. [Complete evidence and derivation](research/census-2026-11-10/README.md).

- Inclusion: at least one source reports a matured unstaked balance strictly above 0.01 NEAR. Accounts appear once; their qualifying amounts are summed exactly.
- Total: **10,558,075.187594404327945091284701 NEAR**, shown as **10.55M**. A protocol’s own balance can represent the same NEAR as its users’ balances, so the gross sum can count the same money twice.
- **110 `.lockup.near` IDs**, **777,029.79408724816839127411321 NEAR**, are labelled Lockup and cannot withdraw directly in FOUND. This is a suffix classification, not an exhaustive account-code audit.
- This is not a count of people, proof of abandonment, guaranteed liquidity, net recoverable assets, or recovered money. Live scans recheck current availability.

## Reproduce

`npm run census:verify` validates the archived records and reproduces the checked-in table offline. `npm run census:expanded -- --block 223975859 --check` independently rereads the chain; it is slower, rate-limited, and may require archival RPC access. Full commands and evidence checks are in the [census README](research/census-2026-11-10/README.md).

`node scripts/verify-coverage.mjs --output /tmp/found-coverage.json` performs read-only live adapter verification. Public balances can change. Existing saved evidence is in [live-verification.json](research/coverage-expansion/live-verification.json).

## Historical research

- [Original LiNEAR and Meta Pool research](docs/history/2026-11-10-research.md), including the original 538-account LiNEAR snapshot and earlier Meta Pool census. Those counts are retained as dated source-specific evidence.
- [Initial coverage investigation](research/coverage-2026-11-10/README.md), recorded before rNEAR and standard validator pools were implemented. Its token and storage-deposit candidates remain outside current app coverage.
- [Earlier independent verification](docs/history/2026-11-10-two-protocol-verification.md), including accounting fixes and source references.

Research reference copies retain upstream authorship and licenses; see [credits](THIRD_PARTY_NOTICES.md).
