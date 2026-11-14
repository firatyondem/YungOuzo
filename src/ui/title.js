// Title screen and the one-screen How to Play page.
import { $, esc } from "./dom.js";
import { cardHTML } from "./cards.js";
import { icon } from "./icons.js";
import { confetti } from "./fx.js";
import { showScreen, showOverlay, hideOverlay } from "./screens.js";

const FAN = ["contest", "swing_pass", "pull_up_jumper", "catch_and_shoot_3", "lockdown"];

export function soundButtonHTML(app) {
  return `<button class="btn icon-btn sound-toggle" title="Sound on/off (M)">${icon(app.muted ? "soundOff" : "soundOn")}</button>`;
}

export function renderTitle(app) {
  const host = $("#screen-title");
  const cards = app.content.cards;
  const fan = FAN.map((id) => cards[id]).filter(Boolean);
  host.innerHTML = `
    <div class="title-bg">
      <div class="beam b1"></div><div class="beam b2"></div><div class="beam b3"></div>
      <div class="crowd"></div>
      <div class="title-floor"><div class="tf-circle"></div><div class="tf-line"></div></div>
    </div>
    <div class="title-top">${soundButtonHTML(app)}</div>
    <div class="title-content">
      <div class="title-kicker">A BASKETBALL ROGUELIKE DECKBUILDER</div>
      <h1 class="logo" aria-label="Full Court Run">
        <span class="logo-line">FULL C<i class="logo-ball"></i>URT</span>
        <span class="logo-line logo-run">RUN</span>
      </h1>
      <p class="title-pitch">Build your squad. Beat the 24-second shot clock. Survive the league and win the Finals.</p>
      <div class="title-actions">
        <button class="btn btn-primary btn-play" id="title-play">PLAY</button>
        <button class="btn btn-howto" id="title-howto">HOW TO PLAY</button>
      </div>
      <div class="title-feats">
        <span>${icon("deck")}Play cards to get open and score</span>
        <span>${icon("defense")}Read the opponent, then defend</span>
        <span>${icon("trophy")}Win, draft rewards, face tougher teams</span>
      </div>
    </div>
    <div class="title-fan">${fan.map((c, i) => `<div class="fan-slot" style="--i:${i - (fan.length - 1) / 2}">${cardHTML(c)}</div>`).join("")}</div>
    <div class="title-foot">Mouse to play · Space ends your turn · 1–9 play a card · M mute</div>`;
  confetti($(".title-bg", host), 46);
  $("#title-play", host).addEventListener("click", () => app.startRun());
  $("#title-howto", host).addEventListener("click", () => app.goHowTo());
}

export function howtoHTML(app) {
  const c = app.content.cards;
  const step = (n, title, body, cardId) => `
    <div class="how-step">
      <div class="how-n">${n}</div>
      <h3>${title}</h3>
      <p>${body}</p>
      ${c[cardId] ? `<div class="how-card">${cardHTML(c[cardId])}</div>` : ""}
    </div>`;
  return `
    <div class="how">
      <h1>HOW TO PLAY</h1>
      <p class="how-lead">First to <b>15</b> wins a game. Beat <b>three league opponents</b>, then win the <b>best-of-3 Finals</b>.</p>
      <div class="how-steps">
        ${step(1, "GET OPEN", "<b class='o'>Offense</b> cards build <b class='o'>Openness</b>. Every point adds +1% to your next shot.", "swing_pass")}
        ${step(2, "TAKE THE SHOT", "<b class='y'>Shot</b> cards score 2 or 3. The big % on the card is your live chance. One shot per turn.", "pull_up_jumper")}
        ${step(3, "DEFEND", "The opponent shows what they will try. <b class='b'>Defense</b> cards add <b class='b'>Contest</b> and cut their %.", "contest")}
        ${step(4, "BEAT THE CLOCK", "Every card costs seconds from your <b>24-second shot clock</b>. Hit <b>END TURN</b> and the opponent shoots. No shot = violation.", "pick_and_roll")}
      </div>
      <div class="how-extra">
        <span><b>Lineup</b> — shots use your players' SHT (3PT) and INS (2PT). DEF and PLY give passive Contest and Openness.</span>
        <span><b>Chemistry</b> — two players of the same archetype unlock a team bonus.</span>
        <span><b>Plays</b> — the right cards in order trigger a play call, e.g. Pass, Pass, shot = Swing-Swing (+10%). The Playbook shows what is one card away.</span>
        <span><b>Coach</b> — three timeouts per game (new hand, ice their shooter, extra seconds) and special options in closing time.</span>
        <span><b>Rewards</b> — after each win pick a new card, a new player, or a rating upgrade.</span>
        <span><b>Controls</b> — click a card to play it · Space = end turn · 1–9 = play card · M = mute</span>
      </div>
    </div>`;
}

export function renderHowTo(app) {
  const host = $("#screen-howto");
  host.innerHTML = `
    <div class="page page-center">
      ${howtoHTML(app)}
      <div class="page-actions">
        <button class="btn btn-primary btn-big" id="how-play">PLAY</button>
        <button class="btn" id="how-back">${icon("arrowLeft")}BACK</button>
      </div>
    </div>`;
  $("#how-play", host).addEventListener("click", () => app.startRun());
  $("#how-back", host).addEventListener("click", () => app.goTitle());
}

/** In-game help: same content in an overlay. */
export function showHowToOverlay(app) {
  const o = showOverlay(`${howtoHTML(app)}<button class="btn btn-primary" id="ov-close">BACK TO THE GAME</button>`, "wide howto");
  $("#ov-close", o).addEventListener("click", hideOverlay);
}

export function goTitleScreen(app) {
  renderTitle(app);
  showScreen("title");
}
