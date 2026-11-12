# Direct withdrawals — 10 November 2026

FOUND now supports owner-approved withdrawals on NEAR mainnet. This is an application integration, not a new custody contract or a security audit.

## Transaction path

1. Connect using `@hot-labs/near-connect` 0.12.0. Require mainnet, `signInWithoutAddKey`, and `signAndSendTransaction`. No access-key plugin or delegated signing permission is requested.
2. Connecting never automatically signs a withdrawal. It shows fresh balances for the connected owner.
3. Before signing, check the wallet account, reread the supported protocols and discovered validator pools at one finalized block, require `found` for the selected protocol, require the displayed amount still matches, and check the wallet account again.
4. Request exactly one `withdraw` function call on the selected supported contract, `{amount: <exact yoctoNEAR string>}`, attached deposit `0`. LiNEAR (`linear-protocol.near`), Meta Pool (`meta-pool.near`) and recognized validator pools use `100000000000000` gas; rNEAR (`lst.rhealab.near`) uses `200000000000000`. rNEAR and validator pools also require the exact reviewed deployed code hash; a code change disables their action until reviewed. The protocol pays its predecessor account; there is no arbitrary destination field. Meta Pool can include its documented available-balance dust sweep, covered by the existing preflight.
5. Store pending metadata before opening the wallet, then store the returned hash. Reloads resume receipt checks, never signing. If the wallet gives no hash, show an explicit unresolved state and wallet activity link. Clearing this marker is a separate user action after checking activity.
6. Check `tx` with `wait_until: FINAL` through the existing two mainnet providers. Require the expected hash, signer, receiver, single function call, amount, gas, deposit, successful statuses, and complete receipt references. A failed downstream transfer prevents a success message. Then refresh balances.

The additional rNEAR and validator-pool readiness/liquidity checks and exact code hashes are documented in [coverage verification](../research/coverage-expansion/README.md). Unknown pool implementations and lockup accounts have no direct withdrawal action.

## Checking a withdrawal after the fact

`npm run verify:tx -- <hash> --account <signer>` reads `EXPERIMENTAL_tx_status` with `wait_until: FINAL` from an archival RPC, plus the header of the transaction’s block and the contract’s `view_account` at the block that executed the call. It then:

1. derives the protocol from the receiver and builds the same pending record the app stores;
2. passes it to `inspectWithdrawal` in `dist/withdrawal.js`, the function the browser and the recovery server use, so signer, receiver, single `withdraw` call, amount, zero deposit, FOUND’s gas limit, finality, every status and the complete receipt chain are checked by one implementation;
3. requires the reviewed code hash for rNEAR and validator pools at the execution block;
4. requires a successful receipt whose only action is a transfer from the contract to the signer for exactly the withdrawn amount (Meta Pool: at least that amount, because of its dust sweep).

`--save` writes the raw responses to `verification/withdrawals/<hash>.json`. `npm run verify:tx` with no arguments rechecks every archived file offline, and `--live` rereads one from the chain and compares everything that decides the verdict. The offline check proves the archived responses are consistent with a confirmed withdrawal; only the live reread proves the chain still says the same. An unreachable provider is reported as unknown, never as a failed withdrawal.

A withdrawal sent by another app with a different gas limit or method (for example `withdraw_all`) is rejected: the command answers “is this the transaction FOUND builds, and did it pay out”, not “did any withdrawal happen”.

## Source references

- [NEAR Connect](https://docs.near.org/tools/near-connect) and [wallet transaction API](https://docs.near.org/web3-apps/tutorials/wallet-login).
- [LiNEAR withdrawal source](https://github.com/linear-protocol/LiNEAR/blob/main/contracts/linear/src/stake.rs).
- [Meta Pool withdrawal source, pinned revision](https://github.com/Meta-Pool/liquid-staking-contract/blob/e9855e283fb167d5ad01fbc6b76cc86f8cce4182/metapool/src/lib.rs) and [transfer/accounting implementation](https://github.com/Meta-Pool/liquid-staking-contract/blob/e9855e283fb167d5ad01fbc6b76cc86f8cce4182/metapool/src/internal.rs).
- [NEAR receipt finality](https://docs.near.org/api/rpc/transactions).

## Verification limits

One real owner-signed withdrawal was completed through FOUND on 12 November 2026 (meteor.poolv1.near to vidvid.near; see [SUBMISSION.md](../SUBMISSION.md) and `npm run verify:tx`). It covers one validator pool only; no real withdrawal has been made from LiNEAR, Meta Pool or rNEAR. Public example accounts are not controlled by us. Automated fixtures verify transaction construction, wrong owners, changed accounts/balances, not-ready states, lockups, exact integers, matching receipts, downstream transfer failure, missing receipt chains, provider fallback, and uncertain confirmation. Browser QA passed with a clearly labeled local simulated wallet: connecting showed balances without signing; cancelling left the LiNEAR balance unchanged; an approved simulated LiNEAR withdrawal showed the matching final receipt and refreshed to zero; a failed Meta Pool transfer showed failure and kept its balance. The local fixture is not part of the deployed app and is not evidence of recovered money.

The contracts are upgradeable and state may change between preflight and wallet approval. Contract rejection and wallet cancellation remain ordinary failure paths. An RPC outage may delay confirmation; FOUND keeps the pending request and does not auto-resubmit it. The connector loads provider-managed wallet integration scripts in sandboxes, as described by NEAR Connect. No claim of reproducible deployed-contract equivalence or independent connector audit is made here.
