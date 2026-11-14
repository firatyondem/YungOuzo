// Player card used on the map, reward and picker screens.
import { esc, ARCHETYPE_LABEL } from "./dom.js";
import { avatarHTML } from "./avatar.js";
import { icon, TYPE_ICON } from "./icons.js";

const RATING_INFO = [
  ["SHT", "Shooting: +5% per point on this player's 3PT shots"],
  ["INS", "Inside: +5% per point on this player's 2PT shots"],
  ["DEF", "Defense: raises your passive Contest each turn"],
  ["PLY", "Playmaking: raises your passive Openness each turn"],
];

function pips(value, highlight) {
  let out = "";
  for (let i = 1; i <= 5; i++) out += `<i class="${i <= value ? "on" : ""}${highlight && i === value ? " new" : ""}"></i>`;
  return out;
}

/** opts: { slot, highlightRating, action (button label), tag } */
export function playerCardHTML(p, content, opts = {}) {
  const sigs = p.signatureCards
    .map((id) => content.cards[id])
    .filter(Boolean)
    .map((c) => `<span class="sig type-${c.type.toLowerCase()}" title="${esc(c.text || "")}">${icon(TYPE_ICON[c.type] || "utility")}${esc(c.name)}</span>`)
    .join("");
  return `
    <div class="pcard${opts.compact ? " compact" : ""}" style="--pc:${p.color}" ${opts.slot != null ? `data-slot="${opts.slot}"` : ""}>
      ${opts.tag ? `<div class="pcard-tag">${esc(opts.tag)}</div>` : ""}
      <div class="pcard-head">
        ${avatarHTML(p, { size: "lg", badge: true })}
        <div class="pcard-id">
          <div class="pcard-name">${esc(p.name)}</div>
          <div class="pcard-arch">${esc(p.position)} / ${esc(ARCHETYPE_LABEL[p.archetype] || p.archetype)}</div>
        </div>
      </div>
      <div class="pcard-ratings">
        ${RATING_INFO.map(
          ([k, tip]) =>
            `<div class="rt" title="${tip}"><span>${k}</span><div class="pips">${pips(p.ratings[k], opts.highlightRating === k)}</div></div>`
        ).join("")}
      </div>
      <div class="pcard-sigs">${sigs}</div>
      ${opts.action ? `<button class="btn btn-small pcard-action">${esc(opts.action)}</button>` : ""}
    </div>`;
}
