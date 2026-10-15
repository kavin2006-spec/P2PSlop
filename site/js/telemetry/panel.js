// Draws the telemetry readout and the RTT sparkline into a container element.

const fmtMs = (v) => (v === null || v === undefined ? '–' : `${v.toFixed(v < 10 ? 1 : 0)} ms`);
const fmtPct = (v) => (v === null || v === undefined ? '–' : `${v.toFixed(1)} %`);
const fmtRate = (bytesPerSec) => {
  if (bytesPerSec === null) return '–';
  return bytesPerSec < 1024 ? `${bytesPerSec.toFixed(0)} B/s` : `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
};

// Rough, opinionated guide for the kinds of games this project targets.
// Thresholds are heuristics for client-server games with prediction, not measurements.
export function verdict(rtt) {
  if (rtt.avg === null) return { level: 'wait', text: 'Waiting for measurements…' };
  const lossy = rtt.lossPct !== null && rtt.lossPct > 5;
  const level = rtt.avg < 60 ? 'great' : rtt.avg < 150 ? 'good' : rtt.avg < 250 ? 'ok' : 'bad';
  const text = {
    great: 'Excellent. Fast games will feel local.',
    good: 'Good. Fine for shooters with client-side prediction.',
    ok: 'Playable for casual shooters and slower games; fast duels will feel laggy.',
    bad: 'Laggy. Stick to turn-based or very slow games.',
  }[level];
  return { level: lossy ? 'bad' : level, text: lossy ? `${text} Packet loss above 5 % will cause visible stutter.` : text };
}

export class TelemetryPanel {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="verdict" data-k="verdict" data-level="wait"></div>
      <div class="tiles">
        <div class="tile big"><span>RTT now</span><b data-k="last">–</b></div>
        <div class="tile"><span>RTT avg</span><b data-k="avg">–</b></div>
        <div class="tile"><span>min / max</span><b data-k="range">–</b></div>
        <div class="tile"><span>Jitter</span><b data-k="jitter">–</b></div>
        <div class="tile"><span>Round-trip loss</span><b data-k="loss">–</b></div>
        <div class="tile"><span>Path</span><b data-k="path">–</b></div>
        <div class="tile"><span>Candidates (you / peer)</span><b data-k="cands">–</b></div>
        <div class="tile"><span>Browser RTT (ICE)</span><b data-k="ice">–</b></div>
        <div class="tile"><span>Traffic out / in</span><b data-k="rate">–</b></div>
        <div class="tile"><span>Pings sent / answered</span><b data-k="counts">–</b></div>
      </div>
      <canvas class="spark" width="720" height="110" aria-label="Round-trip time over the last 60 pings"></canvas>
      <p class="hint">Sparkline: last 60 pings; red ticks are lost pings. Numbers cover the last 100 pings (about 20 s), so they take a moment to settle after conditions change.</p>`;
    this.els = {};
    root.querySelectorAll('[data-k]').forEach((el) => {
      this.els[el.dataset.k] = el;
    });
    this.canvas = root.querySelector('canvas');
    this._lastBytes = null;
  }

  update({ rtt, conn }) {
    const e = this.els;
    const v = verdict(rtt);
    e.verdict.textContent = v.text;
    e.verdict.dataset.level = v.level;

    e.last.textContent = fmtMs(rtt.last);
    e.avg.textContent = fmtMs(rtt.avg);
    e.range.textContent = rtt.min === null ? '–' : `${fmtMs(rtt.min)} / ${fmtMs(rtt.max)}`;
    e.jitter.textContent = fmtMs(rtt.jitter);
    e.loss.textContent = fmtPct(rtt.lossPct);
    e.counts.textContent = `${rtt.sent} / ${rtt.received}`;

    if (conn) {
      e.path.textContent = conn.path;
      e.cands.textContent = `${conn.localType} / ${conn.remoteType} (${conn.protocol})`;
      e.ice.textContent = fmtMs(conn.browserRttMs);
      const now = performance.now();
      if (this._lastBytes) {
        const dt = (now - this._lastBytes.t) / 1000;
        e.rate.textContent = `${fmtRate((conn.bytesSent - this._lastBytes.sent) / dt)} / ${fmtRate(
          (conn.bytesReceived - this._lastBytes.received) / dt,
        )}`;
      }
      this._lastBytes = { t: now, sent: conn.bytesSent, received: conn.bytesReceived };
    }
    this._drawSparkline(rtt.samples);
  }

  _drawSparkline(samples) {
    const c = this.canvas;
    const ctx = c.getContext('2d');
    const css = getComputedStyle(this.root);
    const line = css.getPropertyValue('--accent').trim() || '#4ade80';
    const bad = css.getPropertyValue('--bad').trim() || '#f87171';
    const grid = css.getPropertyValue('--line').trim() || '#333';
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);

    const values = samples.filter((s) => s !== null);
    const top = Math.max(100, ...values) * 1.15;
    const x = (i) => (samples.length <= 1 ? 0 : (i / 59) * w);
    const y = (ms) => h - 8 - (ms / top) * (h - 20);

    const muted = css.getPropertyValue('--muted').trim() || '#888';
    const step = top < 150 ? 50 : top < 400 ? 100 : 200;
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = muted;
    ctx.font = '11px sans-serif';
    for (let ms = step; ms < top; ms += step) {
      ctx.beginPath();
      ctx.moveTo(0, y(ms));
      ctx.lineTo(w, y(ms));
      ctx.stroke();
      ctx.fillText(`${ms} ms`, w - 46, y(ms) - 3);
    }

    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let pen = false;
    samples.forEach((s, i) => {
      if (s === null) {
        pen = false;
        return;
      }
      if (!pen) ctx.moveTo(x(i), y(s));
      else ctx.lineTo(x(i), y(s));
      pen = true;
    });
    ctx.stroke();

    ctx.strokeStyle = bad;
    ctx.lineWidth = 2;
    samples.forEach((s, i) => {
      if (s !== null) return;
      ctx.beginPath();
      ctx.moveTo(x(i), h - 2);
      ctx.lineTo(x(i), h - 14);
      ctx.stroke();
    });
  }
}
