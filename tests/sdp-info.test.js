import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCandidates, formatSummary, explainFailure } from '../site/js/core/sdp-info.js';

// Shaped like what Chrome puts in an offer. Addresses are documentation-range examples.
const SDP = [
  'v=0',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'a=candidate:1 1 udp 2113937151 3f2a1b9c-0d4e-4c11-9a7e-5b6d7c8e9f00.local 54321 typ host generation 0',
  'a=candidate:2 1 udp 1677729535 203.0.113.7 54321 typ srflx raddr 0.0.0.0 rport 0 generation 0',
  'a=candidate:3 1 tcp 1518280447 192.0.2.10 9 typ host tcptype active generation 0',
  'a=candidate:4 1 udp 41885439 198.51.100.4 3478 typ relay raddr 0.0.0.0 rport 0',
  'a=ice-ufrag:abcd',
].join('\r\n');

test('counts candidates by type and protocol', () => {
  const s = summarizeCandidates(SDP);
  assert.equal(s.total, 4);
  assert.equal(s.host, 2);
  assert.equal(s.mdns, 1);
  assert.equal(s.srflx, 1);
  assert.equal(s.relay, 1);
  assert.equal(s.udp, 3);
  assert.equal(s.tcp, 1);
});

test('handles empty or missing SDP', () => {
  assert.equal(summarizeCandidates('').total, 0);
  assert.equal(summarizeCandidates(undefined).total, 0);
  assert.equal(formatSummary(summarizeCandidates('')), 'no candidates');
  assert.equal(formatSummary(null), 'unknown');
});

test('summary text never contains addresses', () => {
  const text = formatSummary(summarizeCandidates(SDP));
  assert.equal(text, 'host 2 (1 hidden .local), srflx 1, relay 1');
  assert.doesNotMatch(text, /203\.0\.113|192\.0\.2|198\.51/);
});

const withPublic = { total: 2, host: 1, mdns: 1, srflx: 1, prflx: 0, relay: 0 };
const localOnly = { total: 1, host: 1, mdns: 1, srflx: 0, prflx: 0, relay: 0 };

test('explains a side that found no public address', () => {
  const mine = explainFailure(localOnly, withPublic).join(' ');
  assert.match(mine, /This side found no public address/);
  const theirs = explainFailure(withPublic, localOnly).join(' ');
  assert.match(theirs, /other side's code had no public address/);
});

test('blames NAT only when both sides had public addresses', () => {
  const text = explainFailure(withPublic, withPublic).join(' ');
  assert.match(text, /strict NAT/);
  assert.match(text, /TURN/);
});

test('says so when there is not enough information', () => {
  assert.match(explainFailure(null, null).join(' '), /Not enough information/);
});
