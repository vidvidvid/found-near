# FOUND demo

**Final recording pending a real owner-approved withdrawal.** No real owner-signed withdrawal was sent in QA. The earlier 44-second MP4 has been removed from the current repository tree. It showed genuine public-account captures and wallet selection, edited together, with no transaction approval or completed recovery. It predates the expanded protocol/pool UI and combined census. It remains in Git history; history has not been rewritten. Do not present that draft as the current end-to-end withdrawal proof.

The original art, soft Faye narration and restrained character animation are retained. The complete draft timing, prompts, assets, provenance, rebuild notes and historical scene counts are preserved in [the dated demo record](../docs/history/2026-11-10-demo.md).

## Final take

Record one continuous screen capture at a readable resolution:

1. Scan a mainnet account controlled by the participant; show the actual ready balance and source.
2. Connect that owner’s wallet in FOUND.
3. Let the owner review and approve the exact withdrawal in their wallet. Keep recovery phrases, passwords and unrelated wallet details out of the recording.
4. Wait for FOUND’s verified receipt and open the public transaction link; refresh to show the resulting balance.

Preserve the uncut take. Any edited narrated version must be identified as an edit. No fabricated wallet, simulated approval, substituted balance, or inferred success is acceptable as the real recording. A new wallet alone is not enough: it needs a withdrawal whose unlock period has finished.

Once an owner-approved transaction exists, record the account/protocol/amount/hash/date and permission to publish in [SUBMISSION.md](../SUBMISSION.md). Add a reproducible receipt command using the app’s existing verifier, and align spoken words and captions with the new scene. Until then, the honest statement remains that no real owner-signed withdrawal was sent in QA.

The optional waiting-room shot must show the **30,681-account, 3-protocol, 858-pool** snapshot at block **223975859**. **10.55M NEAR** is a gross listed total, not unique lost funds; **110 lockup IDs** require their lockup contracts. The simpler withdrawal take can omit these statistics entirely.

## Archived draft renderer

```sh
python3 demo/serve.py
# Open http://127.0.0.1:8086/
python3 -m venv /tmp/found-demo-venv
/tmp/found-demo-venv/bin/pip install pillow
/tmp/found-demo-venv/bin/python demo/render.py --stills
/tmp/found-demo-venv/bin/python demo/render.py
```

The renderer uses Pillow and FFmpeg and composes archived screenshots; it does not record the current browser. Running it now reproduces the older draft, not a new live proof. Generated MP4s are ignored by Git. The preview page links to the live app until the final recording is ready; it does not serve the old draft. To inspect a locally rebuilt draft, open its output file directly.

## Attribution

Art/characters: OpenAI image generation; animation/compositing: CSS and Python/Pillow/FFmpeg; narration: Higgsfield Seed Audio 1.0, Faye preset; automated transcript checks: faster-whisper; font: DM Sans under [SIL OFL](assets/FONT-LICENSE.txt). Exact voice jobs/parameters and phrase edits: [narration-timing.json](narration-timing.json). Project-wide [credits](../THIRD_PARTY_NOTICES.md).
