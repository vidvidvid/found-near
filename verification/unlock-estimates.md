# Optional unlock estimates — 11 November 2026

Pending cards can show an estimated local date/time and download a calendar reminder. The scan and withdrawal checks do not wait for this extra work and never use an estimate to authorize a withdrawal. A missing epoch, unsupported layout, failed RPC, changed amount or inconsistent timing sample leaves the existing “Still unlocking” message with no invented upper bound.

## Evidence

Live read-only checks on the owner's pending Meteor and Figment balances decoded unlock epochs **4961** and **4962**, respectively, while the current epoch was 4958. The decoded unstaked amounts exactly matched the public `get_account` balances at the same block. The browser showed both estimates, retained its fixed outer results footprint, and successfully downloaded a valid UTC `.ics` file. Local captures are kept with the pending-state demo material; no withdrawal occurred.

For the original standard-pool factory code only (`J1arLz48fgXcGyCPVckFwLnewNH6j1uw79thsvwqGYTY`), three narrow Intear state reads identify the account's UnorderedMap index, confirm its stored account ID, and decode the 40-byte value. The two u128 balances precede the u64 unlock epoch. Every query is pinned to the scan block; length, key and exact amount checks reject another account or layout. [Reference account struct and map prefix](https://github.com/near/core-contracts/blob/1b0436c96379c63aee7d2429c6d5d24019031ab8/staking-pool/src/lib.rs). Factory byte provenance is documented in [coverage verification](../research/coverage-expansion/README.md); this is not a reproducible-build claim. The second supported pool binary has no raw-state timing decoder yet.

LiNEAR and rNEAR expose `unstaked_available_epoch_height` through `get_account_details`. rNEAR also requires its recognized code hash before reading this optional field. Meta Pool's `get_account_info` exposes `unstaked_requested_unlock_epoch`; the amount and account must match, and its `can_withdraw` must still be false. [Meta Pool's reference source](https://github.com/Meta-Pool/liquid-staking-contract/blob/e9855e283fb167d5ad01fbc6b76cc86f8cce4182/metapool/src/lib.rs) uses that requested epoch for maturity. These public view fields were read on mainnet; positive pending end-to-end timing was verified for the two standard pools. Other protocol timing cases have fixtures, not a claimed real owner withdrawal.

## Estimate and calendar limits

The timer reads the scan block's header and protocol config, the current validator epoch/start, and a header 5,000 heights earlier. It measures elapsed time per height, then projects the remaining heights to the requested epoch. Inputs must be internally consistent: crossing an epoch boundary, an invalid sample, already-passed epoch or implausible duration suppresses the estimate. Epoch lengths and block production can change. Liquidity, pauses and actual transfer success remain separate checks.

Display and calendar times are rounded to 15 minutes, explicitly labelled estimates, and use the viewer's timezone / UTC calendar format respectively. The reminder asks the user to scan again; it does not initiate anything. Calendar files are created locally, with no email collection or reminder service. Importing the downloaded file into a calendar is up to the user.

`node --test tests/unlock.test.js` covers decoding failures, exact identity and amount checks, time arithmetic, unknown handling, calendar escaping, UTF-8 line folding and the reminder's qualified wording.
