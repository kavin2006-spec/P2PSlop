// One WebRTC connection to one other browser, with two data channels:
//
//   game     unordered, no retransmits  (like UDP: game packets and pings)
//   control  ordered, reliable          (like TCP: handshake, chat, hash checks)
//
// Signalling is manual for now: createOffer() -> text -> acceptOffer() -> text -> acceptAnswer().
// Trystero-based rooms will replace the copy/paste later without changing anything below.

import { DataChannelTransport } from './transport.js';
import { encodeSignal, decodeSignal } from './signal-code.js';

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export class Peer {
  constructor({ iceServers = DEFAULT_ICE_SERVERS } = {}) {
    this.pc = new RTCPeerConnection({ iceServers });
    this.game = null;
    this.control = null;
    this.onstate = null; // (connectionState) => void

    this.ready = new Promise((resolve) => {
      this._resolveReady = resolve;
    });
    this._readyDone = false;

    this.pc.addEventListener('connectionstatechange', () => this.onstate?.(this.pc.connectionState));
    this.pc.addEventListener('datachannel', (e) => this._adopt(e.channel));
  }

  // Host side, step 1: returns the invite text.
  async createOffer() {
    this._adopt(this.pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 }));
    this._adopt(this.pc.createDataChannel('control', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this._waitForIceGathering();
    return encodeSignal(this.pc.localDescription);
  }

  // Joiner side: takes the invite text, returns the reply text.
  async acceptOffer(code) {
    await this.pc.setRemoteDescription(await decodeSignal(code));
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this._waitForIceGathering();
    return encodeSignal(this.pc.localDescription);
  }

  // Host side, step 2: takes the reply text and finishes the connection.
  async acceptAnswer(code) {
    await this.pc.setRemoteDescription(await decodeSignal(code));
  }

  close() {
    this.pc.close();
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
  _waitForIceGathering(timeoutMs = 5000) {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') return resolve();
      const finish = () => {
        clearTimeout(timer);
        this.pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      };
      const check = () => {
        if (this.pc.iceGatheringState === 'complete') finish();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.pc.addEventListener('icegatheringstatechange', check);
    });
  }
}
