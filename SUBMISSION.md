# FOUND — NEAR HACKATHON submission

## Submission details

- Recommended tracks: **Open Innovation** (primary); **Unstoppable DeFi** (secondary, weaker fit). Final selection remains the team’s decision.
- Pitch: **Find the NEAR you left behind.**
- Live demo: https://found-production-e549.up.railway.app/
- Repository: https://github.com/vidvidvid/found-near
- Demo video: add the public URL after recording.
- X demo post: add the public URL after posting.

## Project description

Unstaked does not always mean withdrawn. NEAR can finish unlocking inside a staking protocol while still requiring a separate owner-signed withdrawal.

FOUND finds unfinished withdrawals in LiNEAR, Meta Pool, rNEAR and supported indexed validator pools without requiring a wallet connection to scan. It reads every checked source at the same finalized block, applies protocol-specific maturity and liquidity checks, and lets the owner request a withdrawal directly in FOUND. The connected wallet approves each transaction; the protocol sends funds to that account. FOUND never takes custody or charges a finder’s fee. Official protocol apps remain available as an alternative.

Its public waiting room contains 30,681 unique account IDs with matured balances above 0.01 NEAR, deduplicated across three staking protocols and 858 recognized validator pools at block 223975859. A fast offline command verifies the archived evidence; a separate script can reread the chain. The snapshot does not label owners as forgetful or funds as abandoned.

FOUND is deliberately small, useful ecosystem infrastructure: make an easy-to-miss final step visible, then let owners bring their money home safely.

## What judges can verify

```sh
npm test
npm run census:verify
# Optional independent chain reread:
npm run census:expanded -- --block 223975859 --check
```

- The test suite covers financial-state transitions, exact withdrawal preflights, pagination, malformed responses, failures, and server safety.
- The offline census command validates archived records and reproduces the leaderboard byte-for-byte. The separate expanded command independently rereads on-chain state at the same block.
- `ru.near` provided a live LiNEAR example during development.
- `deportivo.near` provided a live rNEAR example, with a separate Lonk validator withdrawal.
- `within4d45.near` provided Shitzu and Meteor validator-pool examples; its custom Aurora pool remains explicitly unsupported.
- `lb3.near` provided a live Meta Pool example during development.
- Balances are live and may change; no result is hardcoded in the checker.
- Methodology and protocol sources are documented in [RESEARCH.md](RESEARCH.md).

## Demo video draft

A 44-second, narrated demo is prepared in [demo/output/found-demo.mp4](demo/output/found-demo.mp4). Preview it with [demo/index.html](demo/index.html) served locally. The [edit notes](demo/README.md) include timing, capture provenance, asset prompts and rebuild instructions.

The cut leads with the user task: paste an account, discover a real balance, then show connecting a wallet and approving directly in FOUND. Meta Pool coverage and the reproducible LiNEAR census follow as evidence. The existing pixel-art characters are subtly animated. Public examples are labelled; no completed withdrawal is implied.

This recorded demo shows the earlier two-protocol UI and the original 538-account LiNEAR snapshot. The expanded coverage and combined census are verified in the live app and archived evidence. Refresh that recorded coverage/count scene before final publication.

This is a local draft, not a published demo URL. Review it before uploading and add the final public video/post links above.

## X demo post

Replace `[VIDEO_URL]` with the uploaded video or the post’s attached video before publishing. Attach the video directly if possible.

```text
Unstaked doesn’t always mean withdrawn.

FOUND finds unfinished staking withdrawals across NEAR—no wallet connection needed to scan. Its waiting room counts 30,681 accounts with matured balances across supported staking protocols and pools. Connect your wallet and approve the withdrawal in FOUND.

Built at NEAR HACKATHON.
@NEARProtocol #NEARHackathon

[VIDEO_URL]
https://found-production-e549.up.railway.app/
```

## Real recovery evidence

Only complete this section after an actual owner successfully withdraws. Do not use the public examples as recovery stories.

- [ ] Obtain the owner’s permission to document the account, transaction, and quote. Never request a seed phrase or private key.
- [ ] Record the protocol, account, amount, FOUND result, and block before withdrawal.
- [ ] Let the owner connect their own wallet and approve a withdrawal in FOUND or through the official protocol app.
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
