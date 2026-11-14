// One line that says what decided the run, for the end screen.
// Pure: reads run.stats and run.results only.
//   runVerdict(run) -> { key, line }
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

export function runVerdict(run) {
  const s = run.stats || {};
  const won = run.phase === "victory";
  const games = (run.results || []).length || 1;
  const fg = pct(s.makes, s.shots);
  const oppFg = pct(s.oppMakes, s.oppPlays);
  const violations = s.violations || 0;
  const turnovers = s.turnovers || 0;
  const adjustments = s.adjustments || 0;
  const last = (run.results || [])[run.results.length - 1];
  const margin = last ? Math.abs(last.player - last.opp) : 0;

  if (won) {
    if (fg >= 58) return { key: "shooting", line: `Shot-making won it: ${fg}% from the field over ${games} games.` };
    if (s.oppPlays && oppFg <= 45) return { key: "defense", line: `Defense won it: they scored on only ${oppFg}% of their plays.` };
    if ((s.plays || 0) >= games * 3) return { key: "plays", line: `Ball movement won it: ${s.plays} set plays finished.` };
    return { key: "balance", line: `Balance won it: ${fg}% shooting and ${oppFg}% allowed.` };
  }
  // A loss: name the biggest leak first.
  if (violations >= Math.max(3, games * 2)) return { key: "violations", line: `Shot-clock violations decided it: ${violations} turns without a shot. Keep a shot card in hand (HOLD one).` };
  if (s.shots >= 6 && fg < 42) return { key: "cold", line: `Cold shooting decided it: ${fg}% from the field. Build Openness before you shoot.` };
  if (s.oppPlays >= 6 && oppFg >= 62) return { key: "defense", line: `Defense decided it: they scored on ${oppFg}% of their plays. Spend seconds on Contest.` };
  if (adjustments >= Math.max(3, games)) return { key: "predictable", line: `They read you: ${adjustments} adjustments to your habits. Mix threes, drives and passes.` };
  if (turnovers >= Math.max(3, games)) return { key: "turnovers", line: `Mistakes decided it: ${turnovers} turnovers and failed gambles gave them easy plays.` };
  if (margin <= 3) return { key: "close", line: `It came down to the last possessions: a ${margin}-point game. Save a timeout for closing time.` };
  return { key: "outplayed", line: `They were simply better this time: ${fg}% for you, ${oppFg}% for them.` };
}
