// Builds design/state-audit/index.html from the findings below and the shots on disk.
// node design/state-audit/build.mjs .   (run from the repo root after the captures in e2e/state-audit.pw.ts)
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
const dir = join(root, 'design/state-audit');
const shots = new Set(readdirSync(join(dir, 'shots')));
const has = (v, id) => shots.has(`${v}-${id}.png`);

const top5 = [
  ['Back on the Space map, nothing shows what just happened or what is new.',
   'After a visit the only change is which card is gold. The world just finished gets no tick or sticker, the next world does not move, glow or get pointed at, and a world unlocked this moment looks exactly like an old suggestion: the code sets <code>is-new</code> on its card but no CSS styles it. Gold is never explained, so it reads as “this button is pressed”. “Mars is ready” and “Tap Mars” are words in a pill and a voice.'],
  ['After the third find, the ring and the voice point different ways.',
   'The paper ring moves toy → Journal → Space map, and the Space map ring only appears once the journal has been opened. Meanwhile the voice says “You can fly home and pick another world” (Earth, no toy). On a first Earth visit the bedtime spin rings Space map <em>before</em> any gold place is found, so the ring says “leave” while the gold places say “find”.'],
  ['The Mars rover asks too much of a 5-year-old.',
   'Four arrows on a perspective grid (is “up” away from me?), moves that act three seconds later, a queue of up to eight, and Drill that only works when parked exactly on a rock. Drilling plain ground does nothing visible, and the caption stays on “Wait… Mars is far away!” after everything has landed. The idea (“12 minutes”) is only text.'],
  ['“Done” means three different things and none is shown on the map.',
   'A visit is done at 3 places, the world at 6, the game at 24. The journal right after a finished visit shows a half-empty page with three “Still to find” tiles. Once everywhere is visited the gold card sends the child back to a world they just finished (“More to find · Tap Mars”), styled exactly like a brand-new world.'],
  ['A locked world says why only in words.',
   'Tapping a padlocked card shakes it for 0.4 s and shows “Visit The Moon first” (the article is capitalised mid-sentence) for 2.6 s. The world that unlocks it is not pictured, pointed at or highlighted; the gold stays on the suggested world.'],
];

// verdict: clear | unclear | confusing
const states = [
  { n: 1, title: 'First load: grown-ups splash', ids: ['a01-splash'],
    changed: 'A paper page of adult text with one big yellow “Start playing”.',
    tell: 'It is a grown-ups screen; a child cannot read it but sees one big button.',
    next: 'Press Start playing.',
    shown: 'Only the size and colour of the yellow button.',
    verdict: 'clear', why: 'Meant for the adult; one obvious button. The map hint already reads “Tap Earth” behind it.' },
  { n: 2, title: 'Space map, first time', ids: ['a02-map-first'],
    changed: 'Space with Earth and the Moon; five paper cards; Earth’s card gold with a paper ring; a pill “Tap Earth”.',
    tell: 'The gold card is the one coloured thing. Mars and Saturn are dashed with padlocks.',
    next: 'Tap Earth (any unlocked card works).',
    shown: 'Gold card plus ring (static); voice “You can fly to Earth. Tap it.” The parked ship points at the Moon, not Earth (main.ts aims at the Moon whenever Earth is suggested).',
    verdict: 'clear', why: 'One gold card, read by colour. Nothing moves, and the ship points elsewhere.' },
  { n: 3, title: 'Tapping a locked world', ids: ['a03-locked-tap', 'a04-locked-after'],
    changed: 'Mars card shakes; pill becomes padlock + “Visit The Moon first”; voice “Not yet. You can visit the Moon first.” After 2.6 s the pill returns to “Tap Earth”.',
    tell: 'The shake and padlock say “no”.',
    next: 'Go to the Moon first.',
    shown: 'Only in words. The Moon card is not highlighted or pictured; gold stays on Earth.',
    verdict: 'unclear', why: '“No” is shown; “do this instead” is only said.' },
  { n: 4, title: 'Tapping empty space (a miss)', ids: ['a05-miss'],
    changed: 'A faint ring ripples where the finger landed.',
    tell: 'Small echo: the game heard the tap.',
    next: 'Tap a card or a world.',
    shown: 'The echo only; nothing points at the gold card.',
    verdict: 'clear', why: 'Acknowledged without punishment; faint on a busy star field.' },
  { n: 5, title: 'Flight', ids: ['h01-flight-start', 'h02-flight-mid', 'h03-flight-landed'],
    changed: 'All controls vanish except the journal button; the ship flies, the destination grows. Seven seconds on a real device.',
    tell: 'The ship and the world getting bigger.',
    next: 'Watch; nothing to do.',
    shown: 'Motion. No picture of the destination while flying; the journal button stays live in the corner.',
    verdict: 'clear', why: 'Short, nothing to do. The lone journal button is the only control and leads away from the flight.' },
  { n: 6, title: 'Earth arrival: Turn Earth or Find places', ids: ['b01-earth-welcome', 'b02-earth-welcome-later'],
    changed: 'Heading “Earth / Make night. Bring back morning.” Row: Space map, Turn Earth (green), Find places (yellow). Gold places are hidden.',
    tell: 'Two big bright buttons appear.',
    next: 'Turn Earth or Find places.',
    shown: 'Pictures on both (Earth with a sun, a target). Turn Earth has the stronger outline; Find places is the same yellow as the old gold card.',
    verdict: 'unclear', why: 'Two equal invitations; which first is only in the heading text and the voice.' },
  { n: 7, title: 'Earth bedtime spin', ids: ['b03-bedtime-open', 'b04-bedtime-night', 'b05-bedtime-morning'],
    changed: 'Full-screen toy: Earth from above, house, clock, Turn Earth. Night: windows light, “Night-time. Bedtime!”. Morning: “Daytime at your house”, “1 turn = 1 day”.',
    tell: 'The house going dark and light again; the clock.',
    next: 'Keep turning, or the blue back arrow.',
    shown: 'The round trip ends looking like the start. Only the voice says “Morning again! You can fly to the Moon next.”',
    verdict: 'unclear', why: 'The toy reads well; finishing it has no visible “you did it”.' },
  { n: 8, title: 'Back on Earth after the spin (first visit)', ids: ['b06-earth-after-bedtime'],
    changed: 'Gold places appear, a three-dot counter top right, and Space map gains the paper “next step” ring (<code>is-map-next</code>).',
    tell: 'Gold rings on Earth; the ringed Space map button.',
    next: 'Find the gold places, says the hunt. Leave, says the ring.',
    shown: 'Both at once.',
    verdict: 'confusing', why: 'The next-step ring points at the exit while the task is unfinished.' },
  { n: 9, title: 'A find and its postcard', ids: ['b08-postcard1', 'b09-after-postcard1', 'b10-after-find2'],
    changed: 'Big tilted postcard: name, photo, one line, “1 / 3”, “Saved to your journal”, Keep exploring. After closing, one counter dot fills.',
    tell: 'The photo of the place, the count.',
    next: 'Keep exploring (picture of the world) or X.',
    shown: 'Picture and colour; the counter at the top fills.',
    verdict: 'clear', why: 'The strongest moment in the game. The find label at the finger is hidden by the postcard straight away.' },
  { n: 10, title: 'Third find on a world without a toy (Earth)', ids: ['b11-postcard3', 'b12-after-find3', 'b13-after-find3-later'],
    changed: 'Postcard “3 / 3”. On close: counter disappears, Day & night and Journal pop in, Journal ringed, heading “Three found this trip! See your journal.”',
    tell: 'Two new buttons; the ring on Journal.',
    next: 'Journal, says the ring. “Fly home and pick another world”, says the voice.',
    shown: 'Ring on Journal only. No sticker, nothing points at Space map.',
    verdict: 'unclear', why: 'Ring and voice disagree; two buttons arrive at once.' },
  { n: 11, title: 'Journal open and close', ids: ['b14-journal', 'b15-after-journal'],
    changed: 'Paper book: Earth 3/6, three photos and three dashed “Still to find” tiles. On close the ring moves to Space map, heading “Choose your next trip on the Space map.”',
    tell: 'Photos of the places found; empty tiles.',
    next: 'Keep exploring, then Space map.',
    shown: 'The ring moves to Space map, but only after the journal.',
    verdict: 'unclear', why: 'A finished visit looks half empty; the way on appears only after a detour.' },
  { n: 12, title: 'Third find on a world with a toy: the toy pops in', ids: ['d03-toy-popping', 'd04-toy-next', 'f02-mars-toy-next', 'g04-saturn-toy-next'],
    changed: 'After the third postcard closes, the toy button pops into the fourth cell with a paper ring; heading “Three found! Now try Jump.”; voice “Now you can jump on the Moon!”',
    tell: 'A new coloured button pops in with a ring.',
    next: 'Press the toy.',
    shown: 'Pop, colour, ring, picture, voice all agree.',
    verdict: 'clear', why: 'The best state change in the game: one new thing, shown and said. Reduced motion drops the pop.' },
  { n: 13, title: 'Moon jump', ids: ['d05-jump-open', 'd06-jump-mid', 'd07-jump-after'],
    changed: 'Split screen, Earth and Moon astronauts, Jump!; after a jump, a height marker and “Same jump! On the Moon you fly over your own head.”',
    tell: 'The Moon astronaut goes much higher.',
    next: 'Jump again, or back arrow.',
    shown: 'Side-by-side picture.',
    verdict: 'clear', why: 'One verb, the answer is visible.' },
  { n: 14, title: 'After the toy', ids: ['d08-after-jump', 'd09-after-jump-later', 'f10-after-rover', 'g07-after-bath'],
    changed: 'Day & night and Journal pop in together; Journal ringed; heading “Three found this trip! See your journal.”',
    tell: 'Two new buttons; ring on Journal.',
    next: 'Journal, then Space map.',
    shown: 'Ring on Journal. Space map unringed until the journal has been opened.',
    verdict: 'unclear', why: 'A detour before the way on is shown; five buttons now.' },
  { n: 15, title: 'Back on the Space map after Earth', ids: ['c01-returning', 'c02-map-after-earth', 'c03-map-after-earth-later'],
    changed: 'Pull-back to the map. Gold moves from Earth’s card to the Moon’s. Pill “Tap Moon”. Voice “Back home. You can pick another world.”, then “Tap the Moon.” after 8 s idle.',
    tell: 'Compare with state 2: same screen, the gold has moved one card.',
    next: 'Tap the Moon.',
    shown: 'Gold card only. Earth’s card shows nothing for the visit just done; no ring in the scene; the voice line does not name the Moon.',
    verdict: 'confusing', why: 'The playtest moment: nothing on screen marks what just happened.' },
  { n: 16, title: 'Back on the Space map, a world newly unlocked (Mars)', ids: ['e01-map-after-moon', 'e02-map-after-moon-2s', 'e03-map-after-moon-6s', 'e04-map-after-moon-18s'],
    changed: 'Mars fades in wherever its orbit has it: in these runs at the far right edge on the phone, and half behind Earth on the tablet. Its card changes from dashed + padlock to gold + ring. Pill “Mars is ready”, then “Tap Mars” after 3.6 s. Voice “Mars is ready. You can fly there.”',
    tell: 'The padlock has gone and the card is gold, if the child remembers it was locked.',
    next: 'Tap Mars.',
    shown: 'The same gold as every suggestion before. <code>is-new</code> is set but has no style. After the fade nothing moves, glows or points; the Moon card shows nothing for the visit just done. On the phone Mars sits on the second row of cards.',
    verdict: 'confusing', why: 'Unlocking looks like any other turn of the map.' },
  { n: 17, title: 'A newly unlocked world, first arrival (Mars)', ids: ['e05-mars-first-arrival', 'e06-mars-first-arrival-later', 'f01-map-mars-offered'],
    changed: 'Quiet arrival: name, Space map, Listen, gold rings.',
    tell: 'Gold rings on a new planet.',
    next: 'Tap a gold place.',
    shown: 'The gold rings, the same as on the Moon.',
    verdict: 'clear', why: 'The hunt pattern carries over.' },
  { n: 18, title: 'Mars rover', ids: ['f03-rover-open', 'f04-rover-first-press', 'f05-rover-waiting', 'f06-rover-moved', 'f07-rover-mashed', 'f08-rover-mashed-later', 'f09-rover-settled'],
    changed: 'Earth, a clock, “really: 12 minutes”, Jezero crater grid, rover, three rocks, four lime arrows and Drill. Each press sends a glowing dot down from Earth; the rover moves when it lands, about 3 s later.',
    tell: 'Dots leave Earth and the rover moves late.',
    next: 'Steer to a rock, then Drill.',
    shown: 'Dots carry an arrow. Drilling plain ground shows nothing; a full queue shakes the key; the caption stays on “Wait… Mars is far away!” after everything has landed. On the tablet the rover starts on the bottom row, right above Drill, and the crater’s lower edge runs behind the buttons.',
    verdict: 'confusing', why: 'Grid steering, a delayed queue and exact parking at once; the boy was confused.' },
  { n: 19, title: 'Back on the Space map, Saturn unlocked', ids: ['g01-map-after-mars', 'g02-map-after-mars-later'],
    changed: 'Saturn fades in big and ringed; its card turns gold. “Saturn is ready”, then “Tap Saturn”.',
    tell: 'A large new planet appears in the middle of the scene.',
    next: 'Tap Saturn.',
    shown: 'Saturn’s size helps; the card treatment is the same gold.',
    verdict: 'unclear', why: 'Clearer than Mars because Saturn is big, but nothing says “new”.' },
  { n: 20, title: 'Saturn arrival', ids: ['g03-saturn-arrival'],
    changed: 'Quiet arrival over Saturn and its rings.',
    tell: 'Gold places, small on the planet and rings.',
    next: 'Tap a gold place.',
    shown: 'Gold rings, smaller than on other worlds.',
    verdict: 'clear', why: 'Same pattern; the targets are small on the phone.' },
  { n: 21, title: 'Saturn bath', ids: ['g05-bath-open', 'g06-bath-floating'],
    changed: 'A bath, a shelf of worlds, Plop!. Earth, Mars and the Moon sink; Saturn floats; “Only Saturn floats!”; Plop! becomes Again.',
    tell: 'Saturn bobbing on top.',
    next: 'Again, or back arrow.',
    shown: 'Picture.',
    verdict: 'clear', why: 'One verb, a visible answer.' },
  { n: 22, title: 'Space map with everything visited', ids: ['g08-map-after-saturn', 'g09-map-after-saturn-later', 'i01-map-before-finale'],
    changed: 'Gold returns to Mars. Pill with a journal icon “More to find · Tap Mars”.',
    tell: 'A gold card, as before.',
    next: 'Go back to Mars for its other three places.',
    shown: 'Identical gold to a new world; only the pill’s small icon and words differ.',
    verdict: 'confusing', why: 'Sends the child back to a world they just finished, with no picture of why.' },
  { n: 23, title: 'A revisited place, and the hunt arrow', ids: ['i02-hunt-arrow', 'i03-revisited-find'],
    changed: 'A place found on an earlier visit only counts: no postcard. The last place round the back gets a pulsing arrow at the edge.',
    tell: 'The counter fills; the arrow pulses.',
    next: 'Tap the arrow to turn the world.',
    shown: 'Arrow and motion.',
    verdict: 'clear', why: 'The arrow is pictured and does the turning.' },
  { n: 24, title: 'Finale', ids: ['i04-finale', 'i05-after-finale', 'i06-map-after-finale', 'i07-map-after-finale-later'],
    changed: "3.2 s after the last find a paper panel fills the screen: every place’s badge pops in, “You found every place!”, “New sticker: Space Ninja”, a yellow Hooray!. Fanfare and voice “You found every place. You are a Space Ninja!” It closes on any tap or after 14 s.",
    tell: "The badges and the big celebration panel.",
    next: "Hooray!, then back to the visit. The Moon visit underneath still rings Jump with “Three found! Now try Jump.”",
    shown: "Afterwards nothing marks the end: the map has no gold card, all cards plain, pill “Tap a world to fly there”, no Space Ninja sticker or badge on the map itself (the ship livery is the only trace).",
    verdict: "unclear", why: "The party is clear; what comes after it (play on? all done?) is not shown." },
  { n: 25, title: 'Other changes: sound off, reload mid-visit, grown-ups', ids: ['j01-sound-off-arrival', 'j02-reload-mid-visit', 'j03-reload-after-start', 'j04-grownups'],
    changed: "Sound off: Listen becomes a purple Words button and every spoken next step (\"X is ready\", \"Now you can jump\") is gone. Reload mid-visit: back on the Space map with no splash; the visit is dropped, found places stay in the journal. Grown-ups panel: the same adult page as the splash, reached by holding Journal for 2 s or ?grownups.",
    tell: "Sound off looks almost identical. A reload simply shows the map again.",
    next: "Carry on from the map.",
    shown: "With sound off the screen has to carry everything, which makes states 8, 10, 14, 15, 16 and 22 worse. In code, a world unlocked by an arrival (markVisited runs on arrival) and then interrupted by a reload or crash is revealed silently on the next load: boot calls applyReveal() without newlyRevealed, so no “X is ready” at all. (The reload shot here re-seeds progress from the capture script, so it does not show that.)",
    verdict: "unclear", why: "Nothing breaks, but sound off and a reload both remove the only cues the map has." },
];

import { readFileSync } from 'node:fs';
const extra = existsSync(join(dir, 'extra.json')) ? JSON.parse(readFileSync(join(dir, 'extra.json'), 'utf8')) : {};
for (const s of states) for (const k of ['changed', 'tell', 'next', 'shown', 'verdict', 'why']) if (extra[s[k]]) s[k] = extra[s[k]];

const label = id => id.replace(/^[a-z]\d+-/, '').replace(/-/g, ' ');
function figure(v, id) {
  if (!has(v, id)) return `<figure class="shot shot--${v} is-missing"><div class="missing">${v}: not captured</div><figcaption>${label(id)}</figcaption></figure>`;
  const src = `shots/${v}-${id}.png`;
  return `<figure class="shot shot--${v}"><a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${v}: ${label(id)}" loading="lazy"></a><figcaption>${v} · ${label(id)}</figcaption></figure>`;
}
const missingTablet = states.flatMap(s => s.ids).filter(id => has('phone', id) && !has('tablet', id));
const missingAll = states.flatMap(s => s.ids).filter(id => !has('phone', id) && !has('tablet', id));

const rows = states.map(s => `<tr><td class="num">${s.n}</td><td><a href="#s${s.n}">${s.title}</a></td><td><span class="chip chip--${s.verdict}">${s.verdict}</span></td><td>${s.why}</td></tr>`).join('');
const sections = states.map(s => `
<section class="state" id="s${s.n}">
  <header class="state__head"><span class="state__n">${s.n}</span><h3>${s.title}</h3><span class="chip chip--${s.verdict}">${s.verdict}</span></header>
  <p class="state__why">${s.why}</p>
  <dl class="facts">
    <div><dt>What changed</dt><dd>${s.changed}</dd></div>
    <div><dt>How a child can tell</dt><dd>${s.tell}</dd></div>
    <div><dt>What they can do next</dt><dd>${s.next}</dd></div>
    <div><dt>How the next step is shown without reading</dt><dd>${s.shown}</dd></div>
  </dl>
  <div class="strip">${s.ids.map(id => `<div class="pair">${figure('phone', id)}${figure('tablet', id)}</div>`).join('')}</div>
</section>`).join('');

const counts = ['clear', 'unclear', 'confusing'].map(v => [v, states.filter(s => s.verdict === v).length]);

const html = `<title>Space Ninja State Audit</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Andika:wght@400;700&display=swap">
<style>
/* Layout: one reading column of states in the order a child meets them; shots scroll sideways inside each state. */
:root {
  --paper:#f7efdf; --paper-deep:#efe3cc; --ink:#2b2118; --muted:#6b5d4f; --line:#2b2118;
  --sky:#5bb4e5; --sun:#f3b73a; --grass:#7cc576; --tomato:#ef7a62;
  --clear:#4f9d4a; --unclear:#c98a14; --confusing:#c8452f; --chipink:#fffaf0;
  --hand:"Patrick Hand","Comic Sans MS",cursive; --read:"Andika","Trebuchet MS",system-ui,sans-serif;
  --shadow:4px 4px 0 var(--line);
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper:#141a2b; --paper-deep:#1d2539; --ink:#efe6d4; --muted:#b2a993; --line:#d9cdb5;
  --clear:#79c873; --unclear:#f0b542; --confusing:#f07a63; --chipink:#141a2b; --shadow:4px 4px 0 #000; color-scheme:dark } }
:root[data-theme="dark"] { --paper:#141a2b; --paper-deep:#1d2539; --ink:#efe6d4; --muted:#b2a993; --line:#d9cdb5;
  --clear:#79c873; --unclear:#f0b542; --confusing:#f07a63; --chipink:#141a2b; --shadow:4px 4px 0 #000; color-scheme:dark }
body { background:var(--paper); color:var(--ink); font:400 16px/1.55 var(--read); padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:24px 64px; }
main { max-width:1080px; margin:0 auto; display:grid; gap:40px; }
h1,h2,h3 { font-family:var(--hand); font-weight:400; text-wrap:balance; margin:0; line-height:1.1; }
h1 { font-size:clamp(2.2rem,6vw,3.4rem); }
h2 { font-size:2rem; }
h3 { font-size:1.6rem; }
p { margin:0; max-width:68ch; }
code { font-size:.9em; background:var(--paper-deep); padding:0 .3em; border-radius:4px; }
a { color:inherit; }
.intro { display:grid; gap:10px; }
.eyebrow { font:700 .78rem var(--read); letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
.meta { color:var(--muted); font-size:.92rem; }
.top5 { display:grid; gap:14px; counter-reset:t; padding:0; margin:0; list-style:none; }
.top5 li { counter-increment:t; display:grid; grid-template-columns:2.4rem 1fr; gap:4px 12px; padding:16px 18px; background:var(--paper-deep); border:2px solid var(--line); border-radius:14px; box-shadow:var(--shadow); }
.top5 li::before { content:counter(t); grid-row:span 2; font:400 2.2rem/1 var(--hand); color:var(--confusing); }
.top5 strong { font:400 1.35rem/1.2 var(--hand); }
.top5 span { min-width:0; }
.tally { display:flex; flex-wrap:wrap; gap:8px; }
.chip { display:inline-block; padding:1px 10px; border-radius:999px; font:700 .78rem/1.6 var(--read); letter-spacing:.06em; text-transform:uppercase; color:var(--chipink); white-space:nowrap; }
.chip--clear { background:var(--clear); } .chip--unclear { background:var(--unclear); } .chip--confusing { background:var(--confusing); }
.tablewrap { overflow-x:auto; border:2px solid var(--line); border-radius:14px; }
table { border-collapse:collapse; width:100%; min-width:560px; }
th,td { text-align:left; vertical-align:top; padding:8px 12px; border-bottom:1px solid color-mix(in srgb, var(--line) 25%, transparent); }
th { font:700 .78rem var(--read); letter-spacing:.1em; text-transform:uppercase; color:var(--muted); background:var(--paper-deep); }
td.num { font-variant-numeric:tabular-nums; color:var(--muted); width:2.5rem; }
.states { display:grid; gap:44px; }
.state { display:grid; gap:12px; scroll-margin-top:16px; }
.state__head { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
.state__n { font:400 1.4rem var(--hand); width:2.2rem; height:2.2rem; display:grid; place-items:center; border:2px solid var(--line); border-radius:50%; }
.state__why { font-weight:700; }
.facts { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:10px 22px; margin:0; }
.facts div { min-width:0; }
.facts dt { font:700 .74rem var(--read); letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
.facts dd { margin:2px 0 0; }
.strip { display:flex; gap:22px; overflow-x:auto; padding:6px 2px 12px; }
.pair { display:flex; gap:8px; flex:none; align-items:flex-start; }
.shot { margin:0; display:grid; gap:4px; flex:none; }
.shot img, .missing { display:block; height:340px; width:auto; max-width:none; border:2px solid var(--line); border-radius:8px; }
.shot--phone .missing { width:157px; } .shot--tablet .missing { width:255px; }
.missing { display:grid; place-items:center; background:var(--paper-deep); color:var(--muted); font-size:.85rem; border-style:dashed; }
figcaption { font-size:.78rem; color:var(--muted); max-width:255px; }
.shot a:focus-visible { outline:3px solid var(--sky); outline-offset:2px; }
@media (max-width:520px) { .shot img, .missing { height:260px; } .shot--phone .missing { width:120px; } .shot--tablet .missing { width:195px; } }
</style>
<main>
  <header class="intro">
    <span class="eyebrow">Space Ninja · state-change audit · after playtest 2</span>
    <h1>What just happened, and what now?</h1>
    <p>Every state change a child meets, in order, checked against the owner’s rule: a child must be able to tell what just happened and what they can do next, from the screen rather than the voice. Shots are full-resolution captures of the playtest build (<code>e2e/state-audit.pw.ts</code>), phone 390×844 and tablet 768×1024, motion on. Each state was checked against the code (<code>src/main.ts</code>, <code>src/ui/ui.ts</code>, <code>src/toys/</code>, the CSS). Observations only; the coordinator ranks fixes.</p>
    <p class="meta">Branch <code>claude/state-audit-115112</code> · ${new Date().toISOString().slice(0, 10)}${missingTablet.length ? ` · tablet shots missing for: ${missingTablet.length} of ${states.flatMap(s => s.ids).length}` : ''}${missingAll.length ? ` · not captured at all: ${missingAll.join(', ')}` : ''}</p>
  </header>

  <section class="intro">
    <h2>The five biggest confusions</h2>
    <ol class="top5">${top5.map(([a, b]) => `<li><strong>${a}</strong><span>${b}</span></li>`).join('')}</ol>
  </section>

  <section class="intro">
    <h2>Findings</h2>
    <div class="tally">${counts.map(([v, c]) => `<span class="chip chip--${v}">${c} ${v}</span>`).join('')}</div>
    <div class="tablewrap"><table><thead><tr><th>#</th><th>State</th><th>Verdict</th><th>Why</th></tr></thead><tbody>${rows}</tbody></table></div>
  </section>

  <section class="states">
    <h2>Each state, phone and tablet</h2>
    ${sections}
  </section>
</main>
`;
writeFileSync(join(dir, 'index.html'), html);
console.log('written; tablet missing', missingTablet.length, 'none', missingAll.join(','));
