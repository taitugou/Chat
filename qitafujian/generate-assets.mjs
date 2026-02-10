import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(__dirname);
const imagesDir = path.join(outDir, 'images');
const audioDir = path.join(outDir, 'audio');

fs.mkdirSync(imagesDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function tryCopyBrandLogo() {
  const src = path.join(rootDir, 'f.svg');
  const dst = path.join(imagesDir, 'brand-logo.svg');
  if (!fs.existsSync(src)) {
    throw new Error(`找不到品牌 Logo：${src}`);
  }
  fs.copyFileSync(src, dst);
  return dst;
}

function svgWrap({ viewBox = '0 0 512 512', content, title }) {
  const t = title ? `<title>${escapeXml(title)}</title>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="512" height="512" role="img" aria-label="${escapeXml(title || '')}">\n${t}\n${content}\n</svg>\n`;
}

function escapeXml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildSvgAssets() {
  const assets = [
    {
      file: 'default-avatar.svg',
      title: '默认头像',
      content: `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1f2937"/>
      <stop offset="1" stop-color="#0b1220"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="256" fill="url(#g)"/>
  <circle cx="256" cy="210" r="86" fill="#e5e7eb" opacity="0.92"/>
  <path d="M110 430c20-88 92-140 146-140s126 52 146 140" fill="#e5e7eb" opacity="0.92"/>
  <circle cx="190" cy="150" r="6" fill="#ffffff" opacity="0.25"/>
  <circle cx="320" cy="118" r="10" fill="#ffffff" opacity="0.18"/>
      `.trim(),
    },
    {
      file: 'default-cover.svg',
      title: '默认封面',
      viewBox: '0 0 1200 600',
      content: `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1d4ed8"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="30%" r="70%">
      <stop offset="0" stop-color="#93c5fd" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#0b1220" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="600" fill="url(#bg)"/>
  <rect width="1200" height="600" fill="url(#glow)"/>
  <g opacity="0.22" fill="none" stroke="#ffffff">
    <path d="M-80 460C180 320 420 560 720 420s520-20 640 60" stroke-width="3"/>
    <path d="M-60 520C220 360 420 640 760 480s520-40 640 40" stroke-width="2"/>
    <path d="M-40 580C220 420 440 700 800 520s520-60 640 20" stroke-width="2"/>
  </g>
  <g opacity="0.16" fill="#ffffff">
    <circle cx="140" cy="130" r="6"/>
    <circle cx="320" cy="180" r="4"/>
    <circle cx="520" cy="110" r="8"/>
    <circle cx="980" cy="160" r="5"/>
    <circle cx="1080" cy="260" r="4"/>
  </g>
      `.trim(),
    },
    {
      file: 'placeholder-post.svg',
      title: '图片占位',
      content: `
  <rect x="48" y="86" width="416" height="340" rx="28" fill="#111827" stroke="#ffffff" stroke-opacity="0.12"/>
  <path d="M130 350l86-88 78 78 54-54 114 114" fill="none" stroke="#93c5fd" stroke-opacity="0.75" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="188" cy="178" r="22" fill="#93c5fd" opacity="0.75"/>
  <rect x="118" y="308" width="276" height="20" rx="10" fill="#ffffff" opacity="0.08"/>
  <rect x="118" y="338" width="212" height="16" rx="8" fill="#ffffff" opacity="0.06"/>
      `.trim(),
    },
    {
      file: 'empty-data.svg',
      title: '空状态-无数据',
      content: `
  <defs>
    <linearGradient id="e" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect x="64" y="110" width="384" height="292" rx="26" fill="url(#e)" stroke="#ffffff" stroke-opacity="0.10"/>
  <path d="M134 196h244" stroke="#ffffff" stroke-opacity="0.10" stroke-width="14" stroke-linecap="round"/>
  <path d="M134 246h194" stroke="#ffffff" stroke-opacity="0.08" stroke-width="14" stroke-linecap="round"/>
  <path d="M134 296h224" stroke="#ffffff" stroke-opacity="0.06" stroke-width="14" stroke-linecap="round"/>
  <path d="M338 326c44 0 80 36 80 80" fill="none" stroke="#93c5fd" stroke-opacity="0.85" stroke-width="18" stroke-linecap="round"/>
  <circle cx="320" cy="340" r="56" fill="none" stroke="#93c5fd" stroke-opacity="0.85" stroke-width="18"/>
  <path d="M365 385l56 56" stroke="#93c5fd" stroke-opacity="0.85" stroke-width="18" stroke-linecap="round"/>
      `.trim(),
    },
    {
      file: 'empty-chat.svg',
      title: '空状态-无消息',
      content: `
  <defs>
    <linearGradient id="c" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#1f2937"/>
    </linearGradient>
  </defs>
  <path d="M96 162c0-36 30-66 66-66h200c36 0 66 30 66 66v106c0 36-30 66-66 66H254l-84 68v-68h-8c-36 0-66-30-66-66V162z" fill="url(#c)" stroke="#ffffff" stroke-opacity="0.10"/>
  <circle cx="184" cy="214" r="16" fill="#93c5fd" opacity="0.85"/>
  <circle cx="256" cy="214" r="16" fill="#93c5fd" opacity="0.65"/>
  <circle cx="328" cy="214" r="16" fill="#93c5fd" opacity="0.45"/>
  <rect x="160" y="258" width="208" height="16" rx="8" fill="#ffffff" opacity="0.08"/>
  <rect x="200" y="286" width="128" height="14" rx="7" fill="#ffffff" opacity="0.06"/>
      `.trim(),
    },
    {
      file: 'empty-game.svg',
      title: '空状态-暂无游戏',
      content: `
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <path d="M132 246c0-50 40-90 90-90h68c50 0 90 40 90 90v48c0 50-40 90-90 90H222c-50 0-90-40-90-90v-48z" fill="url(#g1)" stroke="#ffffff" stroke-opacity="0.10"/>
  <rect x="188" y="256" width="64" height="18" rx="9" fill="#93c5fd" opacity="0.75"/>
  <rect x="211" y="233" width="18" height="64" rx="9" fill="#93c5fd" opacity="0.75"/>
  <circle cx="324" cy="250" r="16" fill="#93c5fd" opacity="0.65"/>
  <circle cx="362" cy="278" r="12" fill="#93c5fd" opacity="0.45"/>
  <rect x="174" y="192" width="164" height="10" rx="5" fill="#ffffff" opacity="0.06"/>
      `.trim(),
    },
    {
      file: 'chip-icon.svg',
      title: '筹码图标',
      content: `
  <defs>
    <radialGradient id="cg" cx="30%" cy="25%" r="70%">
      <stop offset="0" stop-color="#fef3c7"/>
      <stop offset="0.35" stop-color="#f59e0b"/>
      <stop offset="1" stop-color="#92400e"/>
    </radialGradient>
    <linearGradient id="cs" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <circle cx="256" cy="256" r="196" fill="url(#cg)"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="22"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="22" stroke-linecap="round">
    <path d="M256 60v44"/>
    <path d="M256 408v44"/>
    <path d="M60 256h44"/>
    <path d="M408 256h44"/>
    <path d="M120 120l32 32"/>
    <path d="M360 360l32 32"/>
    <path d="M392 120l-32 32"/>
    <path d="M120 392l32-32"/>
  </g>
  <path d="M112 184c54-92 232-122 300-24" stroke="url(#cs)" stroke-width="28" stroke-linecap="round" fill="none"/>
      `.trim(),
    },
    {
      file: 'card-back.svg',
      title: '扑克牌背面',
      viewBox: '0 0 300 420',
      content: `
  <defs>
    <linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1d4ed8"/>
    </linearGradient>
    <pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(25)">
      <rect width="28" height="28" fill="none"/>
      <path d="M0 14h28" stroke="#ffffff" stroke-opacity="0.10" stroke-width="6" stroke-linecap="round"/>
      <path d="M14 0v28" stroke="#ffffff" stroke-opacity="0.10" stroke-width="6" stroke-linecap="round"/>
    </pattern>
  </defs>
  <rect x="14" y="14" width="272" height="392" rx="26" fill="url(#cbg)"/>
  <rect x="28" y="28" width="244" height="364" rx="20" fill="url(#p)"/>
  <rect x="44" y="44" width="212" height="332" rx="16" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="6"/>
  <circle cx="150" cy="210" r="62" fill="#ffffff" opacity="0.12"/>
  <path d="M150 162c18 0 32 14 32 32s-14 32-32 32-32-14-32-32 14-32 32-32z" fill="#93c5fd" opacity="0.55"/>
      `.trim(),
    },
    {
      file: 'table-bg.svg',
      title: '游戏桌背景',
      viewBox: '0 0 1920 1080',
      content: `
  <defs>
    <radialGradient id="t" cx="50%" cy="45%" r="70%">
      <stop offset="0" stop-color="#064e3b"/>
      <stop offset="1" stop-color="#022c22"/>
    </radialGradient>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
      <path d="M80 0H0V80" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>
      <path d="M40 0V80M0 40H80" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="1920" height="1080" fill="url(#t)"/>
  <rect width="1920" height="1080" fill="url(#grid)"/>
  <ellipse cx="960" cy="540" rx="720" ry="420" fill="#000000" opacity="0.12"/>
  <ellipse cx="960" cy="540" rx="680" ry="380" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="8"/>
      `.trim(),
    },
  ];

  const written = [];
  for (const a of assets) {
    const svg = svgWrap({ viewBox: a.viewBox, content: a.content, title: a.title });
    const fp = path.join(imagesDir, a.file);
    writeText(fp, svg);
    written.push(fp);
  }
  return written;
}

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function wavFromMonoFloat32(samples, sampleRate) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  let o = 0;
  buf.write('RIFF', o); o += 4;
  buf.writeUInt32LE(36 + dataSize, o); o += 4;
  buf.write('WAVE', o); o += 4;

  buf.write('fmt ', o); o += 4;
  buf.writeUInt32LE(16, o); o += 4;
  buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt32LE(sampleRate, o); o += 4;
  buf.writeUInt32LE(sampleRate * 2, o); o += 4;
  buf.writeUInt16LE(2, o); o += 2;
  buf.writeUInt16LE(16, o); o += 2;

  buf.write('data', o); o += 4;
  buf.writeUInt32LE(dataSize, o); o += 4;

  for (let i = 0; i < numSamples; i++) {
    const x = clamp(samples[i], -1, 1);
    const s = Math.round(x * 32767);
    buf.writeInt16LE(clamp(s, -32768, 32767), o);
    o += 2;
  }
  return buf;
}

function envelope(i, n, fadeInN, fadeOutN) {
  const a = fadeInN > 0 ? Math.min(1, i / fadeInN) : 1;
  const b = fadeOutN > 0 ? Math.min(1, (n - 1 - i) / fadeOutN) : 1;
  return Math.max(0, Math.min(a, b));
}

function genTone({ freq, ms, sampleRate, amp = 0.22, fadeInMs = 5, fadeOutMs = 12, harmonic = 0.18 }) {
  const n = Math.max(1, Math.floor((ms / 1000) * sampleRate));
  const fadeInN = Math.floor((fadeInMs / 1000) * sampleRate);
  const fadeOutN = Math.floor((fadeOutMs / 1000) * sampleRate);
  const out = new Float32Array(n);
  const w1 = (2 * Math.PI * freq) / sampleRate;
  const w2 = (2 * Math.PI * freq * 2) / sampleRate;
  for (let i = 0; i < n; i++) {
    const e = envelope(i, n, fadeInN, fadeOutN);
    const x = Math.sin(w1 * i) + harmonic * Math.sin(w2 * i);
    out[i] = x * amp * e;
  }
  return out;
}

function genSilence({ ms, sampleRate }) {
  const n = Math.max(1, Math.floor((ms / 1000) * sampleRate));
  return new Float32Array(n);
}

function genChirp({ f0, f1, ms, sampleRate, amp = 0.22, fadeInMs = 5, fadeOutMs = 14 }) {
  const n = Math.max(1, Math.floor((ms / 1000) * sampleRate));
  const fadeInN = Math.floor((fadeInMs / 1000) * sampleRate);
  const fadeOutN = Math.floor((fadeOutMs / 1000) * sampleRate);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const f = f0 + (f1 - f0) * t;
    phase += (2 * Math.PI * f) / sampleRate;
    const e = envelope(i, n, fadeInN, fadeOutN);
    out[i] = Math.sin(phase) * amp * e;
  }
  return out;
}

function genNoiseClick({ ms, sampleRate, amp = 0.16, decay = 8 }) {
  const n = Math.max(1, Math.floor((ms / 1000) * sampleRate));
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const r = (Math.random() * 2 - 1);
    const hp = r - prev;
    prev = r;
    const e = Math.exp(-(decay * i) / n);
    out[i] = hp * amp * e;
  }
  return out;
}

function concatFloat32(chunks) {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function mixFloat32(a, b) {
  const n = Math.max(a.length, b.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i < a.length ? a[i] : 0) + (i < b.length ? b[i] : 0);
    out[i] = Math.max(-1, Math.min(1, x));
  }
  return out;
}

function genBuzz({ baseFreq, ms, sampleRate, amp = 0.18, modHz = 28 }) {
  const n = Math.max(1, Math.floor((ms / 1000) * sampleRate));
  const out = new Float32Array(n);
  const w = (2 * Math.PI * baseFreq) / sampleRate;
  const wm = (2 * Math.PI * modHz) / sampleRate;
  const fadeInN = Math.floor((5 / 1000) * sampleRate);
  const fadeOutN = Math.floor((12 / 1000) * sampleRate);
  for (let i = 0; i < n; i++) {
    const e = envelope(i, n, fadeInN, fadeOutN);
    const m = 0.55 + 0.45 * Math.sin(wm * i);
    out[i] = Math.sin(w * i) * amp * e * m;
  }
  return out;
}

function writeWav(filePath, samples, sampleRate) {
  const wav = wavFromMonoFloat32(samples, sampleRate);
  fs.writeFileSync(filePath, wav);
}

function buildAudioAssets() {
  const sampleRate = 44100;

  const defs = [
    {
      file: 'notify_msg.wav',
      build: () => mixFloat32(
        genTone({ freq: 880, ms: 160, sampleRate, amp: 0.20 }),
        genTone({ freq: 1320, ms: 160, sampleRate, amp: 0.10, harmonic: 0.08 })
      ),
    },
    {
      file: 'notify_sys.wav',
      build: () => mixFloat32(
        genTone({ freq: 660, ms: 220, sampleRate, amp: 0.18 }),
        genTone({ freq: 990, ms: 220, sampleRate, amp: 0.08, harmonic: 0.08 })
      ),
    },
    {
      file: 'notify_match.wav',
      build: () => concatFloat32([
        genTone({ freq: 660, ms: 120, sampleRate, amp: 0.18 }),
        genSilence({ ms: 40, sampleRate }),
        genTone({ freq: 880, ms: 120, sampleRate, amp: 0.19 }),
        genSilence({ ms: 40, sampleRate }),
        genTone({ freq: 1175, ms: 160, sampleRate, amp: 0.20 }),
      ]),
    },
    {
      file: 'call_ring_in.wav',
      build: () => concatFloat32([
        genTone({ freq: 880, ms: 420, sampleRate, amp: 0.16, fadeInMs: 15, fadeOutMs: 30 }),
        genSilence({ ms: 180, sampleRate }),
        genTone({ freq: 880, ms: 420, sampleRate, amp: 0.16, fadeInMs: 15, fadeOutMs: 30 }),
        genSilence({ ms: 1980, sampleRate }),
      ]),
    },
    {
      file: 'call_ring_out.wav',
      build: () => concatFloat32([
        genTone({ freq: 440, ms: 420, sampleRate, amp: 0.14, fadeInMs: 10, fadeOutMs: 30 }),
        genSilence({ ms: 380, sampleRate }),
        genTone({ freq: 440, ms: 420, sampleRate, amp: 0.14, fadeInMs: 10, fadeOutMs: 30 }),
        genSilence({ ms: 1780, sampleRate }),
      ]),
    },
    {
      file: 'call_connect.wav',
      build: () => concatFloat32([
        genTone({ freq: 1000, ms: 110, sampleRate, amp: 0.18 }),
        genTone({ freq: 1500, ms: 80, sampleRate, amp: 0.14 }),
      ]),
    },
    {
      file: 'call_end.wav',
      build: () => concatFloat32([
        genChirp({ f0: 520, f1: 220, ms: 220, sampleRate, amp: 0.20 }),
      ]),
    },
    {
      file: 'call_busy.wav',
      build: () => concatFloat32([
        genTone({ freq: 480, ms: 140, sampleRate, amp: 0.16 }),
        genSilence({ ms: 60, sampleRate }),
        genTone({ freq: 480, ms: 140, sampleRate, amp: 0.16 }),
        genSilence({ ms: 60, sampleRate }),
        genTone({ freq: 480, ms: 140, sampleRate, amp: 0.16 }),
      ]),
    },
    {
      file: 'game_join.wav',
      build: () => concatFloat32([
        genTone({ freq: 392, ms: 110, sampleRate, amp: 0.18 }),
        genTone({ freq: 523, ms: 140, sampleRate, amp: 0.18 }),
      ]),
    },
    {
      file: 'game_ready.wav',
      build: () => concatFloat32([
        genNoiseClick({ ms: 40, sampleRate, amp: 0.10, decay: 10 }),
        genTone({ freq: 880, ms: 70, sampleRate, amp: 0.12, fadeInMs: 2, fadeOutMs: 25, harmonic: 0.08 }),
      ]),
    },
    {
      file: 'game_start.wav',
      build: () => concatFloat32([
        genNoiseClick({ ms: 260, sampleRate, amp: 0.10, decay: 4 }),
        mixFloat32(
          genTone({ freq: 659, ms: 170, sampleRate, amp: 0.18 }),
          genTone({ freq: 988, ms: 230, sampleRate, amp: 0.12, harmonic: 0.08 })
        ),
      ]),
    },
    {
      file: 'game_turn.wav',
      build: () => genTone({ freq: 740, ms: 160, sampleRate, amp: 0.16 }),
    },
    {
      file: 'game_win.wav',
      build: () => concatFloat32([
        genTone({ freq: 523, ms: 150, sampleRate, amp: 0.18 }),
        genTone({ freq: 659, ms: 150, sampleRate, amp: 0.18 }),
        genTone({ freq: 784, ms: 210, sampleRate, amp: 0.18 }),
        genNoiseClick({ ms: 140, sampleRate, amp: 0.08, decay: 7 }),
      ]),
    },
    {
      file: 'game_lose.wav',
      build: () => concatFloat32([
        genTone({ freq: 392, ms: 220, sampleRate, amp: 0.17 }),
        genTone({ freq: 330, ms: 280, sampleRate, amp: 0.16 }),
      ]),
    },
    {
      file: 'game_chip.wav',
      build: () => concatFloat32([
        genNoiseClick({ ms: 28, sampleRate, amp: 0.12, decay: 14 }),
        genSilence({ ms: 18, sampleRate }),
        genNoiseClick({ ms: 34, sampleRate, amp: 0.10, decay: 12 }),
        genSilence({ ms: 14, sampleRate }),
        genNoiseClick({ ms: 40, sampleRate, amp: 0.08, decay: 10 }),
      ]),
    },
    {
      file: 'game_card.wav',
      build: () => concatFloat32([
        genNoiseClick({ ms: 60, sampleRate, amp: 0.10, decay: 6 }),
      ]),
    },
    {
      file: 'game_deal.wav',
      build: () => concatFloat32([
        genNoiseClick({ ms: 45, sampleRate, amp: 0.10, decay: 12 }),
        genSilence({ ms: 20, sampleRate }),
        genNoiseClick({ ms: 45, sampleRate, amp: 0.08, decay: 10 }),
      ]),
    },
    {
      file: 'game_check.wav',
      build: () => concatFloat32([
        genTone({ freq: 330, ms: 60, sampleRate, amp: 0.10 }),
        genTone({ freq: 330, ms: 60, sampleRate, amp: 0.10 }),
      ]),
    },
    {
      file: 'game_bet.wav',
      build: () => concatFloat32([
        genTone({ freq: 523, ms: 100, sampleRate, amp: 0.15 }),
        genTone({ freq: 659, ms: 100, sampleRate, amp: 0.15 }),
      ]),
    },
    {
      file: 'game_fold.wav',
      build: () => concatFloat32([
        genTone({ freq: 261, ms: 150, sampleRate, amp: 0.12 }),
      ]),
    },
    {
      file: 'game_allin.wav',
      build: () => concatFloat32([
        genTone({ freq: 523, ms: 100, sampleRate, amp: 0.20 }),
        genTone({ freq: 659, ms: 100, sampleRate, amp: 0.20 }),
        genTone({ freq: 784, ms: 100, sampleRate, amp: 0.20 }),
        genTone({ freq: 1046, ms: 300, sampleRate, amp: 0.25 }),
      ]),
    },
    {
      file: 'game_timer.wav',
      build: () => genTone({ freq: 880, ms: 50, sampleRate, amp: 0.10 }),
    },
    {
      file: 'social_like.wav',
      build: () => concatFloat32([
        genTone({ freq: 659, ms: 80, sampleRate, amp: 0.15 }),
        genTone({ freq: 880, ms: 120, sampleRate, amp: 0.18 }),
      ]),
    },
    {
      file: 'social_gift.wav',
      build: () => concatFloat32([
        genTone({ freq: 1046, ms: 100, sampleRate, amp: 0.15 }),
        genTone({ freq: 1318, ms: 100, sampleRate, amp: 0.15 }),
        genTone({ freq: 1568, ms: 200, sampleRate, amp: 0.18 }),
      ]),
    },
    {
      file: 'social_vip.wav',
      build: () => concatFloat32([
        genTone({ freq: 523, ms: 150, sampleRate, amp: 0.15 }),
        genTone({ freq: 659, ms: 150, sampleRate, amp: 0.15 }),
        genTone({ freq: 784, ms: 150, sampleRate, amp: 0.15 }),
        genTone({ freq: 1046, ms: 400, sampleRate, amp: 0.20 }),
      ]),
    },
    {
      file: 'pay_success.wav',
      build: () => concatFloat32([
        genTone({ freq: 880, ms: 100, sampleRate, amp: 0.15 }),
        genTone({ freq: 1760, ms: 200, sampleRate, amp: 0.18 }),
      ]),
    },
    {
      file: 'ui_click.wav',
      build: () => genTone({ freq: 1600, ms: 26, sampleRate, amp: 0.09, fadeInMs: 1, fadeOutMs: 16, harmonic: 0 }),
    },
    {
      file: 'ui_success.wav',
      build: () => concatFloat32([
        genTone({ freq: 784, ms: 120, sampleRate, amp: 0.16 }),
        genTone({ freq: 988, ms: 160, sampleRate, amp: 0.16 }),
      ]),
    },
    {
      file: 'ui_error.wav',
      build: () => concatFloat32([
        genBuzz({ baseFreq: 196, ms: 220, sampleRate, amp: 0.14, modHz: 26 }),
        genBuzz({ baseFreq: 147, ms: 240, sampleRate, amp: 0.14, modHz: 26 }),
      ]),
    },
  ];

  const written = [];
  for (const d of defs) {
    const fp = path.join(audioDir, d.file);
    const samples = d.build();
    writeWav(fp, samples, sampleRate);
    written.push(fp);
  }
  return written;
}

function buildManifest({ logoPath, svgPaths, wavPaths }) {
  const rel = (p) => path.relative(outDir, p).replaceAll('\\', '/');
  const manifest = {
    baseDir: 'qitafujian',
    images: {
      brandLogo: rel(logoPath),
      svgs: svgPaths.map(rel).sort(),
    },
    audio: {
      wavs: wavPaths.map(rel).sort(),
    },
  };
  const fp = path.join(outDir, 'asset-manifest.json');
  writeText(fp, JSON.stringify(manifest, null, 2) + '\n');
  return fp;
}

const logoPath = tryCopyBrandLogo();
const svgPaths = buildSvgAssets();
const wavPaths = buildAudioAssets();
const manifestPath = buildManifest({ logoPath, svgPaths, wavPaths });

console.log('已生成资源：');
console.log(`- Logo: ${path.relative(rootDir, logoPath)}`);
console.log(`- SVG: ${svgPaths.length} 个`);
console.log(`- WAV: ${wavPaths.length} 个`);
console.log(`- 清单: ${path.relative(rootDir, manifestPath)}`);
