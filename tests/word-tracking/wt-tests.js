// Per-word tracking tests (WT-*). Loaded after sidecar-harness.js; uses its runner.
(function () {
  const { T0, DAY, wait } = T;
  const TP = T.TP;
  const C = window.CTT;
  const E = () => C.ENGINE;
  const R = T.TESTS;
  const ok = T.result;
  const realPerf = TP.real.perf;
  window.WT = {};

  function fixture(o) {
    const s = C.STORE.defaults();
    s.savedAt = T0 - 1000;
    s.mode = 'adaptive';
    return Object.assign(s, o || {});
  }
  const seed = (o, cfg) => async () => {
    localStorage.setItem('ctt.v1', JSON.stringify(typeof o === 'function' ? o() : fixture(o)));
    return T.RELOAD(Object.assign({ freeze: T0 }, cfg || {}));
  };
  function lessonChars() {
    const spans = [...document.querySelectorAll('#textbox > span')];
    if (!spans.length || spans[0].classList.contains('muted')) throw new Error('no lesson');
    return spans.map((s) => ({ ch: s.classList.contains('nl') ? '\n' : s.textContent, auto: s.classList.contains('auto') }));
  }
  // Type the current lesson with a controlled clock. dt(i) = ms before key i.
  // err(i, ch) -> wrong char or null. how: 'stop' (wrong then right), 'skip' (wrong only),
  // 'bs' (wrong, Backspace, right).
  function typeIt({ dt = () => 150, err = () => null, how = 'stop' } = {}) {
    if (document.activeElement) document.activeElement.blur();
    const cs = lessonChars();
    const text = cs.map((c) => c.ch).join('');
    let pt = realPerf();
    performance.now = () => pt;
    try {
      for (let i = 0; i < cs.length; i++) {
        if (cs[i].auto) continue;
        const ch = cs[i].ch;
        pt += dt(i, ch);
        const w = err(i, ch);
        if (w && w !== ch) {
          T.press(w);
          if (how === 'skip') continue;
          pt += dt(i, ch);
          if (how === 'bs') { T.press('Backspace'); pt += dt(i, ch); }
        }
        T.press(ch);
      }
    } finally { performance.now = realPerf; }
    return text;
  }
  // Expected samples per word for a lesson text: badPos = set of error positions.
  function expected(text, badPos, ms) {
    const ex = Object.create(null);
    for (const sp of E().wordSpans(text)) {
      let good = true;
      for (let i = sp.start; i < sp.end; i++) if (badPos.has(i)) good = false;
      (ex[sp.word] = ex[sp.word] || []).push([good ? (ms == null ? -1 : ms) : 0, T.TP.clock]);
    }
    for (const w of Object.keys(ex)) ex[w] = ex[w].slice(-10);
    return ex;
  }
  const sortObj = (o) => JSON.stringify(Object.fromEntries(Object.keys(o || {}).sort().map((k) => [k, o[k]])));
  function cmpTokens(got, exp) {
    const diffs = [];
    const keys = new Set([...Object.keys(got || {}), ...Object.keys(exp)]);
    for (const k of keys) if (JSON.stringify((got || {})[k]) !== JSON.stringify(exp[k])) diffs.push({ k, got: (got || {})[k], exp: exp[k] });
    return diffs;
  }
  // first span of length>=3 not at text start; error at its middle char
  function pickWord(text, minLen) {
    const sps = E().wordSpans(text).filter((s) => s.end - s.start >= (minLen || 3));
    return sps[Math.floor(sps.length / 2)] || null;
  }
  WT.typeIt = typeIt; WT.expected = expected; WT.cmpTokens = cmpTokens;

  // ---------- WT-1 spans ----------
  R['WT-1'] = [async () => {
    const sp = (s) => E().wordSpans(s).map((x) => x.word);
    const cases = [
      ['def __init__(self, val=0): return True if x else None', ['def', '__init__', 'self', 'val', 'return', 'True', 'if', 'else', 'None']],
      ['a = b + c1 * x2; _ = __; _x', ['c1', 'x2', '_x']],
      ['true True TRUE', ['true', 'True', 'TRUE']],
      ['node.next.val nums[i][j] max_len', ['node', 'next', 'val', 'nums', 'max_len']],
      ['f"{name}" "hello" 10 26 -1 3.14', ['name', 'hello']],
      ['__ ___ _1 _a1 __name__', ['_a1', '__name__']],
      ['', []],
      ['obj.__proto__ x.__proto__x', ['obj', '__proto__x']],
      ['qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr', ['rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr']],
    ];
    const res = cases.map(([s, exp]) => ({ s, got: sp(s), pass: T.eq(sp(s), exp) }));
    // span offsets
    const s = 'def __init__(self, val=0): return True';
    const offs = E().wordSpans(s).every((x) => s.slice(x.start, x.end) === x.word);
    // observations: digit-led tokens
    const obs = { '9ab': sp('9ab'), '1e5': sp('x = 1e5'), '0x1f': sp('0x1f') };
    return ok(res.every((r) => r.pass) && offs, { res: res.filter((r) => !r.pass), offs, obs });
  }];

  // ---------- WT-2 perfect Adaptive lesson ----------
  R['WT-2'] = [seed({ unlocked: 26 }), async () => {
    const text = typeIt({ dt: () => 150 });
    await wait(50);
    const got = T.st().tokens;
    const diffs = cmpTokens(got, expected(text, new Set(), 150));
    return ok(!diffs.length && Object.keys(got).length > 0, { text, words: Object.keys(got).length, diffs: diffs.slice(0, 5) });
  }];

  // ---------- WT-3/4/5 mistakes ----------
  const mistake = (how, stop) => [seed({ unlocked: 26, settings: Object.assign(C.STORE.defaults().settings, { stopOnError: stop }) }), async () => {
    const t0 = T.text();
    const w = pickWord(t0);
    if (!w) return ok(false, 'no word in ' + t0);
    const k = w.start + 1;
    // also an error right after another word (outside the span) — that word must stay ok
    const other = E().wordSpans(t0).find((s) => s.end < t0.length && s.start !== w.start && s.end !== k && !/[A-Za-z0-9_]/.test(t0[s.end]) && t0[s.end] !== '\n');
    const bad = new Set([k].concat(other ? [other.end] : []));
    const text = typeIt({ dt: () => 150, err: (i, ch) => (bad.has(i) ? T.wrongFor(ch) : null), how });
    await wait(50);
    const got = T.st().tokens;
    const diffs = cmpTokens(got, expected(text, bad, 150));
    return ok(!diffs.length && text === t0, { word: w.word, outsideErrAfter: other && other.word, text, diffs: diffs.slice(0, 5) });
  }];
  R['WT-3'] = mistake('stop', true);
  R['WT-4'] = mistake('skip', false);
  R['WT-5'] = mistake('bs', false);

  // ---------- WT-6 untimed gap / ms per char ----------
  R['WT-6'] = [seed({ unlocked: 26 }), async () => {
    const t0 = T.text();
    const sps = E().wordSpans(t0).filter((s) => s.end - s.start >= 3);
    const gapW = sps[0], varW = sps[sps.length - 1];
    if (!gapW || gapW === varW) return ok(false, 'need 2 words: ' + t0);
    // gapW: 3001 ms gap inside; varW: increasing deltas (100, 200, ...) -> mean
    const dt = (i) => (i === gapW.start + 1 ? 3001 : i > varW.start && i < varW.end ? 100 * (i - varW.start) : i === varW.start ? 5000 : 150);
    typeIt({ dt });
    await wait(50);
    const tk = T.st().tokens;
    const last = (w) => tk[w].filter(() => true);
    const n = varW.end - varW.start;
    const expMs = Math.round((100 * (n - 1) * n / 2) / (n - 1));
    const gS = last(gapW.word), vS = last(varW.word);
    const r = { gap: gapW.word, gapSamples: gS, var: varW.word, varSamples: vS, expMs };
    // the gapped occurrence is the first sample of that word; the varW occurrence is its last
    return ok(gS[0][0] === -1 && vS[vS.length - 1][0] === expMs, r);
  }];

  // ---------- WT-7 Lines, WT-8 My code ----------
  R['WT-7'] = [seed({ unlocked: 26, mode: 'lines' }), async () => {
    const text = typeIt({ dt: () => 120 });
    await wait(50);
    const got = T.st().tokens;
    const diffs = cmpTokens(got, expected(text, new Set(), 120));
    return ok(T.onMode() === 'lines' && !diffs.length && Object.keys(got).length > 0, { text, diffs: diffs.slice(0, 5) });
  }];
  const MYCODE = 'class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        return True if val else None\nx = obj.__proto__\ny = constructor + toString\n';
  R['WT-8'] = [seed({ unlocked: 26, mode: 'mycode', mycode: { text: MYCODE, pos: 0 } }), async () => {
    const text1 = typeIt({ dt: () => 130 });
    await wait(50);
    const exp1 = expected(text1, new Set(), 130);
    const g1 = T.st().tokens;
    const d1 = cmpTokens(g1, exp1);
    const text2 = typeIt({ dt: () => 130 }); // second chunk (has __proto__)
    await wait(50);
    const exp2 = expected(text2, new Set(), 130);
    const merged = Object.assign(Object.create(null), JSON.parse(JSON.stringify(exp1)));
    for (const [k, v] of Object.entries(exp2)) merged[k] = (merged[k] || []).concat(v);
    const g2 = T.st().tokens;
    const d2 = cmpTokens(g2, merged);
    const protoLost = d2.some((d) => d.k === '__proto__');
    const d2real = d2.filter((d) => d.k !== '__proto__');
    // __proto__ is tracked separately as WT-17; here require everything else
    return ok(T.onMode() === 'mycode' && !d1.length && !d2real.length, { text1, text2, d1: d1.slice(0, 5), d2: d2.slice(0, 5), protoLost });
  }];

  // ---------- WT-9 Warmup, WT-10 Words: no tokens ----------
  const TOK = () => ({ alpha: [[120, T0 - DAY]], beta: [[0, T0 - DAY]] });
  R['WT-9'] = [seed({ unlocked: 26, mode: 'warmup', tokens: TOK() }), async () => {
    const before = T.st() ? T.st().tokens : null;
    const text = typeIt({ dt: () => 150 });
    await wait(50);
    const after = T.st().tokens;
    return ok(T.onMode() === 'warmup' && sortObj(after) === sortObj(TOK()) && (before === null || sortObj(before) === sortObj(TOK())), { text, after });
  }];
  R['WT-10'] = [seed({ unlocked: 26, tokens: TOK() }), async () => {
    T.mode('words'); await wait(50);
    const v1 = T.raw('ctt.v1');
    const t1 = typeIt({ dt: () => 150 });
    await wait(50);
    T.freeze(T0 + 60000);
    const t2 = typeIt({ dt: () => 150, err: (i, ch) => (i === 3 ? T.wrongFor(ch) : null) });
    await wait(50);
    const sw = T.sw();
    const focus = document.getElementById('focusLine').innerHTML;
    const r = { mode: T.onMode(), v1Same: T.raw('ctt.v1') === v1, swHasTokens: 'tokens' in sw, mainTokens: T.st().tokens, words: sw.lessons.length, focusHasWords: /words <b>/.test(focus), t1 };
    return ok(r.mode === 'words' && r.v1Same && !r.swHasTokens && sortObj(r.mainTokens) === sortObj(TOK()) && r.words >= 2 && !r.focusHasWords, r);
  }];

  // ---------- WT-5b clean backspace into a word (stop-on-error off) ----------
  R['WT-5b'] = [seed({ unlocked: 26, settings: Object.assign(C.STORE.defaults().settings, { stopOnError: false }) }), async () => {
    if (document.activeElement) document.activeElement.blur();
    const t0 = T.text();
    const w = pickWord(t0, 4);
    if (!w) return ok(false, 'no word');
    const cs = lessonChars();
    let pt = realPerf(); performance.now = () => pt;
    let did = false;
    try {
      for (let i = 0; i < cs.length; i++) {
        if (cs[i].auto) continue;
        pt += 150; T.press(cs[i].ch);
        if (i === w.start + 2 && !did) { did = true; pt += 150; T.press('Backspace'); pt += 150; T.press('Backspace'); i -= 2; }
      }
    } finally { performance.now = realPerf; }
    await wait(50);
    const tk = T.st().tokens;
    const occ = E().wordSpans(t0).filter((x) => x.word === w.word);
    const idx = occ.findIndex((x) => x.start === w.start);
    const h = tk[w.word] || [];
    const samp = h[h.length - occ.length + idx];
    const others = cmpTokens(Object.fromEntries(Object.entries(tk).filter(([k]) => k !== w.word)), Object.fromEntries(Object.entries(expected(t0, new Set(), 150)).filter(([k]) => k !== w.word)));
    return ok(samp && samp[0] > 0 && !others.length, { word: w.word, samp, others: others.slice(0, 3) });
  }];

  // ---------- WT-11 caps and pruning (engine) ----------
  R['WT-11'] = [async () => {
    const s = C.STORE.defaults();
    for (let i = 0; i < 20; i++) { T.freeze(T0 + i); E().recordWord(s, 'foo', i % 2, 100 + i); }
    const cap = E().CONST.WORD_HIST, wcap = E().CONST.WORD_CAP;
    const capOk = s.tokens.foo.length === 10 && s.tokens.foo[0][1] === T0 + 10 && s.tokens.foo[9][1] === T0 + 19;
    const missMs = s.tokens.foo.every((x) => (x[1] % 2 ? x[0] > 0 : x[0] === 0));
    T.freeze(T0);
    E().recordWord(s, 'un', true, null); E().recordWord(s, 'fr', true, 0.3); E().recordWord(s, 'nan', true, NaN);
    E().recordWord(s, 'x'.repeat(61), true, 100); E().recordWord(s, '__proto__', true, 100); E().recordWord(s, 'a', true, 100);
    const rec = { un: s.tokens.un, fr: s.tokens.fr, nan: s.tokens.nan, long: 'x'.repeat(61) in s.tokens, keys: Object.keys(s.tokens), proto: Object.getPrototypeOf(s.tokens) === Object.prototype };
    const s2 = C.STORE.defaults();
    for (let i = 0; i < 210; i++) s2.tokens['w' + String(i).padStart(3, '0')] = [[100, T0 - DAY + i * 1000]];
    s2.tokens.old = [[100, T0 - 22 * DAY]];
    s2.tokens.mixed = [[0, T0 - 25 * DAY], [90, T0]];
    s2.tokens.many = Array.from({ length: 30 }, (_, i) => [100, T0 - 100 + i]);
    s2.tokens.notArr = { x: 1 };
    E().pruneWords(s2, T0);
    const keys = Object.keys(s2.tokens);
    const dropped = Array.from({ length: 210 }, (_, i) => 'w' + String(i).padStart(3, '0')).filter((w) => !(w in s2.tokens));
    const expDropped = Array.from({ length: 12 }, (_, i) => 'w' + String(i).padStart(3, '0')); // 212 live - 200
    const s3 = C.STORE.defaults();
    s3.tokens.edge = [[1, T0 - 21 * DAY - 1], [1, T0 - 21 * DAY]];
    E().pruneWords(s3, T0);
    const r = { cap, wcap, capOk, missMs, rec, n: keys.length, old: 'old' in s2.tokens, mixed: s2.tokens.mixed, many: s2.tokens.many && s2.tokens.many.length, notArr: 'notArr' in s2.tokens, dropped, edge: s3.tokens.edge };
    T.thaw();
    return ok(cap === 10 && wcap === 200 && capOk && missMs && T.eq(rec.un, [[-1, T0]]) && T.eq(rec.fr, [[1, T0]]) && T.eq(rec.nan, [[-1, T0]]) && !rec.long &&
      !rec.keys.includes('__proto__') && !rec.keys.includes('a') && rec.proto && keys.length === 200 && !r.old && r.mixed.length === 1 && r.many === 10 && !r.notArr && T.eq(dropped, expDropped) && T.eq(r.edge, [[1, T0 - 21 * DAY]]), r);
  }];
  // caps through the app: 200 fixture words (+ bigw, expiredw), a lesson adds new ones
  R['WT-12'] = [seed(() => {
    const tk = {};
    for (let i = 0; i < 200; i++) tk['fx' + String(i).padStart(3, '0')] = [[100, T0 - 2 * DAY + i * 1000]];
    tk.expiredw = [[100, T0 - 30 * DAY]];
    tk.bigw = Array.from({ length: 40 }, (_, i) => [100, T0 - 1000 + i]);
    return fixture({ unlocked: 26, tokens: tk });
  }), async () => {
    const loaded = C.STORE.merge(T.st());
    const text = typeIt({ dt: () => 150 });
    await wait(50);
    const tk = T.st().tokens;
    const lessonWords = [...new Set(E().wordSpans(text).map((x) => x.word))];
    const fx = Array.from({ length: 200 }, (_, i) => 'fx' + String(i).padStart(3, '0'));
    const dropped = fx.filter((w) => !(w in tk));
    const expDrop = fx.slice(0, 1 + lessonWords.length);
    const r = { n: Object.keys(tk).length, loadedN: Object.keys(loaded.tokens).length, lessonWords, allLessonIn: lessonWords.every((w) => w in tk), expired: 'expiredw' in tk, big: tk.bigw && tk.bigw.length, dropped, expDrop };
    return ok(r.n === 200 && r.allLessonIn && !r.expired && r.big === 10 && T.eq(dropped, expDrop), r);
  }];

  // ---------- WT-13 ranking / drills ----------
  R['WT-13'] = [async () => {
    const s = C.STORE.defaults(); // targetWpm 30
    const now = T0;
    const S = (ok_, ms, ago) => [ok_ ? ms : 0, now - (ago || 0)];
    s.tokens = {
      fastok: [S(1, 100), S(1, 100), S(1, 100)],
      twoMiss: [S(0), S(0)],
      oneOf3: [S(0), S(1, 100), S(1, 100)],
      slow12: [S(1, 1000), S(1, 1000), S(1, 1000)],
      slow25: [S(1, 480), S(1, 480), S(1, 480)],
      edge20: [S(0), S(1, 100), S(1, 100), S(1, 100), S(1, 100)],
      wMiss: [S(0), S(1, 100, 10 * DAY), S(1, 100, 10 * DAY)],
      expired5: [S(0, 0, 25 * DAY), S(0, 0, 25 * DAY), S(0, 0, 25 * DAY), S(0, 0, 25 * DAY), S(0, 0, 25 * DAY)],
      mixExp: [S(0, 0, 25 * DAY), S(0, 0, 25 * DAY), S(0), S(0)],
      allMiss: [S(0), S(0), S(0)],
      m75: [S(0), S(0), S(0), S(1, 100)],
      m66: [S(0), S(0), S(1, 100)],
      untimed: [S(1, -1), S(1, -1), S(1, -1)],
    };
    const tw = E().troubleWords(s, 50, now);
    const names = tw.map((x) => x.word);
    const sc = Object.fromEntries(tw.map((x) => [x.word, +x.score.toFixed(4)]));
    const dw = E().drillWords(s, now);
    const expOrder = ['allMiss', 'm75', 'm66', 'wMiss', 'oneOf3', 'slow12', 'edge20', 'slow25'];
    const ws = E().wordStats(s, 'slow12', now);
    const r = { names, sc, dw, wpm: ws.wpm, expired5: E().wordStats(s, 'expired5', now).n, mixExp: E().wordStats(s, 'mixExp', now).n };
    const W = JSON.parse(JSON.stringify(s));
    Object.defineProperty(W, 'order', { value: 'etaoin' });
    r.wordsDrill = E().drillWords(W, now);
    r.defLimit = E().troubleWords(s).length;
    r.inherited = E().wordStats(s, 'toString', now).n;
    const s2 = C.STORE.defaults();
    s2.tokens = { edge20: s.tokens.edge20, slow25: s.tokens.slow25, fastok: s.tokens.fastok };
    r.dw2 = E().drillWords(s2, now);
    const s3 = C.STORE.defaults();
    s3.tokens = { max_len: s.tokens.allMiss, Blorpy: s.tokens.m75, __init__: s.tokens.m66 };
    r.dwAllowedNoUnd = E().drillWords(s3, now, new Set(['(', ')', '[', ']']));
    r.dwAllowedUnd = E().drillWords(s3, now, new Set(['(', ')', '[', ']', '_']));
    T.freeze(now);
    s3.unlocked = 4; r.plan4 = E().plan(s3).words;
    s3.unlocked = 6; r.plan6 = E().plan(s3).words;
    T.thaw();
    const pass = T.eq(names, expOrder) && T.eq(dw, ['allMiss', 'm75', 'm66', 'wMiss', 'oneOf3']) && r.wordsDrill.length === 0 &&
      Math.abs(sc.edge20 - 0.2) < 1e-9 && Math.abs(sc.wMiss - 0.5) < 1e-9 && Math.abs(sc.slow12 - 0.3) < 1e-9 &&
      Math.round(ws.wpm) === 12 && r.expired5 === 0 && r.mixExp === 2 && r.defLimit === 8 && r.inherited === 0 && T.eq(r.dw2, ['edge20']) &&
      T.eq(r.dwAllowedNoUnd, ['Blorpy']) && T.eq(r.dwAllowedUnd, ['max_len', 'Blorpy', '__init__']) && T.eq(r.plan4, ['Blorpy']) && r.plan6.length === 3;
    return ok(pass, r);
  }];

  // ---------- WT-14 adaptive mix, bare keywords, locked symbols ----------
  R['WT-14'] = [async () => {
    const TR = C.CONTENT.TRAIN;
    const FAKE = ['Zyxw', 'qwv_kk', 'Blorpy', 'mnop9', 'None', 'self', 'return'];
    const BAREW = ['None', 'self', 'return'];
    const WRAPS = ['§(', 'if §:', '(§)', '[§]', '§ = 0', '§, §', 'not §'];
    const wrapsOf = (w) => WRAPS.map((t) => t.split('§').join(w));
    const fakeOnly = FAKE.filter((w) => !BAREW.includes(w));
    const isTrouble = (s) => FAKE.some((w) => s === w || wrapsOf(w).includes(s));
    const out = {};
    const viol = [], wrappedBare = [], badWrap = [];
    let placeholders = 0;
    const realPush = Array.prototype.push;
    const runSet = (label, list, planOf, n) => {
      let pushes = 0, trouble = 0, lessonsWith = 0, v = 0, und = 0;
      for (let i = 0; i < n; i++) {
        T.seedRandom(1000 + i + list.length * 7 + label.length);
        const plan = planOf(i);
        const rec = [];
        Array.prototype.push = function (...a) { if (a.length === 1 && typeof a[0] === 'string') realPush.call(rec, a[0]); return realPush.apply(this, a); };
        let text;
        try { text = C.CONTENT.adaptive(list, plan, 70); } finally { Array.prototype.push = realPush; }
        pushes += rec.length;
        trouble += rec.filter(isTrouble).length;
        for (const p of rec) {
          for (const b of BAREW) if (p !== b && wrapsOf(b).includes(p) && wrappedBare.length < 5) wrappedBare.push(p);
          for (const w of fakeOnly) for (const wr of wrapsOf(w)) if (p === wr && [...C.CONTENT.symbolsIn(wr)].some((c) => !list.includes(c))) badWrap.push(p);
        }
        if (rec.some((p) => fakeOnly.some((w) => p.includes(w)))) lessonsWith++;
        if (/[§¤¶]/.test(text)) placeholders++;
        if (text.includes('_')) und++;
        const bad = [...C.CONTENT.symbolsIn(text)].filter((c) => !list.includes(c) && c !== plan.partner);
        if (bad.length) { v++; if (viol.length < 6) viol.push({ label, bad, text }); }
      }
      out[label] = { chunkShare: +(trouble / pushes).toFixed(3), chunksPerLesson: +(pushes / n).toFixed(1), lessonsWith, viol: v, lessonsWithUnderscore: und };
    };
    for (const unl of [6, 12, 26]) for (const phase of ['learn', 'review']) {
      const list = TR.slice(0, unl);
      runSet(unl + '-' + phase, list, (i) => ({ focus: list[i % list.length], secondary: list.slice(0, 2), partner: null, phase, letters: [], words: FAKE }), 200);
    }
    // through ENGINE.plan with _ locked (hand-edited save, unlocked = 4): trouble words with _
    const st = C.STORE.defaults();
    st.unlocked = 4;
    const bad3 = (ts) => [[0, ts], [0, ts], [0, ts]];
    st.tokens = { max_len: bad3(T0), __init__: bad3(T0), is_valid: bad3(T0), Blorpy: bad3(T0) };
    T.freeze(T0);
    const list4 = E().unlockedList(st);
    const p4 = E().plan(st);
    runSet('4-plan', list4, () => E().plan(st), 200);
    T.thaw();
    T.unseed();
    const ok26 = out['26-review'].chunkShare > 0.1 && out['26-review'].chunkShare < 0.22 && out['26-learn'].chunkShare > 0.04 && out['26-learn'].chunkShare < 0.14;
    const noViol = Object.values(out).every((o) => o.viol === 0);
    return ok(ok26 && noViol && placeholders === 0 && !wrappedBare.length && !badWrap.length && T.eq(p4.words, ['Blorpy']) && out['4-plan'].lessonsWithUnderscore === 0,
      { out, placeholders, viol, wrappedBare, badWrap: badWrap.slice(0, 5), plan4: p4.words, list4 });
  }];

  // ---------- WT-15 templates and Lines weighting ----------
  R['WT-15'] = [async () => {
    let src = await (await TP.real.fetch('js/content.js')).text();
    src = src.replace('const CTT = (window.CTT = window.CTT || {});', 'const CTT = __box;')
      .replace(/CTT\.CONTENT = \{([^}]*)\};/, 'CTT.CONTENT = {$1, TEMPLATES, LINES, WORD_WRAP, BARE, fill, MICRO, IDS, FUNCS};');
    const box = {};
    new Function('__box', 'window', src)(box, {});
    const K = box.CONTENT;
    const bad = [];
    const TRS = new Set(K.TRAIN);
    const samples = {};
    for (const t of K.TEMPLATES) for (let i = 0; i < 40; i++) { const f = K.fill(t); if (i === 0) samples[t] = f; if (/[§¤¶]/.test(f)) { bad.push({ t, f }); break; } }
    for (const l of K.LINES) if (/[§¤¶]/.test(l)) bad.push({ line: l });
    for (const w of K.WORD_WRAP) if (!w.includes('§')) bad.push({ wrap: w });
    const noSym = K.TEMPLATES.filter((t) => ![...t].some((c) => TRS.has(c)));
    const dupT = K.TEMPLATES.filter((t, i) => K.TEMPLATES.indexOf(t) !== i);
    const dupL = K.LINES.filter((t, i) => K.LINES.indexOf(t) !== i);
    const changed = ['return §[0] is not None', 'return None,', 'yield from self.dfs(§)', 'return self.dfs(§)'];
    const present = changed.filter((t) => K.TEMPLATES.includes(t));
    const removed = !K.TEMPLATES.includes('nonlocal §; § += 1');
    const N = 4000;
    const freq = (words, target) => { let n = 0; for (let i = 0; i < N; i++) if (C.CONTENT.lines(() => 0, 3, [], words).split('\n').some((l) => (l.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).includes(target))) n++; return n / N; };
    T.seedRandom(77);
    const base = freq([], 'nonlocal'), boosted = freq(['nonlocal'], 'nonlocal');
    const baseLN = freq([], 'ListNode'), boostLN = freq(['ListNode'], 'ListNode');
    const caseSens = freq(['nonLocal'], 'nonlocal');
    T.unseed();
    const r = { nT: K.TEMPLATES.length, nL: K.LINES.length, wraps: K.WORD_WRAP, bare: K.BARE.size, bad, noSym, dupT, dupL, present, removed, newSamples: changed.map((t) => samples[t]), base, boosted, baseLN, boostLN, caseSens };
    return ok(!bad.length && present.length === 4 && removed && T.eq(K.WORD_WRAP, ['§(', 'if §:', '(§)', '[§]', '§ = 0', '§, §', 'not §']) && boosted > 2.5 * base && boostLN > 1.5 * baseLN && caseSens < 2 * base, r);
  }];

  // ---------- WT-16 merge with malformed tokens ----------
  const NOW = () => TP.real.now();
  const BAD = () => {
    const t = T0;
    const parts = [
      '"good":[[120,' + t + ']]', '"nullArr":null', '"obj":{"a":1}', '"str":"abc"', '"num":5',
      '"mixed":[null,5,"a",[],[100],[100,"123"],[-5,' + t + '],[-1,' + t + '],[0,' + t + '],[1.5,' + t + '],["100",' + t + '],[100,' + (NOW() + 2 * DAY) + '],[100,' + (NOW() + 3600000) + '],{"ok":1,"ms":1,"ts":' + t + '},[100,' + (t - 5000) + ',"extra"]]',
      '"oldfmt":[{"ok":1,"ms":120,"ts":' + t + '}]',
      '"unsorted":[[1,' + t + '],[2,' + (t - 2000) + '],[3,' + (t - 1000) + ']]',
      '"fifteen":[' + Array.from({ length: 15 }, (_, i) => '[' + (i + 1) + ',' + (t - 15000 + i * 1000) + ']').join(',') + ']',
      '"bad-key":[[1,' + t + ']]', '"9abc":[[1,' + t + ']]', '"":[[1,' + t + ']]', '"a b":[[1,' + t + ']]', '"ünï":[[1,' + t + ']]', '"a":[[1,' + t + ']]', '"__":[[1,' + t + ']]',
      '"' + 'x'.repeat(61) + '":[[1,' + t + ']]', '"' + 'a'.repeat(60) + '":[[1,' + t + ']]', '"' + 'h'.repeat(200000) + '":[[1,' + t + ']]',
      '"constructor":[[100,' + t + ']]', '"toString":[[0,' + t + ']]', '"hasOwnProperty":[[1,' + t + ']]', '"__proto__":[[100,' + t + ']]',
      '"empty":[]', '"allbad":[null,[1,null]]',
    ];
    return '{"v":3,"unlocked":8,"tokens":{' + parts.join(',') + '}}';
  };
  R['WT-16'] = [async () => {
    const r = {};
    const shapes = [null, [], 'x', 5, true, {}, undefined];
    r.shapes = shapes.map((t) => { try { return JSON.stringify(C.STORE.merge({ tokens: t }).tokens); } catch (e) { return 'THROW ' + e.message; } });
    let m;
    try { m = C.STORE.merge(JSON.parse(BAD())); } catch (e) { return ok(false, 'throw ' + e.stack); }
    const tk = m.tokens;
    r.keys = Object.keys(tk).map((k) => (k.length > 20 ? k.slice(0, 5) + '..' + k.length : k)).sort();
    r.mixed = tk.mixed;
    r.unsorted = tk.unsorted;
    r.fifteen = tk.fifteen && tk.fifteen.map((x) => x[0]);
    r.proto = Object.getPrototypeOf(tk) === Object.prototype;
    r.noTokens = JSON.stringify(C.STORE.merge({ v: 3 }).tokens);
    r.oldSave = JSON.stringify(C.STORE.merge(T.fsyn()).tokens);
    r.legacy = JSON.stringify(C.STORE.merge(T.FLEGACY()).tokens);
    const big = {};
    for (let i = 0; i < 250; i++) big['w' + i] = [[100, T0 - i * 1000]];
    const mb = C.STORE.merge({ tokens: big }).tokens;
    r.bigN = Object.keys(mb).length; r.bigOldestKept = Object.keys(mb).includes('w199') && !Object.keys(mb).includes('w200');
    const expKeys = ['aaaaa..60', 'constructor', 'fifteen', 'good', 'hasOwnProperty', 'mixed', 'toString', 'unsorted'];
    const expMixed = [[100, T0 - 5000], [-1, T0], [0, T0], [1.5, T0], [100, NOW() + 3600000]];
    try { r.tw = E().troubleWords(m, 10, T0).map((x) => x.word); r.rep = /Trouble words in code/.test(C.REPORT.build(m)); } catch (e) { r.rankThrow = e.message; }
    const mixedOk = r.mixed && r.mixed.length === 5 && T.eq(r.mixed.slice(0, 4), expMixed.slice(0, 4)) && r.mixed[4][0] === 100 && Math.abs(r.mixed[4][1] - expMixed[4][1]) < 60000;
    const pass = r.shapes.every((x) => x === '{}') && T.eq(r.keys, expKeys) && mixedOk && T.eq(r.unsorted, [[2, T0 - 2000], [3, T0 - 1000], [1, T0]]) &&
      T.eq(r.fifteen, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) && r.proto && r.noTokens === '{}' && r.oldSave === '{}' && r.legacy === '{}' && r.bigN === 200 && r.bigOldestKept && !r.rankThrow && r.rep;
    return ok(pass, r);
  }];
  // ---------- WT-17 __proto__ word ----------
  R['WT-17'] = [async () => {
    const s = C.STORE.defaults();
    let err = null;
    try { E().recordWord(s, '__proto__', true, 100); E().recordWord(s, 'map', true, 100); E().pruneWords(s); } catch (e) { err = e.message; }
    const m = C.STORE.merge(JSON.parse('{"tokens":{"__proto__":[[100,' + T0 + ']],"ok_w":[[100,' + T0 + ']]}}'));
    const r = { err, recordedKeys: Object.keys(s.tokens), protoChanged: Object.getPrototypeOf(s.tokens) !== Object.prototype, mergeProtoChanged: Object.getPrototypeOf(m.tokens) !== Object.prototype, mergeJson: JSON.stringify(m.tokens), spans: E().wordSpans('a.__proto__ = b').map((x) => x.word) };
    return ok(!err && !r.protoChanged && !r.mergeProtoChanged && T.eq(r.recordedKeys, ['map']) && !/__proto__/.test(r.mergeJson) && !r.spans.includes('__proto__'), r);
  }];

  // ---------- WT-18 boot with malformed save ----------
  R['WT-18'] = [async () => {
    const b = BAD();
    const raw = JSON.stringify(Object.assign(fixture({ unlocked: 26 }), { tokens: 'PLACEHOLDER' })).replace('"tokens":"PLACEHOLDER"', '"tokens":' + b.slice(b.indexOf('"tokens":') + 9, -1));
    JSON.parse(raw);
    localStorage.setItem('ctt.v1', raw);
    return T.RELOAD({ freeze: T0 });
  }, async () => {
    const r = { mode: T.onMode(), text: T.text().length };
    document.getElementById('statsBtn').click(); await wait(60);
    r.wordList = document.getElementById('wordList').innerText;
    document.getElementById('statsBtn').click(); await wait(30);
    typeIt({ dt: () => 150 });
    await wait(50);
    const tk = T.st().tokens;
    r.savedKeys = Object.keys(tk).filter((k) => k.length < 20).sort();
    r.hasHuge = Object.keys(tk).some((k) => k.length > 60);
    r.raw = T.raw('ctt.v1').length;
    return ok(r.mode === 'adaptive' && r.text > 0 && !r.hasHuge && r.raw < 100000 && 'good' in tk && !('oldfmt' in tk), r);
  }];

  // ---------- WT-19 old save loads; export -> import round trip ----------
  R['WT-19'] = [async () => {
    const old = T.fsyn(); delete old.tokens;
    localStorage.setItem('ctt.v1', JSON.stringify(old));
    return T.RELOAD({ freeze: T0 });
  }, async (ctx) => {
    ctx.loaded = JSON.stringify(T.st().tokens);
    T.freeze(T0 + 1000);
    typeIt({ dt: () => 150 });
    await wait(50);
    const tk = T.st().tokens;
    await T.openSettings(); document.getElementById('sExport').click(); await wait(150); await T.closeSettings();
    const d = TP.downloads[0];
    ctx.exp = d.text; ctx.tk = JSON.stringify(tk); ctx.n = Object.keys(tk).length;
    localStorage.clear();
    return T.RELOAD({ freeze: T0 + 5000 });
  }, async (ctx) => {
    const r0 = { loaded: ctx.loaded, fresh: JSON.stringify(T.st() ? T.st().tokens : null), words: ctx.n };
    await T.openSettings();
    await T.load(ctx.exp, 'code-typing-trainer-backup-x.json');
    await wait(100);
    await T.closeSettings();
    r0.after = !!T.st() && JSON.stringify(T.st().tokens) === ctx.tk;
    r0.exportHasTokens = Object.keys(JSON.parse(ctx.exp).tokens || {}).length;
    return ok(r0.after && ctx.n > 0 && r0.exportHasTokens === ctx.n, r0);
  }];

  // ---------- WT-20 stats, report, focus line ----------
  R['WT-20'] = [seed({ unlocked: 26 }), async (ctx) => {
    const r = {};
    document.getElementById('statsBtn').click(); await wait(60);
    r.emptyText = document.getElementById('wordList').innerText.trim();
    document.getElementById('statsBtn').click(); await wait(30);
    r.reportEmpty = /## Trouble words in code[^\n]*\n\nNot enough data yet\./.test(C.REPORT.build(C.STORE.merge(T.st() || {})));
    r.focusEmpty = document.getElementById('focusLine').innerHTML;
    ctx.r = r;
    localStorage.setItem('ctt.v1', JSON.stringify(fixture({ unlocked: 26, tokens: { fast: [[100, T0 - 1000], [100, T0 - 1000], [100, T0 - 1000]] } })));
    return T.RELOAD({ freeze: T0 });
  }, async (ctx) => {
    document.getElementById('statsBtn').click(); await wait(60);
    ctx.r.cleanText = document.getElementById('wordList').innerText.trim();
    document.getElementById('statsBtn').click(); await wait(30);
    const S = (o, ms) => [o ? ms : 0, T0 - 1000];
    localStorage.setItem('ctt.v1', JSON.stringify(fixture({ unlocked: 26, tokens: {
      allMiss: [S(0), S(0), S(0)], m66: [S(0), S(0), S(1, 100)], oneOf3: [S(0), S(1, 100), S(1, 100)],
      slow12: [S(1, 1000), S(1, 1000), S(1, 1000)], slow25: [S(1, 480), S(1, 480), S(1, 480)], fast: [S(1, 100), S(1, 100), S(1, 100)],
      'a<b': [S(0), S(0), S(0)],
    } })));
    return T.RELOAD({ freeze: T0 });
  }, async (ctx) => {
    const r = ctx.r;
    r.focus = document.getElementById('focusLine').innerHTML;
    document.getElementById('statsBtn').click(); await wait(60);
    r.list = [...document.querySelectorAll('#wordList li')].map((li) => li.textContent);
    r.letterBlockVisible = !document.getElementById('letterBlock').hidden;
    const sw = document.getElementById('statsWords');
    if (sw) { sw.click(); await wait(40); r.wordsStatsHidden = document.getElementById('letterBlock').hidden; document.getElementById('statsSym').click(); await wait(30); }
    document.getElementById('statsBtn').click(); await wait(30);
    const rep = C.REPORT.build(C.STORE.merge(T.st()));
    const sec = rep.slice(rep.indexOf('## Trouble words in code'), rep.indexOf('## Top mix-ups'));
    r.reportSection = sec;
    T.mode('lines'); await wait(30); r.linesFocus = document.getElementById('focusLine').innerHTML;
    T.mode('adaptive'); await wait(30);
    const pass = /^Needs 3\+ samples per word\.$/.test(r.emptyText) && /^No trouble words/.test(r.cleanText) && r.reportEmpty && !/words <b>/.test(r.focusEmpty) &&
      /words <b>allMiss m66 oneOf3<\/b>/.test(r.focus) && r.list.length === 5 && /^allMiss\s+0%/.test(r.list[0]) && /← in drills/.test(r.list[0]) &&
      !/← in drills/.test(r.list[4]) && r.letterBlockVisible && r.wordsStatsHidden === true &&
      /\| `allMiss` \| 3 \| 0\.0% \|/.test(sec) && /\| `slow25` \|.*\| – \|$/m.test(sec);
    return ok(pass, r);
  }];
  // ---------- WT-21 trouble word mixed in by the app ----------
  R['WT-21'] = [seed(() => fixture({ unlocked: 26, tokens: { Blorpy: [[0, T0 - 1000], [0, T0 - 1000], [0, T0 - 1000]] } })), async () => {
    let n = 0, withW = 0;
    for (let i = 0; i < 40; i++) { T.esc(); await wait(5); n++; if (/\bBlorpy\b/.test(T.text())) withW++; }
    T.mode('lines'); await wait(20);
    const lf = document.getElementById('focusLine').innerHTML;
    T.mode('adaptive'); await wait(20);
    const af = document.getElementById('focusLine').innerHTML;
    return ok(withW > 5 && /words <b>Blorpy<\/b>/.test(af), { n, withW, af, linesFocus: lf });
  }];

  // ---------- WT-22 trouble-word share re-measure (O-1 fix) ----------
  R['WT-22'] = [async () => {
    const TR = C.CONTENT.TRAIN;
    const FAKE = ['Zyxw', 'qwv_kk', 'Blorpy', 'mnop9'];
    const WRAPS = ['§(', 'if §:', '(§)', '[§]', '§ = 0', '§, §', 'not §'];
    const isTrouble = (s) => FAKE.some((w) => s === w || WRAPS.some((t) => t.split('§').join(w) === s));
    const realPush = Array.prototype.push;
    const out = {};
    for (const unl of [6, 12, 26]) for (const phase of ['learn', 'review']) {
      const list = TR.slice(0, unl);
      let pushes = 0, trouble = 0, viol = 0, ph = 0;
      for (let i = 0; i < 200; i++) {
        T.seedRandom(9000 + i + unl * 13 + (phase === 'learn' ? 1 : 0));
        const plan = { focus: list[i % list.length], secondary: list.slice(0, 2), partner: null, phase, letters: [], words: FAKE };
        const rec = [];
        Array.prototype.push = function (...a) { if (a.length === 1 && typeof a[0] === 'string') realPush.call(rec, a[0]); return realPush.apply(this, a); };
        let text;
        try { text = C.CONTENT.adaptive(list, plan, 70); } finally { Array.prototype.push = realPush; }
        pushes += rec.length; trouble += rec.filter(isTrouble).length;
        if ([...C.CONTENT.symbolsIn(text)].some((c) => !list.includes(c))) viol++;
        if (/[§¤¶]/.test(text)) ph++;
      }
      out[unl + '-' + phase] = { share: +(trouble / pushes).toFixed(3), chunksPerLesson: +(pushes / 200).toFixed(1), viol, placeholders: ph };
    }
    T.unseed();
    const pass = Object.entries(out).every(([k, o]) => o.viol === 0 && o.placeholders === 0 && o.share <= (k.endsWith('review') ? 0.17 : 0.10) && o.share > 0.03);
    return ok(pass, out);
  }];

  // ---------- WT-23 digit-led literals (O-2 fix) ----------
  R['WT-23'] = [async () => {
    const sp = (s) => E().wordSpans(s).map((x) => x.word);
    const cases = [['x = 1e5', ['x'].filter(() => false)], ['n = 0x1f', []], ['z = 2j', []], ['x1 = 10', ['x1']],
      ['abc = 1e5 + x1 + 0xff + val2', ['abc', 'x1', 'val2']], ['nums[0]', ['nums']], ['a1b2 3c4d', ['a1b2']]];
    const res = cases.map(([s, exp]) => ({ s, got: sp(s), pass: T.eq(sp(s), exp) }));
    const s = 'abc = 1e5 + x1';
    const offs = E().wordSpans(s).every((x) => s.slice(x.start, x.end) === x.word);
    return ok(res.every((r) => r.pass) && offs, { res, offs });
  }];
})();
