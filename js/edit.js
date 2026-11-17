// Edit drill: fix one planted mistake in a line of real Python, with the cursor
// starting at the end of the line, as when you spot a typo after typing. Trains
// moving the cursor with word jumps, Home/End, word deletes and selection instead
// of many single arrow presses. Like Adaptive, it unlocks one skill at a time
// (LEVELS). Results live in the main save under `edit`.
(function () {
  const CTT = (window.CTT = window.CTT || {});

  const KINDS = ['swap', 'missing', 'extra', 'typo', 'name'];
  const CHAR_KINDS = ['swap', 'missing', 'extra', 'typo'];
  const KIND_NAMES = { swap: 'wrong symbol', missing: 'missing symbol', extra: 'extra character', typo: 'misspelled name', name: 'wrong name' };
  const ROUNDS_KEPT = 300;
  const MAX_LEN = 64; // longer lines do not fit the box at a readable size
  // Common mix-ups, both ways; the player's own top mix-ups are added in front.
  const PAIRS = [['_', '-'], ['[', ']'], ['(', ')'], [':', ';'], ["'", '"'], [',', '.'], ['=', '-'],
    ['+', '='], ['{', '['], ['}', ']'], ['<', '>'], ['0', '-'], ['(', '*'], [')', '_'], ['p', '[']];
  const MISSABLE = new Set([')', ']', '}', ':', ',', '(', '[', '_', '.', '"', "'", '=']);
  // Wrong names for the "wrong name" rounds (levels 4 and 5).
  const NAMES = ['nums', 'left', 'right', 'mid', 'count', 'total', 'result', 'target', 'node', 'root', 'curr',
    'prev', 'seen', 'stack', 'queue', 'index', 'value', 'key', 'val', 'res', 'ans', 'grid', 'row', 'col',
    'start', 'end', 'low', 'high', 'size', 'dist', 'path', 'memo', 'graph', 'heap', 'window', 'freq', 'best', 'temp'];
  const KEYWORDS = new Set(['for', 'in', 'def', 'return', 'if', 'else', 'elif', 'while', 'not', 'and', 'or', 'is',
    'None', 'True', 'False', 'class', 'import', 'from', 'with', 'as', 'lambda', 'yield', 'pass', 'break',
    'continue', 'try', 'except', 'raise', 'global', 'nonlocal', 'self', 'del', 'assert', 'finally']);

  // The skill ladder. Each level adds keys and plants mistakes where those keys
  // are the fastest fix. `moves`: what the par may use. `used`: did the round use
  // the level's skill. `ms`: median fix time needed to pass. Caps names are for the
  // Caps Lock layer (extras/caps-arrows.ahk); `alt` is the same key without it.
  const LEVELS = [
    { name: 'Characters', keys: 'Caps+J / L move · Caps+H / ; delete', alt: '←/→ · Backspace/Delete',
      moves: { word: false, home: false }, ms: 4000, used: (r) => !r.mouse,
      where: (i, n) => n - i >= 2 && n - i <= 6 },
    { name: 'Line start', keys: 'Caps+U Home · Caps+O End', alt: 'Home/End',
      moves: { word: false, home: true }, ms: 5000, used: (r) => r.homeEnd > 0,
      where: (i, n) => n >= 30 && i >= 1 && i <= 5 },
    { name: 'Word jumps', keys: 'Caps+Y / P jump a word', alt: 'Ctrl+←/→',
      moves: { word: true, home: true }, ms: 5000, used: (r) => r.word > 0,
      where: (i, n) => i >= 10 && n - i >= 12 },
    { name: 'Delete a word', keys: 'Caps+N deletes the word before the cursor', alt: 'Ctrl+Backspace',
      moves: { word: true, home: true }, ms: 7000, used: (r) => r.wordDel > 0, kind: 'name' },
    { name: 'Select a word', keys: 'Shift+Caps+Y / P select, then type over it', alt: 'Ctrl+Shift+←/→',
      moves: { word: true, home: true }, ms: 7000, used: (r) => r.sel > 0, kind: 'name' },
  ];
  const PASS = { rounds: 10, ratio: 1.3, used: 7 }; // over a level's last 10 rounds

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Where Ctrl+Left / Ctrl+Right stop in a browser text box (start of each run of
  // word characters or of punctuation), as positions 0..len.
  function wordStops(s) {
    const stops = new Set([0, s.length]);
    const re = /\w+|[^\w\s]+/g;
    let m;
    while ((m = re.exec(s))) stops.add(m.index);
    return [...stops].sort((a, b) => a - b);
  }

  // Fewest keys to move from the end of the line to position p: word jumps from the
  // end, or Home then word jumps right, plus single arrows for the rest.
  // moves: { word, home } limits the keys used (default: all).
  function navPar(s, p, moves) {
    const mv = moves || { word: true, home: true };
    let best = s.length - p; // single arrows only
    if (mv.home) best = Math.min(best, 1 + p); // Home, then arrows right
    if (!mv.word) return best;
    const st = wordStops(s);
    const last = st.length - 1; // st[last] === s.length, where the cursor starts
    for (let i = 0; i <= last; i++) {
      const fine = Math.abs(st[i] - p); // single arrows from that stop
      best = Math.min(best, last - i + fine); // Ctrl+Left from the end
      if (mv.home) best = Math.min(best, 1 + i + fine); // Home, then Ctrl+Right
    }
    return best;
  }

  // Fewest keys: reach any of the positions, then `fix` keys.
  function best(s, positions, fix, moves) {
    return Math.min(...positions.filter((p) => p >= 0 && p <= s.length).map((p) => navPar(s, p, moves))) + fix;
  }

  // Make one round from a correct line. confusions: [{expected, typed}] (player's).
  // where(i, n): which positions of the line may hold the mistake (default: not in
  // the last 15%). Returns { target, shown, kind, pos, len, par } or null.
  function plant(line, kind, confusions, where, moves) {
    const n = line.length;
    const limit = Math.max(1, Math.floor(n * 0.85)); // keep the mistake away from the end
    const ok = where || ((i) => i < limit);
    const idx = (test) => {
      const c = [];
      for (let i = 0; i < n; i++) if (ok(i, n) && test(line[i], i)) c.push(i);
      return c;
    };
    if (kind === 'swap') {
      const table = (pairs) => {
        const byChar = {};
        for (const [a, b] of pairs) {
          if (typeof a !== 'string' || typeof b !== 'string' || a.length !== 1 || b.length !== 1) continue;
          if (a === b || /\s/.test(a) || /\s/.test(b)) continue;
          (byChar[a] = byChar[a] || []).push(b);
        }
        return byChar;
      };
      const own = table((confusions || []).map((c) => [c.expected, c.typed]));
      const all = table((confusions || []).map((c) => [c.expected, c.typed]).concat(PAIRS));
      // The player's own mix-ups first, when this line has one.
      const ownC = idx((ch) => own[ch]);
      const useOwn = ownC.length && Math.random() < 0.6;
      const byChar = useOwn ? own : all;
      const c = useOwn ? ownC : idx((ch) => all[ch]);
      if (!c.length) return null;
      const i = pick(c);
      const wrong = pick(byChar[line[i]]);
      const shown = line.slice(0, i) + wrong + line.slice(i + 1);
      // Delete before or Backspace after the wrong character, then type the right one.
      return { target: line, shown, kind, pos: i, len: 1, par: best(shown, [i, i + 1], 2, moves) };
    }
    if (kind === 'missing') {
      const c = idx((ch) => MISSABLE.has(ch));
      if (!c.length) return null;
      const i = pick(c);
      const shown = line.slice(0, i) + line.slice(i + 1);
      return { target: line, shown, kind, pos: i, len: 1, par: best(shown, [i], 1, moves) };
    }
    if (kind === 'extra') {
      const c = idx((ch) => ch !== ' ');
      if (!c.length) return null;
      const i = pick(c);
      const shown = line.slice(0, i + 1) + line[i] + line.slice(i + 1);
      // Delete at i or i+1, or Backspace at i+1 or i+2 (either copy goes).
      return { target: line, shown, kind, pos: i, len: 1, par: best(shown, [i, i + 1, i + 2], 1, moves) };
    }
    if (kind === 'name') {
      // A whole name is wrong: delete it (or select it) and type the right one.
      const c = [];
      // Whole names that start with a letter (no dunders like __init__).
      const re = /\w+/g;
      let m;
      while ((m = re.exec(line))) {
        const w = m[0];
        if (!/^[A-Za-z]/.test(w) || w.length < 3 || w.length > 10 || KEYWORDS.has(w) || !ok(m.index, n)) continue;
        const wrong = NAMES.filter((x) => x !== w && Math.abs(x.length - w.length) <= 2 && !line.includes(x));
        if (wrong.length) c.push({ i: m.index, w, wrong });
      }
      if (!c.length) return null;
      const { i, w, wrong } = pick(c);
      const bad = pick(wrong);
      const shown = line.slice(0, i) + bad + line.slice(i + w.length);
      // Reach the end of the wrong name, one word delete, type the name.
      return { target: line, shown, kind, pos: i, len: w.length, par: best(shown, [i + bad.length], 1 + w.length, moves) };
    }
    // typo: swap two neighbouring letters inside a name of 4+ letters
    const words = [];
    const re = /[A-Za-z_]{4,}/g;
    let m;
    while ((m = re.exec(line))) {
      for (let i = m.index; i < m.index + m[0].length - 1; i++) {
        if (!ok(i, n) || !ok(i + 1, n)) continue;
        if (/[a-z]/i.test(line[i]) && /[a-z]/i.test(line[i + 1]) && line[i] !== line[i + 1]) words.push(i);
      }
    }
    if (!words.length) return null;
    const i = pick(words);
    const shown = line.slice(0, i) + line[i + 1] + line[i] + line.slice(i + 2);
    // Between the two letters: Backspace, Right, type (3); at either side: 2 deletes + 2 letters.
    return { target: line, shown, kind: 'typo', pos: i, len: 2, par: Math.min(best(shown, [i + 1], 3, moves), best(shown, [i, i + 2], 4, moves)) };
  }

  // A new round from the Lines pool, preferring lines with trouble words.
  // opts.lv (1..LEVELS.length) places the mistake for that level.
  function round(lines, opts) {
    opts = opts || {};
    const L = opts.lv ? LEVELS[opts.lv - 1] : null;
    const pool = lines.filter((l) => !l.includes('\n') && l.length >= 18 && l.length <= MAX_LEN);
    // Trouble words are identifiers ([A-Za-z0-9_]), so a token set is enough.
    const tw = new Set(opts.words || []);
    const withWord = tw.size ? pool.filter((l) => (l.match(/\w+/g) || []).some((w) => tw.has(w))) : [];
    const kindFor = () => opts.kind || (L && L.kind) || pick(CHAR_KINDS);
    const where = L && L.where;
    const moves = L && L.moves;
    for (let k = 0; k < 60; k++) {
      const line = withWord.length && Math.random() < 0.4 ? pick(withWord) : pick(pool);
      const r = plant(line, kindFor(), opts.confusions, where, moves);
      if (r && r.shown !== r.target) return Object.assign(r, { lv: opts.lv || 0 });
    }
    const fb = 'for i, num in enumerate(nums):';
    const r = plant(fb, (L && L.kind) || 'swap', [], where, moves) || plant(fb, 'swap', []);
    return Object.assign(r, { lv: opts.lv || 0 });
  }

  // How a level is going: its last PASS.rounds rounds.
  function levelStatus(rounds, lv) {
    const L = LEVELS[lv - 1];
    const R = (rounds || []).filter((r) => r.lv === lv).slice(-PASS.rounds);
    const med = (xs) => {
      const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
      return s.length ? s[Math.floor(s.length / 2)] : null;
    };
    const medRatio = med(R.map((r) => (r.par > 0 ? r.keys / r.par : null)));
    const medMs = med(R.map((r) => r.ms));
    const used = R.filter((r) => L.used(r)).length;
    const passed = R.length >= PASS.rounds && medRatio != null && medRatio <= PASS.ratio && medMs <= L.ms && used >= PASS.used;
    return { n: R.length, medRatio, medMs, used, passed };
  }

  // Which level the next round practises: the newest level 60% of the time, else a
  // review of an earlier one, the weakest (most keys vs best) more often.
  // level: highest unlocked (LEVELS.length + 1 once all are passed).
  function pickLevel(rounds, level) {
    const top = Math.min(level, LEVELS.length);
    const review = level > LEVELS.length ? top : top - 1;
    if (review < 1 || (level <= LEVELS.length && Math.random() < 0.6)) return top;
    const w = [];
    for (let lv = 1; lv <= review; lv++) {
      const s = levelStatus(rounds, lv);
      w.push(Math.max(0.2, (s.medRatio == null ? 1.5 : s.medRatio) - 0.8));
    }
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return i + 1;
    return review;
  }

  // Feedback tip for a finished round: k = key counts, level = highest unlocked.
  // Only suggests keys that are unlocked.
  function tip(r, k, level) {
    const lv = level || LEVELS.length;
    if (k.mouse) return 'No mouse: Caps+J / L (←/→) move the cursor';
    if (r.lv === 2 && !k.homeEnd) return 'Caps+U (Home) jumps to the start of the line';
    if (r.lv === 3 && !k.word) return 'Caps+Y / P (Ctrl+←/→) jump a word at a time';
    if (r.lv === 4 && !k.wordDel) return 'Caps+N (Ctrl+Backspace) deletes the whole name';
    if (r.lv === 5 && !k.sel) return 'Shift+Caps+Y (Ctrl+Shift+←) selects the name, then type over it';
    if (lv >= 3 && k.arrows >= 6 && !k.word) return k.arrows + ' single moves: Caps+Y / P (Ctrl+←/→) jump a word';
    if (lv >= 2 && r.pos < r.target.length / 3 && !k.homeEnd && k.arrows + k.word > 6) return 'Near the start: Caps+U (Home) first';
    if (lv >= 4 && (r.kind === 'typo' || r.kind === 'name') && k.del >= 4 && !k.wordDel) return 'Caps+N (Ctrl+Backspace) deletes the whole word';
    return '';
  }

  // Summary of recent rounds: { n, medMs, medRatio, wordShare, mouseShare, byKind }.
  function summary(rounds, last) {
    const R = (rounds || []).slice(-(last || 50));
    const med = (xs) => {
      const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
      return s.length ? s[Math.floor(s.length / 2)] : null;
    };
    const byKind = {};
    for (const k of KINDS) {
      const xs = R.filter((r) => r.kind === k);
      if (xs.length) byKind[k] = { n: xs.length, medMs: med(xs.map((r) => r.ms)) };
    }
    return {
      n: R.length,
      medMs: med(R.map((r) => r.ms)),
      medRatio: med(R.map((r) => (r.par > 0 ? r.keys / r.par : null))),
      wordShare: R.length ? R.filter((r) => r.word > 0 || r.homeEnd > 0).length / R.length : null,
      mouseShare: R.length ? R.filter((r) => r.mouse > 0).length / R.length : null,
      byKind,
    };
  }

  // Keep only well-formed rounds and the unlocked level (a bad entry must not stop boot).
  function clean(raw) {
    const out = { rounds: [], level: 1 };
    if (!raw || typeof raw !== 'object') return out;
    if (Number.isInteger(raw.level)) out.level = Math.min(Math.max(raw.level, 1), LEVELS.length + 1);
    if (!Array.isArray(raw.rounds)) return out;
    const num = (x) => (Number.isFinite(x) && x >= 0 ? x : 0);
    const limit = Date.now() + 86400000; // no rounds from the future
    out.rounds = raw.rounds
      .filter((r) => r && typeof r === 'object' && Number.isFinite(r.ts) && r.ts <= limit && Number.isFinite(r.ms) && KINDS.includes(r.kind))
      .map((r) => {
        const o = {
          ts: r.ts, kind: r.kind, ms: Math.max(0, r.ms), keys: num(r.keys), par: num(r.par),
          arrows: num(r.arrows), word: num(r.word), homeEnd: num(r.homeEnd), del: num(r.del), mouse: num(r.mouse),
          wordDel: num(r.wordDel), sel: num(r.sel),
        };
        if (Number.isInteger(r.lv) && r.lv >= 1 && r.lv <= LEVELS.length) o.lv = r.lv;
        return o;
      })
      .sort((a, b) => a.ts - b.ts)
      .slice(-ROUNDS_KEPT);
    return out;
  }

  CTT.EDIT = { KINDS, KIND_NAMES, ROUNDS_KEPT, LEVELS, PASS, round, plant, navPar, wordStops, tip, summary, clean, levelStatus, pickLevel };
})();
