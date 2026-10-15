// The single interface that everything above the network talks to.
//
//   games  -> send()/onmessage      (Quake 3's packets will go through here in Phase 1)
//   chaos  -> wraps a Transport and breaks it on purpose
//   telemetry -> pings over a Transport
//
// Anything with this shape is a Transport, so layers can be stacked:
//   DataChannelTransport  ->  ChaosTransport  ->  game / pinger

export class Transport {
  constructor() {
    this.onmessage = null; // (data: string | ArrayBuffer) => void
    this.onopen = null;
    this.onclose = null;
  }
  get isOpen() {
    return false;
  }
  send(_data) {
    throw new Error('send() not implemented');
  }
  close() {}
}

// A Transport backed by one RTCDataChannel.
export class DataChannelTransport extends Transport {
  constructor(channel) {
    super();
    this.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.addEventListener('message', (e) => this.onmessage?.(e.data));
    channel.addEventListener('open', () => this.onopen?.());
    channel.addEventListener('close', () => this.onclose?.());
  }
  get label() {
    return this.channel.label;
  }
  get isOpen() {
    return this.channel.readyState === 'open';
  }
  send(data) {
    // Silently ignore sends on a closed channel; games send every frame and
    // should not crash the page when a peer drops.
    if (this.isOpen) this.channel.send(data);
  }
  close() {
    this.channel.close();
  }
}
