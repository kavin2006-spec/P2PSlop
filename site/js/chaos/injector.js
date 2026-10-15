// Fault injection: break the network on purpose, like `tc netem` but inside the page.
//
// ChaosTransport wraps any Transport. Every packet SENT through it can be delayed,
// jittered, dropped, duplicated or reordered. Apply it on both tabs for symmetric trouble.
// Limits: it simulates trouble at the app level only; it cannot touch the real
// ICE/STUN/TURN path or the operating system's network stack.

import { Transport } from '../core/transport.js';

// Delay values are ONE-WAY (what this tab adds to the packets it sends).
// Use the same preset on both tabs: round-trip time is then about 2x the delay.
export const PRESETS = {
  clean: { label: 'Clean', delayMs: 0, jitterMs: 0, lossPct: 0, dupPct: 0, reorderPct: 0 },
  wifi: { label: 'Bad Wi-Fi', delayMs: 8, jitterMs: 20, lossPct: 2, dupPct: 0, reorderPct: 1 },
  nlIndia: { label: 'NL ↔ India', delayMs: 70, jitterMs: 12, lossPct: 0.5, dupPct: 0, reorderPct: 0 },
  indiaAlaska: { label: 'India ↔ Alaska', delayMs: 140, jitterMs: 25, lossPct: 1, dupPct: 0, reorderPct: 0.5 },
  awful: { label: 'Awful', delayMs: 150, jitterMs: 80, lossPct: 8, dupPct: 2, reorderPct: 5 },
};

// Pure function: decide what happens to ONE packet.
// Returns an array of delays in ms, one per copy that will be delivered.
//   []        -> packet dropped
//   [40]      -> delivered once after 40 ms
//   [40, 55]  -> duplicated
// `rng` is injectable so tests can be deterministic.
export function planDelivery(config, rng = Math.random) {
  if (rng() * 100 < config.lossPct) return [];

  const oneCopyDelay = () => {
    let delay = config.delayMs + (rng() * 2 - 1) * config.jitterMs;
    // Reorder: hold this packet back long enough for later ones to overtake it.
    if (rng() * 100 < config.reorderPct) delay += Math.max(20, config.jitterMs * 2);
    return Math.max(0, delay);
  };

  const copies = [oneCopyDelay()];
  if (rng() * 100 < config.dupPct) copies.push(oneCopyDelay());
  return copies;
}

export class ChaosTransport extends Transport {
  constructor(inner, config = PRESETS.clean, rng = Math.random) {
    super();
    this.inner = inner;
    this.config = { ...config };
    this.rng = rng;
    this.counters = { sent: 0, dropped: 0, duplicated: 0, delayed: 0 };

    inner.onmessage = (data) => this.onmessage?.(data);
    inner.onopen = () => this.onopen?.();
    inner.onclose = () => this.onclose?.();
  }

  get isOpen() {
    return this.inner.isOpen;
  }

  setConfig(partial) {
    Object.assign(this.config, partial);
  }

  send(data) {
    this.counters.sent++;
    const plan = planDelivery(this.config, this.rng);
    if (plan.length === 0) {
      this.counters.dropped++;
      return;
    }
    if (plan.length > 1) this.counters.duplicated++;
    for (const delay of plan) {
      if (delay < 1) {
        this.inner.send(data);
      } else {
        this.counters.delayed++;
        setTimeout(() => this.inner.send(data), delay);
      }
    }
  }

  close() {
    this.inner.close();
  }
}
