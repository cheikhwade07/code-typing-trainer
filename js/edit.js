// Edit drill: fix one planted mistake in a line of real Python with the Caps Lock
// editing commands (extras/caps-arrows.ahk). Every command is always available.
// After every key a live planner works out the fewest keys left to fix the line
// from the current text and cursor, and which next key(s) start such a way. Each
// key you press is scored as a decision (a best key or not), each command gets
// an accuracy bar like Adaptive, and most rounds are built around the weakest
// one (the focus). Results live in the main save under `edit`.
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
  const DEC_WINDOW = 30; // a command's bar: its last 30 decisions where it was a best key
  const DEC_MIN = 8; // fewer such decisions counts as not learned yet (weakest)
  const DEC_PER_ROUND = 40; // decisions kept per round

  // The Caps Lock layer. Browsers cannot tell Caps+U from a real Ctrl+Left (the
  // script sends the same key), so either counts. The ids are the saved names and
  // predate the 2026-11-17 key swap: Y and P are the word jumps (now Caps+U / O),
  // U and O are Home / End (now Caps+Y / P).
  const CMDS = [
    { id: 'Y', caps: 'Caps+U', key: 'Ctrl ←', code: 'KeyU', what: 'jump a word left' },
    { id: 'P', caps: 'Caps+O', key: 'Ctrl →', code: 'KeyO', what: 'jump a word right' },
    { id: 'U', caps: 'Caps+Y', key: 'Home', code: 'KeyY', what: 'go to the start of the line' },
    { id: 'O', caps: 'Caps+P', key: 'End', code: 'KeyP', what: 'go to the end of the line' },
    { id: 'N', caps: 'Caps+N', key: 'Ctrl+Backspace', code: 'KeyN', what: 'delete the word before the cursor' },
    { id: 'J', caps: 'Caps+J', key: '←', code: 'KeyJ', what: 'move one character left' },
    { id: 'L', caps: 'Caps+L', key: '→', code: 'KeyL', what: 'move one character right' },
    { id: 'H', caps: 'Caps+H', key: 'Backspace', code: 'KeyH', what: 'delete the character before the cursor' },
    { id: 'S', caps: 'Caps+;', key: 'Delete', code: 'Semicolon', what: 'delete the character after the cursor' },
  ];
  const BY_ID = Object.fromEntries(CMDS.map((c) => [c.id, c]));
  // Typing a character, a character that does not help, and any other key.
  const OTHER = { T: 'typing', X: 'a wrong character', '?': 'another key' };
  // Commands rounds are built around (and that can be the focus).
  const FOCUS_IDS = ['Y', 'P', 'U', 'O', 'N'];
  // Chips in the symbol bar: the five commands, then the single-step pairs.
  const CHIPS = FOCUS_IDS.map((id) => ({ ...BY_ID[id], ids: [id] })).concat([
    { id: 'JL', ids: ['J', 'L'], caps: 'Caps+J·L', key: '← →', what: 'move one character' },
    { id: 'HS', ids: ['H', 'S'], caps: 'Caps+H·;', key: 'Backspace · Delete', what: 'delete one character' },
  ]);
  const ORDER = 'YPUONJLHST'; // how best keys are listed
  const MOVES = ['J', 'L', 'Y', 'P', 'U', 'O'];
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
  function prevStop(st, c) {
    let r = 0;
    for (const x of st) if (x < c) r = x;
    return r;
  }
  function nextStop(st, c, n) {
    for (const x of st) if (x > c) return x;
    return n;
  }

  // Where a cursor move takes the cursor.
  function moveTo(id, st, c, n) {
    if (id === 'J') return Math.max(0, c - 1);
    if (id === 'L') return Math.min(n, c + 1);
    if (id === 'Y') return prevStop(st, c);
    if (id === 'P') return nextStop(st, c, n);
    if (id === 'U') return 0;
    return n; // O
  }

  // Fewest moves from c to every position (breadth-first over J L Y P U O).
  function navDist(v, c, allow) {
    const n = v.length;
    const st = wordStops(v);
    const dist = new Array(n + 1).fill(Infinity);
    dist[c] = 0;
    const queue = [c];
    for (let i = 0; i < queue.length; i++) {
      const u = queue[i];
      for (const m of MOVES) {
        if (allow && !allow.has(m)) continue;
        const w = moveTo(m, st, u, n);
        if (dist[w] !== Infinity) continue;
        dist[w] = dist[u] + 1;
        queue.push(w);
      }
    }
    return dist;
  }

  // The part of v to replace: [a, b) becomes ins. Prefix first, then suffix first
  // (repeated characters make both valid).
  function regions(v, t) {
    const lv = v.length;
    const lt = t.length;
    const m = Math.min(lv, lt);
    let p = 0;
    while (p < m && v[p] === t[p]) p++;
    let s = 0;
    while (s < m - p && v[lv - 1 - s] === t[lt - 1 - s]) s++;
    let s2 = 0;
    while (s2 < m && v[lv - 1 - s2] === t[lt - 1 - s2]) s2++;
    let p2 = 0;
    while (p2 < m - s2 && v[p2] === t[p2]) p2++;
    const out = [{ a: p, b: lv - s, ins: t.slice(p, lt - s) }];
    if (p2 !== p || s2 !== s) out.push({ a: p2, b: lv - s2, ins: t.slice(p2, lt - s2) });
    return out;
  }

  // Fewest keys to turn v (cursor at c) into t. allow: a Set of usable ids, or
  // null for all. Fix strategies, after moving the cursor to q:
  // - single deletes from anywhere in [a, b] (Backspace / Delete), then type ins;
  // - word deletes from b until the cursor is at or before a, then retype;
  // - two swapped characters: Backspace between them, Right, type the one.
  // cap: only costs below it matter (returns cap or more otherwise).
  function cost(v, c, t, allow, cap) {
    if (v === t) return 0;
    const ub = quickCost(v, c, t, allow);
    let best = cap != null ? Math.min(ub, cap) : ub;
    for (const r of regions(v, t)) best = Math.min(best, localCost(v, c, t, r, allow, best));
    return best;
  }

  // The typing that can help in the window X (cursor k) on the way to T: extend
  // the part already right on the left, or on the right. At most 2 characters.
  function helpfulChars(X, k, T) {
    const out = [];
    if (k < T.length && X.slice(0, k) === T.slice(0, k)) out.push(T[k]);
    const r = X.length - k;
    const j = T.length - r - 1;
    if (j >= 0 && X.slice(k) === T.slice(T.length - r) && !out.includes(T[j])) out.push(T[j]);
    return out;
  }

  // Exact fewest keys for one region: move the cursor into the window [a0, b] of
  // the unchanged line (a0 = start of the word holding the first wrong character),
  // then edit inside it with every key, searched cheapest first. Edits stay in the
  // window; typing is limited to helpfulChars. Gives up past `limit` (a known cost).
  const LOCAL_STATES = 20000;
  // States shared by one whole plan() or round attempt, so the worst case stays
  // fast. When it runs out the search keeps the quick (still reachable) cost.
  const PLAN_STATES = 30000;
  let budget = Infinity;
  // Longest common subsequence length (short strings).
  function lcs(x, y) {
    const m = y.length;
    const row = new Uint16Array(m + 1);
    const yc = new Uint16Array(m);
    for (let j = 0; j < m; j++) yc[j] = y.charCodeAt(j);
    for (let i = 0; i < x.length; i++) {
      const xc = x.charCodeAt(i);
      let prev = 0;
      for (let j = 1; j <= m; j++) {
        const keep = row[j];
        if (xc === yc[j - 1]) row[j] = prev + 1;
        else if (row[j - 1] > keep) row[j] = row[j - 1];
        prev = keep;
      }
    }
    return row[m];
  }
  function localCost(v, c, t, reg, allow, limit) {
    const st0 = wordStops(v);
    const a0 = st0.includes(reg.a) ? reg.a : prevStop(st0, reg.a);
    const S = v.slice(reg.b);
    if (t.slice(0, a0) !== v.slice(0, a0) || t.slice(t.length - S.length) !== S) return Infinity;
    const dist = navDist(v, c, allow);
    // Entry points nearest first; each gets only the keys left after moving there.
    const entries = [];
    for (let e = a0; e <= reg.b; e++) if (dist[e] < limit) entries.push(e);
    entries.sort((x, y) => dist[x] - dist[y]);
    let best = limit;
    for (const e of entries) {
      if (dist[e] >= best) break;
      best = Math.min(best, dist[e] + editFrom(v, t, a0, reg.b, e, allow, best - dist[e]));
    }
    return best;
  }

  // Fewest keys to fix the window [a0, b) of v with the cursor at e, editing only
  // inside it (cheapest first, with a lower bound to prune). Returns `limit` or
  // more when it needs at least that many. Remembered per text, so the next-key
  // tries of one plan (cursor moves leave the text as it is) share the work.
  const editMemo = new Map();
  // Word stops inside the window X (positions 0..|X|), the same as wordStops on
  // the whole line: a stop starts a run of word characters or of punctuation.
  // before / after: the characters just outside the window ('' at the line ends).
  const kind = (ch) => (/\w/.test(ch) ? 'w' : /\s/.test(ch) ? 's' : 'p');
  function windowStops(X, before, after) {
    const out = [];
    for (let k = 0; k <= X.length; k++) {
      const prev = k > 0 ? X[k - 1] : before;
      const cur = k < X.length ? X[k] : after;
      if (cur === '') { out.push(k); continue; } // end of the line
      if (prev === '' && k === 0) { out.push(k); continue; } // start of the line
      if (kind(cur) !== 's' && kind(cur) !== kind(prev)) out.push(k);
    }
    return out;
  }
  function editFrom(v, t, a0, b, e, allow, limit) {
    const memoKey = v + '\u0000' + t + '\u0000' + a0 + ',' + b + ',' + e + ',' + (allow ? [...allow].join('') : '*');
    const known = editMemo.get(memoKey);
    if (known && (known.exact || known.atLeast >= limit)) return known.exact ? known.value : Math.max(known.atLeast, limit);
    const P = v.slice(0, a0);
    const S = v.slice(b);
    const X0 = v.slice(a0, b);
    const T = t.slice(a0, t.length - S.length);
    const before = P ? P[P.length - 1] : '';
    const after = S ? S[0] : '';
    const ok = (id) => !allow || allow.has(id);
    const buckets = [];
    const seen = new Map();
    // Lower bound on the keys left: each missing character is typed, and anything
    // extra takes at least one delete (a word delete can take several).
    const low = new Map();
    const h = (X) => {
      let r = low.get(X);
      if (r === undefined) {
        budget -= (X.length * T.length) >> 6; // long windows cost more
        const m = lcs(X, T);
        r = T.length - m + (X.length > m ? 1 : 0);
        low.set(X, r);
      }
      return r;
    };
    const push = (X, k, d) => {
      if (budget < 0 || d + h(X) >= limit) return;
      const key = k + '|' + X;
      if (seen.has(key) && seen.get(key) <= d) return;
      seen.set(key, d);
      (buckets[d] = buckets[d] || []).push([X, k]);
    };
    const remember = (r) => {
      if (editMemo.size > 2000) editMemo.clear();
      editMemo.set(memoKey, r);
    };
    push(X0, e - a0, 0);
    for (let d = 0; d < limit && d < buckets.length; d++) {
      const level = buckets[d];
      if (!level) continue;
      for (const [X, k] of level) {
        if (seen.get(k + '|' + X) !== d) continue;
        if (X === T) {
          remember({ exact: true, value: d });
          return d;
        }
        if (seen.size > LOCAL_STATES || --budget < 0) return limit;
        const ws = windowStops(X, before, after);
        let back = -1; // the word stop left of the cursor, inside the window
        let fwd = -1; // the word stop right of the cursor, inside the window
        for (const w of ws) {
          if (w < k) back = w;
          else if (w > k && fwd < 0) fwd = w;
        }
        const next = d + 1;
        if (k > 0 && ok('J')) push(X, k - 1, next);
        if (k < X.length && ok('L')) push(X, k + 1, next);
        if (back >= 0 && ok('Y')) push(X, back, next);
        if (fwd >= 0 && ok('P')) push(X, fwd, next);
        if (k > 0 && ok('H')) push(X.slice(0, k - 1) + X.slice(k), k - 1, next);
        if (k < X.length && ok('S')) push(X.slice(0, k) + X.slice(k + 1), k, next);
        if (back >= 0 && ok('N')) push(X.slice(0, back) + X.slice(k), back, next);
        for (const ch of helpfulChars(X, k, T)) push(X.slice(0, k) + ch + X.slice(k), k + 1, next);
      }
    }
    remember({ exact: false, atLeast: limit });
    return limit;
  }

  // Quick upper bound from fixed strategies (whole-region deletes and retyping,
  // word deletes from the end of the region, the 3-key letter swap).
  function quickCost(v, c, t, allow) {
    if (v === t) return 0;
    const dist = navDist(v, c, allow);
    const st = wordStops(v);
    const canN = !allow || allow.has('N');
    let best = Infinity;
    for (const { a, b, ins } of regions(v, t)) {
      const fix = b - a + ins.length;
      for (let q = a; q <= b; q++) best = Math.min(best, dist[q] + fix);
      if (canN && b > 0) {
        let ps = b;
        for (let k = 1; k <= 3; k++) {
          ps = prevStop(st, ps);
          if (ps <= a) {
            best = Math.min(best, dist[b] + k + (a - ps) + ins.length);
            break;
          }
        }
      }
      if (b - a === 2 && ins.length === 2 && ins[0] === v[a + 1] && ins[1] === v[a]) {
        // from a: Delete, Right, type; from a+1: Backspace, Right, type; from a+2: Backspace, Left, type
        best = Math.min(best, Math.min(dist[a], dist[a + 1], dist[a + 2]) + 3);
      }
    }
    return best;
  }

  // The text and cursor after one action, or null when it would do nothing.
  function apply(v, c, id, ch, st) {
    const n = v.length;
    if (id === 'H') return c > 0 ? [v.slice(0, c - 1) + v.slice(c), c - 1] : null;
    if (id === 'S') return c < n ? [v.slice(0, c) + v.slice(c + 1), c] : null;
    if (id === 'N') {
      if (c === 0) return null;
      const ps = prevStop(st, c);
      return [v.slice(0, ps) + v.slice(c), ps];
    }
    if (id === 'T') return [v.slice(0, c) + ch + v.slice(c), c + 1];
    const w = moveTo(id, st, c, n);
    return w === c ? null : [v, w];
  }

  // The live plan: { done, cost, best: Set of ids, chars: Set of helpful
  // characters (when best has T), char: the one to show }. Each possible next key
  // is tried, and the best keys are those that leave the fewest keys after them.
  function plan(v, c, t, allow) {
    budget = PLAN_STATES;
    try {
      return planIn(v, c, t, allow);
    } finally {
      budget = Infinity;
    }
  }
  function planIn(v, c, t, allow) {
    const now = cost(v, c, t, allow);
    const out = { done: now === 0, cost: now, best: new Set(), chars: new Set(), char: null };
    if (out.done) return out;
    const st = wordStops(v);
    const tries = [];
    for (const id of ORDER) {
      if (id === 'T' || (allow && !allow.has(id))) continue;
      const nx = apply(v, c, id, null, st);
      if (nx) tries.push({ id, k: 1 + cost(nx[0], nx[1], t, allow, now) });
    }
    // Only characters that can help where the cursor is (see helpfulChars), and
    // the target's character at the cursor when the line is right up to it (or
    // right after it).
    const chars = new Set();
    if (v.slice(0, c) === t.slice(0, c) && c < t.length) chars.add(t[c]);
    const tail = v.length - c;
    if (tail < t.length && v.slice(c) === t.slice(t.length - tail)) chars.add(t[t.length - tail - 1]);
    for (const r of regions(v, t)) {
      const a0 = st.includes(r.a) ? r.a : prevStop(st, r.a);
      if (c < a0 || c > r.b) continue;
      const S = v.slice(r.b);
      helpfulChars(v.slice(a0, r.b), c - a0, t.slice(a0, t.length - S.length)).forEach((ch) => chars.add(ch));
    }
    for (const ch of chars) {
      const nx = apply(v, c, 'T', ch, st);
      tries.push({ id: 'T', ch, k: 1 + cost(nx[0], nx[1], t, allow, now) });
    }
    const min = Math.min(...tries.map((x) => x.k));
    out.cost = Math.min(now, min);
    for (const x of tries) {
      if (x.k !== min) continue;
      out.best.add(x.id);
      if (x.id === 'T') out.chars.add(x.ch);
    }
    out.char = out.chars.size ? [...out.chars][0] : null;
    return out;
  }

  // Best ids as a string in display order ("YU", "T").
  function bestStr(p) {
    return ORDER.split('').filter((id) => p.best.has(id)).join('');
  }

  // Which action a keydown is: J L Y P U O H S N, T (a helpful character given
  // the plan), X (a character that does not help), '?' (another editing key),
  // or null (not an editing key: not counted).
  function classify(e, p) {
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    const nav = { ArrowLeft: ctrl ? 'Y' : 'J', ArrowRight: ctrl ? 'P' : 'L', Home: 'U', End: 'O' }[k];
    if (nav) return e.shiftKey ? '?' : nav; // Shift selects: not a command
    if (k === 'Backspace') return ctrl || e.altKey ? 'N' : 'H';
    if (k === 'Delete') return ctrl ? '?' : 'S';
    // AltGr (Ctrl+Alt) types characters on some layouts.
    if (k.length === 1 && (!ctrl || (e.ctrlKey && e.altKey))) return p && p.chars.has(k) ? 'T' : 'X';
    return null;
  }

  // Plant one mistake in a correct line: { target, shown, kind, pos, len } or null.
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
      return { target: line, shown: line.slice(0, i) + pick(byChar[line[i]]) + line.slice(i + 1), kind, pos: i, len: 1 };
    }
    if (kind === 'missing') {
      const c = idx((ch) => MISSABLE.has(ch));
      if (!c.length) return null;
      const i = pick(c);
      return { target: line, shown: line.slice(0, i) + line.slice(i + 1), kind, pos: i, len: 1 };
    }
    if (kind === 'extra') {
      const c = idx((ch) => ch !== ' ');
      if (!c.length) return null;
      const i = pick(c);
      return { target: line, shown: line.slice(0, i + 1) + line[i] + line.slice(i + 1), kind, pos: i, len: 1 };
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
      return { target: line, shown: line.slice(0, i) + bad + line.slice(i + w.length), kind, pos: i, len: w.length };
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
    return { target: line, shown: line.slice(0, i) + line[i + 1] + line[i] + line.slice(i + 2), kind: 'typo', pos: i, len: 2 };
  }

  // A new round built around one command (no locking: every command is always
  // usable). The cursor starts where that command is needed, the fewest keys
  // with every command (par) is at most MAX_PAR, and the same fix without that
  // command takes MIN_GAIN+ more keys.
  // opts: { focus, confusions, words, cmd (force) }.
  // Returns { target, shown, kind, pos, len, caret, par, cmd }.
  function round(lines, opts) {
    opts = opts || {};
    const cmd = opts.cmd || (opts.focus && FOCUS_IDS.includes(opts.focus) && Math.random() < FOCUS_SHARE ? opts.focus : pick(FOCUS_IDS));
    const without = new Set(CMDS.map((c) => c.id).concat('T').filter((x) => x !== cmd));
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
      budget = PLAN_STATES;
      const par = cost(r.shown, caret, r.target, null);
      budget = PLAN_STATES;
      const gain = cost(r.shown, caret, r.target, without) - par;
      budget = Infinity;
      const out = { target: r.target, shown: r.shown, kind: r.kind, pos: r.pos, len: r.len, caret, par, cmd };
      if (gain >= MIN_GAIN && par <= MAX_PAR) return out;
      if (gain > 0 && par <= MAX_PAR + 4 && (!fallback || gain > fallback.gain)) fallback = Object.assign(out, { gain });
    }
    if (fallback) return fallback;
    const line = 'for i, num in enumerate(nums):';
    const r = plant(line, 'swap', []);
    const caret = r.shown.length;
    return { target: r.target, shown: r.shown, kind: r.kind, pos: r.pos, len: r.len, caret, par: cost(r.shown, caret, r.target, null), cmd };
  }

  function median(xs) {
    const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!s.length) return null;
    const h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  // Every decision of the saved rounds, oldest first: [best, took, ms].
  function decisions(rounds) {
    const D = [];
    for (const r of rounds || []) if (Array.isArray(r.d)) for (const x of r.d) D.push(x);
    return D;
  }

  // Per command and per chip, over its last DEC_WINDOW decisions where it was a
  // best key: { n, hits (a best key was pressed), acc, medMs (of hits) }.
  // focus: the lowest accuracy among Y P U O N (fewer than DEC_MIN decisions
  // counts as weakest, fewest first).
  function cmdStats(rounds) {
    const D = decisions(rounds);
    const one = (ids) => {
      const xs = D.filter((x) => ids.some((id) => x[0].includes(id))).slice(-DEC_WINDOW);
      const hits = xs.filter((x) => x[0].includes(x[1]));
      return { n: xs.length, hits: hits.length, acc: xs.length ? hits.length / xs.length : 0, medMs: median(hits.map((x) => x[2])) };
    };
    const out = { by: {} };
    for (const c of CMDS) out.by[c.id] = one([c.id]);
    for (const c of CHIPS) if (c.ids.length > 1) out.by[c.id] = one(c.ids);
    const score = (id) => (out.by[id].n < DEC_MIN ? -1 + out.by[id].n / 10 : out.by[id].acc);
    out.focus = FOCUS_IDS.reduce((a, b) => (score(b) < score(a) ? b : a));
    return out;
  }

  // Names for feedback: a command in Caps form, or what was pressed.
  function capsName(id) {
    return BY_ID[id] ? BY_ID[id].caps + ' (' + BY_ID[id].key + ')' : OTHER[id] || id;
  }
  function keyName(id) {
    return BY_ID[id] ? BY_ID[id].key : OTHER[id] || id;
  }
  // "first miss: best was Caps+U, you pressed ←", or '' when every decision hit.
  function firstMiss(d) {
    const x = (d || []).find((y) => !y[0].includes(y[1]));
    if (!x) return '';
    const best = x[0].split('').map((id) => (BY_ID[id] ? BY_ID[id].caps : OTHER[id])).join(' or ');
    return 'first miss: best was ' + best + ', you pressed ' + keyName(x[1]);
  }

  // Summary of recent rounds: { n, medMs, medRatio, bestRate, mouseShare, byKind }.
  function summary(rounds, last) {
    const R = (rounds || []).slice(-(last || 50));
    const byKind = {};
    for (const k of KINDS) {
      const xs = R.filter((r) => r.kind === k);
      if (xs.length) byKind[k] = { n: xs.length, medMs: median(xs.map((r) => r.ms)) };
    }
    const D = decisions(R);
    return {
      n: R.length,
      medMs: median(R.map((r) => r.ms)),
      medRatio: median(R.map((r) => (r.par > 0 ? r.keys / r.par : null))),
      bestRate: D.length ? D.filter((x) => x[0].includes(x[1])).length / D.length : null,
      decisions: D.length,
      wordShare: R.length ? R.filter((r) => r.word > 0).length / R.length : null,
      mouseShare: R.length ? R.filter((r) => r.mouse > 0).length / R.length : null,
      byKind,
    };
  }

  // Keep only well-formed rounds (a bad entry must not stop boot). Older rounds
  // (with cmds, or dir L/R from the word-jump build) still load; they have no
  // decisions, so they only count for times and keys.
  function clean(raw) {
    const out = { rounds: [] };
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.rounds)) return out;
    const num = (x) => (Number.isFinite(x) && x >= 0 ? x : 0);
    const limit = Date.now() + 86400000; // no rounds from the future
    const okDec = (x) => Array.isArray(x) && typeof x[0] === 'string' && /^[YPUONJLHST]{1,10}$/.test(x[0]) &&
      typeof x[1] === 'string' && /^[YPUONJLHSTX?]$/.test(x[1]) && Number.isFinite(x[2]) && x[2] >= 0;
    out.rounds = raw.rounds
      .filter((r) => r && typeof r === 'object' && Number.isFinite(r.ts) && r.ts <= limit && Number.isFinite(r.ms) && KINDS.includes(r.kind))
      .map((r) => {
        const o = {
          ts: r.ts, kind: r.kind, ms: Math.max(0, r.ms), keys: num(r.keys), par: num(r.par),
          arrows: num(r.arrows), word: num(r.word), homeEnd: num(r.homeEnd), del: num(r.del), mouse: num(r.mouse),
          wl: num(r.wl), wr: num(r.wr), hm: num(r.hm), en: num(r.en), wordDel: num(r.wordDel),
        };
        if (FOCUS_IDS.includes(r.cmd)) o.cmd = r.cmd;
        if (Array.isArray(r.cmds)) o.cmds = r.cmds.filter((x) => BY_ID[x]);
        else if (r.dir === 'L') o.cmds = ['Y'];
        else if (r.dir === 'R') {
          o.cmds = ['U', 'P'];
          if (!o.hm && o.homeEnd) o.hm = o.homeEnd;
        }
        if (Array.isArray(r.d)) o.d = r.d.filter(okDec).slice(0, DEC_PER_ROUND).map((x) => [x[0], x[1], Math.round(x[2])]);
        return o;
      })
      .sort((a, b) => a.ts - b.ts)
      .slice(-ROUNDS_KEPT);
    return out;
  }

  CTT.EDIT = {
    KINDS, KIND_NAMES, ROUNDS_KEPT, MIN_GAIN, MAX_PAR, DEC_WINDOW, DEC_MIN, DEC_PER_ROUND, CMDS, BY_ID, CHIPS, FOCUS_IDS,
    round, plant, wordStops, cost, plan, bestStr, classify, cmdStats, capsName, keyName, firstMiss, summary, clean,
  };
})();
