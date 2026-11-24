const $ = (id) => document.getElementById(id);
const KEY = "cricket-scorer-match-v1";

let m = null;      // current match
let history = [];  // snapshots for undo
let signedIn = false; // set by auth.js

// ---------- Supabase (optional) ----------
let db = null;
if (window.supabase && window.SUPABASE_URL && !window.SUPABASE_URL.includes("YOUR-PROJECT")) {
  db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}

// ---------- Match state ----------
const blank = () => ({ runs: 0, wkts: 0, balls: 0, extras: 0, log: [] });

function newMatch(a, b, overs) {
  return { teams: [a, b], overs, inn: 0, innings: [blank(), blank()], waiting: false, done: false, result: "", saved: false };
}

function save() { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} }
function load() {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}

const fmtOvers = (balls) => Math.floor(balls / 6) + "." + (balls % 6);
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

function inningsOver(i) { return i.balls >= m.overs * 6 || i.wkts >= 10; }

// ---------- Scoring ----------
function addBall({ r = 0, x = null, w = false }) {
  if (!m || m.done || m.waiting) return;
  history.push(JSON.stringify(m));
  const i = m.innings[m.inn];

  let runs = r;
  if (x) { runs = r + 1; i.extras += x === "nb" ? 1 : runs; } // wide: all runs are extras; no ball: 1 extra
  const legal = !x;

  i.runs += runs;
  if (legal) i.balls++;
  if (w) i.wkts++;
  i.log.push({ r: runs, x, w, legal });

  checkEnd();
  save();
  render();
}

function checkEnd() {
  const i = m.innings[m.inn];
  if (m.inn === 0) {
    if (inningsOver(i)) m.waiting = true;
    return;
  }
  const first = m.innings[0].runs;
  if (i.runs > first) {
    m.done = true;
    m.result = m.teams[1] + " won by " + plural(10 - i.wkts, "wicket");
  } else if (inningsOver(i)) {
    m.done = true;
    m.result = i.runs === first
      ? "Match tied"
      : m.teams[0] + " won by " + plural(first - i.runs, "run");
  }
}

function undo() {
  if (!history.length) return;
  m = JSON.parse(history.pop());
  save();
  render();
}

// ---------- Rendering ----------
function currentOver(i) {
  let cur = [], legal = 0;
  for (const b of i.log) {
    cur.push(b);
    if (b.legal && ++legal === 6) { cur = []; legal = 0; }
  }
  return cur;
}

function ballLabel(b) {
  if (b.w) return "W";
  if (b.x === "wd") return "Wd" + (b.r > 1 ? "+" + (b.r - 1) : "");
  if (b.x === "nb") return "Nb" + (b.r > 1 ? "+" + (b.r - 1) : "");
  return String(b.r);
}

function render() {
  $("setup").hidden = !!m;
  $("game").hidden = !m;
  if (!m) return;

  const i = m.innings[m.inn];
  const batting = m.teams[m.inn];

  $("innings-label").textContent = (m.inn === 0 ? "1st innings" : "2nd innings") + " · " + batting + " batting";
  $("score").textContent = i.runs + "/" + i.wkts;
  const rr = i.balls ? (i.runs / (i.balls / 6)).toFixed(2) : "0.00";
  $("overs-line").textContent = fmtOvers(i.balls) + " of " + m.overs + " overs · run rate " + rr;

  // Chase info
  const chase = $("chase");
  if (m.inn === 1 && !m.done) {
    const need = m.innings[0].runs + 1 - i.runs;
    const left = m.overs * 6 - i.balls;
    chase.textContent = m.teams[1] + " need " + need + " from " + left + " balls";
  } else if (m.inn === 0) {
    chase.textContent = "";
  } else {
    chase.textContent = m.teams[0] + " scored " + m.innings[0].runs + "/" + m.innings[0].wkts;
  }

  // This over
  const box = $("over-balls");
  box.replaceChildren();
  const cur = currentOver(i);
  if (!cur.length) {
    const s = document.createElement("span");
    s.className = "none";
    s.textContent = "No balls yet in this over.";
    box.append(s);
  }
  cur.forEach((b) => {
    const s = document.createElement("span");
    s.className = "ball" + (b.w ? " w" : "") + (!b.w && !b.x && (b.r === 4 || b.r === 6) ? " b" : "") + (b.x ? " x" : "");
    s.textContent = ballLabel(b);
    box.append(s);
  });

  // Controls visibility
  const active = !m.waiting && !m.done;
  $("controls").hidden = !active;
  $("next").hidden = !m.waiting;
  $("result").hidden = !m.done;
  if (m.waiting) {
    const f = m.innings[0];
    $("next-msg").textContent = "Innings over: " + m.teams[0] + " " + f.runs + "/" + f.wkts + ". " + m.teams[1] + " need " + (f.runs + 1) + " to win.";
  }
  if (m.done) {
    $("result-text").textContent = m.result;
    $("save-btn").hidden = !db || !signedIn || m.saved;
    if (db && !signedIn && !m.saved) {
      $("save-status").textContent = "Sign in at the top of the page to save this match.";
    }
  }

  $("undo").disabled = history.length === 0;

  // Scorecard
  const card = $("card");
  card.replaceChildren();
  m.teams.forEach((t, n) => {
    const inn = m.innings[n];
    const tr = document.createElement("tr");
    [t, inn.runs, inn.wkts, fmtOvers(inn.balls), inn.extras].forEach((v) => {
      const td = document.createElement("td");
      td.textContent = v;
      tr.append(td);
    });
    card.append(tr);
  });
}

// ---------- Events ----------
$("setup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  m = newMatch($("teamA").value.trim() || "Team A", $("teamB").value.trim() || "Team B", Number($("overs").value));
  history = [];
  save();
  render();
});

document.querySelectorAll("[data-run]").forEach((b) =>
  b.addEventListener("click", () => addBall({ r: Number(b.dataset.run) }))
);
document.querySelectorAll("[data-extra]").forEach((b) =>
  b.addEventListener("click", () => {
    addBall({ r: Number($("extra-runs").value), x: b.dataset.extra });
    $("extra-runs").value = "0";
  })
);
$("wicket").addEventListener("click", () => addBall({ w: true }));
$("undo").addEventListener("click", undo);

$("next-btn").addEventListener("click", () => {
  history.push(JSON.stringify(m));
  m.inn = 1;
  m.waiting = false;
  save();
  render();
});

$("reset").addEventListener("click", () => {
  if (!confirm("Start a new match? The current match will be cleared.")) return;
  m = null;
  history = [];
  try { localStorage.removeItem(KEY); } catch (e) {}
  render();
});

$("save-btn").addEventListener("click", async () => {
  const [a, b] = m.innings;
  const { error } = await db.from("matches").insert({
    team_a: m.teams[0], team_b: m.teams[1],
    a_runs: a.runs, a_wkts: a.wkts, b_runs: b.runs, b_wkts: b.wkts,
    overs: m.overs, result: m.result,
  });
  if (error) {
    $("save-status").textContent = "Could not save: " + error.message;
    return;
  }
  m.saved = true;
  save();
  $("save-status").textContent = "Match saved.";
  if (typeof loadHistory === "function") loadHistory();
  $("save-btn").hidden = true;
});

// ---------- Start ----------
m = load();
render();
