# Public scan API fairness — 11 November 2026

The API now limits each caller to 10 new scans per minute and two concurrent scans. The existing aggregate limits remain: 30 new scans per minute, four concurrent scans, 45 seconds per scan and 128 cached results. Complete results expire after 30 seconds; incomplete results are not cached. Cache hits and requests joining an existing account scan do not start additional RPC work or consume quota.

## Caller identification

Direct/local requests use the socket address and ignore forwarded headers. On Railway, the server enables proxy trust only when Railway project and service environment variables are present. It uses the edge-provided [X-Real-IP](https://docs.railway.com/networking/public-networking/specs-and-limits), accepting only a single valid IP address; malformed/missing values fall back to the socket address. X-Forwarded-For is ignored. IPv6 addresses are normalized.

This deployment exposes HTTP through Railway's edge. Do not enable this mode behind a proxy that forwards untrusted client headers, or expose the server directly through a public TCP port. People sharing an IP share its quota. Aggregate limits still protect capacity; this does not guarantee availability under distributed overload.

Counters contain only IP, window time and counts in memory, never account history. There are at most 512 entries; expired idle entries are removed on subsequent scan requests. Nothing is persisted to the recovery database.

## Verification

- All 67 application tests in the suite at that commit passed (the suite has grown since). New cases cover per-caller isolation, concurrency isolation, the aggregate cap, cache/coalescing exceptions, header trust, IPv6 normalization, and bounded/expired bookkeeping.
- The offline census verifier still reproduced 30,681 accounts, 858 pools and three protocols at block 223975859. No census data was changed.
- Deployment `6c3acf63-ea45-4dd8-91d4-99cd44d766ee` succeeded. Its read-only `ru.near` scan returned complete coverage at block 224042234 in 555 ms.
- One caller then made nine new scans of nonexistent accounts, varying both forwarded-IP headers. Each returned 404; the next returned 429 with Retry-After: 60. Changing those headers did not reset the caller quota. This is a single-source production probe; independent caller isolation is covered locally, not a multi-region load test.
- The cached `ru.near` response still returned 200 after that caller's quota was exhausted, with cacheAgeMs 10016. Leaderboard page 1 still returned ten rows. Recovery totals remained zero.

Sanitized probe output: [api-fairness-2026-11-11.json](api-fairness-2026-11-11.json). No wallet was connected or transaction sent during this check. The real owner-approved withdrawal and final video remain pending.
