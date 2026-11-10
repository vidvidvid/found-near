# Verification status

The current app checks LiNEAR, Meta Pool, rNEAR and up to 24 supported indexed validator pools for an account, at one finalized block. Its separate archived census spans three protocols and 858 recognized pools. The full workflow and limits are in [README.md](README.md).

- **Deterministic checks:** `npm test` passes. Fixtures cover account validation, exact balances, maturity, pause/liquidity checks, lockups, unknown implementations, owner and balance changes, receipt-chain failures, recovery tracking, pagination and public API resource limits. Tests send no withdrawal transactions.
- **Census:** `npm run census:verify` passes offline against archived RPC evidence: 30,681 qualifying IDs from 305,908 unique IDs checked at block 223975859. [Evidence and reproduction](research/census-2026-11-10/README.md). A separate fresh RPC reread is available; the offline check is not that reread.
- **Live coverage and code provenance:** [rNEAR / validator-pool verification](research/coverage-expansion/README.md), including pinned public-account reads, independent comparisons and deployed-code limitations. This is not a smart-contract security audit or a reproducible build of every deployed contract.
- **Withdrawal path:** [direct-withdrawal verification](verification/direct-withdrawals.md). Wallet approval and the exact successful receipt chain are required. No real owner-signed withdrawal was sent in QA.
- **Recovery totals:** [tracking verification](verification/recovery-tracking.md). Local synthetic success/failure tests verify accounting and persistence; they are not production recoveries. The live counter is hidden while zero.
- **HTTP API:** `tests/public-api.test.js` verifies validation, paging, exact lockup totals, cache expiry, partial/error states, shared work, timeouts and capacity limits. The browser’s financial preflights remain fresh RPC reads.

The earlier two-protocol review, its findings and historical test counts are preserved in [the dated verification record](docs/history/2026-11-10-two-protocol-verification.md). Those results describe that revision, not today’s scope. Public examples are dated observations and never claimed as accounts we recovered.

Fresh-clone setup, live API/browser checks and the independent README review are recorded in [submission preparation checks](verification/submission-readiness.md).
