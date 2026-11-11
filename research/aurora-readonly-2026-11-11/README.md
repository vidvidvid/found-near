# Aurora pool: read-only coverage, 11 November 2026

FOUND reads `get_account` on `aurora.pool.near` only while its code hash is `5vf2Jkqpk11H7szLnY4XdPA6maJi1ND8xe346xtbtX8e`. This hash is **not** in the withdrawal allowlist. A new `readonly` result carries the reported unstaked amount, `reportedCanWithdraw`, and `withdrawalSupported: false`; it never offers a signing action.

## Evidence and scope

The [archived reads](evidence.json) include the complete scan plus separate FastNEAR and Intear account/code and balance views at block **224046331**, hash `A2RTVaMJbs5mhTJmRbcHfQPobPnMYMsvetkXzU4VGdyY`. Both providers returned zero unstaked NEAR for the public example `illia.near`. This is a dated balance check, not a recovery story or an endorsement. Fixture tests cover positive, pending, malformed, wrong-block and changed-code states, and reject attempts to build withdrawals even if a read-only row is forged into `found`.

The interface was checked through the local browser: Aurora displays “Balance checked · read only”, the actual amount and “Open MyNearWallet”; no withdrawal button is present. Other unrecognized implementations remain unknown. The original census and its 858-pool scope are unchanged.

[Aurora’s official guide](https://doc.aurora.dev/blog/managing-aurora-s-validator-staking-with-near-cli-rs/) describes this as a nonstandard validator and links the staking-farm implementation. Its additional token rewards and upgrade behavior are reasons not to equate a familiar balance view with a reviewed withdrawal implementation. [Aurora’s support page](https://help.aurora.dev/article/64-stake-aurora-near) links [MyNearWallet’s Aurora staking screen](https://app.mynearwallet.com/staking/aurora.pool.near), which is the UI’s external management destination.

No reproducible WASM build or security audit is claimed. The balance-view validation checks account identity, unsigned 128-bit amount, boolean maturity, and the same pinned block as the code check. The UI does not call the reported balance immediately withdrawable: liquidity, pauses and signing behavior have not been verified for this implementation.

Run `node --test tests/aurora.test.js` offline; scan the public account again for fresh chain state.
