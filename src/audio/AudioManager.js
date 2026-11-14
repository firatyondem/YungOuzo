// AudioManager: play(eventName) for SFX, announce(eventName) for announcer lines
// (voice file if present + on-screen caption). Design rules:
//   * missing files fail silently, captions show even without audio
//   * nothing plays before the first user gesture (autoplay policies)
//   * no audio error may ever interrupt gameplay (everything is guarded)
//   * if an SFX has no file, a tiny synthesized sound is used instead
const AUDIO_DIR = "assets/audio/";
const MUSIC_FILE = "music_loop.mp3";

// Synth fallbacks: event -> synth name (used only when no file exists).
const SYNTH_FOR = {
  swish: "swish",
  clank: "clank",
  buzzer: "buzzer",
  squeak: "squeak",
  crowd: "crowd",
  // announcer events without a voice file still get a little colour
  alleyoop: "crowd",
  steal: "whoosh",
  block: "whoosh",
  win: "fanfare",
  loss: "sad",
};

export class AudioManager {
  constructor({ announcer = {}, manifest = null, captionEl = null, muted = false, synth = true } = {}) {
    this.lines = announcer;
    this.manifest = manifest;
    this.captionEl = captionEl;
    this.muted = muted;
    this.synthEnabled = synth;
    this.unlocked = false;
    this.missing = new Set();
    this.lastIndex = {};
    this.ctx = null;
    this.master = null;
    this.voice = null;
    this.music = null;
    this.scene = "";
    this.titlePlayed = false;
  }

  // ---------- lifecycle ----------

  /** Call from the first user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.unlocked) {
      this._resume();
      return;
    }
    this.unlocked = true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.ctx.destination);
      }
    } catch {
      this.ctx = null;
    }
    this._startMusic();
    if (this.scene === "title" || this.scene === "map") this._titleLine();
  }

  _resume() {
    try {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    } catch {}
  }

  setMuted(muted) {
    this.muted = !!muted;
    try {
      if (this.muted) {
        this.voice?.pause();
        this.music?.pause();
      } else if (this.unlocked) {
        this._startMusic();
      }
    } catch {}
  }

  setScene(name) {
    this.scene = name;
    if (name === "title" || name === "map") this._titleLine();
  }

  _titleLine() {
    if (this.titlePlayed || !this.unlocked || this.muted) return;
    this.titlePlayed = true;
    const line = this._pickLine("title");
    if (line?.file) this._playFile(line.file, 0.9, true);
  }

  // ---------- public API ----------

  /** Short sound effect. Returns nothing, never throws. */
  play(eventName) {
    try {
      const line = this._pickLine(eventName);
      if (line?.file && this._playFile(line.file, 0.6, false)) return;
      this._synth(SYNTH_FOR[eventName]);
    } catch {}
  }

  /** Announcer line: caption always, voice if the file exists. */
  announce(eventName) {
    try {
      const line = this._pickLine(eventName);
      if (line?.caption) this._caption(line.caption);
      if (line?.file && this._playFile(line.file, 0.95, true)) return;
      this._synth(SYNTH_FOR[eventName]);
    } catch {}
  }

  // ---------- internals ----------

  _available(file) {
    if (this.missing.has(file)) return false;
    return this.manifest ? this.manifest.audio.has(file) : true;
  }

  /** Random line whose file exists; otherwise any line (for its caption). */
  _pickLine(eventName) {
    const lines = this.lines?.[eventName]?.lines;
    if (!Array.isArray(lines) || !lines.length) return null;
    const withFile = lines.filter((l) => l.file && this._available(l.file));
    const pool = withFile.length ? withFile : lines;
    let i = Math.floor(Math.random() * pool.length); // presentation only, not gameplay
    if (pool.length > 1 && pool[i] === this.lastIndex[eventName]) i = (i + 1) % pool.length;
    this.lastIndex[eventName] = pool[i];
    const line = pool[i];
    return withFile.length ? line : { caption: line.caption };
  }

  _playFile(file, volume, isVoice) {
    if (!this.unlocked || this.muted || !this._available(file)) return false;
    try {
      const a = new Audio(AUDIO_DIR + file);
      a.volume = volume;
      a.addEventListener("error", () => this.missing.add(file));
      if (isVoice) {
        try {
          this.voice?.pause();
        } catch {}
        this.voice = a;
      }
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      return true;
    } catch {
      this.missing.add(file);
      return false;
    }
  }

  _startMusic() {
    if (this.muted || !this._available(MUSIC_FILE)) return;
    if (!this.manifest) return; // unknown: don't probe for music
    try {
      if (!this.music) {
        this.music = new Audio(AUDIO_DIR + MUSIC_FILE);
        this.music.loop = true;
        this.music.volume = 0.22;
        this.music.addEventListener("error", () => this.missing.add(MUSIC_FILE));
      }
      const p = this.music.play();
      if (p && p.catch) p.catch(() => {});
    } catch {}
  }

  _caption(text) {
    const el = this.captionEl;
    if (!el) return;
    const box = document.createElement("div");
    box.className = "caption-box";
    box.textContent = text;
    el.replaceChildren(box);
    clearTimeout(this._capTimer);
    this._capTimer = setTimeout(() => {
      if (box.isConnected) box.remove();
    }, 3400);
  }

  // ---------- tiny synth (WebAudio) ----------

  _noise(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  _env(peak, attack, release, t0) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
    g.connect(this.master);
    return g;
  }

  _tone(type, freq, t0, dur, peak, toFreq = null) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
    o.connect(this._env(peak, 0.012, dur, t0));
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  _filteredNoise(dur, type, f0, f1, q, peak, attack, t0) {
    const ctx = this.ctx;
    const n = this._noise(dur + 0.1);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    n.connect(f);
    f.connect(this._env(peak, attack, dur - attack, t0));
    n.start(t0);
    n.stop(t0 + dur + 0.1);
  }

  _synth(name) {
    if (!name || !this.synthEnabled || !this.unlocked || this.muted || !this.ctx) return;
    this._resume();
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case "swish":
        this._filteredNoise(0.32, "bandpass", 3400, 900, 1.1, 0.5, 0.03, t);
        break;
      case "clank":
        this._tone("triangle", 640, t, 0.2, 0.35);
        this._tone("square", 947, t, 0.14, 0.12);
        this._filteredNoise(0.06, "highpass", 2000, 2500, 0.7, 0.25, 0.005, t);
        break;
      case "buzzer":
        this._tone("sawtooth", 196, t, 0.75, 0.2);
        this._tone("sawtooth", 208, t, 0.75, 0.2);
        break;
      case "squeak":
        this._tone("sine", 1500, t, 0.07, 0.07, 2400);
        break;
      case "crowd":
        this._filteredNoise(1.3, "bandpass", 700, 1300, 0.5, 0.42, 0.3, t);
        break;
      case "whoosh":
        this._filteredNoise(0.3, "bandpass", 400, 2600, 1.4, 0.4, 0.1, t);
        break;
      case "fanfare":
        [523, 659, 784, 1047].forEach((f, i) => this._tone("triangle", f, t + i * 0.13, i === 3 ? 0.7 : 0.16, 0.3));
        this._filteredNoise(1.6, "bandpass", 700, 1400, 0.5, 0.4, 0.4, t + 0.3);
        break;
      case "sad":
        [392, 330, 262].forEach((f, i) => this._tone("triangle", f, t + i * 0.22, 0.4, 0.26));
        break;
    }
  }
}
