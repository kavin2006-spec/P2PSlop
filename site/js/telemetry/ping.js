// Application-level ping/pong over a Transport.
//
// It runs over the unreliable "game" channel on purpose: that is the same path game packets
// take, so loss and jitter measured here are what a game would actually feel. If the
// Transport is wrapped in a ChaosTransport, the injected trouble shows up in these numbers.

import { RttStats } from './rtt-stats.js';

export class Pinger {
  constructor(transport, { intervalMs = 200, now = () => performance.now() } = {}) {
    this.transport = transport;
    this.intervalMs = intervalMs;
    this.now = now;
    this.stats = new RttStats();
    this._seq = 0;
    this._timer = null;
  }

  start() {
    this.stop();
    this._timer = setInterval(() => this._tick(), this.intervalMs);
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  }

  _tick() {
    const t = this.now();
    this.stats.sweep(t);
    if (!this.transport.isOpen) return;
    const seq = ++this._seq;
    this.stats.onSend(seq, t);
    this.transport.send(JSON.stringify({ k: 'ping', s: seq }));
  }

  // Feed every incoming message here first. Returns true if it was a ping/pong
  // (and was handled), false if it is something else for the caller to deal with.
  handle(data) {
    if (typeof data !== 'string') return false;
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return false;
    }
    if (msg?.k === 'ping') {
      this.transport.send(JSON.stringify({ k: 'pong', s: msg.s }));
      return true;
    }
    if (msg?.k === 'pong') {
      this.stats.onPong(msg.s, this.now());
      return true;
    }
    return false;
  }
}
