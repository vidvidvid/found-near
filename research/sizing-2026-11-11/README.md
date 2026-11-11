# How big is this? Unwithdrawn unstaked NEAR is measurable, persistent and small

Every number below is printed by `npm run sizing:figures` (line labels in brackets) or by an existing verify command. Amounts are NEAR, truncated. There are no prices, dollar values or forecasts. The census is a dated snapshot of contract ledgers, not a claim about people.

## Claim

At NEAR mainnet block 223975859 (10 Nov 2026), NEAR that had finished unstaking but had not been withdrawn from LiNEAR, Meta Pool, rNEAR and 858 standard validator pools was 0.805% of total supply as a gross sum, and the part unchanged at every sampled date for 24 months was 0.184% of supply. This class is persistent but small: it does not change the staking ratio and moves any float figure by less than one percentage point, so it is evidence about NEAR's auditability and unstaking UX, not a driver of a long-term case for NEAR.

## Evidence for

- **It is measurable account by account.** One pinned block, 305,908 ledger accounts, 861 sources (3 protocols + 858 pools) [A1]. 30,681 accounts held a matured, withdrawable balance above 0.01 NEAR, totalling 10,558,075.18 NEAR gross [A2, A3]. `npm run census:verify` rebuilds this offline from archived RPC responses. NEAR's account-based ledgers, standard pool factories and archival block-pinned view calls make a complete census of this kind practical.
- **Its size against the denominators.** Total supply in the census block header: 1,311,369,673 NEAR [A4]; gross share 0.805% [A5]. Stake of the 338 validators active in the census epoch: 581,233,868 NEAR, 44.3% of supply [A6]; the gross listed amount equals 1.81% of that stake [A7]. These balances are not staked, so the staking ratio already excludes them. A float figure that counts them as circulating overstates movable supply by at most 0.805 percentage points, less identified and unidentified overlap.
- **Part of it persists.** In the 100+ NEAR cohort (2,963 accounts, 98.2% of the gross amount) [C1], balances unchanged at every sampled date [C2]: 12 months, 1,840 accounts, 3,920,190.03 NEAR (0.298% of supply); 24 months, 777 accounts, 2,416,897.95 NEAR (0.184%); 36 months, 353 accounts, 1,038,160.09 NEAR (0.079%). Among named accounts: 452 for 12 months, 304 for 24 months, 171 for 36 months.
- **Persistence differs by account kind.** Of the amount unchanged for 1 month, 82.5% of named-account NEAR was also unchanged for 24 months, against 14.3% of implicit-account NEAR [C4]. Balances held by implicit (64-hex) accounts turn over far more often than those held by named accounts.
- **Leaving it idle has a measurable cost to the holder.** Total supply rose from 1,219,595,904 NEAR on 10 Nov 2024 to the census figure, so a balance unchanged since then represented 6.99% less of total supply at the census; since 10 Nov 2023, 11.35% less [D1]. Withdrawing, then restaking or moving the NEAR, is the owner's remedy.
- **Most of the named accounts are plain-key accounts.** Of the 304 named accounts unchanged at every sampled date for 24 months, 261 had no contract code deployed at the census block and 43 had code; none were unknown (`npm run dormancy:code:verify`). All 43 carry one of two NEAR Wallet contracts, its two-factor multisig or the empty contract it deploys when two-factor is turned off; the hashes and how they were identified are in the [contract-code section of the history research](../dormancy-2026-11-11/README.md). No code does not prove an individual owner, and deployed code does not prove the owner is not a person.

## Evidence against, and limits of the data

- **Materiality.** 0.805% of supply gross, 0.184% for the 24-month group. Neither figure is large enough to move a valuation, supply or security argument for NEAR. This is the main reason the claim says "small".
- **Concentration.** The largest single account holds 24.5% of the gross amount and the top 10 hold 59.6% [B1, B2]. Accounts above 10,000 NEAR (90 of them) hold 78.74%; the 14,998 accounts between 0.01 and 1 NEAR hold 0.03% [B5]. Implicit accounts hold 66.38% of the gross amount [B3]; most large rows look like custodial or institutional holdings, which can wait deliberately.
- **One account drives the named 24-month figure.** The largest named 24-month account holds 888,703.50 NEAR, 48.5% of the named total; without it the named 24-month group is 940,848.90 NEAR, 0.071% of supply [C3]. At 36 months one account is 81.1% of the named total [C3].
- **Unchanged is not inactive.** Identical balances at six sampled dates are strong evidence of dormancy, not proof that nothing happened between samples. A balance can be left deliberately. The data cannot separate holder attrition from conviction or from custody policy, so neither reading is claimed.
- **Overlap.** The gross sum can count the same NEAR twice where a protocol's own balance backs its users' balances. Rows whose account is a staking-protocol contract total 537.38 NEAR [B4]; other overlap is not excluded.
- **Scope.** Only the three protocols and the two standard pool factories. Factory pools with unrecognized code, custom pools, other staking products and lockup internals are outside. The census may understate the class; the sampled history is conservative (79 pairs stopped on unrecognized historical code and 11 on failed code reads [C5]).
- **Evidence trust.** Archives are trusted-provider RPC responses, verified for consistency, not light-client proofs. The validator set [A6] was fetched on 11 Nov 2026 by census epoch ID. Total supply is the header `total_supply`, not a circulating-supply figure.
- **No causal UX evidence.** Nothing here shows why balances were not withdrawn, and no recovery has been measured.

## What would change my mind

- A pinned-block census with wider coverage (custom pools, other staking products, balances inside lockup contracts) finding matured, unwithdrawn NEAR at or above 2% of total supply. The class would then be material.
- A repeat census at a later block where the gross share rises above 1.5% of supply, or the 24-month group grows in NEAR, would mean the class is accumulating rather than stable.
- A repeat census where most of the 304 named 24-month accounts have changed would undo the persistence finding.
- An independent archival reread (`npm run census:expanded -- --block 223975859 --check`) that disagrees with the archive would void the figures.

The 2% and 1.5% thresholds are judgments, not measurements.

## Re-run

Node 24 (or 22.13+), `npm ci` once, then offline:

| Command | Expected output (excerpt) |
| --- | --- |
| `npm run census:verify` | `Verified archive: 30681 unique qualifying accounts from 305908 unique accounts, 858 supported pools + 3 protocols, block 223975859.` |
| `npm run dormancy:verify` | `Verified dormancy archive: 2963 accounts, 3703 account-source pairs, 6 historical dates; census block 223975859.` |
| `node scripts/sizing-figures.mjs` | `A5 gross listed as share of total supply: 0.805%` and every bracketed label above |
| `node scripts/sizing-figures.mjs --json` | The same figures as exact yoctoNEAR strings |

`sizing-figures.mjs` checks the dormancy archive digest, rebuilds the history buckets from the raw archived responses, matches them against the committed summaries, and binds the validator archive to the census header's epoch ID. To re-fetch the validator set (network): `node scripts/sizing-figures.mjs --fetch-validators [--rpc URL]`. Evidence: `research/census-2026-11-10/`, `research/dormancy-2026-11-11/`, `research/sizing-2026-11-11/validators-epoch.json.gz`, `dist/leaderboard.json`.
