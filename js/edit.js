// Edit drill: fix one planted mistake in a line of real Python, with the cursor
// starting at the end of the line, as when you spot a typo after typing. Every
// mistake is placed where word jumps (Ctrl+Left/Right) are clearly the fastest
// way there, so the drill builds that one habit instead of long runs of single
// arrow presses. Results live in the main save under `edit`.
(function () {
  const CTT = (window.CTT = window.CTT || {});

  // 'name' only appears in rounds saved by an earlier build; it is kept on load.
  const KINDS = ['swap', 'missing', 'extra', 'typo', 'name'];
  const PLANT_KINDS = ['swap', 'missing', 'extra', 'typo'];
  const KIND_NAMES = { swap: 'wrong symbol', missing: 'missing symbol', extra: 'extra character', typo: 'misspelled name', name: 'wrong name' };
  const ROUNDS_KEPT = 300;
  const MAX_LEN = 64; // longer lines do not fit the box at a readable size
  const MIN_GAIN = 3; // word jumps must save at least this many keys over arrows/Home
  const FOCUS_SHARE = 0.65; // rounds that practise the focus word jump
  // Common mix-ups, both ways; the player's own top mix-ups are added in front.
  const PAIRS = [['_', '-'], ['[', ']'], ['(', ')'], [':', ';'], ["'", '"'], [',', '.'], ['=', '-'],
    ['+', '='], ['{', '['], ['}', ']'], ['<', '>'], ['0', '-'], ['(', '*'], [')', '_'], ['p', '[']];
  const MISSABLE = new Set([')', ']', '}', ':', ',', '(', '[', '_', '.', '"', "'", '=']);
  const ALL_MOVES = { word: true, home: true };
  const NO_WORD = { word: false, home: true };

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
    const mv = moves || ALL_MOVES;
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

  // Fewest keys for a round: the best of its ways to fix ([positions, fix keys]).
  function parOf(shown, ways, moves) {
    let best = Infinity;
    for (const [positions, fix] of ways) {
      for (const p of positions) if (p >= 0 && p <= shown.length) best = Math.min(best, navPar(shown, p, moves) + fix);
    }
    return best;
  }

  // Which word jump the fastest way uses: 'L' (Ctrl+Left from the end) or
  // 'R' (Home, then Ctrl+Right).
  function dirOf(shown, ways) {
    const st = wordStops(shown);
    const last = st.length - 1;
    let L = Infinity, R = Infinity;
    for (const [positions, fix] of ways) {
      for (const p of positions) {
        if (p < 0 || p > shown.length) continue;
        for (let i = 0; i <= last; i++) {
          const fine = Math.abs(st[i] - p);
          L = Math.min(L, last - i + fine + fix);
          R = Math.min(R, 1 + i + fine + fix);
        }
      }
    }
    return L <= R ? 'L' : 'R';
  }

  // Make one round from a correct line. confusions: [{expected, typed}] (player's).
  // Returns { target, shown, kind, pos, len, par, parNoWord } or null.
  function plant(line, kind, confusions) {
    const n = line.length;
    const limit = Math.max(1, Math.floor(n * 0.85)); // keep the mistake away from the end
    const idx = (test) => {
      const c = [];
      for (let i = 0; i < limit; i++) if (test(line[i], i)) c.push(i);
      return c;
    };
    let r = null;
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
      const shown = line.slice(0, i) + pick(byChar[line[i]]) + line.slice(i + 1);
      // Delete before or Backspace after the wrong character, then type the right one.
      r = { shown, pos: i, len: 1, ways: [[[i, i + 1], 2]] };
    } else if (kind === 'missing') {
      const c = idx((ch) => MISSABLE.has(ch));
      if (!c.length) return null;
      const i = pick(c);
      r = { shown: line.slice(0, i) + line.slice(i + 1), pos: i, len: 1, ways: [[[i], 1]] };
    } else if (kind === 'extra') {
      const c = idx((ch) => ch !== ' ');
      if (!c.length) return null;
      const i = pick(c);
      // Delete at i or i+1, or Backspace at i+1 or i+2 (either copy goes).
      r = { shown: line.slice(0, i + 1) + line[i] + line.slice(i + 1), pos: i, len: 1, ways: [[[i, i + 1, i + 2], 1]] };
    } else {
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
      // Between the two letters: Backspace, Right, type (3); at either side: 2 deletes + 2 letters.
      r = { shown: line.slice(0, i) + line[i + 1] + line[i] + line.slice(i + 2), pos: i, len: 2, ways: [[[i + 1], 3], [[i, i + 2], 4]] };
    }
    return {
      target: line, shown: r.shown, kind, pos: r.pos, len: r.len,
      par: parOf(r.shown, r.ways, ALL_MOVES), parNoWord: parOf(r.shown, r.ways, NO_WORD), dir: dirOf(r.shown, r.ways),
    };
  }

  // A new round from the Lines pool, preferring lines with trouble words. The
  // mistake must be somewhere word jumps save MIN_GAIN+ keys over arrows and Home.
  // opts.dir ('L' or 'R'): the word jump to practise; kept FOCUS_SHARE of the time.
  function round(lines, opts) {
    opts = opts || {};
    const pool = lines.filter((l) => !l.includes('\n') && l.length >= 18 && l.length <= MAX_LEN);
    // Trouble words are identifiers ([A-Za-z0-9_]), so a token set is enough.
    const tw = new Set(opts.words || []);
    const withWord = tw.size ? pool.filter((l) => (l.match(/\w+/g) || []).some((w) => tw.has(w))) : [];
    const want = opts.dir && Math.random() < FOCUS_SHARE ? opts.dir : null;
    let fallback = null;
    let good = null;
    for (let k = 0; k < 120; k++) {
      const line = withWord.length && Math.random() < 0.4 ? pick(withWord) : pick(pool);
      const r = plant(line, opts.kind || pick(PLANT_KINDS), opts.confusions);
      if (!r || r.shown === r.target) continue;
      if (r.parNoWord - r.par >= MIN_GAIN) {
        if (!want || r.dir === want) return r;
        if (!good) good = r;
        continue;
      }
      if (!fallback || r.parNoWord - r.par > fallback.parNoWord - fallback.par) fallback = r;
    }
    return good || fallback || plant('for i, num in enumerate(nums):', 'swap', []);
  }

  // The two commands and how well each has become a habit: over the last `last`
  // rounds whose fastest way used it, the share where it was used (no mouse).
  // focus: the weaker one (fewer than 5 such rounds counts as not yet learned).
  const JUMPS = [
    { dir: 'L', key: 'Ctrl ←', caps: 'Caps+Y', what: 'jump a word left (from the end of the line)' },
    { dir: 'R', key: 'Ctrl →', caps: 'Caps+P', what: 'jump a word right (after Home / Caps+U)' },
  ];
  function jumpStats(rounds, last) {
    const out = {};
    for (const j of JUMPS) {
      const R = (rounds || []).filter((r) => r.dir === j.dir).slice(-(last || 20));
      const used = R.filter((r) => !r.mouse && (j.dir === 'L' ? r.wl > 0 : r.wr > 0)).length;
      out[j.dir] = { n: R.length, used, share: R.length ? used / R.length : 0 };
    }
    const score = (d) => (out[d].n < 5 ? -1 + out[d].n / 10 : out[d].share);
    out.focus = score('R') < score('L') ? 'R' : 'L';
    return out;
  }

  // Feedback tip for a finished round: k = key counts.
  function tip(r, k) {
    if (k.mouse) return 'No mouse: Ctrl+←/→ (Caps+Y / P) jumps a word';
    if (!k.word) {
      const how = r.dir === 'R' ? 'Home (Caps+U), then Ctrl+→ (Caps+P)' : 'Ctrl+← (Caps+Y)';
      return (k.arrows ? k.arrows + ' single arrows: ' : '') + how + ' jumps a word at a time';
    }
    if (k.arrows >= 4) return k.arrows + ' single arrows after jumping: one more jump gets closer';
    if (k.keys > r.par + 3) return 'Best was ' + r.par + ': count the jumps before you press';
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
      wordShare: R.length ? R.filter((r) => r.word > 0).length / R.length : null,
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
        ...(r.dir === 'L' || r.dir === 'R' ? { dir: r.dir, wl: num(r.wl), wr: num(r.wr) } : {}),
      }))
      .sort((a, b) => a.ts - b.ts)
      .slice(-ROUNDS_KEPT);
    return out;
  }

  CTT.EDIT = { KINDS, KIND_NAMES, ROUNDS_KEPT, MIN_GAIN, JUMPS, round, plant, navPar, wordStops, tip, summary, clean, jumpStats };
})();
