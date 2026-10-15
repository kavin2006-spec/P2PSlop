// Turns a WebRTC session description (offer/answer) into one short pasteable string, and back.
// Format: "p2p1." + base64url(deflate(JSON)). Short enough to send in a chat message.

const PREFIX = 'p2p1.';

function toBase64Url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function runThrough(bytes, stream) {
  const response = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

export async function encodeSignal(description) {
  const json = new TextEncoder().encode(JSON.stringify({ type: description.type, sdp: description.sdp }));
  const packed = await runThrough(json, new CompressionStream('deflate'));
  return PREFIX + toBase64Url(packed);
}

export async function decodeSignal(code) {
  const clean = String(code).trim().replace(/\s+/g, '');
  if (!clean.startsWith(PREFIX)) throw new Error('That is not a P2P connection code.');
  let json;
  try {
    json = await runThrough(fromBase64Url(clean.slice(PREFIX.length)), new DecompressionStream('deflate'));
  } catch {
    throw new Error('The connection code is damaged (was it cut off when copying?).');
  }
  return JSON.parse(new TextDecoder().decode(json));
}
