# Lockup recovery path — source review, 11 November 2026

This is a roadmap note, not a deployed adapter. The census contains 110 IDs ending in `.lockup.near`; that suffix is a label, not verification of their code, owner, vesting state or current withdrawal rights.

Reviewed reference: `near/core-contracts` at commit `1b0436c96379c63aee7d2429c6d5d24019031ab8`. Deployed lockups may differ. No lockup binary was allowlisted or tested with an owner transaction in this review.

## Two different destinations

1. **Pool → lockup.** The controlling owner calls the lockup's `withdraw_all_from_staking_pool()`, not the pool directly. The lockup queries its own unstaked pool balance, then its callback calls the pool's `withdraw({amount})`. The reference requires the caller to be the recorded owner, a selected idle pool and no active vesting termination. The pool independently enforces maturity. Successful receipt processing returns the NEAR to the lockup and updates its recorded deposit balance.
2. **Lockup → owner.** A separate owner call to `transfer({amount, receiver_id})` moves only the liquid owner's balance. Transfers must be enabled, the contract must be idle, no vesting termination may be active, and the requested amount must fit the contract's liquid owner balance. That balance accounts for remaining lockup/vesting obligations and its storage reserve. A matured pool balance is therefore not automatically spendable in the owner's wallet.

`refresh_staking_pool_balance()` is an owner-signed synchronization call, not a read-only view or a payout. It refreshes the lockup's known total deposited balance through a callback. It may be needed before computing accurate ownership/liquidity, but is not an unconditional prerequisite of `withdraw_all_from_staking_pool()` in the reference.

## Required adapter checks

Read `get_owner_account_id()` and `get_staking_pool_account_id()` from a recognized lockup implementation, rather than deriving the owner from the account's name. Verify both deployed code versions, the actual pool association, maturity/liquidity, termination and busy status, transfer-enabled state, and `get_liquid_owners_balance()` at pinned state. Recheck each stage before asking the owner to approve; the owner's wallet signs calls to the lockup. Never request the lockup's keys or use `add_full_access_key` as a recovery shortcut.

Observe each asynchronous receipt chain and the resulting balances before advancing. Preserve a clear intermediate “returned to lockup” state if vesting or transfer rules prevent onward transfer. The recovery counter must not count both legs as two recoveries of the same money, and cannot label the pool-to-lockup leg “in your wallet.” Review deployed versions and add failure, busy, vesting, ownership and partial-completion fixtures before shipping.

The safe roadmap sentence is: **“A future lockup adapter could guide the recorded owner through pool-to-lockup recovery and, where the contract permits, a separate transfer to their wallet.”** FOUND currently labels these accounts and does not offer that path.

Sources: [owner calls](https://github.com/near/core-contracts/blob/1b0436c96379c63aee7d2429c6d5d24019031ab8/lockup/src/owner.rs), [callbacks](https://github.com/near/core-contracts/blob/1b0436c96379c63aee7d2429c6d5d24019031ab8/lockup/src/owner_callbacks.rs), [owner/vesting/liquidity views](https://github.com/near/core-contracts/blob/1b0436c96379c63aee7d2429c6d5d24019031ab8/lockup/src/getters.rs), [authorization and storage reserve](https://github.com/near/core-contracts/blob/1b0436c96379c63aee7d2429c6d5d24019031ab8/lockup/src/internal.rs).
