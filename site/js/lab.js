// Network Lab: wires the connection, telemetry and fault injection to the page.
// Open lab.html?stun=off to test two tabs on one machine without any STUN server.

import { Peer } from './core/peer.js';
import { ChaosTransport, PRESETS } from './chaos/injector.js';
import { Pinger } from './telemetry/ping.js';
import { readConnectionStats } from './telemetry/stats.js';
import { TelemetryPanel } from './telemetry/panel.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const state = {
  peer: null,
  chaos: null,
  pinger: null,
  poll: null,
  config: { ...PRESETS.clean },
};
const panel = new TelemetryPanel($('panel'));

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
  setStatus('error', 'bad');
}

// ---------- connection ----------
function newPeer() {
  state.peer?.close();
  state.pinger?.stop();
  clearInterval(state.poll);
  const iceServers = params.get('stun') === 'off' ? [] : undefined;
  const peer = new Peer(iceServers ? { iceServers } : {});
  peer.onstate = (s) => {
    const level = { connected: 'good', connecting: 'wait', new: 'wait' }[s] ?? 'bad';
    setStatus(s, level);
    log('connection', s);
    if (s === 'failed') {
      log('hint', 'Connection failed. This pair probably needs a TURN relay (strict NAT). Note it in docs/test-logs.');
    }
  };
  peer.ready.then(() => onReady(peer));
  state.peer = peer;
  setStatus('connecting', 'wait');
  return peer;
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
