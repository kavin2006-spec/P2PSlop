# Architecture

## Idea
One launcher core + game modules.

Launcher core (shared by every game):
- rooms: random room code + password, host approves joiners, player cap
- peer: WebRTC connections (host = star centre, others connect to the host)
- transport: the single send/receive interface that games plug into
- telemetry: RTT, jitter, loss, direct-vs-relay, per-frame stats
- chaos: fault injector wrapping the transport (delay, jitter, loss, duplication, reorder)

Game modules (two kinds):
1. Engine module (shooters): WASM engine with its network layer swapped for `transport`.
   First target: Quake 3 (ioquake3 / OpenArena data). One browser hosts the game server.
2. Streamed-emulator module (couch co-op): host runs the emulator, streams video/audio,
   guests send controller input back.

## Key constraint
Friends span NL, India, Hong Kong and Alaska, so round-trip times of roughly 130-300 ms are expected.
Client-server engines with prediction are the fit. Lockstep netcode is not.

## Open questions
- Can the Quake 3 WASM build run a listen server in-browser? (Phase 1 spike)
- How many friend pairs need a TURN relay? (measured with the Network Lab)
