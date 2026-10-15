# Roadmap

## Phase 0: Network Lab (in progress)
- [x] Transport interface, WebRTC peer with game + control channels
- [x] Manual invite/reply signalling (compressed single-string codes)
- [x] RTT, jitter, round-trip loss, path type (direct vs relayed), traffic
- [x] Fault injector: delay, jitter, loss, duplication, reordering, presets
- [x] Unit tests (23) and an automated two-page connection test
- [ ] Test with real friends (India, Hong Kong, Alaska, Mac/Safari) and log results in `docs/test-logs/`
- [ ] Decide whether TURN is needed based on those results
- [ ] Trystero rooms: random code + password + host approval

## Later
- [ ] Phase 1  Quake 3 spike: one browser hosts, others join over the WebRTC transport (OpenArena / own Q3 data)
- [ ] Phase 2  Rooms for up to 5 players inside the launcher
- [ ] Phase 3  Streamed-emulator module for retro couch co-op
- [ ] Phase 4  Launcher UI + game library manifests, data cache in IndexedDB
- [ ] More shooters (Xash3D / Half-Life family, others), rollback or other netcode experiments
