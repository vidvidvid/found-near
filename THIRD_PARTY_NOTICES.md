# Credits and third-party notices

FOUND’s original code and documentation are available under [MIT](LICENSE). Third-party code, reference source copies, fonts and trademarks retain their own terms. MIT does not grant rights to the NEAR name or mark, or replace licenses of protocol references.

- **NEAR Connect** (`@hot-labs/near-connect` 0.12.0), by HOT Labs, declares MIT in its [package metadata](https://github.com/hot-dao/near-selector/blob/main/package.json). Its published package has no separate LICENSE file. The pinned browser bundle preserves any legal comments through esbuild’s `legalComments: eof`; FOUND does not claim authorship of that bundle.
- **esbuild** 0.28.2, MIT, builds the connector. Its license appears below.
- **Node.js**, its **SQLite** interface, and the Alpine/su-exec deployment dependencies retain their upstream licenses. These are not FOUND-authored code.
- **FastNEAR** supplies staking-account discovery and RPC; **Intear** supplies fallback RPC and full-state census reads; **dRPC** supplied census RPC reads. **Railway** hosts the app and persistent recovery database. These are service dependencies, not proof of complete discovery or availability.
- **LiNEAR, Meta Pool, rNEAR and NEAR’s staking pools** supply the existing contracts. Pinned references and limitations are linked in [RESEARCH.md](RESEARCH.md). Copies under research are reference material governed by their original repositories’ licenses.
- **DM Sans**, SIL Open Font License 1.1: [bundled license](demo/assets/FONT-LICENSE.txt). The app loads it from Google Fonts with system fallbacks.
- **NEAR mark**: used to identify the network, without claiming endorsement or ownership. The symbol is not MIT-licensed by FOUND; [NEAR’s terms](https://www.near.org/terms-of-use) reserve trademark rights. The former brand-page URL is unavailable, so no separate broad trademark permission is claimed here.
- **OpenAI Codex / ChatGPT** assisted with code, research, testing, documentation and design. **Kimi** supplied independent reviews and implementation assistance; the owner also confirmed use of **Anthropic Claude**. AI-assisted review is not a security audit. No AI model runs in the balance or withdrawal path.
- **OpenAI’s built-in image-generation tool** generated the original night-shop illustration, plate and character atlas. CSS and Python animate those assets; they are not hand-drawn artwork. Prompts and references: [demo README](demo/README.md).
- **Higgsfield / Seed Audio 1.0, Faye preset** generated the synthetic narration. Voice job IDs and settings: [narration metadata](demo/narration-timing.json). The code license does not license the provider’s voice preset or model.
- **Python, Pillow and FFmpeg** compose the demo; **faster-whisper** checks narration automatically. These are development tools, not app runtime dependencies.

Any project-owned rights in the original generated assets are offered under MIT. This makes no claim of exclusive copyright in AI output or rights in third-party marks, voices or models. Provider terms still apply to using the generation services themselves.

## esbuild license

```text
MIT License

Copyright (c) 2020 Evan Wallace

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
