// Custom SVG icon set. One style everywhere: 24x24 grid, 2px round strokes,
// currentColor, no fills. No emoji are used anywhere in the UI.
const P = {
  // Card types
  offense: '<path d="M4 18c3-7 7-3 15-11"/><path d="M13 6h6v6"/>',
  shot: '<circle cx="7.5" cy="6.5" r="3.2"/><path d="M10.6 8.4c2.6 1 4.3 2.6 5 4.6"/><ellipse cx="16" cy="15" rx="5" ry="1.8"/><path d="M11.6 16.2 13 21h6l1.4-4.8"/>',
  defense: '<path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  buff: '<path d="M12 3c1 3.2 5 5 5 10a5 5 0 0 1-10 0c0-2 .8-3.2 2-4.2 0 2 .8 3 2 3.2 0-3-1-5 1-9z"/>',
  utility: '<rect x="6" y="4.5" width="12" height="16.5" rx="2"/><path d="M9.5 3h5v3h-5z"/><path d="M9 11h6M9 15h4"/>',
  hustle: '<path d="M13 2 5 14h6l-1 8 9-12h-6z"/>',
  // Player state
  stamina: '<path d="M2.5 12h4l2-5 3.5 10 2.5-7 1.5 2h5.5"/>',
  foul: '<circle cx="9" cy="14.5" r="5"/><path d="M13.4 12 21 8v4.5l-7 2"/><path d="M5.5 6 7 8.5M10 4v3"/>',
  wear: '<path d="M4 17a8 8 0 0 1 16 0"/><path d="M12 17l4.5-5.5"/><path d="M4 20h16"/>',
  injury: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  // Tactics
  mismatch: '<path d="M8 20V6"/><path d="M4 10l4-4 4 4"/><path d="M16 4v14"/><path d="M12 14l4 4 4-4"/>',
  doubleTeam: '<circle cx="8" cy="7" r="3"/><circle cx="16" cy="7" r="3"/><path d="M3 20c0-4 2-6 5-6s5 2 5 6"/><path d="M11.5 15.5c1-1 2.600-1.500 4.500-1.500 3 0 5 2 5 6"/>',
  clutch: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.500V9"/><path d="M9.500 2.500h5M12 2.500V6"/>',
  capSpace: '<circle cx="12" cy="12" r="9"/><path d="M15 9.200c-1-1.700-5.200-1.800-5.200.700 0 2.700 5.400 1.600 5.400 4.500 0 2.500-4.600 2.500-5.700.500"/><path d="M12 6v12"/>',
  relic: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="M9 3 7 9l5 12 5-12-2-6"/>',
  scouting: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  // UI
  soundOn: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4.200 4.200 0 0 1 0 6"/><path d="M18.600 6.400a8 8 0 0 1 0 11.200"/>',
  soundOff: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9.500l5 5M22 9.500l-5 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.400 9.400a2.700 2.700 0 1 1 3.800 2.500c-.800.400-1.200 1-1.200 1.900"/><path d="M12 17.200v.300"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4c0 3 1.200 5 4 5M17 6h3c0 3-1.200 5-4 5"/><path d="M12 14v4M8 20.500h8"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18"/><path d="M5.600 5.600c3 3.200 3 9.600 0 12.800M18.400 5.600c-3 3.200-3 9.600 0 12.800"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M4 12.500l5 5L20 6.500"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  arrowRight: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  swap: '<path d="M4 8h14"/><path d="M14 4l4 4-4 4"/><path d="M20 16H6"/><path d="M10 12l-4 4 4 4"/>',
  deck: '<rect x="4" y="6" width="11" height="15" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v13"/>',
  play: '<path d="M7 4.500v15l12-7.500z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  star: '<path d="M12 3l2.700 5.600 6.100.800-4.500 4.300 1.100 6.100L12 16.900 6.600 19.800l1.100-6.100L3.200 9.400l6.100-.800z"/>',
  users: '<circle cx="9" cy="8" r="3.200"/><path d="M3 20c0-3.600 2.400-5.600 6-5.600s6 2 6 5.600"/><path d="M16 5.200a3 3 0 0 1 0 5.600M18 14.800c1.900.700 3 2.400 3 5.200"/>',
  skip: '<path d="M5 5l8 7-8 7z"/><path d="M17 5v14"/>',
};

export const ICON_NAMES = Object.keys(P);

/** Type name ("Offense", "Shot"...) -> icon name. */
export const TYPE_ICON = { Offense: "offense", Shot: "shot", Defense: "defense", Buff: "buff", Utility: "utility", Hustle: "hustle", Status: "wear" };

/** Inline SVG icon. opts: { size (px), cls, title } */
export function icon(name, opts = {}) {
  const body = P[name] || P.ball;
  const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : "";
  const label = opts.title ? ` role="img" aria-label="${String(opts.title).replace(/"/g, "&quot;")}"` : ' aria-hidden="true"';
  return `<svg class="ico${opts.cls ? " " + opts.cls : ""}" viewBox="0 0 24 24"${size} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${label}>${body}</svg>`;
}
