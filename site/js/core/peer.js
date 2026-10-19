// One WebRTC connection to one other browser, with two data channels:
//
//   game     unordered, no retransmits  (like UDP: game packets and pings)
//   control  ordered, reliable          (like TCP: handshake, chat, hash checks)
//
// Signalling is manual for now: createOffer() -> text -> acceptOffer() -> text -> acceptAnswer().
// Trystero-based rooms will replace the copy/paste later without changing anything below.
//
// `diag` records what happened during setup (candidate types, gather time, state changes)
// so a failed connection can be explained. It never stores IP addresses.

import { DataChannelTransport } from './transport.js';
import { encodeSignal, decodeSignal } from './signal-code.js';
import { summarizeCandidates, formatSummary } from './sdp-info.js';

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const MAX_EVENTS = 60;

export class Peer {
  constructor({ iceServers = DEFAULT_ICE_SERVERS } = {}) {
    this.pc = new RTCPeerConnection({ iceServers });
    this.game = null;
    this.control = null;
    this.onstate = null; // (connectionState) => void
    this.ondiag = null; // ({ t, text }) => void, called for every diagnostic event

    this.diag = { role: null, gatherMs: null, gatherTimedOut: false, local: null, remote: null, events: [] };
    this._t0 = performance.now();

    this.ready = new Promise((resolve) => {
      this._resolveReady = resolve;
    });
    this._readyDone = false;

    const pc = this.pc;
    pc.addEventListener('connectionstatechange', () => {
      this._note(`connection: ${pc.connectionState}`);
      this.onstate?.(pc.connectionState);
    });
    pc.addEventListener('iceconnectionstatechange', () => this._note(`ice: ${pc.iceConnectionState}`));
    pc.addEventListener('icegatheringstatechange', () => this._note(`gathering: ${pc.iceGatheringState}`));
    pc.addEventListener('signalingstatechange', () => this._note(`signaling: ${pc.signalingState}`));
    pc.addEventListener('icecandidateerror', (e) => {
      // Usually "could not reach the STUN server". Reports the server, never our address.
      this._note(`ice error ${e.errorCode ?? '?'}: ${e.errorText || 'no detail'} (${e.url || 'no url'})`);
    });
    pc.addEventListener('datachannel', (e) => this._adopt(e.channel));
  }

  // Host side, step 1: returns the invite text.
  async createOffer() {
    this.diag.role = 'host';
    this._adopt(this.pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 }));
    this._adopt(this.pc.createDataChannel('control', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this._gather();
    return encodeSignal(this.pc.localDescription);
  }

  // Joiner side: takes the invite text, returns the reply text.
  async acceptOffer(code) {
    this.diag.role = 'join';
    await this._setRemote(code, 'invite');
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this._gather();
    return encodeSignal(this.pc.localDescription);
  }

  // Host side, step 2: takes the reply text and finishes the connection.
  async acceptAnswer(code) {
    if (this.pc.signalingState !== 'have-local-offer') {
      throw new Error(
        'This invite can no longer take a reply: it was already used, or the connection was reset. ' +
          'Press "Start over" on both sides and create a fresh invite.',
      );
    }
    await this._setRemote(code, 'reply');
  }

  close() {
    this.pc.close();
  }

  async _setRemote(code, what) {
    const desc = await decodeSignal(code);
    this.diag.remote = summarizeCandidates(desc.sdp);
    this._note(`received ${what}: ${formatSummary(this.diag.remote)}`);
    await this.pc.setRemoteDescription(desc);
  }

  async _gather() {
    const start = performance.now();
    const timedOut = await this._waitForIceGathering();
    this.diag.gatherMs = Math.round(performance.now() - start);
    this.diag.gatherTimedOut = timedOut;
    this.diag.local = summarizeCandidates(this.pc.localDescription?.sdp);
    this._note(
      `gathered in ${this.diag.gatherMs} ms${timedOut ? ' (timed out)' : ''}: ${formatSummary(this.diag.local)}`,
    );
  }

  _note(text) {
    const event = { t: Math.round(performance.now() - this._t0), text };
    this.diag.events.push(event);
    if (this.diag.events.length > MAX_EVENTS) this.diag.events.shift();
    this.ondiag?.(event);
  }

  _adopt(channel) {
    const transport = new DataChannelTransport(channel);
    if (channel.label === 'game') this.game = transport;
    else if (channel.label === 'control') this.control = transport;
    channel.addEventListener('open', () => this._checkReady());
    this._checkReady();
  }

  _checkReady() {
    if (!this._readyDone && this.game?.isOpen && this.control?.isOpen) {
      this._readyDone = true;
      this._resolveReady();
    }
  }

  // "Non-trickle" ICE: wait until all network candidates are collected so the
  // whole connection fits in one pasteable string. Gives up after a few seconds.
  // Resolves true if it gave up (timed out), false if gathering completed.
  _waitForIceGathering(timeoutMs = 5000) {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') return resolve(false);
      const finish = (timedOut) => {
        clearTimeout(timer);
        this.pc.removeEventListener('icegatheringstatechange', check);
        resolve(timedOut);
      };
      const check = () => {
        if (this.pc.iceGatheringState === 'complete') finish(false);
      };
      const timer = setTimeout(() => finish(true), timeoutMs);
      this.pc.addEventListener('icegatheringstatechange', check);
    });
  }
}
