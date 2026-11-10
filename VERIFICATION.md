# Independent verification — 10 November 2026

Reviewed the implementation introduced in commit `7255178`, then corrected the gaps below. This is a source review and read-only verification, not a smart-contract security audit or a successful owner withdrawal.

## Results

- `npm run census -- --block 223800610 --check` passed on the original code and again after stricter validation: **47,882 accounts, 538 qualifying balances, byte-for-byte match**. The checked-in snapshot was not modified.
- Independently reran Meta Pool enumeration at block `223892176`: **21,018 accounts, 457 positive unfinished balances, 455 mature and 2 pending**. This matches the prior research. Pages of 500 were checked for length, pinned height, and unique account IDs. Archival rate limits required a slower retry; final totals are in [verification/metapool-census-2026-11-10.json](verification/metapool-census-2026-11-10.json).
- Snapshot SHA-256: `6c90c76d52e12cc86863f9a4da4608b9ed70d23f8ba1c3859d932ae6a4a371a7`.
- `npm test`: **22/22 passing**, including new regression cases.
- Live reads: `ru.near` has 500.307262171597331335415343 NEAR in LiNEAR; `lb3.near` has 17502.40105 NEAR in Meta Pool. Both pass their respective readiness checks. `treasury.linear-protocol.near` has zero unfinished unstake balance in both protocols.
- The earlier pending Meta Pool example (`41a5bf8e8abcd00bd7b9081e944c51c5407bdb7cff80eb64b8ad6543a34dea3e`) is now mature. Do not use it to promise a pending-state demo. Pending logic is covered by fixtures.
- Raw live evidence and block identities are in [verification/live-2026-11-10.json](verification/live-2026-11-10.json). These are dated observations, not current balances.

## Findings fixed

1. **Real NEAR accounts were rejected.** The input validator explicitly rejected 0x plus 40 hex characters. NEAR supports Ethereum-style implicit accounts; six qualifying accounts in the existing leaderboard have that format. Removed that rejection and misleading error text. Confirmed `0x9fbbf4b8330dedc4dbcbca778c8a21bbd25cffbc` exists on NEAR and passes a live LiNEAR check for 1.000000000000000000000001 NEAR at block 223949199. No EVM network scanning was added. The NEAR existence check remains mandatory.
2. **Meta Pool's possible payout exceeded the checked amount.** `take_from_available` can sweep an existing available balance up to and including 0.001 NEAR. Added an available-balance read, exact integer payout checks, and total-claim/total-available accounting checks. Test cases cover the inclusive threshold and insufficient reserve/balance/accounting totals.
3. **Pinned requests did not validate returned block identity.** RPC now rejects missing identities and mismatched requested heights/hashes before selecting a provider result. The census checks every result against its pinned block header's height and hash.
4. **Census accepted duplicate or malformed records.** Added unique-account checks, boolean maturity validation, and string-encoded unsigned 128-bit balance validation. Added genuinely incomplete-page and mismatched-header tests; the previous test title claimed incomplete-page coverage without testing that case.

## Meta Pool source review

Read the official repository at commit `e9855e283fb167d5ad01fbc6b76cc86f8cce4182`:

- [withdraw_unstaked and get_account](https://github.com/Meta-Pool/liquid-staking-contract/blob/e9855e283fb167d5ad01fbc6b76cc86f8cce4182/metapool/src/lib.rs): maturity is an epoch comparison; ordinary withdrawals reject lockup accounts. The withdrawal path does not assert staking-pause or contract-busy state.
- [in_memory_try_finish_unstaking and take_from_available](https://github.com/Meta-Pool/liquid-staking-contract/blob/e9855e283fb167d5ad01fbc6b76cc86f8cce4182/metapool/src/account.rs): reserve, total claims, available accounting, and possible dust sweep.
- [is_close and lockup detection](https://github.com/Meta-Pool/liquid-staking-contract/blob/e9855e283fb167d5ad01fbc6b76cc86f8cce4182/metapool/src/utils.rs): the 0.001 NEAR boundary is inclusive.
- [internal withdrawal and native_transfer](https://github.com/Meta-Pool/liquid-staking-contract/blob/e9855e283fb167d5ad01fbc6b76cc86f8cce4182/metapool/src/internal.rs): account accounting is updated before scheduling a native transfer.
- [NEAR account model](https://github.com/near/nearcore/blob/master/docs/DataStructures/Account.md): Ethereum-style implicit account IDs.

Mainnet self-identifies as Meta Pool 2.0.0 with this repository as its source. The observed deployed code hash at block 223949021 was `J6pS9R23vzbwxGB8eMq4qrn8UhciEYHsVbR9UJPyLNxh`. **The source was not rebuilt to establish byte-for-byte equivalence with deployed WASM.** Matching version metadata alone does not establish that equivalence.

## Remaining boundaries

These checks establish protocol view-state and documented accounting preconditions. They do not simulate the owner's transaction, wallet authorization, gas, runtime storage reserve, or eventual transfer receipt. State can change before withdrawal. No owner-signed withdrawal was sent, and no recovery story has been established.

FOUND checks unfinished unstakes in two protocols, not every internal balance or asset. The public leaderboard remains LiNEAR-only and dated. This review does not change repository visibility or submit the project.
