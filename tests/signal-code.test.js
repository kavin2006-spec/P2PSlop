import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSignal, decodeSignal } from '../site/js/core/signal-code.js';

const sdp = 'v=0\r\n' + 'a=candidate:1 1 udp 2113937151 192.168.1.20 54321 typ host\r\n'.repeat(12);

test('encode/decode round-trips a session description', async () => {
  const code = await encodeSignal({ type: 'offer', sdp });
  assert.ok(code.startsWith('p2p1.'));
  assert.deepEqual(await decodeSignal(code), { type: 'offer', sdp });
});

test('code is compressed, URL-safe and has no whitespace', async () => {
  const code = await encodeSignal({ type: 'answer', sdp });
  assert.ok(code.length < sdp.length);
  assert.match(code, /^[A-Za-z0-9._-]+$/);
});

test('decode tolerates whitespace added by chat apps', async () => {
  const code = await encodeSignal({ type: 'offer', sdp });
  const wrapped = '  ' + code.replace(/(.{40})/g, '$1\n') + '\n';
  assert.equal((await decodeSignal(wrapped)).type, 'offer');
});

test('decode rejects foreign and damaged codes with a clear error', async () => {
  await assert.rejects(decodeSignal('hello'), /not a P2P connection code/);
  await assert.rejects(decodeSignal('p2p1.AAAA'), /damaged/);
});
