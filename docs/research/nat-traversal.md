# NAT traversal: how two browsers connect

## WebRTC pieces  [read]
Source: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity
(The page itself says it needs heavy rewriting and is thin on STUN/TURN; use it for definitions only.)

- WebRTC has no built-in way to find peers, so it needs a **signalling** channel ("any sort of channel of
  communication to exchange information before setting up a connection"). Ours is a pasted code.
- Peers exchange **session descriptions** (SDP): the caller's **offer**, the recipient's **answer**.
- **ICE candidates** list the ways a peer can be reached: `host` (real local address), `srflx` (address seen by a
  STUN server), `prflx` (learned during the connection from a NAT in between), `relay` (via a TURN server).
- One peer is the controlling agent and picks the final candidate pair.

## Hole punching and NAT types  [read]
Source: https://tailscale.com/blog/how-nat-traversal-works

- Most NATs and firewalls allow inbound UDP only after a matching outbound packet. Two peers send at each other at
  roughly the same time and both NATs open: "packets must flow out before packets can flow back in."
- **STUN** tells a peer which public ip:port its packet came from. It only works if the STUN request used the same
  socket as the real traffic.
- **Easy NAT**: endpoint-independent mapping, the same public port for every destination. STUN hole punching works.
- **Hard NAT**: a different mapping for each destination, so the port learned from STUN is useless to the peer.
- **Birthday-paradox trick**: against one hard NAT, 2,048 random probes give a 99.9% chance of success. With two hard NATs,
  success after 20 seconds is about 0.01%.
- **CGNAT** (carrier-grade NAT) means the ISP applies NAT on top of your router. Port-mapping protocols often fail and
  hairpinning is often unsupported.
- Relays are the fallback. The author estimates "a direct connection over 90% of the time" with basic techniques. That is
  Tailscale's own estimate for its own methods, not a WebRTC measurement.

## How often does WebRTC need TURN?  [read]
No reliable number exists.
- https://bloggeek.me/webrtcglossary/turn/ : "anything between 0 and 50 percent sessions to go via relay", depending on
  the audience; no source or method given. Advises measuring your own traffic.
- https://www.nojitter.com/know-where-turn-when-deploying-webrtc : 22% of *failed* calls needed a relay (attributed to
  Callstats.io); this is not a share of all sessions.

## What this means for us
- Home broadband pairs will usually connect. Mobile data and CGNAT are the likely failures.
- I believe browser ICE does not do birthday-paradox port guessing, so two hard NATs would need TURN **[unverified]**.
- Our Network Lab has no TURN, so such a pair shows up as a failed connection, not "relayed".
- For the friend test: ask everyone to try home Wi-Fi first, and note anyone on mobile data or a known CGNAT.
- The share of friend pairs that need TURN is exactly what `docs/test-logs/` will measure.
