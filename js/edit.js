// Edit drill: fix one planted mistake in a line of real Python, with the cursor
// starting at the end of the line, as when you spot a typo after typing. Trains
// moving the cursor with Ctrl+Left/Right, Home/End and word deletes instead of
// many single arrow presses. Results live in the main save under `edit`.
(function () {
  const CTT = (window.CTT = window.CTT || {});

  const KINDS = ['swap', 'missing', 'extra', 'typo'];
  const KIND_NAMES = { swap: 'wrong symbol', missing: 'missing symbol', extra: 'extra character', typo: 'misspelled name' };
  const ROUNDS_KEPT = 300;
  const MAX_LEN = 64; // longer lines do not fit the box at a readable size
  // Common mix-ups, both ways; the player's own top mix-ups are added in front.
  const PAIRS = [['_', '-'], ['[', ']'], ['(', ')'], [':', ';'], ["'", '"'], [',', '.'], ['=', '-'],
    ['+', '='], ['{', '['], ['}', ']'], ['<', '>'], ['0', '-'], ['(', '*'], [')', '_'], ['p', '[']];
  const MISSABLE = new Set([')', ']', '}', ':', ',', '(', '[', '_', '.', '"', "'", '=']);

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
  function navPar(s, p) {
    const st = wordStops(s);
    const last = st.length - 1; // st[last] === s.length, where the cursor starts
    let best = s.length - p; // single arrows only
    for (let i = 0; i <= last; i++) {
      const fine = Math.abs(st[i] - p); // single arrows from that stop
      best = Math.min(best, last - i + fine); // Ctrl+Left from the end
      best = Math.min(best, 1 + i + fine); // Home, then Ctrl+Right
    }
    return best;
  }

  // Fewest keys: reach any of the positions, then `fix` keys.
  function best(s, positions, fix) {
    return Math.min(...positions.filter((p) => p >= 0 && p <= s.length).map((p) => navPar(s, p))) + fix;
  }

  // Make one round from a correct line. confusions: [{expected, typed}] (player's).
  // Returns { target, shown, kind, pos, par } or null if this line has no candidate.
  function plant(line, kind, confusions) {
    const n = line.length;
    const limit = Math.max(1, Math.floor(n * 0.85)); // keep the mistake away from the end
    const idx = (test) => {
      const c = [];
      for (let i = 0; i < limit; i++) if (test(line[i], i)) c.push(i);
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
      return { target: line, shown, kind, pos: i, par: best(shown, [i, i + 1], 2) };
    }
    if (kind === 'missing') {
      const c = idx((ch) => MISSABLE.has(ch));
      if (!c.length) return null;
      const i = pick(c);
      const shown = line.slice(0, i) + line.slice(i + 1);
      return { target: line, shown, kind, pos: i, par: best(shown, [i], 1) };
    }
    if (kind === 'extra') {
      const c = idx((ch) => ch !== ' ');
      if (!c.length) return null;
      const i = pick(c);
      const shown = line.slice(0, i + 1) + line[i] + line.slice(i + 1);
      // Delete at i or i+1, or Backspace at i+1 or i+2 (either copy goes).
      return { target: line, shown, kind, pos: i, par: best(shown, [i, i + 1, i + 2], 1) };
    }
    // typo: swap two neighbouring letters inside a name of 4+ letters
    const words = [];
    const re = /[A-Za-z_]{4,}/g;
    let m;
    while ((m = re.exec(line))) {
      if (m.index >= limit) break;
      for (let i = m.index; i < Math.min(m.index + m[0].length - 1, limit - 1); i++) {
        if (/[a-z]/i.test(line[i]) && /[a-z]/i.test(line[i + 1]) && line[i] !== line[i + 1]) words.push(i);
      }
    }
    if (!words.length) return null;
    const i = pick(words);
    const shown = line.slice(0, i) + line[i + 1] + line[i] + line.slice(i + 2);
    // Between the two letters: Backspace, Right, type (3); at either side: 2 deletes + 2 letters.
    return { target: line, shown, kind: 'typo', pos: i, par: Math.min(best(shown, [i + 1], 3), best(shown, [i, i + 2], 4)) };
  }

  // A new round from the Lines pool, preferring lines with trouble words.
  function round(lines, opts) {
    opts = opts || {};
    const pool = lines.filter((l) => !l.includes('\n') && l.length >= 18 && l.length <= MAX_LEN);
    // Trouble words are identifiers ([A-Za-z0-9_]), so a token set is enough.
    const tw = new Set(opts.words || []);
    const withWord = tw.size ? pool.filter((l) => (l.match(/\w+/g) || []).some((w) => tw.has(w))) : [];
    for (let k = 0; k < 50; k++) {
      const line = withWord.length && Math.random() < 0.4 ? pick(withWord) : pick(pool);
      const r = plant(line, opts.kind || pick(KINDS), opts.confusions);
      if (r && r.shown !== r.target) return r;
    }
    return plant('for i, num in enumerate(nums):', 'swap', []);
  }

  // Feedback tip for a finished round: { keys counts }.
  function tip(r, k) {
    if (k.mouse) return 'Try it without the mouse: Ctrl+Left/Right jumps a word';
    if (k.arrows >= 6 && !k.word) return k.arrows + ' arrow presses: Ctrl+Left/Right jumps a word at a time';
    if (r.pos < r.target.length / 3 && !k.homeEnd && k.arrows + k.word > 6) return 'Near the start: Home, then Ctrl+Right';
    if (r.kind === 'typo' && k.del >= 4 && !k.wordDel) return 'Ctrl+Backspace deletes the whole word';
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

  // Keep only well-formed rounds (a bad entry must not stop boot).
  function clean(raw) {
    const out = { rounds: [] };
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.rounds)) return out;
    const num = (x) => (Number.isFinite(x) && x >= 0 ? x : 0);
    const limit = Date.now() + 86400000; // no rounds from the future
    out.rounds = raw.rounds
      .filter((r) => r && typeof r === 'object' && Number.isFinite(r.ts) && r.ts <= limit && Number.isFinite(r.ms) && KINDS.includes(r.kind))
      .map((r) => ({
        ts: r.ts, kind: r.kind, ms: Math.max(0, r.ms), keys: num(r.keys), par: num(r.par),
        arrows: num(r.arrows), word: num(r.word), homeEnd: num(r.homeEnd), del: num(r.del), mouse: num(r.mouse),
      }))
      .sort((a, b) => a.ts - b.ts)
      .slice(-ROUNDS_KEPT);
    return out;
  }

  CTT.EDIT = { KINDS, KIND_NAMES, ROUNDS_KEPT, round, plant, navPar, wordStops, tip, summary, clean };
})();
