// Network Lab: wires the connection, telemetry and fault injection to the page.
// Open lab.html?stun=off to test two tabs on one machine without any STUN server.

import { Peer } from './core/peer.js';
import { ChaosTransport, PRESETS } from './chaos/injector.js';
import { Pinger } from './telemetry/ping.js';
import { readConnectionStats } from './telemetry/stats.js';
import { TelemetryPanel } from './telemetry/panel.js';
import { explainFailure, formatSummary } from './core/sdp-info.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const state = {
  peer: null,
  chaos: null,
  pinger: null,
  poll: null,
  conn: null, // latest selected-path stats once connected
  config: { ...PRESETS.clean },
};
let panel = new TelemetryPanel($('panel'));

// ---------- status + log ----------
function setStatus(text, level) {
  const pill = $('status');
  pill.textContent = text;
  pill.dataset.level = level;
}

function log(who, text) {
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString([], { hour12: false });
  li.innerHTML = '<time></time><b></b><span></span>';
  li.children[0].textContent = time;
  li.children[1].textContent = who;
  li.children[2].textContent = text;
  const list = $('log');
  list.prepend(li);
  while (list.children.length > 100) list.lastChild.remove();
}

function setBusy(button, busy) {
  button.disabled = busy;
}

function showError(err) {
  console.error(err);
  log('error', err.message || String(err));
  if (state.peer?.pc.connectionState !== 'connected') setStatus('error', 'bad');
}

// ---------- connection ----------
function dropPeer() {
  if (state.peer) {
    state.peer.onstate = null;
    state.peer.ondiag = null;
    state.peer.close();
  }
  state.pinger?.stop();
  clearInterval(state.poll);
  Object.assign(state, { peer: null, chaos: null, pinger: null, poll: null, conn: null });
}

function newPeer() {
  dropPeer();
  const iceServers = params.get('stun') === 'off' ? [] : undefined;
  const peer = new Peer(iceServers ? { iceServers } : {});
  peer.onstate = (s) => {
    const level = { connected: 'good', connecting: 'wait', new: 'wait' }[s] ?? 'bad';
    setStatus(s, level);
    log('connection', s);
    if (s === 'failed') {
      for (const line of explainFailure(peer.diag.local, peer.diag.remote)) log('why', line);
      log('why', 'Press "Start over" on both sides before trying again, and copy the diagnostics.');
    }
  };
  peer.ondiag = (ev) => {
    log('diag', ev.text);
    renderDiag();
  };
  peer.ready.then(() => {
    if (state.peer === peer) onReady(peer);
  });
  state.peer = peer;
  setStatus('connecting', 'wait');
  renderDiag();
  return peer;
}

// ---------- diagnostics ----------
function diagText() {
  const peer = state.peer;
  if (!peer) return 'No connection yet.';
  const d = peer.diag;
  const pc = peer.pc;
  const lines = [
    `role: ${d.role ?? '?'}`,
    `browser: ${navigator.userAgent}`,
    `this side's code: ${formatSummary(d.local)}${d.gatherMs === null ? '' : ` (gathered in ${d.gatherMs} ms${d.gatherTimedOut ? ', timed out' : ''})`}`,
    `other side's code: ${formatSummary(d.remote)}`,
    `states: connection ${pc.connectionState}, ice ${pc.iceConnectionState}, signaling ${pc.signalingState}`,
  ];
  if (state.conn) {
    lines.push(`path: ${state.conn.path} (${state.conn.localType} / ${state.conn.remoteType}, ${state.conn.protocol})`);
  }
  if (pc.connectionState === 'failed') lines.push(`why: ${explainFailure(d.local, d.remote).join(' ')}`);
  lines.push('timeline:');
  for (const ev of d.events) lines.push(`  +${String(ev.t).padStart(6)} ms  ${ev.text}`);
  return lines.join('\n');
}

function renderDiag() {
  $('diag').textContent = diagText();
}

function onReady(peer) {
  const chaos = new ChaosTransport(peer.game, state.config);
  const pinger = new Pinger(chaos);
  chaos.onmessage = (data) => {
    if (!pinger.handle(data)) log('game channel', typeof data === 'string' ? data : `${data.byteLength} bytes`);
  };
  peer.control.onmessage = (data) => log('peer', String(data));
  state.chaos = chaos;
  state.pinger = pinger;
  pinger.start();
  $('chat-send').disabled = false;
  $('chat-text').disabled = false;
  log('connection', 'channels open: measuring');

  state.poll = setInterval(async () => {
    const conn = await readConnectionStats(peer.pc).catch(() => null);
    if (state.peer !== peer) return;
    state.conn = conn;
    panel.update({ rtt: pinger.stats.snapshot(), conn });
    const c = chaos.counters;
    $('chaos-counters').textContent = `sent ${c.sent} · dropped ${c.dropped} · duplicated ${c.duplicated} · delayed ${c.delayed}`;
  }, 500);
}

$('btn-host').addEventListener('click', async (e) => {
  setBusy(e.target, true);
  try {
    const peer = newPeer();
    setStatus('waiting for reply', 'wait');
    $('host-invite').value = await peer.createOffer();
    log('host', 'invite created. Send it to your friend.');
  } catch (err) {
    showError(err);
  } finally {
    setBusy(e.target, false);
  }
});

$('btn-connect').addEventListener('click', async (e) => {
  setBusy(e.target, true);
  try {
    if (!state.peer) throw new Error('Create an invite first.');
    if (!$('host-reply').value.trim()) throw new Error("Paste your friend's reply first.");
    await state.peer.acceptAnswer($('host-reply').value);
    log('host', 'reply accepted, connecting…');
  } catch (err) {
    showError(err);
  } finally {
    setBusy(e.target, false);
  }
});

$('btn-join').addEventListener('click', async (e) => {
  setBusy(e.target, true);
  try {
    const peer = newPeer();
    $('join-reply').value = await peer.acceptOffer($('join-invite').value);
    setStatus('waiting for host', 'wait');
    log('join', 'reply created. Send it back to the host.');
  } catch (err) {
    showError(err);
  } finally {
    setBusy(e.target, false);
  }
});

for (const [btn, box] of [['copy-invite', 'host-invite'], ['copy-reply', 'join-reply']]) {
  $(btn).addEventListener('click', async () => {
    const text = $(box).value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      log('clipboard', 'copied');
    } catch {
      $(box).select();
      log('clipboard', 'could not copy automatically; text is selected, press Ctrl+C');
    }
  });
}

$('btn-reset').addEventListener('click', () => {
  dropPeer();
  for (const id of ['host-invite', 'host-reply', 'join-invite', 'join-reply']) $(id).value = '';
  $('chat-send').disabled = true;
  $('chat-text').disabled = true;
  $('chaos-counters').textContent = 'not running';
  panel = new TelemetryPanel($('panel'));
  setStatus('not connected', 'idle');
  renderDiag();
  log('lab', 'started over. Make a fresh invite (host) and ask your friend to press Start over too.');
});

$('copy-diag').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(diagText());
    log('clipboard', 'diagnostics copied');
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('diag'));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    log('clipboard', 'could not copy automatically; text is selected, press Ctrl+C');
  }
});

// ---------- chat over the reliable channel ----------
$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('chat-text').value.trim();
  if (!text || !state.peer?.control?.isOpen) return;
  state.peer.control.send(text);
  log('you', text);
  $('chat-text').value = '';
});

// ---------- fault injection controls ----------
const SLIDERS = ['delayMs', 'jitterMs', 'lossPct', 'dupPct', 'reorderPct'];

function applyConfig(partial) {
  Object.assign(state.config, partial);
  state.chaos?.setConfig(partial);
  for (const key of SLIDERS) {
    $(`s-${key}`).value = state.config[key];
    $(`v-${key}`).textContent = state.config[key];
  }
}

for (const key of SLIDERS) {
  $(`s-${key}`).addEventListener('input', (e) => applyConfig({ [key]: Number(e.target.value) }));
}

const presetBox = $('presets');
for (const [id, preset] of Object.entries(PRESETS)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ghost';
  b.textContent = preset.label;
  b.dataset.preset = id;
  b.addEventListener('click', () => {
    const { label, ...values } = preset;
    applyConfig(values);
    log('chaos', `preset: ${label}`);
  });
  presetBox.append(b);
}
applyConfig({});
setStatus('not connected', 'idle');
