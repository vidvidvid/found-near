# FOUND — submission packet

## Ready-to-use details

- Project: **FOUND**
- Pitch: **Find the NEAR you left behind.**
- Track submitted: **Open Innovation** (`open`) only. Unstoppable DeFi (`defi`) was considered and left out, because FOUND does not implement cross-chain settlement or a trading protocol.
- Live app: https://foundyours.xyz/
- Example: https://foundyours.xyz/?account=ru.near
- Repository: https://github.com/vidvidvid/found-near — public since 12 November 2026.
- Final demo video and public X post: https://x.com/viiiiiiiiiiiid/status/2120914430607471080 (published 12 November 2026, video attached). The 48-second video is an edited walkthrough assembled from real captures of the owner’s withdrawal; the wallet approval itself happened off-camera. The older MP4 has been removed from the current tree.
- Deadline: **14 November 2026, 23:59 UTC**.
- **Submitted 12 November 2026, 19:14 UTC.** The organizers' endpoint answered `201` (saved). The submitted commit is tagged [`hackathon-submission`](https://github.com/vidvidvid/found-near/tree/hackathon-submission).

Rules checked against [the official handbook](https://nearhackathon.com/HACKATHON.md). The submission is saved and cannot be edited directly; corrections go through the organizers' manual [change-request process](https://nearhackathon.com/request-changes). Do not submit the same project again.

## Project description

Unstaked does not always mean withdrawn. After NEAR finishes unlocking inside a staking protocol, the account owner still needs to make a separate withdrawal.

FOUND finds these unfinished withdrawals in LiNEAR, Meta Pool, rNEAR and supported indexed validator pools without requiring a wallet connection to scan. Every checked source is read at the same finalized block. Protocol-specific checks cover maturity, pauses, liquidity and supported implementations. Owners can connect their wallet and approve the exact withdrawal directly in FOUND; the app verifies the transaction and complete receipt chain. FOUND does not hold keys, take custody or charge a finder’s fee.

The public waiting room lists 30,681 unique account IDs with qualifying matured balances across three protocols and 858 recognized validator pools, from 305,908 unique ledger IDs checked at block 223975859. Its 10.55M NEAR total is a gross sum: a protocol’s own balance can represent the same money as users’ balances. It is not unique lost funds or confirmed recoveries. The 110 lockup IDs, totaling 777,029.79 NEAR, are labelled because they require their lockup contracts and cannot withdraw directly through FOUND.

<!-- sampled-history -->
In the **100+ NEAR cohort (2,963 accounts)**, **304 named accounts** had at least one balance unchanged and withdrawable at every sampled date from **10 Nov 2024** through **10 Nov 2026**, totalling **1,829,552.41 gross NEAR** in those qualifying balances. Named accounts may be contracts; activity between samples is possible. This is sampled history, not proof of abandonment. [Method, all six buckets and archived evidence](research/dormancy-2026-11-11/README.md).
<!-- /sampled-history -->

Read-only account links and a JSON scan API make results shareable. A fast offline command reproduces the archived census, while a separate tool can reread the chain. No claim is made that the owners forgot their balances. One real owner-signed withdrawal through FOUND is archived and can be rechecked offline; local simulations are labelled as simulations.

## Checks judges can run

Start with [README.md](README.md), which lists commands, expected outputs, network requirements and source locations.

```sh
npm ci
npm test
npm run census:verify
npm run dormancy:verify
npm run dormancy:code:verify
npm run sizing:figures
npm run verify:tx
curl -fsS 'https://foundyours.xyz/api/scan/ru.near'
```

The first install and API call need network access. Tests, census verification, sampled-history verification, the contract-code check and the sizing figures run offline after setup. A fresh chain reread is optional and slower:

```sh
npm run census:expanded -- --block 223975859 --check
```

- Current implementation evidence: [VERIFICATION.md](VERIFICATION.md).
- Census, exact totals and scope: [research/census-2026-11-10/README.md](research/census-2026-11-10/README.md).
- License and tools/assets: [LICENSE](LICENSE), [README built-with list](README.md#built-with), [credits](THIRD_PARTY_NOTICES.md).
- Public accounts such as ru.near, lb3.near, deportivo.near and within4d45.near are live read examples, not owner recovery stories.

## Final demo

Record one continuous take: **scan the owner’s account → connect → owner approves → receipt verified → updated balance**. Keep the approved pixel-art aesthetic, quiet character motion and clear Faye narration for an optional edited cut. Preserve the uncut take as proof. Recording plan and preserved production assets: [demo/README.md](demo/README.md).

The older two-protocol/538-account MP4 remains in Git history only; it is not the current UI or final demo. The combined count is 30,681; the old 538 number remains valid only for the dated LiNEAR-only dataset.

## X post

Published by the owner’s account on 12 November 2026 with the final video attached: https://x.com/viiiiiiiiiiiid/status/2120914430607471080. The owner revised the 11 November draft to open on the census count and ask the reader to check their own account. The text below is what was posted.

```text
30,681 accounts have unstaked NEAR still waiting to be withdrawn. Some for 2+ years.

Is one of them yours? Type your account and see in 10 seconds. No wallet needed to look.

Built at NEAR HACKATHON
@NEARProtocol #NEARHackathon
https://foundyours.xyz/
https://github.com/vidvidvid/found-near
```

The 30,681 figure is the 10 November 2026 census (block 223975859): unique account IDs with a matured, withdrawable balance at that snapshot. It says nothing about how long each balance has waited. “Some for 2+ years” rests on the sampled-history finding: 304 named accounts in the 100+ NEAR cohort showed the same withdrawable balance at every sampled date from 10 Nov 2024 through 10 Nov 2026. The page keeps “100+ NEAR cohort” and “sampled dates” legible beside it. The post must not describe any listed amount as recovered money, and it is not a claim of abandonment.

## Real recovery evidence

One real owner-signed withdrawal was completed through FOUND on 12 November 2026. The owner approved it in their own wallet; no private keys or recovery phrases were needed by FOUND or the developer. It is a single withdrawal from one validator pool, not evidence about LiNEAR, Meta Pool, rNEAR or other pools.

| Field | Record |
| --- | --- |
| Owner-provided account | vidvid.near |
| Protocol / contract | meteor.poolv1.near (validator pool), reviewed code `J1arLz48fgXcGyCPVckFwLnewNH6j1uw79thsvwqGYTY` |
| Amount | 0.999999000000000000000002 NEAR (`withdraw`, deposit 0, gas 100 TGas) |
| Final transaction hash / explorer URL | [`3TcvgZqdJ29SGTDkg49n9oNSXH2GyHB8GvR4SMs33mtK`](https://nearblocks.io/txns/3TcvgZqdJ29SGTDkg49n9oNSXH2GyHB8GvR4SMs33mtK) |
| Block and time | 224220895 · 2026-11-12T13:33:19.659Z |
| Result | 4 receipts, all successful; transfer receipt `6CvXAQiP8mgUXFS7CkSD2yo1nwo2UW5hwH1wv4WA6HDG` moved the exact amount from meteor.poolv1.near to vidvid.near |
| Production recovery counter after it | 1 withdrawal, 1 account, 999999000000000000000002 yoctoNEAR |
| Not yet withdrawn | The owner’s figment.poolv1.near balance is untouched |
| Permission to publish account and receipt | Granted by the owner, 11 November 2026 |
| Optional owner quote | None; never fabricate one |

Reproduce offline with `npm run verify:tx`. It applies FOUND’s existing exact receipt verifier (not a separate looser implementation) to the archived archival-RPC responses in `verification/withdrawals/3TcvgZqdJ29SGTDkg49n9oNSXH2GyHB8GvR4SMs33mtK.json` and requires the pool’s transfer to the signer; CI runs it on every push. To reread the chain instead: `npm run verify:tx -- 3TcvgZqdJ29SGTDkg49n9oNSXH2GyHB8GvR4SMs33mtK --account vidvid.near`. Output of the saving run on 12 November 2026:

```text
Withdrawal 3TcvgZqdJ29SGTDkg49n9oNSXH2GyHB8GvR4SMs33mtK
  signer     vidvid.near
  contract   meteor.poolv1.near (meteor.poolv1.near) · reviewed code J1arLz48fgXcGyCPVckFwLnewNH6j1uw79thsvwqGYTY
  call       withdraw {"amount":"999999000000000000000002"} · deposit 0 · gas 100000000000000
  amount     0.999999000000000000000002 NEAR
  receipts   4, all successful, every referenced receipt present
  transfer   6CvXAQiP8mgUXFS7CkSD2yo1nwo2UW5hwH1wv4WA6HDG: meteor.poolv1.near -> vidvid.near, 0.999999000000000000000002 NEAR
  block      224220895 · 2026-11-12T13:33:19.659Z
Confirmed by FOUND's receipt verifier against a fresh archival read.
```

Historical reports that say no owner-signed withdrawal had been sent remain dated records.

## Publication and submission handoff

All six steps are done. The record is kept so the order of events can be checked.

1. Done 12 November: real withdrawal completed, final video published with the X post linked above.
2. Done 12 November: the repo is public. Keep it public through judging. GitHub description has been updated to the expanded withdrawal workflow.
3. Done 12 November: a fresh clone of the public repo passed the tests and offline verifiers, and commit `b44c4b3` is tagged `hackathon-submission`. Still to do: keep the live app available through judging (ideally through 25 November).
4. Done 12 November: X post with the video attached: https://x.com/viiiiiiiiiiiid/status/2120914430607471080
5. Done 12 November: the owner confirmed team lead name, contact email, team size, track, mainnet payout account, repo and post links, and agreed to the contact notice. The private payload is not committed.
6. Done 12 November, 19:14 UTC: the owner reviewed the values, and the single submission was sent and saved (`201`). Corrections go through the organizers’ request-changes process.

**Still required from the owner:** nothing for the submission. Keep the repo public and the live app up through judging.

The entry is in Open Innovation. The history data alone does not establish a long-term investment thesis for NEAR; no Investment Thesis entry has been prepared.
