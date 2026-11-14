// Audio settings widget: a mute button plus a small popover with three volume
// sliders (Music / SFX / Announcer). Self-contained: it brings its own markup,
// icons and CSS, and talks to app.audio (AudioManager) only.
//
//   import { mountAudioSettings } from "./audio/settingsPanel.js";
//   mountAudioSettings(app, document.querySelector("#g-tools"));
//
// Safe to mount before app.audio exists and safe to mount more than once.
const STYLE_ID = "fcr-audio-settings-css";
const CHANNELS = [
  ["music", "Music"],
  ["sfx", "SFX"],
  ["announcer", "Announcer"],
];
// Shown until app.audio is ready (same defaults / storage key as AudioManager).
const FALLBACK = { music: 0.22, sfx: 0.6, announcer: 0.95 };

const CSS = `
.fcr-as { position: relative; display: inline-flex; gap: 4px; align-items: center; font-family: var(--body, system-ui, sans-serif); }
.fcr-as-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 40px; padding: 8px 10px;
  color: var(--text, #FFF8EC); background: var(--surface-2, #1F3157); border: 2px solid var(--line, #3A5486);
  border-radius: var(--r-panel, 6px); box-shadow: 0 3px 0 #0A1120; cursor: pointer; transition: background .15s, border-color .15s; }
.fcr-as-btn:hover, .fcr-as-btn[aria-expanded="true"] { background: #2A4276; border-color: var(--white, #FFF8EC); }
.fcr-as-btn:focus-visible, .fcr-as-pop input:focus-visible { outline: 3px solid var(--yellow, #FFD23F); outline-offset: 2px; }
.fcr-as-btn svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.fcr-as-btn.is-muted { color: var(--muted, #A9B8D6); }
.fcr-as-pop { position: absolute; top: calc(100% + 8px); right: 0; z-index: 1000; width: 232px; max-width: calc(100vw - 16px); padding: 12px 14px;
  color: var(--text, #FFF8EC); background: var(--surface, #16233D); border: 2px solid var(--line, #3A5486);
  border-radius: var(--r-panel, 6px); box-shadow: 0 8px 24px rgba(0, 0, 0, .5); }
.fcr-as-pop[hidden] { display: none; }
.fcr-as-row { display: grid; grid-template-columns: 88px 1fr 30px; align-items: center; gap: 8px; margin: 6px 0;
  font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.fcr-as-row output { text-align: right; color: var(--muted, #A9B8D6); font-variant-numeric: tabular-nums; }
.fcr-as-pop input[type="range"] { width: 100%; min-width: 0; margin: 0; accent-color: var(--orange, #FF6B1A); cursor: pointer; }
.fcr-as-pop.is-muted .fcr-as-row { opacity: .5; }
`;

const ICON = {
  on: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4.2 4.2 0 0 1 0 6"/><path d="M18.6 6.4a8 8 0 0 1 0 11.2"/>',
  off: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>',
  sliders: '<path d="M5 4v6M5 14v6M12 4v2M12 10v10M19 4v9M19 17v3"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="19" cy="15" r="2"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

function injectCss() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

let uid = 0;

/**
 * Adds the widget to containerEl (appended; existing children are kept).
 * Returns { el, refresh, destroy } or null if it could not be mounted.
 */
export function mountAudioSettings(app, containerEl) {
  try {
    if (!containerEl || typeof document === "undefined") return null;
    injectCss();
    const id = `fcr-as-${++uid}`;
    const root = document.createElement("span");
    root.className = "fcr-as";
    root.innerHTML = `
      <button type="button" class="fcr-as-btn fcr-as-mute" title="Sound on/off (M)" aria-label="Mute sound" aria-pressed="false"></button>
      <button type="button" class="fcr-as-btn fcr-as-open" title="Volume" aria-label="Volume settings" aria-expanded="false" aria-controls="${id}">${svg("sliders")}</button>
      <div class="fcr-as-pop" id="${id}" role="group" aria-label="Volume" hidden>
        ${CHANNELS.map(
          ([key, label]) => `
        <label class="fcr-as-row"><span>${label}</span>
          <input type="range" min="0" max="100" step="1" data-channel="${key}">
          <output data-out="${key}"></output></label>`,
        ).join("")}
      </div>`;
    containerEl.appendChild(root);

    const muteBtn = root.querySelector(".fcr-as-mute");
    const openBtn = root.querySelector(".fcr-as-open");
    const pop = root.querySelector(".fcr-as-pop");
    const audio = () => app?.audio || null;

    const state = () => {
      try {
        const a = audio();
        if (a?.getVolumes) return a.getVolumes();
      } catch {}
      return { ...FALLBACK, muted: !!app?.muted };
    };

    const refresh = () => {
      try {
        const s = state();
        muteBtn.innerHTML = svg(s.muted ? "off" : "on");
        muteBtn.classList.toggle("is-muted", !!s.muted);
        muteBtn.setAttribute("aria-pressed", s.muted ? "true" : "false");
        pop.classList.toggle("is-muted", !!s.muted);
        for (const [key] of CHANNELS) {
          const pct = Math.round((s[key] ?? 0) * 100);
          const input = pop.querySelector(`[data-channel="${key}"]`);
          if (document.activeElement !== input || +input.value !== pct) input.value = String(pct);
          pop.querySelector(`[data-out="${key}"]`).textContent = String(pct);
        }
      } catch {}
    };

    // app.audio is created asynchronously: subscribe as soon as it exists.
    let unsubscribe = null;
    let tries = 0;
    let waitTimer = null;
    const connect = () => {
      const a = audio();
      if (a?.onChange && !unsubscribe) {
        unsubscribe = a.onChange(refresh);
        refresh();
      }
      return !!unsubscribe;
    };
    if (!connect()) {
      waitTimer = setInterval(() => {
        if (connect() || ++tries > 40) clearInterval(waitTimer);
      }, 250);
    }

    const setOpen = (open) => {
      pop.hidden = !open;
      openBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        connect();
        refresh();
      }
    };

    const onMute = () => {
      try {
        // app.toggleMute keeps the app's own flag and mute buttons in step.
        if (typeof app?.toggleMute === "function") app.toggleMute();
        else audio()?.toggleMute?.();
      } catch {}
      refresh();
    };
    const onOpen = () => setOpen(pop.hidden);
    const onInput = (e) => {
      const key = e.target?.dataset?.channel;
      if (!key) return;
      const v = Number(e.target.value) / 100;
      try {
        audio()?.setVolume?.(key, v);
      } catch {}
      const out = pop.querySelector(`[data-out="${key}"]`);
      if (out) out.textContent = String(Math.round(v * 100));
    };
    // A slider move is a good moment to hear the new SFX level.
    const onChange = (e) => {
      try {
        if (e.target?.dataset?.channel === "sfx") audio()?.play?.("swish");
      } catch {}
    };
    const onDocDown = (e) => {
      if (!pop.hidden && !root.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape" && !pop.hidden) {
        setOpen(false);
        openBtn.focus();
      }
    };

    muteBtn.addEventListener("click", onMute);
    openBtn.addEventListener("click", onOpen);
    pop.addEventListener("input", onInput);
    pop.addEventListener("change", onChange);
    // Escape closes the popover and hands focus back to its button.
    root.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDocDown);

    refresh();
    return {
      el: root,
      refresh,
      destroy() {
        clearInterval(waitTimer);
        unsubscribe?.();
        document.removeEventListener("pointerdown", onDocDown);
        root.remove();
      },
    };
  } catch {
    return null; // the settings UI must never break the game
  }
}
