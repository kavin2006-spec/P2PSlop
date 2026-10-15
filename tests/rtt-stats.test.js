import test from 'node:test';
import assert from 'node:assert/strict';
import { RttStats } from '../site/js/telemetry/rtt-stats.js';
import { Pinger } from '../site/js/telemetry/ping.js';
import { Transport } from '../site/js/core/transport.js';
import { verdict } from '../site/js/telemetry/panel.js';

test('RTT is pong time minus ping time', () => {
  const s = new RttStats();
  s.onSend(1, 1000);
  assert.equal(s.onPong(1, 1042), 42);
  assert.equal(s.snapshot().last, 42);
});

test('unknown or duplicate pongs are ignored and counted', () => {
  const s = new RttStats();
  s.onSend(1, 0);
  s.onPong(1, 10);
  assert.equal(s.onPong(1, 20), null);
  assert.equal(s.onPong(99, 20), null);
  assert.equal(s.snapshot().unmatched, 2);
  assert.equal(s.snapshot().received, 1);
});

test('pings older than the timeout count as lost', () => {
  const s = new RttStats({ lossTimeoutMs: 1000 });
  s.onSend(1, 0);
  s.onSend(2, 100);
  s.onPong(2, 140);
  s.sweep(1200);
  const snap = s.snapshot();
  assert.equal(snap.lossPct, 50);
  assert.equal(snap.avg, 40);
});

test('a pong arriving after the timeout does not resurrect a lost ping', () => {
  const s = new RttStats({ lossTimeoutMs: 1000 });
  s.onSend(1, 0);
  s.sweep(1500);
  assert.equal(s.onPong(1, 1600), null);
  assert.equal(s.snapshot().lossPct, 100);
});

test('min, max, avg over the window', () => {
  const s = new RttStats();
  [10, 20, 60].forEach((rtt, i) => {
    s.onSend(i, 0);
    s.onPong(i, rtt);
  });
  const snap = s.snapshot();
  assert.equal(snap.min, 10);
  assert.equal(snap.max, 60);
  assert.equal(snap.avg, 30);
});

test('jitter is zero for a constant RTT and grows when RTT varies', () => {
  const steady = new RttStats();
  const noisy = new RttStats();
  for (let i = 0; i < 40; i++) {
    steady.onSend(i, 0);
    steady.onPong(i, 50);
    noisy.onSend(i, 0);
    noisy.onPong(i, i % 2 ? 30 : 90);
  }
  assert.equal(steady.snapshot().jitter, 0);
  assert.ok(noisy.snapshot().jitter > 20);
});

test('window keeps only the most recent results', () => {
  const s = new RttStats({ window: 5 });
  for (let i = 0; i < 20; i++) {
    s.onSend(i, 0);
    s.onPong(i, i);
  }
  assert.equal(s.results.length, 5);
  assert.equal(s.snapshot().min, 15);
});

test('Pinger answers pings and measures pongs', () => {
  class Fake extends Transport {
    out = [];
    get isOpen() { return true; }
    send(d) { this.out.push(d); }
  }
  let clock = 0;
  const t = new Fake();
  const p = new Pinger(t, { now: () => clock });

  p._tick(); // sends ping seq 1 at t=0
  assert.equal(JSON.parse(t.out[0]).k, 'ping');
  clock = 37;
  assert.equal(p.handle(JSON.stringify({ k: 'pong', s: 1 })), true);
  assert.equal(p.stats.snapshot().last, 37);

  assert.equal(p.handle(JSON.stringify({ k: 'ping', s: 7 })), true);
  assert.deepEqual(JSON.parse(t.out[1]), { k: 'pong', s: 7 });

  assert.equal(p.handle('hello'), false);
  assert.equal(p.handle(new ArrayBuffer(4)), false);
});

test('verdict reflects RTT and loss', () => {
  assert.equal(verdict({ avg: null }).level, 'wait');
  assert.equal(verdict({ avg: 30, lossPct: 0 }).level, 'great');
  assert.equal(verdict({ avg: 120, lossPct: 0 }).level, 'good');
  assert.equal(verdict({ avg: 200, lossPct: 0 }).level, 'ok');
  assert.equal(verdict({ avg: 300, lossPct: 0 }).level, 'bad');
  assert.equal(verdict({ avg: 30, lossPct: 9 }).level, 'bad');
});
