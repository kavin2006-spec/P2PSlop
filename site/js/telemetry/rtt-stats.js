// Pure math for ping/pong measurements (no browser APIs, so it is unit-tested in Node).
//
// Loss here is ROUND-TRIP loss: a ping or its pong went missing, we can't tell which.
// Jitter is the smoothed average change between consecutive RTTs (RFC 3550 style, 1/16 gain).

export class RttStats {
  constructor({ window = 100, lossTimeoutMs = 2000 } = {}) {
    this.windowSize = window;
    this.lossTimeoutMs = lossTimeoutMs;
    this.pending = new Map(); // seq -> time sent
    this.results = []; // last N outcomes: rtt in ms, or null for a lost ping
    this.sent = 0;
    this.received = 0;
    this.unmatched = 0; // pongs that arrived after we gave up (or duplicates)
    this.last = null;
    this.jitter = 0;
    this._prev = null;
  }

  onSend(seq, now) {
    this.pending.set(seq, now);
    this.sent++;
  }

  // Returns the RTT in ms, or null if this pong was unknown/late/duplicate.
  onPong(seq, now) {
    const sentAt = this.pending.get(seq);
    if (sentAt === undefined) {
      this.unmatched++;
      return null;
    }
    this.pending.delete(seq);
    const rtt = now - sentAt;
    this.received++;
    this.last = rtt;
    if (this._prev !== null) this.jitter += (Math.abs(rtt - this._prev) - this.jitter) / 16;
    this._prev = rtt;
    this._push(rtt);
    return rtt;
  }

  // Call regularly: pings older than the timeout are counted as lost.
  sweep(now) {
    for (const [seq, sentAt] of this.pending) {
      if (now - sentAt > this.lossTimeoutMs) {
        this.pending.delete(seq);
        this._push(null);
      }
    }
  }

  _push(value) {
    this.results.push(value);
    if (this.results.length > this.windowSize) this.results.shift();
  }

  snapshot() {
    const rtts = this.results.filter((v) => v !== null);
    const lost = this.results.length - rtts.length;
    const n = rtts.length;
    return {
      last: this.last,
      avg: n ? rtts.reduce((a, b) => a + b, 0) / n : null,
      min: n ? Math.min(...rtts) : null,
      max: n ? Math.max(...rtts) : null,
      jitter: n > 1 ? this.jitter : null,
      lossPct: this.results.length ? (lost / this.results.length) * 100 : null,
      sent: this.sent,
      received: this.received,
      unmatched: this.unmatched,
      samples: this.results.slice(-60),
    };
  }
}
