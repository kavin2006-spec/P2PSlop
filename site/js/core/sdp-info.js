// Reads the ICE candidates out of an SDP blob and explains what they mean.
// Only counts and types are reported, never IP addresses, so the result is safe to paste into a chat.
//
// Candidate types:
//   host   an address on the machine itself (browsers often hide it behind a random ".local" name)
//   srflx  the public address a STUN server saw: what a friend on another network needs
//   relay  an address on a TURN relay (we have none configured yet)
//   prflx  discovered during connection checks (never listed in an invite)

const LINE = /^a=candidate:(\S+) (\d+) (\S+) (\d+) (\S+) (\d+) typ (\w+)/;

export function summarizeCandidates(sdp) {
  const out = { total: 0, host: 0, mdns: 0, srflx: 0, prflx: 0, relay: 0, udp: 0, tcp: 0 };
  for (const line of String(sdp ?? '').split(/\r?\n/)) {
    const m = LINE.exec(line);
    if (!m) continue;
    const [, , , protocol, , address, , type] = m;
    out.total += 1;
    if (type in out) out[type] += 1;
    if (type === 'host' && address.endsWith('.local')) out.mdns += 1;
    if (protocol.toLowerCase() === 'udp') out.udp += 1;
    else if (protocol.toLowerCase() === 'tcp') out.tcp += 1;
  }
  return out;
}

export function formatSummary(s) {
  if (!s) return 'unknown';
  if (!s.total) return 'no candidates';
  const host = s.mdns ? `host ${s.host} (${s.mdns} hidden .local)` : `host ${s.host}`;
  return `${host}, srflx ${s.srflx}, relay ${s.relay}`;
}

const hasPublic = (s) => !!s && s.srflx + s.relay > 0;

// Plain-language reasons a connection failed, based only on what each side's code contained.
// `local` is this side's candidates, `remote` is the other side's.
export function explainFailure(local, remote) {
  const lines = [];
  if (local && !hasPublic(local)) {
    lines.push(
      'This side found no public address. STUN may be blocked here (VPN, firewall, school or work network), ' +
        'so the code you sent only works on the same network.',
    );
  }
  if (remote && !hasPublic(remote)) {
    lines.push(
      "The other side's code had no public address, so a connection across the internet could not work. " +
        'Ask them to check for a VPN or a blocking firewall.',
    );
  }
  if (!lines.length && local && remote) {
    lines.push(
      'Both codes had public addresses but the direct path still failed. The usual reason is a strict NAT ' +
        '(carrier-grade NAT, as on Starlink or mobile data). A TURN relay would likely fix it.',
    );
  }
  if (!lines.length) lines.push('Not enough information to say why. Press "Copy diagnostics" and send it over.');
  return lines;
}
