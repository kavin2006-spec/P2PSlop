// Reads the browser's own view of the connection (RTCPeerConnection.getStats()):
// which network path was chosen (direct or relayed), plus byte counters.

function describePath(local, remote) {
  const types = [local?.candidateType, remote?.candidateType];
  if (types.includes('relay')) return 'relayed (TURN)';
  if (types.every((t) => t === 'host')) return 'direct (same network)';
  return 'direct (NAT traversal)';
}

export async function readConnectionStats(pc) {
  const report = await pc.getStats();
  const byId = {};
  report.forEach((r) => {
    byId[r.id] = r;
  });

  let pair = null;
  report.forEach((r) => {
    if (r.type === 'transport' && r.selectedCandidatePairId) pair = byId[r.selectedCandidatePairId];
  });
  if (!pair) {
    report.forEach((r) => {
      if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected)) pair = r;
    });
  }
  if (!pair) return null;

  const local = byId[pair.localCandidateId];
  const remote = byId[pair.remoteCandidateId];
  return {
    path: describePath(local, remote),
    localType: local?.candidateType ?? '?',
    remoteType: remote?.candidateType ?? '?',
    protocol: local?.protocol ?? '?',
    browserRttMs: typeof pair.currentRoundTripTime === 'number' ? pair.currentRoundTripTime * 1000 : null,
    bytesSent: pair.bytesSent ?? 0,
    bytesReceived: pair.bytesReceived ?? 0,
  };
}
