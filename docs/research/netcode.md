# Netcode

## Three models  [relayed]
Source: https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/
(The fetched summary said the article covers these three; it does not cover snapshot interpolation or jitter buffers.)

1. **Peer-to-peer lockstep** (RTS games). Machines exchange commands, not state, and each runs the same simulation.
   Low bandwidth, hard determinism. Quote: "each player in the game has latency equal to the most lagged player."
2. **Client/server** (action games). Clients send inputs to one server that returns state. Quality depends on each
   client's own connection to the server, not the slowest peer. Every action still waits a round trip.
3. **Client-side prediction** (modern FPS). The client applies its own inputs immediately; the server stays authoritative
   and corrects it, and the client replays buffered inputs. "The Server Is The Man."

Flag: the summary lists Doom under client/server. Vanilla Doom is, as far as I know, peer-to-peer lockstep **[unverified]**.
Check the original text and the Doom Wiki before citing either way.
Also relayed: Doom's design targeted connections under 200 ms.

## Why not lockstep here  [estimate]
Worst pair among the five players is India / Alaska at about 250 ms (see latency.md), so every player would feel at
least that. A client-server host in Hong Kong or the Netherlands caps any guest at about 200 ms.

## Quake 3 network model  [read]
Source: https://mail.fabiensanglard.net/quake3/network.php

- UDP only. "There is no trace of TCP/IP anywhere": reliable transmission added "intolerable latency".
- Principle: information "not received on first transmission is not worth sending again", because it will be too old.
- A NetChannel module abstracts communication. Critical messages (player quits, level change) are guaranteed through it.
- The server keeps the last 32 gamestates sent to each client ("snapshots"; about 8 MB for 4 players).
- Each update is a delta against the last snapshot the client acknowledged. If none is usable, it compares against an
  all-zero dummy and sends a full update. Example in the article: 132 bits for a full entity vs 36 bits when one field changed.
- Packet loss is handled by this scheme: the next delta is computed against an older acknowledged snapshot.
- Messages are sliced into 1,400-byte chunks to avoid fragmentation on 1,500-byte MTUs.

### Not covered by that article, now checked in the source  [read]
Client-side prediction, snapshot interpolation and the rate settings are all in the ioquake3 code. `sv_fps` is 20, so
the server sends at most 20 snapshots a second. Details and line references are in [ioquake3.md](ioquake3.md).
One correction to the article: 1,400 bytes is the maximum packet; fragments carry 1,300 bytes of data.

## What this means for the project
- The `game` channel is unordered with no retransmits (UDP-like), matching how Quake 3 already works.
- Quake 3's packets are at most 1,400 bytes (1,300-byte fragments), so each fits in one datagram.
- Quake 3 provides its own reliability for critical messages, so it does not need a reliable WebRTC channel.
- Open question for Phase 1: can the browser build run the server side (listen server) so one player's browser hosts?
  The source says listen servers are built into the normal client, and upstream ioq3 builds with Emscripten, but nobody
  has shown it working over WebRTC (see [ioquake3.md](ioquake3.md)).
  The existing Q3JS browser port connects through a WebSocket-to-UDP gateway (https://q3js.com/quake-3-webassembly [read]).
