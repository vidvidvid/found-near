# Recovery tracking — 10 November 2026

This measures withdrawals requested through FOUND and independently verified on-chain. It does not measure all NEAR withdrawals or prove exclusive UI attribution.

- Automated tests: exact request/receipt matching, pre-request and expired transactions, changed contract code, pending receipts, failed downstream transfers, incomplete receipt graphs, duplicate hashes and intents, exact integer totals, unique-account counts, SQLite reopen persistence, cross-origin rejection, and unavailable tracking.
- Browser integration: the production UI and tracking API ran against an explicitly labeled local simulated wallet/RPC. A successful 1.25 NEAR fixture increased totals from zero to one withdrawal/one account. A subsequent failed 2.5 NEAR transfer kept the total at 1.25. Reload retained the verified total. These are synthetic test values, not recovered funds; the fixture and its database are outside the repository and deployment.
- Production starts with zero confirmed withdrawals. No real owner-signed transaction has been sent during QA.
- An unconfirmed request stores public account/protocol/amount/code/time, not a success. Only the server's successful receipt verification records a recovery. Requested amounts are gross of gas and exclude any extra Meta Pool dust sweep.
- The new SQLite file lives on the Railway volume mounted at `/data`. The application runs as the unprivileged node user. Redeployment retains the database; deleting the volume would remove it.
- Browser retries are best effort. Tracking outages do not prevent withdrawing. The public API exposes aggregates; request/receipt metadata stays in the server database.
