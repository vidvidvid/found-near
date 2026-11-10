# FOUND — NEAR HACKATHON submission

## Submission details

- Track: **Open Innovation**.
- Pitch: **Find the NEAR you left behind.**
- Live demo: https://found-production-e549.up.railway.app/
- Repository: https://github.com/vidvidvid/found-near
- Demo video: add the public URL after recording.
- X demo post: add the public URL after posting.

## Project description

Unstaked does not always mean withdrawn. NEAR can finish unlocking inside a staking protocol while still requiring a separate owner-signed withdrawal.

FOUND finds those unfinished LiNEAR and Meta Pool withdrawals without requiring a wallet connection to scan. It reads both protocols at the same finalized block, applies protocol-specific maturity and liquidity checks, and guides the owner to the official withdrawal flow. FOUND never takes custody, requests a signature, or charges a fee.

Its public waiting room is reproducible evidence rather than a curated screenshot: one command reads all 47,882 LiNEAR accounts at block 223800610 and verifies the 538 matured balances above 0.01 NEAR. The snapshot does not label owners as forgetful or funds as abandoned.

FOUND is deliberately small, useful ecosystem infrastructure: make an easy-to-miss final step visible, then let owners bring their money home safely.

## What judges can verify

```sh
npm test
npm run census -- --block 223800610 --check
```

- The test suite covers financial-state transitions, exact withdrawal preflights, pagination, malformed responses, failures, and server safety.
- The census command independently reproduces the checked-in leaderboard byte-for-byte without modifying it.
- `ru.near` provided a live LiNEAR example during development.
- `lb3.near` provided a live Meta Pool example during development.
- Balances are live and may change; no result is hardcoded in the checker.
- Methodology and protocol sources are documented in [RESEARCH.md](RESEARCH.md).

## 60–90 second demo recording

Record at 1440×1000 or larger, at 100% zoom, with the bookmarks bar hidden. Use the deployed site and a visible terminal for the census check. Confirm that the example accounts still have suitable live balances before recording; do not substitute recorded or invented amounts.

### 0:00–0:10 — The problem

**Screen:** FOUND hero.

**Narration:**

“Unstaked doesn’t always mean withdrawn. Your NEAR can be ready inside a protocol while still waiting for one final transaction. FOUND helps you find it.”

### 0:10–0:23 — Public evidence

**Screen:** Scroll to The waiting room.

**Narration:**

“We checked 47,882 LiNEAR accounts and found 538 matured balances above 0.01 NEAR. This is public onchain state—not a lost-money list, and not a claim about what owners intend.”

### 0:23–0:34 — Reproducibility

**Screen:** Run the census check in a terminal at the repository root.

```sh
npm run census -- --block 223800610 --check
```

**Narration:**

“Anyone can regenerate the complete snapshot at one pinned block. The generator checks every account and rejects incomplete pages or mixed block heights.”

### 0:34–0:50 — LiNEAR live scan

**Screen:** Return to the hero and choose **Try a real account**.

**Narration:**

“No wallet connection, no signature—just a live read. FOUND finds this matured LiNEAR balance and checks the exact withdrawal preflight before calling it ready.”

### 0:50–1:05 — Meta Pool live scan

**Screen:** Enter `lb3.near`, or another account verified to have a current matured Meta Pool balance, and scan.

**Narration:**

“The same simple check now covers Meta Pool. Both protocols are read at one finalized block, with Meta Pool’s reserved-liquidity requirement checked before the withdrawal handoff.”

### 1:05–1:18 — Safe handoff

**Screen:** Open the withdrawal dialog. Show the account copy action and official destination. Do not sign a transaction for the demo unless recording a genuine owner-approved recovery.

**Narration:**

“FOUND never touches the money. The owner withdraws through the official app, then comes back and checks again.”

### 1:18–1:28 — Close

**Screen:** Return to the FOUND hero.

**Narration:**

“Two protocols, one simple check, and a reproducible public census. FOUND—find the NEAR you left behind.”

## X demo post

Replace `[VIDEO_URL]` with the uploaded video or the post’s attached video before publishing. Attach the video directly if possible.

```text
Unstaked doesn’t always mean withdrawn.

FOUND finds matured LiNEAR + Meta Pool withdrawals—no wallet connection needed to scan. Its waiting room is reproducible from 47,882 onchain accounts. Withdraw through the official apps.

Built at NEAR HACKATHON.
@NEARProtocol #NEARHackathon

[VIDEO_URL]
https://found-production-e549.up.railway.app/
```

## Real recovery evidence

Only complete this section after an actual owner successfully withdraws. Do not use the public examples as recovery stories.

- [ ] Obtain the owner’s permission to document the account, transaction, and quote. Never request a seed phrase or private key.
- [ ] Record the protocol, account, amount, FOUND result, and block before withdrawal.
- [ ] Let the owner connect their own wallet and withdraw through the official protocol flow.
- [ ] Preserve the public transaction URL and confirmation status.
- [ ] Recheck the account in FOUND and capture the updated result.
- [ ] Add a short owner quote and identify what they found and withdrew.
- [ ] Offer to omit the account ID or other details if the owner prefers.
- [ ] Update the submission and demo only with evidence the owner approved for publication.

### Recovery record

- Owner-approved account/reference: pending
- Protocol: pending
- Amount before withdrawal: pending
- Transaction URL: pending
- Result after recheck: pending
- Owner quote and publication permission: pending

## Final submission checklist

- [ ] Latest code is deployed at the public demo URL.
- [ ] Repository is public and contains the latest code and documentation.
- [ ] Live demo URL and demo video URL are added above and to the README.
- [ ] Demo video or screenshots are attached to a public X post.
- [ ] X post says the project was built at NEAR HACKATHON and includes @NEARProtocol and #NEARHackathon.
- [ ] Submission selects **Open Innovation**.
- [ ] Submission includes the public repository and X demo-post URLs.
- [ ] A valid NEAR mainnet account is entered for the payout.
- [ ] Submission is completed before **14 November 2026 at 23:59 UTC**.
