# FOUND narrated demo

44 seconds, 1920×1080, 30 fps, H.264 MP4 with AAC narration. Faye preset, generated with Seed Audio 1.0 through Higgsfield. Also understandable without sound; English captions are available.

Run `python3 demo/serve.py` and open http://127.0.0.1:8086/ to preview. The local server supports byte-range requests, so the video timeline can seek before playback. Export: `output/found-demo.mp4`. Poster: `output/poster.png`. Contact sheet: `output/storyboard.jpg`.

## Story

| Time | Message | Visual |
| --- | --- | --- |
| 0–5 s | Unstaked your NEAR? It might still be waiting for you. | Night shop, floating lantern spirit, blinking wallet |
| 5–10 s | Paste a NEAR account. | Genuine ru.near input capture, subtle tap cue |
| 10–17 s | See what’s ready. | Real LiNEAR result, account and block visible |
| 17–24 s | Use the official app. | Actual withdrawal instructions; owner approval required |
| 24–30 s | One account. One check. | Real Meta Pool result; LiNEAR + Meta Pool coverage |
| 30–37 s | 538 accounts. NEAR waiting. | Dated LiNEAR waiting-room snapshot |
| 37–44 s | Find the NEAR you left behind. | Night shop, public demo URL, and NEAR mark with “Built on NEAR” |

Visual direction: original dark navy/violet/amber scene, DM Sans, restrained crossfades, tiny drifting lights. The lantern and wallet advance together: a small search sweep, a discovery hop, then a walk toward the official-app handoff. Positions persist through the middle scenes; there are no speech bubbles, confetti, fake balance counters, or recovery claims.

## Evidence and editorial treatment

The UI shots are actual browser captures of the Railway deployment on 10 November 2026. They are cropped, resized and edited together, not a continuous screen recording. No UI values were redrawn or substituted. `captures/provenance-hd.json` preserves the two accounts, observed blocks, source URL and capture time. The pixel-art characters are decorative animation outside the captured UI.

- ru.near: LiNEAR, 500.3072 NEAR displayed, block 223957418.
- lb3.near: Meta Pool, 17,502.401 NEAR displayed, block 223957726.
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

## Narration and character progression

`assets/narration-source.flac` is the lossless generated source. `narration-timing.json` records the exact voice, job ID, parameters, and seven phrase cuts. `narrate.py` extends inter-scene silence and normalizes to -18 LUFS / -2 dBTP; speech is not sped up. `render.py` calls it automatically. Pass `--silent` to render a separate silent version. `output/captions.vtt` provides English captions.

Audio wording was checked with a local faster-whisper transcription, including the 538 figure. This is an automated check, not a claim of human listening review. No music or additional sound effects are mixed in.

On the landing page, character motion follows the real scan state: search while reading RPC, a small hop only for a ready balance, and a guided step when withdrawal instructions open. Empty, pending, and error states do not celebrate a find. Reduced-motion preferences disable all movement. The progression ends at the official app handoff, never a pretend completed withdrawal.

## UI clarity pass

The export renders text and graphics natively at 1080p. All five UI shots were recaptured from the live site using `capture-frame.html` (600×1080 CSS viewport, 2× browser rendering) and cropped to measured element bounds. This gives readable type without enlarging the old compressed desktop shots. The leaderboard excerpt includes its complete heading and first three complete rows, rather than shrinking the whole desktop table. Original captures remain archived.

The renderer adds no stroke or frame around UI shots. Rounded masks follow the existing component corners. Input and leaderboard crops have breathing room and soft edge masks; the input's focus halo is absent and its tap cue is centered on the button. Each of the seven scenes was visually checked for clipping, overlap, duplicate borders, and readable labels.

The closing frame uses the same NEAR mark as the app (`dist/near.svg`), rasterized in the existing cream foreground color as `assets/near-mark.png`. The mark’s geometry is unchanged.
