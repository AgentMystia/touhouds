// sfx.js — WebAudio 程序化音效 + BGM 交叉淡入（bgm/ 目录有文件才播放）。
let ac = null, master = null, bgmGain = null, sfxGain = null;
let currentBgm = null, bgmSrc = null;

function ctx() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
    sfxGain = ac.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    bgmGain = ac.createGain(); bgmGain.gain.value = 0.0; bgmGain.connect(master);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

export function unlockAudio() { ctx(); }

function env(g, t0, a, peak, d, sustain = 0) {
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, sustain), t0 + a + d);
}

function osc(type, freq, t0, dur, peak = 0.3, dest = null) {
  const a = ctx();
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  env(g, t0, 0.005, peak, dur);
  o.connect(g); g.connect(dest || sfxGain);
  o.start(t0); o.stop(t0 + dur + 0.1);
  return { o, g };
}

function noise(t0, dur, peak = 0.2, filterFreq = 1200, q = 1, type = 'bandpass') {
  const a = ctx();
  const len = Math.max(1, (dur + 0.1) * a.sampleRate) | 0;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq; f.Q.value = q;
  const g = a.createGain();
  env(g, t0, 0.004, peak, dur);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t0); src.stop(t0 + dur + 0.1);
}

// 五声音阶（夜雀主题：羽调式）
const PENTA = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

export function sfx(name) {
  if (!ac && !window.__audioPending) { window.__audioPending = true; return; }
  try {
    const a = ctx();
    const t = a.currentTime;
    switch (name) {
      case 'chop': noise(t, 0.08, 0.35, 400, 2); osc('square', 90, t, 0.08, 0.2); break;
      case 'mine': noise(t, 0.07, 0.3, 2500, 3); osc('square', 180, t, 0.05, 0.15); break;
      case 'pick': noise(t, 0.1, 0.2, 900, 1.5); break;
      case 'craft':
        osc('triangle', 523, t, 0.1, 0.25); osc('triangle', 659, t + 0.08, 0.1, 0.25);
        osc('triangle', 784, t + 0.16, 0.16, 0.3); break;
      case 'eat':
        noise(t, 0.06, 0.2, 700, 2); noise(t + 0.09, 0.06, 0.18, 600, 2);
        osc('sine', 440, t + 0.18, 0.12, 0.2); break;
      case 'hurt': osc('sawtooth', 160, t, 0.15, 0.3); noise(t, 0.12, 0.25, 500, 1); break;
      case 'swing': noise(t, 0.09, 0.14, 1800, 1); break;
      case 'enemy_swing': noise(t, 0.1, 0.12, 900, 1); break;
      case 'hit': osc('square', 220, t, 0.06, 0.2); noise(t, 0.05, 0.2, 1500, 2); break;
      case 'roar':
        osc('sawtooth', 80, t, 0.6, 0.4); osc('sawtooth', 82, t, 0.6, 0.3);
        noise(t, 0.5, 0.2, 300, 1); break;
      case 'enrage':
        for (let i = 0; i < 5; i++) osc('sawtooth', 100 + i * 40, t + i * 0.08, 0.2, 0.25);
        noise(t, 0.8, 0.25, 250, 1); break;
      case 'bossdown':
        for (let i = 0; i < 6; i++) osc('triangle', PENTA[i], t + i * 0.12, 0.3, 0.25);
        break;
      case 'song': {
        // 夜雀之歌：上行琶音 + 鸟鸣颤音
        const seq = [0, 2, 4, 5, 7, 5, 4, 7];
        seq.forEach((n, i) => {
          const { o } = osc('sine', PENTA[n] * 2, t + i * 0.09, 0.24, 0.22);
          o.frequency.setValueAtTime(PENTA[n] * 2, t + i * 0.09);
          o.frequency.linearRampToValueAtTime(PENTA[n] * 2 * 1.03, t + i * 0.09 + 0.06);
          o.frequency.linearRampToValueAtTime(PENTA[n] * 2, t + i * 0.09 + 0.12);
        });
        break;
      }
      case 'charm':
        for (let i = 0; i < 4; i++) osc('sine', PENTA[7 - i], t + i * 0.1, 0.4, 0.2);
        break;
      case 'death':
        osc('sine', 440, t, 1.2, 0.3).o.frequency.exponentialRampToValueAtTime(110, t + 1.2);
        noise(t + 0.2, 0.8, 0.1, 300, 1); break;
      case 'wave_warn': osc('sine', 330, t, 0.3, 0.2); osc('sine', 311, t + 0.35, 0.5, 0.2); break;
      case 'wave': noise(t, 0.4, 0.25, 200, 1); osc('square', 65, t, 0.4, 0.3); break;
      case 'splash': noise(t, 0.25, 0.25, 1000, 1); break;
      case 'catch':
        noise(t, 0.2, 0.2, 1200, 1);
        osc('sine', 660, t + 0.15, 0.12, 0.2); osc('sine', 880, t + 0.27, 0.15, 0.2); break;
      case 'cook': noise(t, 0.3, 0.15, 800, 1); osc('sine', 330, t + 0.1, 0.2, 0.12); break;
      case 'dish':
        [0, 2, 4].forEach((n, i) => osc('triangle', PENTA[n] * 2, t + i * 0.1, 0.2, 0.22));
        break;
      case 'trap': osc('square', 300, t, 0.08, 0.2); osc('square', 200, t + 0.08, 0.1, 0.2); break;
      case 'ring': noise(t, 0.5, 0.2, 2000, 2); osc('sine', 880, t, 0.4, 0.15); break;
      case 'ui': osc('sine', 700, t, 0.04, 0.12); break;
      case 'ui_open': osc('sine', 520, t, 0.06, 0.12); osc('sine', 780, t + 0.05, 0.08, 0.12); break;
      case 'place': noise(t, 0.1, 0.25, 500, 1.5); osc('sine', 180, t, 0.12, 0.2); break;
      case 'fuel': noise(t, 0.15, 0.2, 600, 1); break;
      case 'rumia': osc('sine', 392, t, 0.5, 0.15); osc('sine', 523, t + 0.2, 0.6, 0.12); break;
      case 'step': noise(t, 0.03, 0.05, 800, 1); break;
    }
  } catch (e) { /* 音频不可用时静默 */ }
}

// ---------- BGM（外部文件，存在才播） ----------
const BGM_FILES = { day: 'assets/bgm/day.mp3', dusk: 'assets/bgm/dusk.mp3', night: 'assets/bgm/night.mp3', danger: 'assets/bgm/danger.mp3' };
const bgmAvailable = {};

export async function probeBgm() {
  for (const k in BGM_FILES) {
    try {
      const r = await fetch(BGM_FILES[k], { method: 'HEAD' });
      bgmAvailable[k] = r.ok;
    } catch { bgmAvailable[k] = false; }
  }
}

export function updateBgm(phase, danger) {
  const want = danger && bgmAvailable.danger ? 'danger' : phase;
  if (currentBgm === want) return;
  if (!bgmAvailable[want]) return;
  currentBgm = want;
  const a = ctx();
  if (bgmSrc) { try { bgmSrc.stop(); } catch {} }
  const el = new Audio(BGM_FILES[want]);
  el.loop = true; el.crossOrigin = 'anonymous';
  const src = a.createMediaElementSource(el);
  src.connect(bgmGain);
  el.play().catch(() => {});
  bgmSrc = { stop: () => el.pause() };
  bgmGain.gain.cancelScheduledValues(a.currentTime);
  bgmGain.gain.setTargetAtTime(0.45, a.currentTime, 1.5);
}
