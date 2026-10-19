# Decisions log

- 2026-10-15  Plain JavaScript + ES modules, no bundler, no TypeScript (simple, deploys straight to GitHub Pages).
- 2026-10-15  Trystero vendored as a pinned copy in `site/vendor/` (no CDN dependency). Add when needed.
- 2026-10-15  Node's built-in test runner for logic tests, no framework.
- 2026-10-15  Host-based star topology: one player's browser hosts, others connect to it.
- 2026-10-15  Game library lives in `site/library/` as per-game manifests, separate from engine code. Created in Phase 1.
- 2026-10-15  `games/`, `library/`, `vendor/` are created when first needed, not as empty folders.
- 2026-10-15  Game data/ROMs are never committed or uploaded; `.gitignore` blocks them.
- 2026-10-15  Project name TBD; decide when creating the GitHub repo.
- 2026-10-15  `package.json` exists only for `"type": "module"` and the `serve`/`test` scripts. No dependencies.
- 2026-10-15  Phase 0 signalling is manual copy/paste (invite + reply, ~580 chars each, deflate + base64url). Trystero rooms replace it later without touching `peer.js` internals.
- 2026-10-15  Two data channels per peer: `game` (unordered, no retransmits, like UDP) and `control` (reliable). Pings run over `game` so they feel what games feel.
- 2026-10-15  Fault injection is egress-only per tab, simulated at app level. Delays are one-way; use the same preset on both tabs.
- 2026-10-15  Client-server with one hosting browser, not lockstep: lockstep gives everyone the worst pair's lag (India/Alaska ~250 ms). See `docs/research/`.
- 2026-10-15  Lab presets use half of Azure's published P50 RTT as one-way delay; Alaska presets are labelled estimates; jitter/loss values are assumptions until measured.
- 2026-10-15  Phase 1 base is upstream ioq3 (it has Emscripten support) rather than the older QuakeJS fork. Swap point: `Sys_SendPacket` / `NET_GetPacket`. Peers get synthetic non-private addresses (see `docs/research/ioquake3.md`).
- 2026-10-15  Google's public STUN server is the default. No TURN yet; Network Lab tests will show which friend pairs need one.
- 2026-10-19  After the first Alaska test failed, the lab records why: candidate types per side (counts only, no IPs), gather time, state timeline, a plain-language failure explanation, a Copy diagnostics button, and Start over. The cause of that failure is not yet known.
