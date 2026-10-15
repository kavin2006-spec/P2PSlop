import test from 'node:test';
import assert from 'node:assert/strict';
import { planDelivery, PRESETS, ChaosTransport } from '../site/js/chaos/injector.js';
import { Transport } from '../site/js/core/transport.js';

const none = { delayMs: 0, jitterMs: 0, lossPct: 0, dupPct: 0, reorderPct: 0 };

// Deterministic "random" source that replays a fixed list of numbers.
const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('clean config delivers once with zero delay', () => {
  assert.deepEqual(planDelivery(none, seq(0.5)), [0]);
});

test('100% loss drops everything', () => {
  assert.deepEqual(planDelivery({ ...none, lossPct: 100 }, seq(0.5)), []);
});

test('0% loss never drops', () => {
  for (let i = 0; i < 50; i++) assert.equal(planDelivery(none, Math.random).length, 1);
});

test('delay stays within delay +/- jitter and is never negative', () => {
  const cfg = { ...none, delayMs: 50, jitterMs: 20 };
  for (let i = 0; i < 500; i++) {
    const [d] = planDelivery(cfg);
    assert.ok(d >= 30 && d <= 70, `delay ${d} out of range`);
  }
  const small = { ...none, delayMs: 5, jitterMs: 50 };
  for (let i = 0; i < 500; i++) assert.ok(planDelivery(small)[0] >= 0);
});

test('100% duplication delivers two copies', () => {
  assert.equal(planDelivery({ ...none, dupPct: 100 }, seq(0.99, 0.5)).length, 2);
});

test('reordering holds a packet back by at least 20 ms', () => {
  // rng calls: loss roll, jitter roll, reorder roll, dup roll
  const [d] = planDelivery({ ...none, reorderPct: 100 }, seq(0.99, 0.5, 0.0, 0.99));
  assert.ok(d >= 20);
});

test('measured loss rate is close to configured loss rate', () => {
  const cfg = { ...none, lossPct: 10 };
  let dropped = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) if (planDelivery(cfg).length === 0) dropped++;
  const pct = (dropped / n) * 100;
  assert.ok(pct > 8.5 && pct < 11.5, `loss ${pct}%`);
});

test('presets are well-formed', () => {
  for (const [id, p] of Object.entries(PRESETS)) {
    for (const k of ['delayMs', 'jitterMs', 'lossPct', 'dupPct', 'reorderPct']) {
      assert.equal(typeof p[k], 'number', `${id}.${k}`);
    }
  }
});

test('ChaosTransport counts drops and forwards the rest', () => {
  class Fake extends Transport {
    sent = [];
    get isOpen() { return true; }
    send(d) { this.sent.push(d); }
  }
  const inner = new Fake();
  const chaos = new ChaosTransport(inner, { ...none, lossPct: 100 });
  chaos.send('a');
  chaos.send('b');
  assert.equal(inner.sent.length, 0);
  assert.equal(chaos.counters.dropped, 2);

  chaos.setConfig({ lossPct: 0 });
  chaos.send('c');
  assert.deepEqual(inner.sent, ['c']);
});

test('ChaosTransport passes received messages up unchanged', () => {
  class Fake extends Transport {}
  const inner = new Fake();
  const chaos = new ChaosTransport(inner);
  const got = [];
  chaos.onmessage = (d) => got.push(d);
  inner.onmessage('hello');
  assert.deepEqual(got, ['hello']);
});
