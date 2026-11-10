# FOUND demo draft

43 seconds, 1280×720, 30 fps, H.264 MP4. Designed to work without sound. No voice-over, music, or third-party audio licensing needed.

Open `index.html` through a local static server to preview. Export: `output/found-demo.mp4`. Poster: `output/poster.png`. Contact sheet: `output/storyboard.jpg`.

## Story

| Time | Message | Visual |
| --- | --- | --- |
| 0–5 s | Unstaked NEAR? It may still be waiting. | Night shop, floating lantern spirit, blinking wallet |
| 5–10 s | Paste a NEAR account. | Genuine ru.near input capture, subtle tap cue |
| 10–17 s | See what’s ready. | Real LiNEAR result, account and block visible |
| 17–24 s | Use the official app. | Actual withdrawal instructions; owner approval required |
| 24–30 s | One account. One check. | Real Meta Pool result; LiNEAR + Meta Pool coverage |
| 30–36 s | 538 accounts. NEAR waiting. | Dated LiNEAR waiting-room snapshot |
| 36–43 s | Find the NEAR you left behind. | Night shop and public demo URL |

Visual direction: original dark navy/violet/amber scene, DM Sans, restrained crossfades, tiny drifting lights. Characters float, blink, and nod; there are no speech bubbles, confetti, fake balance counters, or recovery claims.

## Evidence and editorial treatment

The UI shots are actual browser captures of the Railway deployment on 10 November 2026. They are cropped, resized and edited together, not a continuous screen recording. No UI values were redrawn or substituted. `captures/provenance.json` preserves the two accounts, observed blocks, source URL and capture time. The pixel-art characters are decorative animation outside the captured UI.

- ru.near: LiNEAR, 500.3072 NEAR displayed, block 223950238.
- lb3.near: Meta Pool, 17,502.401 NEAR displayed, block 223950463.
- Neither example belongs to us. Neither is presented as recovered funds.
- The handoff scene displays FOUND’s actual instructions and official app destination; it does not show a completed withdrawal.
- The 538 figure is the 9 Nov 2026 LiNEAR snapshot above 0.01 NEAR, not a current all-protocol count or proof of abandonment.
- The video may be shared as a dated demo. Recheck and recapture if claiming the values are current.

## Rebuild

Requires Python with Pillow and ffmpeg. No runtime dependency is added to FOUND.

```sh
python3 -m venv /tmp/found-demo-venv
/tmp/found-demo-venv/bin/pip install pillow
/tmp/found-demo-venv/bin/python demo/render.py --stills
/tmp/found-demo-venv/bin/python demo/render.py
```

The renderer only composes existing captured screenshots and art; it does not automate a browser. Frame timing, crops and captions are in `render.py`.

DM Sans is bundled under the SIL Open Font License in `assets/FONT-LICENSE.txt`.

## Generated assets

Created with the built-in image-generation tool, using `dist/found-night.png` as the reference. Project copies:

- `assets/characters.png`: transparent atlas, lantern spirit in row 1, wallet in row 2, resting and blinking expressions.
- `assets/night-plate.png`: background plate with the two characters removed so their animated sprites can be composed separately.

Prompts:

**Character atlas:** Use case: identity-preserve. Asset: animation sprite atlas for FOUND's product demo. Reference image defines the exact two character identities and pixel-art texture: cyan lantern spirit with brass cap and loop, green stitched wallet with gold clasp and peeking cards. Create one square transparent PNG sprite sheet, strict 2 columns x 2 rows of equally sized cells, no borders, no text. Top row: lantern spirit in both cells; bottom row: wallet in both cells. Each character completely isolated on genuine transparent alpha, no scenery, table, floor or cast shadow outside the sprite. Keep subjects inside their cells. Consistent scale and registration within each row. Left poses: simple open dot eyes and small closed-mouth smile. Right poses: gently closed blink for spirit and subtle content nod for wallet. Preserve reference palette, hands, pixel clusters and stepped silhouette. No smooth vector or 3D look; no extra objects, labels, symbols or logos.

**Background plate:** Use case: precise-object-edit. Remove only the small cyan lantern spirit and green wallet character sitting on the shop counter, including cap, cards and hands. Fill their positions naturally with the empty wooden countertop and shadowed shop. Preserve the dark left half, composition, counter, purple archway, amber lantern, ivy, coin chest, pixel art and stepped pixel clusters. Keep image dimensions/aspect ratio. No new characters, objects, text or logos.

## Revision — animated landing page and narration preparation

The landing page now uses the same character identities and understated CSS animation, disabled with reduced-motion preferences. The demo account input no longer has the additional editorial outer frame. `narration.txt` and `narration-direction.txt` prepare the voice-over; audio generation awaits a voice selection. The current MP4 remains silent.
