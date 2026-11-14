// AudioManager: play(eventName) for SFX, announce(eventName) for announcer lines
// (voice file if present + on-screen caption), setScene(name, round) for music.
// Design rules:
//   * missing files fail silently, captions show even without audio
//   * nothing plays before the first user gesture (autoplay policies)
//   * no audio error may ever interrupt gameplay (everything is guarded)
//   * if an SFX has no file, a tiny synthesized sound is used instead
const AUDIO_DIR = "assets/audio/";
const MUSIC_FILE = "music_loop.mp3"; // legacy fallback for every scene

// Scene -> music track. Missing files fall back to MUSIC_FILE (or silence).
// "game" picks a track per round; the last entry is the finals track.
const MUSIC_FOR = {
  title: "music_menu.mp3",
  howto: "music_menu.mp3",
  map: "music_menu.mp3",
  reward: "music_menu.mp3",
  game: ["music_match.mp3", "music_match.mp3", "music_finals.mp3"],
  victory: "music_victory.mp3",
  gameover: "music_defeat.mp3",
};
const LOOPS = { "music_victory.mp3": false, "music_defeat.mp3": false };
const FADE_MS = 700;

// Screen ids / phases that are not scene names themselves. "end" is resolved
// in _resolveScene (it is the victory OR the game-over screen).
const SCENE_ALIAS = { "": "title", boot: "title", match: "game" };

// Mix: three user channels (0..1), persisted. The WebAudio master gain stays.
const DEFAULT_VOL = { music: 0.22, sfx: 0.6, announcer: 0.95 };
const VOL_KEY = "fcr_audio";
const MUTE_KEY = "fcr_muted"; // the key main.js already uses for its mute button
const DUCK_TO = 0.5; // music drops to 50% under an announcer voice line
const DUCK_IN_MS = 150;
const DUCK_OUT_MS = 400;
const STINGER_DUCK_MS = 1000;

// One-shot crowd swell on big moments (deduplicated, see _crowd).
const CROWD_ON = new Set(["made3", "deep3", "gamepoint", "win"]);
const CROWD_GAP_MS = 1200;

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(+v) ? +v : 0));
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const jitter = (spread) => 1 + (Math.random() * 2 - 1) * spread; // presentation only

// Synth fallbacks: event -> synth name (used only when no file exists).
const SYNTH_FOR = {
  swish: "swish",
  clank: "clank",
  buzzer: "buzzer",
  squeak: "squeak",
  crowd: "crowd",
  card_play: "squeak",
  combo_tick: "tick",
  reward_pick: "chime",
  gamepoint_tension: "tension",
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
    this.sfxBus = null;
    this.voice = null;
    this.music = null;
    this.musicFile = null;
    this.tracks = []; // [{ audio, file, gain, from, to, t0, dur, done, started }], incl. fading-out ones
    this.duck = { v: 1, from: 1, to: 1, t0: 0, dur: 0 };
    this.duckHoldUntil = 0;
    this.scene = "";
    this.round = 0;
    this.final = undefined;
    this.titlePlayed = false;
    this.listeners = new Set();
    this.vol = { ...DEFAULT_VOL, ...this._loadVolumes() };
  }

  // ---------- lifecycle ----------

  /** Call from the first user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.unlocked) {
      this._resume();
      // A first play() can be rejected (e.g. a touch pointerdown): try again.
      if (this._musicBlocked) this._startMusic();
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
        this.sfxBus = this.ctx.createGain(); // synth SFX follow the SFX slider
        this.sfxBus.gain.value = this.vol.sfx / DEFAULT_VOL.sfx;
        this.sfxBus.connect(this.master);
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

  /** Mute pauses music and voices at once; unmute resumes the scene's track. */
  setMuted(muted) {
    this.muted = !!muted;
    try {
      if (this.muted) {
        try {
          this.voice?.pause();
        } catch {}
        this.voice = null;
        clearTimeout(this._duckTimer);
        this.duck = { v: 1, from: 1, to: 1, t0: 0, dur: 0 };
        for (const tr of this.tracks) {
          try {
            tr.audio.pause();
          } catch {}
        }
        // Drop tracks that were fading out; the current one stays paused in place.
        this.tracks = this.tracks.filter((tr) => tr.audio === this.music);
        for (const tr of this.tracks) {
          tr.gain = tr.to = 1;
          tr.done = null;
        }
        this._stopTick();
      } else if (this.unlocked) {
        this._startMusic();
      }
    } catch {}
    this._emit();
  }

  /** Flip mute, remember it, return the new state. */
  toggleMute() {
    this.setMuted(!this.muted);
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {}
    return this.muted;
  }

  /** channel: "music" | "sfx" | "announcer", value 0..1. Applies live. */
  setVolume(channel, value) {
    try {
      if (!Object.hasOwn(DEFAULT_VOL, channel)) return;
      this.vol[channel] = clamp01(value);
      if (channel === "music") this._applyMusic();
      else if (channel === "announcer" && this.voice) this.voice.volume = this.vol.announcer;
      else if (channel === "sfx" && this.sfxBus) this.sfxBus.gain.value = this.vol.sfx / DEFAULT_VOL.sfx;
      try {
        localStorage.setItem(VOL_KEY, JSON.stringify(this.vol));
      } catch {}
    } catch {}
    this._emit();
  }

  /** { music, sfx, announcer, muted } */
  getVolumes() {
    return { ...this.vol, muted: this.muted };
  }

  /** Subscribe to volume / mute changes. Returns an unsubscribe function. */
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of this.listeners) {
      try {
        fn(this.getVolumes());
      } catch {}
    }
  }

  _loadVolumes() {
    try {
      const raw = JSON.parse(localStorage.getItem(VOL_KEY) || "{}");
      const out = {};
      for (const k of Object.keys(DEFAULT_VOL)) if (Number.isFinite(raw?.[k])) out[k] = clamp01(raw[k]);
      return out;
    } catch {
      return {};
    }
  }

  /**
   * round: index of the stop being played. final: true on the last stop; when
   * omitted it is read from the run (a season can have more than 3 stops).
   */
  setScene(name, round = 0, final = undefined) {
    try {
      this.scene = this._resolveScene(name);
      this.round = round || 0;
      this.final = final;
      if (this.unlocked) this._startMusic();
      if (this.scene === "title" || this.scene === "map") this._titleLine();
    } catch {}
  }

  /** Maps screen ids to scene names ("end" -> victory / gameover). */
  _resolveScene(name) {
    const n = String(name ?? "");
    if (Object.hasOwn(MUSIC_FOR, n)) return n;
    if (Object.hasOwn(SCENE_ALIAS, n)) return SCENE_ALIAS[n];
    if (n === "end") {
      if (this.scene === "victory" || this.scene === "gameover") return this.scene;
      const phase = this._run()?.phase;
      if (phase === "victory" || phase === "gameover") return phase;
    }
    return this.scene || "title"; // unknown: keep what is playing
  }

  _run() {
    try {
      return globalThis.fcr?.run || null;
    } catch {
      return null;
    }
  }

  _titleLine() {
    if (this.titlePlayed || !this.unlocked || this.muted) return;
    this.titlePlayed = true;
    const line = this._pickLine("title");
    if (line?.file) this._playFile(line.file, this.vol.announcer, true);
  }

  // ---------- public API ----------

  /** Short sound effect. Returns nothing, never throws. */
  play(eventName) {
    try {
      if (eventName === "crowd") return void this._crowd();
      const line = this._pickLine(eventName);
      if (line?.file && this._playFile(line.file, this.vol.sfx, false, jitter(0.05))) return;
      this._synth(SYNTH_FOR[eventName]);
    } catch {}
  }

  /** Announcer line: caption always, voice if the file exists. */
  announce(eventName) {
    try {
      const line = this._pickLine(eventName);
      if (line?.caption) this._caption(line.caption);
      if (CROWD_ON.has(eventName)) this._crowd();
      if (line?.file && this._playFile(line.file, this.vol.announcer, true)) return;
      this._synth(SYNTH_FOR[eventName]);
    } catch {}
  }

  /** One-shot crowd swell: a little different every time, never stacked. */
  _crowd() {
    try {
      const t = now();
      if (t - (this._lastCrowd ?? -1e9) < CROWD_GAP_MS) return;
      this._lastCrowd = t;
      const line = this._pickLine("crowd");
      const level = (0.5 + Math.random() * 0.2) * (this.vol.sfx / DEFAULT_VOL.sfx);
      if (line?.file && this._playFile(line.file, level, false, jitter(0.05))) return;
      this._synth(SYNTH_FOR.crowd);
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

  _playFile(file, volume, isVoice, rate = 1) {
    if (!this.unlocked || this.muted || !this._available(file)) return false;
    try {
      const a = new Audio(AUDIO_DIR + file);
      a.volume = clamp01(volume);
      if (rate !== 1) {
        try {
          a.preservesPitch = a.mozPreservesPitch = a.webkitPreservesPitch = false; // vary the pitch too
          a.playbackRate = rate;
        } catch {}
      }
      a.addEventListener("error", () => this.missing.add(file));
      if (!isVoice) {
        const p = a.play();
        if (p && p.catch) p.catch(() => {});
        return true;
      }
      try {
        this.voice?.pause();
      } catch {}
      this.voice = a;
      const release = () => this._voiceDone(a);
      a.addEventListener("ended", release);
      a.addEventListener("error", release);
      this._duckTo(DUCK_TO, DUCK_IN_MS);
      // A stinger that has only just started stays ducked for its first second.
      const cur = this.tracks.find((tr) => tr.audio === this.music);
      if (cur && LOOPS[cur.file] === false && now() - cur.started < STINGER_DUCK_MS) {
        this.duckHoldUntil = cur.started + STINGER_DUCK_MS;
      }
      const p = a.play();
      if (p && p.catch) p.catch(release);
      return true;
    } catch {
      this.missing.add(file);
      return false;
    }
  }

  /** A voice line ended (or failed): bring the music back up. */
  _voiceDone(a) {
    try {
      if (this.voice !== a) return; // a newer line took over and keeps the duck
      this.voice = null;
      clearTimeout(this._duckTimer);
      const wait = this.duckHoldUntil - now();
      if (wait > 0) {
        this._duckTimer = setTimeout(() => {
          if (!this.voice) this._duckTo(1, DUCK_OUT_MS);
        }, wait);
      } else this._duckTo(1, DUCK_OUT_MS);
    } catch {}
  }

  // ---------- music ----------

  _trackFor(scene, round) {
    let t = MUSIC_FOR[scene];
    if (Array.isArray(t)) {
      const r = round || 0;
      let final = this.final;
      if (final == null) {
        const stops = this._run()?.schedule?.length;
        final = stops ? r >= stops - 1 : r >= t.length - 1;
      }
      t = final ? t[t.length - 1] : t[Math.min(r, t.length - 2)];
    }
    if (t && this._available(t)) return t;
    return this._available(MUSIC_FILE) ? MUSIC_FILE : null;
  }

  /** Every music element plays at: channel volume x its own fade x duck. */
  _applyMusic() {
    for (const tr of this.tracks) {
      try {
        tr.audio.volume = clamp01(this.vol.music * tr.gain * this.duck.v);
      } catch {}
    }
  }

  _fadeTrack(tr, to, ms, done = null) {
    tr.from = tr.gain;
    tr.to = to;
    tr.t0 = now();
    tr.dur = ms;
    tr.done = done;
    this._startTick();
  }

  _duckTo(to, ms) {
    const d = this.duck;
    d.from = d.v;
    d.to = to;
    d.t0 = now();
    d.dur = ms;
    this._startTick();
  }

  // A timer rather than requestAnimationFrame, so fades also finish in a hidden tab.
  _startTick() {
    if (this._tick) return;
    try {
      this._tick = setInterval(() => this._step(), 25);
    } catch {}
  }

  _stopTick() {
    clearInterval(this._tick);
    this._tick = null;
  }

  _step() {
    try {
      const t = now();
      let busy = false;
      const d = this.duck;
      if (d.v !== d.to) {
        const k = d.dur > 0 ? Math.min(1, (t - d.t0) / d.dur) : 1;
        d.v = k < 1 ? d.from + (d.to - d.from) * k : d.to;
        if (k < 1) busy = true;
      }
      for (const tr of [...this.tracks]) {
        if (tr.gain === tr.to) continue;
        const k = tr.dur > 0 ? Math.min(1, (t - tr.t0) / tr.dur) : 1;
        tr.gain = k < 1 ? tr.from + (tr.to - tr.from) * k : tr.to;
        if (k < 1) busy = true;
        else {
          const done = tr.done;
          tr.done = null;
          done?.();
        }
      }
      this._applyMusic();
      if (!busy) this._stopTick();
    } catch {
      this._stopTick();
    }
  }

  _playMusic(tr) {
    try {
      this._musicBlocked = false;
      const p = tr.audio.play();
      if (p && p.catch) {
        p.catch(() => {
          if (tr.audio === this.music && !this.muted) this._musicBlocked = true;
        });
      }
    } catch {}
  }

  _startMusic() {
    if (this.muted || !this.manifest) return; // unknown manifest: don't probe
    try {
      const file = this._trackFor(this.scene, this.round);
      if (!file) return;
      const cur = this.tracks.find((tr) => tr.audio === this.music);
      if (cur && this.musicFile === file) {
        // Same track: carry on where it was (after a mute or a blocked first play).
        const a = cur.audio;
        if (a.paused && !a.ended && (a.loop || this._musicBlocked || a.currentTime > 0)) {
          this._applyMusic();
          this._playMusic(cur);
        }
        return;
      }
      if (cur) {
        this._fadeTrack(cur, 0, FADE_MS, () => {
          try {
            cur.audio.pause();
          } catch {}
          this.tracks = this.tracks.filter((tr) => tr !== cur);
        });
      }
      const a = new Audio(AUDIO_DIR + file);
      a.loop = LOOPS[file] !== false;
      a.volume = 0;
      a.addEventListener("error", () => this.missing.add(file));
      // Loops fade in; a stinger keeps its attack and starts at full level.
      const g = a.loop ? 0 : 1;
      const tr = { audio: a, file, gain: g, from: g, to: g, t0: 0, dur: 0, done: null, started: now() };
      this.tracks.push(tr);
      this.music = a;
      this.musicFile = file;
      // A stinger that starts under a voice line stays ducked for its first second.
      if (!a.loop && this.voice) this.duckHoldUntil = tr.started + STINGER_DUCK_MS;
      this._applyMusic();
      this._playMusic(tr);
      if (a.loop) this._fadeTrack(tr, 1, FADE_MS);
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
    g.connect(this.sfxBus || this.master);
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
      case "tick":
        this._tone("square", 880, t, 0.05, 0.1, 1320);
        break;
      case "chime":
        this._tone("triangle", 784, t, 0.14, 0.25);
        this._tone("triangle", 1175, t + 0.11, 0.3, 0.25);
        break;
      case "tension":
        this._tone("sawtooth", 98, t, 0.45, 0.16, 147);
        this._filteredNoise(0.45, "bandpass", 300, 1400, 0.8, 0.18, 0.2, t);
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
