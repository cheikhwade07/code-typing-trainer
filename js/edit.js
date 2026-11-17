// Edit drill: fix one planted mistake in a line of real Python with the Caps Lock
// editing commands (extras/caps-arrows.ahk), Adaptive-style: the commands unlock
// one at a time, each has a bar for how often you use it when it is the fastest
// way, and most rounds are built around the weakest one (the focus). The cursor
// starts at the end of the line, or at its start for rounds that need End or a
// right jump. Results live in the main save under `edit`.
(function () {
  const CTT = (window.CTT = window.CTT || {});

  const KINDS = ['swap', 'missing', 'extra', 'typo', 'name'];
  const CHAR_KINDS = ['swap', 'missing', 'extra', 'typo'];
  const KIND_NAMES = { swap: 'wrong symbol', missing: 'missing symbol', extra: 'extra character', typo: 'misspelled name', name: 'wrong name' };
  const ROUNDS_KEPT = 300;
  const MAX_LEN = 64; // longer lines do not fit the box at a readable size
  const MIN_GAIN = 3; // the round's command must save at least this many keys
  const MAX_PAR = 10; // and the round needs at most this many keys (no long jump chains)
  const FOCUS_SHARE = 0.65; // rounds built around the focus command
  const WINDOW = 10; // a command's bar: its last 10 rounds where it was fastest
  const UNLOCK = { rounds: 5, share: 0.8 }; // every unlocked command, to unlock the next
  const START_UNLOCKED = 2;

  // In unlock order. used(r): the round used it. Browsers cannot tell Caps+Y from
  // a real Ctrl+Left (the script sends the same key), so either counts.
  const CMDS = [
    { id: 'Y', caps: 'Caps+Y', key: 'Ctrl ←', code: 'KeyY', what: 'jump a word left', used: (r) => r.wl > 0 },
    { id: 'P', caps: 'Caps+P', key: 'Ctrl →', code: 'KeyP', what: 'jump a word right', used: (r) => r.wr > 0 },
    { id: 'U', caps: 'Caps+U', key: 'Home', code: 'KeyU', what: 'go to the start of the line', used: (r) => r.hm > 0 },
    { id: 'O', caps: 'Caps+O', key: 'End', code: 'KeyO', what: 'go to the end of the line', used: (r) => r.en > 0 },
    { id: 'N', caps: 'Caps+N', key: 'Ctrl+Backspace', code: 'KeyN', what: 'delete the word before the cursor', used: (r) => r.wordDel > 0 },
  ];
  const BY_ID = Object.fromEntries(CMDS.map((c) => [c.id, c]));
  // Where the round's cursor starts for each command it is built around.
  const CARET_START = { Y: 'end', P: 'start', U: 'end', O: 'start', N: 'end' };

  // Common mix-ups, both ways; the player's own top mix-ups are added in front.
  const PAIRS = [['_', '-'], ['[', ']'], ['(', ')'], [':', ';'], ["'", '"'], [',', '.'], ['=', '-'],
    ['+', '='], ['{', '['], ['}', ']'], ['<', '>'], ['0', '-'], ['(', '*'], [')', '_'], ['p', '[']];
  const MISSABLE = new Set([')', ']', '}', ':', ',', '(', '[', '_', '.', '"', "'", '=']);
  // Wrong names for the delete-word rounds.
  const NAMES = ['nums', 'left', 'right', 'mid', 'count', 'total', 'result', 'target', 'node', 'root', 'curr',
    'prev', 'seen', 'stack', 'queue', 'index', 'value', 'key', 'val', 'res', 'ans', 'grid', 'row', 'col',
    'start', 'end', 'low', 'high', 'size', 'dist', 'path', 'memo', 'graph', 'heap', 'window', 'freq', 'best', 'temp'];
  const KEYWORDS = new Set(['for', 'in', 'def', 'return', 'if', 'else', 'elif', 'while', 'not', 'and', 'or', 'is',
    'None', 'True', 'False', 'class', 'import', 'from', 'with', 'as', 'lambda', 'yield', 'pass', 'break',
    'continue', 'try', 'except', 'raise', 'global', 'nonlocal', 'self', 'del', 'assert', 'finally']);

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

  // Ways to move the cursor from c (0 or s.length) to p: { cost, cmds }.
  function moves(s, c, p) {
    const st = wordStops(s);
    const last = st.length - 1;
    const ic = st.indexOf(c);
    const out = [{ cost: Math.abs(c - p), cmds: [] }]; // single arrows (Caps+J / L)
    for (let i = 0; i <= last; i++) {
      const fine = Math.abs(st[i] - p);
      const j = Math.abs(ic - i);
      out.push({ cost: j + fine, cmds: j ? [i < ic ? 'Y' : 'P'] : [] });
      if (c !== 0) out.push({ cost: 1 + i + fine, cmds: i ? ['U', 'P'] : ['U'] }); // Home, then right
      if (c !== s.length) out.push({ cost: 1 + last - i + fine, cmds: i < last ? ['O', 'Y'] : ['O'] }); // End, then left
    }
    return out;
  }

  // Fewest keys with the allowed commands, and the commands that best way uses.
  // ways: [{ at: [positions], fix: keys, cmds: [...] }].
  function bestWay(s, c, ways, allowed) {
    let best = { cost: Infinity, cmds: [] };
    for (const w of ways) {
      if (!w.cmds.every((x) => allowed.has(x))) continue;
      for (const p of w.at) {
        if (p < 0 || p > s.length) continue;
        for (const m of moves(s, c, p)) {
          if (!m.cmds.every((x) => allowed.has(x))) continue;
          const cost = m.cost + w.fix;
          if (cost < best.cost) best = { cost, cmds: [...new Set(m.cmds.concat(w.cmds))] };
        }
      }
    }
    return best;
  }

  // Plant one mistake in a correct line: { target, shown, kind, pos, len, ways } or null.
  function plant(line, kind, confusions) {
    const n = line.length;
    const idx = (test) => {
      const c = [];
      for (let i = 0; i < n; i++) if (test(line[i], i)) c.push(i);
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
      // Delete before or Backspace after the wrong character, then type the right one.
      return { target: line, shown: line.slice(0, i) + pick(byChar[line[i]]) + line.slice(i + 1), kind, pos: i, len: 1, ways: [{ at: [i, i + 1], fix: 2, cmds: [] }] };
    }
    if (kind === 'missing') {
      const c = idx((ch) => MISSABLE.has(ch));
      if (!c.length) return null;
      const i = pick(c);
      return { target: line, shown: line.slice(0, i) + line.slice(i + 1), kind, pos: i, len: 1, ways: [{ at: [i], fix: 1, cmds: [] }] };
    }
    if (kind === 'extra') {
      const c = idx((ch) => ch !== ' ');
      if (!c.length) return null;
      const i = pick(c);
      // Delete at i or i+1, or Backspace at i+1 or i+2 (either copy goes).
      return { target: line, shown: line.slice(0, i + 1) + line[i] + line.slice(i + 1), kind, pos: i, len: 1, ways: [{ at: [i, i + 1, i + 2], fix: 1, cmds: [] }] };
    }
    if (kind === 'name') {
      // A whole name is wrong: delete it and type the right one.
      const c = [];
      const re = /\w+/g;
      let m;
      while ((m = re.exec(line))) {
        const w = m[0];
        if (!/^[A-Za-z]/.test(w) || w.length < 3 || w.length > 10 || KEYWORDS.has(w)) continue;
        const wrong = NAMES.filter((x) => x !== w && x.length >= 4 && Math.abs(x.length - w.length) <= 2 && !line.includes(x));
        if (wrong.length) c.push({ i: m.index, w, wrong });
      }
      if (!c.length) return null;
      const { i, w, wrong } = pick(c);
      const bad = pick(wrong);
      const end = i + bad.length;
      return {
        target: line, shown: line.slice(0, i) + bad + line.slice(i + w.length), kind, pos: i, len: w.length,
        // One word delete from the end of the name, or one Backspace per letter.
        ways: [{ at: [end], fix: 1 + w.length, cmds: ['N'] }, { at: [end], fix: bad.length + w.length, cmds: [] }],
      };
    }
    // typo: swap two neighbouring letters inside a name of 4+ letters
    const words = [];
    const re = /[A-Za-z_]{4,}/g;
    let m;
    while ((m = re.exec(line))) {
      for (let i = m.index; i < m.index + m[0].length - 1; i++) {
        if (/[a-z]/i.test(line[i]) && /[a-z]/i.test(line[i + 1]) && line[i] !== line[i + 1]) words.push(i);
      }
    }
    if (!words.length) return null;
    const i = pick(words);
    // Between the two letters: Backspace, Right, type (3); at either side: 2 deletes + 2 letters.
    return {
      target: line, shown: line.slice(0, i) + line[i + 1] + line[i] + line.slice(i + 2), kind: 'typo', pos: i, len: 2,
      ways: [{ at: [i + 1], fix: 3, cmds: [] }, { at: [i, i + 2], fix: 4, cmds: [] }],
    };
  }

  // A new round built around one command: the cursor starts where that command is
  // needed, and the best way with the unlocked commands must use it and save
  // MIN_GAIN+ keys over the best way without it.
  // opts: { focus, unlocked (count), confusions, words, cmd (force) }.
  // Returns { target, shown, kind, pos, len, caret, par, cmds, cmd }.
  function round(lines, opts) {
    opts = opts || {};
    const open = CMDS.slice(0, Math.max(1, opts.unlocked || START_UNLOCKED)).map((c) => c.id);
    const cmd = opts.cmd || (opts.focus && open.includes(opts.focus) && Math.random() < FOCUS_SHARE ? opts.focus : pick(open));
    const allowed = new Set(open);
    const without = new Set(open.filter((x) => x !== cmd));
    const pool = lines.filter((l) => !l.includes('\n') && l.length >= 18 && l.length <= MAX_LEN);
    // Trouble words are identifiers ([A-Za-z0-9_]), so a token set is enough.
    const tw = new Set(opts.words || []);
    const withWord = tw.size ? pool.filter((l) => (l.match(/\w+/g) || []).some((w) => tw.has(w))) : [];
    let fallback = null;
    for (let k = 0; k < 200; k++) {
      const line = withWord.length && Math.random() < 0.4 ? pick(withWord) : pick(pool);
      const r = plant(line, cmd === 'N' ? 'name' : pick(CHAR_KINDS), opts.confusions);
      if (!r || r.shown === r.target) continue;
      const caret = CARET_START[cmd] === 'start' ? 0 : r.shown.length;
      const b = bestWay(r.shown, caret, r.ways, allowed);
      const gain = bestWay(r.shown, caret, r.ways, without).cost - b.cost;
      const out = { target: r.target, shown: r.shown, kind: r.kind, pos: r.pos, len: r.len, caret, par: b.cost, cmds: b.cmds, cmd };
      if (gain >= MIN_GAIN && b.cost <= MAX_PAR && b.cmds.includes(cmd)) return out;
      if (b.cmds.includes(cmd) && b.cost <= MAX_PAR + 4 && (!fallback || gain > fallback.gain)) fallback = Object.assign(out, { gain });
    }
    if (fallback) return fallback;
    const line = 'for i, num in enumerate(nums):';
    const r = plant(line, 'swap', []);
    const b = bestWay(r.shown, r.shown.length, r.ways, allowed);
    return { target: r.target, shown: r.shown, kind: r.kind, pos: r.pos, len: r.len, caret: r.shown.length, par: b.cost, cmds: b.cmds, cmd };
  }

  // Each command's bar: over its last WINDOW rounds where the best way used it,
  // the share where you used it (no mouse). focus: the weakest unlocked command
  // (fewer than UNLOCK.rounds such rounds counts as not learned yet).
  // canUnlock: every unlocked command is at UNLOCK.share over UNLOCK.rounds+.
  function cmdStats(rounds, unlocked) {
    const open = Math.min(Math.max(1, unlocked || START_UNLOCKED), CMDS.length);
    const out = { unlocked: open, by: {} };
    for (const c of CMDS) {
      const R = (rounds || []).filter((r) => Array.isArray(r.cmds) && r.cmds.includes(c.id)).slice(-WINDOW);
      const used = R.filter((r) => !r.mouse && c.used(r)).length;
      out.by[c.id] = { n: R.length, used, share: R.length ? used / R.length : 0 };
    }
    const score = (id) => (out.by[id].n < UNLOCK.rounds ? -1 + out.by[id].n / 10 : out.by[id].share);
    const ids = CMDS.slice(0, open).map((c) => c.id);
    out.focus = ids.reduce((a, b) => (score(b) < score(a) ? b : a));
    out.canUnlock = open < CMDS.length && ids.every((id) => out.by[id].n >= UNLOCK.rounds && out.by[id].share >= UNLOCK.share);
    return out;
  }

  // Feedback tip for a finished round: the first command the best way used that
  // you did not, in Caps form.
  function tip(r, k) {
    if (k.mouse) return 'No mouse: ' + (r.cmds.length ? r.cmds.map((id) => BY_ID[id].caps).join(', then ') : 'Caps+J / L move the cursor');
    const missed = r.cmds.filter((id) => !BY_ID[id].used(k));
    if (missed.length) {
      const order = r.cmds.map((id) => BY_ID[id].caps + ' (' + BY_ID[id].key + ')').join(', then ');
      return 'Fastest: ' + order;
    }
    if (k.keys > r.par + 3) return 'Best was ' + r.par + ': count the jumps before you press';
    return '';
  }

  // Summary of recent rounds: { n, medMs, medRatio, mouseShare, byKind }.
  function summary(rounds, last) {
    const R = (rounds || []).slice(-(last || 50));
    const med = (xs) => {
      const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
      if (!s.length) return null;
      const h = Math.floor(s.length / 2);
      return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
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
      wordShare: R.length ? R.filter((r) => r.word > 0).length / R.length : null,
      mouseShare: R.length ? R.filter((r) => r.mouse > 0).length / R.length : null,
      byKind,
    };
  }

  // Keep only well-formed rounds and the unlock count (a bad entry must not stop boot).
  // Rounds from the word-jump build (dir L/R) count for Y, or U then P.
  function clean(raw) {
    const out = { rounds: [], unlocked: START_UNLOCKED };
    if (!raw || typeof raw !== 'object') return out;
    if (Number.isInteger(raw.unlocked)) out.unlocked = Math.min(Math.max(raw.unlocked, 1), CMDS.length);
    if (!Array.isArray(raw.rounds)) return out;
    const num = (x) => (Number.isFinite(x) && x >= 0 ? x : 0);
    const limit = Date.now() + 86400000; // no rounds from the future
    out.rounds = raw.rounds
      .filter((r) => r && typeof r === 'object' && Number.isFinite(r.ts) && r.ts <= limit && Number.isFinite(r.ms) && KINDS.includes(r.kind))
      .map((r) => {
        const o = {
          ts: r.ts, kind: r.kind, ms: Math.max(0, r.ms), keys: num(r.keys), par: num(r.par),
          arrows: num(r.arrows), word: num(r.word), homeEnd: num(r.homeEnd), del: num(r.del), mouse: num(r.mouse),
          wl: num(r.wl), wr: num(r.wr), hm: num(r.hm), en: num(r.en), wordDel: num(r.wordDel),
        };
        if (Array.isArray(r.cmds)) o.cmds = r.cmds.filter((x) => BY_ID[x]);
        else if (r.dir === 'L') o.cmds = ['Y'];
        else if (r.dir === 'R') {
          o.cmds = ['U', 'P'];
          if (!o.hm && o.homeEnd) o.hm = o.homeEnd;
        }
        return o;
      })
      .sort((a, b) => a.ts - b.ts)
      .slice(-ROUNDS_KEPT);
    return out;
  }

  CTT.EDIT = { KINDS, KIND_NAMES, ROUNDS_KEPT, MIN_GAIN, CMDS, BY_ID, START_UNLOCKED, UNLOCK, round, plant, wordStops, bestWay, tip, summary, clean, cmdStats };
})();
