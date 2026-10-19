# ioquake3 source findings

Researched 2026-10-15 by reading the source directly: `github.com/ioquake/ioq3`, branch `main`
(HEAD was `87a99d18206e878a20289f05ac3c16005dcae5c3` when checked; files were fetched from `main`, so line numbers
may drift). Everything below is **[read]** in the source unless tagged **[design inference]** or **[unverified]**.

## Netcode numbers (answers the open items in netcode.md)

| Setting | Value | Where |
|---|---|---|
| `sv_fps` (server frame rate) | 20 | `code/server/sv_init.c:667` |
| `snaps` (client-requested snapshots/s) | 20 default, clamped to `sv_fps`; missing = 50 ms | `cl_main.c:3669`, `sv_client.c:1442-1452` |
| `cl_maxpackets` (client packets/s) | 30 default, clamped 15-125 | `cl_main.c:3592`, `cl_input.c:707-714` |
| `cl_packetdup` | 1 | `cl_main.c:3593` |
| Client `rate` | 25000 default; server clamps 1000-90000 (3000 if unset) | `cl_main.c:3668`, `sv_client.c:1417-1430` |
| `MAX_PACKETLEN` / `FRAGMENT_SIZE` / header | 1400 / 1300 / 10 bytes | `code/qcommon/net_chan.c:50-53` |

So the server sends at most 20 snapshots a second (one every 50 ms) and a client sends up to 30 command packets a second.
Correction to Sanglard's article: 1,400 bytes is the maximum packet; message fragments carry 1,300 bytes.
Client-side prediction exists (`CG_PredictPlayerState`, `cg_predict.c:412`; off-switch `cg_nopredict`, default 0).
Snapshot interpolation machinery exists in cgame (`cg.nextSnap`, `cent->interpolate`, `cg_snapshot.c`).
**[design inference]** Remote players are drawn between snapshots 50 ms apart, so expect that on top of network latency.

## Quake 3 already ships fault injection
- `cl_packetdelay` and `sv_packetdelay`: delay outgoing packets by N ms (`net_chan.c:555-560`, defined `common.c:2775-2776`,
  flagged `CVAR_CHEAT`).
- `net_dropsim`: drops N% of *incoming* packets (`net_ip.c:1638-1641`).
Delay and loss only, no jitter, duplication or reordering. Useful as an independent cross-check of the Network Lab's injector.

## The network layer has two chokepoints
- **Outbound:** every datagram goes through `NET_SendPacket` (`net_chan.c:537`), which ends in `Sys_SendPacket`
  (`net_ip.c`, uses `sendto`). The delayed-packet queue also ends there (`net_chan.c:528`).
- **Inbound:** `NET_Event` (`net_ip.c:1625`) calls `NET_GetPacket` (`recvfrom`) and hands each packet to the server
  (`Com_RunAndTimeServerPacket`) if a server is running, otherwise to the client (`CL_PacketEvent`).
- Sockets are UDP (`SOCK_DGRAM`) only.
- The engine's own local player uses a loopback address (`NA_LOOPBACK`, `net_chan.c:544`), not a socket.
- Addresses are `netadr_t` (type, 4-byte IP, port). The server tells clients apart by address.

## Listen server is built into the normal client
`SV_Frame` runs in non-dedicated builds (`sv_main.c:1097`: bots are stepped `if (!com_dedicated->integer)`), and a
running server takes all inbound socket packets (`NET_Event`). Hosting from a normal client is a first-class mode,
not a hack. **[unverified]** that it works in the WebAssembly build.

## WebAssembly support is upstream
- The README lists "Web support via Emscripten" and gives a build recipe: `emcmake cmake -S . -B build`, then
  `cmake --build build`, put pk3 files in `build/Release/baseq3`, serve with any web server, open `ioquake3.html`.
- Game files are listed in `client-config.json`, or packed into one `.data` file with `EMSCRIPTEN_PRELOAD_FILE=1`.
- `sys_main.c:890` uses `emscripten_set_main_loop`; `common.c:2754` skips manual frame throttling under Emscripten.
- Game logic: `vm.c:658` falls back to the bytecode interpreter on architectures with no compiler, so the QVM game
  modules are likely interpreted in WebAssembly **[unverified]**; performance for 5 players is unmeasured.

This makes upstream ioq3 a better base than the older QuakeJS fork, whose gateway design is separate (see netcode.md).

## Emscripten networking limits  [read]
Source: https://emscripten.org/docs/porting/networking.html
- "Direct UDP communication is not available in browsers."
- By default Emscripten emulates sockets over WebSockets (needs something like WebSockify on the server side),
  and says the emulation "is not very complete at the moment".
- WebRTC data channels are named as the closest alternative, but "Currently Emscripten does not provide a C/C++ API
  for interacting with WebRTC."
So the WebRTC bridge must be our own JavaScript glue called from C.

## Phase 1 sketch  [design inference]
1. Build upstream ioq3 with Emscripten and free game data (OpenArena, or the demo data). Confirm it runs with bots.
2. Start a local listen server in the browser build and check the server really runs.
3. Replace `Sys_SendPacket` and `NET_GetPacket` with calls into JavaScript that use the Network Lab's `Transport`.
4. Give each WebRTC peer a synthetic address. **Gotcha:** `Sys_IsLANAddress` treats 10/8, 172.16/12, 192.168/16,
   127/8 and local subnets as LAN, and `sv_lanForceRate` defaults to 1, which sets `rate` to 99999 (no limit) for LAN
   clients (`sv_client.c:1416-1418`, `sv_init.c:685`). Pick non-private fake addresses, or set `sv_lanForceRate 0`.
5. Connect a second browser. Then run the Network Lab's fault injector against it and compare with `net_dropsim` /
   `cl_packetdelay`.

Not yet known: how much of the Emscripten build's networking code must change, whether the data channel's SCTP
message limits cause trouble for 1,300-byte fragments (unlikely), and whether the browser build runs the server fast enough.
