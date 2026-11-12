// Per-key statistics with time decay, spaced review, focus rotation,
// mix-up (confusion) tracking, and slow-transition (pair) tracking.
(function () {
  const CTT = (window.CTT = window.CTT || {});
  const { TRAIN } = CTT.CONTENT;
  // Key order of a tracked state: the main state trains symbols (TRAIN); a sub-state
  // (Words mode) carries its own non-persisted `order` (lowercase letters).
  const ord = (state) => state.order || TRAIN;

  const DAY = 86400000;
  const HALF_LIFE_D = 10; // a sample's weight halves every 10 days
  const MAX_AGE_D = 21; // samples older than 3 weeks are dropped
  const HIST = 150; // max samples kept per key
  const ATTEMPT_HALF = 100; // an attempt also counts half after this many newer attempts
  const MIN_EFF = 10; // weighted samples needed before a key can count as learned
  // Mastery and demotion by confidence bound (see IMPROVEMENTS.md, 2026-11-11).
  const MASTER_BAR = 0.93; // mastered when we are Z_MASTER-sure accuracy is at least this
  const Z_MASTER = 1.2816; // one-sided 90%
  const DEMOTE_BAR = 0.9; // demoted when we are Z_DEMOTE-sure accuracy is below this
  const Z_DEMOTE = 0.8416; // one-sided 80%
  const PASS_DAYS = 2; // mastery must be cleared on this many different days
  const DAY_ACC = 0.95; // ...and each of those days must be this good on its own
  const DAY_MIN = 10; // attempts that day before it can count
  const REVIEW_MAX = 40; // a review still undecided at this many attempts uses point accuracy
  // Unlocking: next key when every key is good enough, or after a stall.
  const GOOD_RESET = 0.8; // a "good enough" key loses that status below this accuracy
  const STALL_LESSONS = 10; // adaptive lessons without an unlock before forcing one
  const STALL_FLOOR = 0.7; // ...only if no unlocked key is below this
  const MAX_NOT_GOOD = 3; // ...and at most this many keys are not good enough yet
  const ACC_TARGET = MASTER_BAR; // kept for the report header
  const INTERVALS = [0, 1, 3, 7, 14, 30]; // review gap in days for mastery level 1..5
  const ROTATE_AFTER = 5; // lessons on one focus without progress before rotating
  const COOLDOWN = 3; // lessons a rotated-out key rests
  // A key leaves single-key focus once it is reasonably solid (it keeps being
  // trained in the mixed phase until fully learned).
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const LETTER_ACC = 0.9; // a letter below this gets mixed into drills
  const LETTER_MIN = 8; // weighted samples before a letter can count as weak
  const LETTER_MAX = 3; // at most this many weak letters at once
  const LEARN_ACC = 0.92;
  const LEARN_SPEED = 0.7; // fraction of the target speed
  function inLearnPhase(state, st) {
    if (st.status !== 'learning' && st.status !== 'stale') return false;
    const solid = st.eff >= MIN_EFF && st.acc >= LEARN_ACC && st.wpm != null && st.wpm >= LEARN_SPEED * state.settings.targetWpm;
    return !solid;
  }

  function keyObj(state, ch) {
    return (state.keys[ch] = state.keys[ch] || { hist: [], level: 0, due: null });
  }

  // Wilson score interval for accuracy p over n (weighted) attempts.
  function wilson(p, n, z) {
    if (!n) return { lo: 0, hi: 1 };
    const d = 1 + (z * z) / n;
    const c = p + (z * z) / (2 * n);
    const r = z * Math.sqrt(Math.max(0, (p * (1 - p)) / n + (z * z) / (4 * n * n)));
    return { lo: (c - r) / d, hi: (c + r) / d };
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function prune(arr, now, cap) {
    const cut = now - MAX_AGE_D * DAY;
    let i = 0;
    while (i < arr.length && arr[i].ts < cut) i++;
    if (i) arr.splice(0, i);
    if (arr.length > cap) arr.splice(0, arr.length - cap);
  }

  function record(state, ch, ok, t, typed) {
    const now = Date.now();
    const k = keyObj(state, ch);
    k.hist.push({ ok: ok ? 1 : 0, t: ok && t != null ? Math.round(t) : null, ts: now });
    prune(k.hist, now, HIST);
    if (!ok && typed != null) {
      const c = (state.confusions[ch] = state.confusions[ch] || []);
      c.push({ c: typed, ts: now });
      prune(c, now, 50);
    }
  }

  function recordPair(state, pair, t) {
    const now = Date.now();
    const p = (state.pairs[pair] = state.pairs[pair] || []);
    p.push({ t: Math.round(t), ts: now });
    prune(p, now, 20);
  }

  function weight(ts, now) {
    const age = (now - ts) / DAY;
    return age > MAX_AGE_D ? 0 : Math.pow(0.5, age / HALF_LIFE_D);
  }

  function stats(state, ch, now) {
    now = now || Date.now();
    const k = state.keys[ch] || { hist: [], level: 0, due: null };
    let w = 0, wok = 0, wt = 0, wtn = 0, raw = 0, dn = 0, dok = 0;
    const today = dayKey(now);
    const L = k.hist.length;
    k.hist.forEach((s, i) => {
      if (dayKey(s.ts) === today) { dn++; dok += s.ok; }
      const x = weight(s.ts, now) * Math.pow(0.5, (L - 1 - i) / ATTEMPT_HALF);
      if (!x) return;
      raw++;
      w += x;
      if (s.ok) {
        wok += x;
        if (s.t) { wt += x * s.t; wtn += x; }
      }
    });
    const acc = w ? wok / w : null;
    const avg = wtn ? wt / wtn : null;
    const wpm = avg ? 12000 / avg : null; // 60000 ms / (avg ms * 5 chars)
    const target = state.settings.targetWpm;
    const lo = acc == null ? 0 : wilson(acc, w, Z_MASTER).lo;
    const hi = acc == null ? 1 : wilson(acc, w, Z_DEMOTE).hi;
    const dayAcc = dn >= DAY_MIN ? dok / dn : null;
    // Passes today's mastery check (mastery also needs PASS_DAYS different days).
    const passes = w >= MIN_EFF && lo >= MASTER_BAR && wpm != null && wpm >= target;
    const sp = wpm ? Math.min(1, wpm / target) : 0;
    const ac = Math.min(1, lo / MASTER_BAR);
    const mastered = (k.level || 0) >= 1;
    const conf = mastered ? 1 : Math.min(0.99, sp * ac * Math.min(1, w / MIN_EFF));
    const recentDays = (k.passDays || []).filter((d) => d.ts > now - MAX_AGE_D * DAY);
    const nowGood = w >= MIN_EFF && acc >= LEARN_ACC && wpm != null && wpm >= LEARN_SPEED * target;
    const lostGood = w >= MIN_EFF && acc < GOOD_RESET;

    const locked = ord(state).indexOf(ch) >= state.unlocked;
    let status = 'learning';
    if (locked) status = 'locked';
    else if (k.level >= 1 && k.due != null && k.due <= now) status = 'review due';
    else if (k.level >= 1) status = 'mastered';
    else if (raw > 0 && w < 3) status = 'stale';
    return {
      n: raw, eff: w, acc, wpm, conf, lo, hi, dayAcc, passes, level: k.level || 0, due: k.due, status,
      passDays: recentDays.length, good: mastered || nowGood || (!!k.good && !lostGood),
    };
  }

  function unlockedList(state) {
    return ord(state).slice(0, state.unlocked);
  }

  function needsWork(st) {
    return st.status === 'learning' || st.status === 'review due' || st.status === 'stale';
  }

  // Weakest key that needs work, skipping keys resting after a rotation.
  function focusKey(state) {
    const now = Date.now();
    // Single-key style: stay on the current focus key until it leaves the learn phase.
    const run = state.focusRun;
    if (state.settings.focusStyle !== 'mixed' && run && ord(state).indexOf(run.ch) < state.unlocked && !(state.cooldown[run.ch] > 0)) {
      const st = stats(state, run.ch, now);
      if (inLearnPhase(state, st)) return run.ch;
    }
    const cands = unlockedList(state).map((ch) => ({ ch, st: stats(state, ch, now) }));
    const pickMin = (list) => list.reduce((a, b) => (b.st.conf < a.st.conf ? b : a), list[0]);
    const work = cands.filter((c) => needsWork(c.st));
    const rested = work.filter((c) => !(state.cooldown[c.ch] > 0));
    const pool = rested.length ? rested : work.length ? work : cands;
    return pool.length ? pickMin(pool).ch : null;
  }

  // Most frequent mix-up for a key in the decay window: { typed, count }.
  function topConfusions(state, ch, limit) {
    const now = Date.now();
    const counts = {};
    for (const e of state.confusions[ch] || []) {
      if (!weight(e.ts, now)) continue;
      counts[e.c] = (counts[e.c] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([typed, count]) => ({ typed, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit || 3);
  }

  // Letters below LETTER_ACC with enough samples, weakest first.
  function weakLetters(state, now) {
    now = now || Date.now();
    return LETTERS.map((ch) => ({ ch, st: stats(state, ch, now) }))
      .filter((x) => x.st.eff >= LETTER_MIN && x.st.acc != null && x.st.acc < LETTER_ACC)
      .sort((a, b) => a.st.acc - b.st.acc)
      .slice(0, LETTER_MAX)
      .map((x) => x.ch);
  }

  // Lesson plan for Adaptive mode: focus, secondary keys, and a contrast partner.
  function plan(state) {
    const now = Date.now();
    const focus = focusKey(state);
    const unl = unlockedList(state);
    const secondary = unl.filter((ch) => ch !== focus && needsWork(stats(state, ch, now)));
    const top = focus ? topConfusions(state, focus, 1)[0] : null;
    // The mix-up partner is drilled even if it is not unlocked yet (e.g. - for _).
    const partner = top && ord(state).includes(top.typed) ? top.typed : null;
    if (partner && !secondary.includes(partner)) secondary.push(partner);
    // keybr-style "learn" phase: while the focus key is new or weak, lessons are
    // almost entirely that one key so the finger movement becomes automatic.
    let phase = 'mix';
    if (focus && state.settings.focusStyle !== 'mixed') {
      if (inLearnPhase(state, stats(state, focus, now))) phase = 'learn';
    }
    // Weak-letter mixing belongs to the main (symbol) state only.
    return {
      focus, secondary, partner, phase,
      letters: state.order ? [] : weakLetters(state, now),
      // Adaptive must never show a locked symbol (e.g. _ in max_len before _ unlocks).
      words: drillWords(state, now, new Set(partner ? unl.concat(partner) : unl)),
    };
  }

  // Called after every lesson. perKey: ch -> { n, ok, tSum, tN }. Returns event strings.
  function afterLesson(state, perKey, mode, lessonFocus) {
    const now = Date.now();
    const events = [];
    const target = state.settings.targetWpm;
    for (const ch of unlockedList(state)) {
      const k = keyObj(state, ch);
      const st = stats(state, ch, now);
      const L = perKey[ch];
      const due = k.level >= 1 && k.due != null && k.due <= now;
      if (due && L && L.n) {
        // Review attempts accumulate across lessons until they decide pass or fail.
        const r = (k.rev = k.rev || { n: 0, ok: 0, tSum: 0, tN: 0 });
        r.n += L.n; r.ok += L.ok; r.tSum += L.tSum; r.tN += L.tN;
      }
      if (due && k.rev && k.rev.n >= 6) {
        const r = k.rev;
        const racc = r.ok / r.n;
        const lwpm = r.tN ? 12000 / (r.tSum / r.tN) : 0;
        const fast = lwpm >= target * 0.9;
        let verdict = null;
        if (wilson(racc, r.n, Z_MASTER).lo >= MASTER_BAR && fast) verdict = 'pass';
        else if (wilson(racc, r.n, Z_DEMOTE).hi < DEMOTE_BAR) verdict = 'fail';
        else if (r.n >= REVIEW_MAX) verdict = racc >= MASTER_BAR && fast ? 'pass' : 'fail';
        if (verdict === 'pass') {
          k.rev = null;
          k.level = Math.min(INTERVALS.length - 1, k.level + 1);
          k.due = now + INTERVALS[k.level] * DAY;
          events.push('Review passed: ' + ch + ' (next in ' + INTERVALS[k.level] + 'd)');
        } else if (verdict === 'fail') {
          demote(k);
          events.push('Review missed: ' + ch + ' is back to learning');
        }
      } else if (k.level >= 1 && !due && st.eff >= MIN_EFF && st.hi < DEMOTE_BAR) {
        demote(k);
        events.push(ch + ' has dropped below 90%, back to learning');
      } else if (k.level === 0 && st.passes && st.dayAcc != null && st.dayAcc >= DAY_ACC) {
        const today = dayKey(now);
        const days = (k.passDays = (k.passDays || []).filter((d) => d.ts > now - MAX_AGE_D * DAY));
        if (!days.some((d) => d.day === today)) {
          days.push({ day: today, ts: now });
          if (days.length >= PASS_DAYS) {
            k.level = 1;
            k.due = now + INTERVALS[1] * DAY;
            k.passDays = [];
            events.push('Mastered: ' + ch + ' (review tomorrow)');
          } else {
            events.push(ch + ' looks solid today: confirm it on another day to master it');
          }
        }
      }
      // "Good enough" for unlocking: reached once, lost if accuracy falls a lot.
      if (st.eff >= MIN_EFF && st.acc >= LEARN_ACC && st.wpm != null && st.wpm >= LEARN_SPEED * target) k.good = true;
      else if (st.eff >= MIN_EFF && st.acc < GOOD_RESET) k.good = false;
    }

    if (mode === 'adaptive') {
      state.sinceUnlock = (state.sinceUnlock || 0) + 1;
      for (const ch of Object.keys(state.cooldown)) {
        if (--state.cooldown[ch] <= 0) delete state.cooldown[ch];
      }
      const f = lessonFocus || focusKey(state);
      if (f) {
        const conf = stats(state, f, now).conf;
        if (!state.focusRun || state.focusRun.ch !== f) {
          state.focusRun = { ch: f, lessons: 1, startConf: conf };
        } else if (++state.focusRun.lessons >= ROTATE_AFTER) {
          if (conf - state.focusRun.startConf < 0.05) {
            state.cooldown[f] = COOLDOWN;
            state.focusRun = null;
            events.push('Rotating off ' + f + ' for ' + COOLDOWN + ' lessons, it will come back');
          } else {
            // still improving: keep going, measure the next stretch from here
            state.focusRun = { ch: f, lessons: 0, startConf: conf };
          }
        }
      }
    }

    const u = unlockStatus(state, now);
    if (u.ready) {
      state.unlocked++;
      state.sinceUnlock = 0;
      events.push('New ' + (state.order ? 'letter' : 'symbol') + ' unlocked: ' + ord(state)[state.unlocked - 1] + (u.allGood ? '' : ' (keep drilling the weak ones)'));
    }
    return events;
  }

  function demote(k) {
    k.level = 0;
    k.due = null;
    k.rev = null;
    k.passDays = [];
  }

  // Whether the next symbol unlocks now, and why not if it does not.
  function unlockStatus(state, now) {
    now = now || Date.now();
    if (state.unlocked >= ord(state).length) return { ready: false, done: true, notGood: [], low: [], since: 0, left: 0 };
    const sts = unlockedList(state).map((ch) => ({ ch, st: stats(state, ch, now) }));
    const notGood = sts.filter((x) => !x.st.good).map((x) => x.ch);
    const low = sts.filter((x) => x.st.eff >= MIN_EFF && x.st.acc < STALL_FLOOR).map((x) => x.ch);
    const since = state.sinceUnlock || 0;
    const allGood = notGood.length === 0;
    const stall = since >= STALL_LESSONS && !low.length && notGood.length <= MAX_NOT_GOOD;
    return { ready: allGood || stall, allGood, notGood, low, since, left: Math.max(0, STALL_LESSONS - since) };
  }

  function forceUnlock(state) {
    if (state.unlocked >= ord(state).length) return null;
    state.unlocked++;
    state.sinceUnlock = 0;
    return ord(state)[state.unlocked - 1];
  }

  // 0 (strong) .. 1 (weak); locked keys count as medium.
  function weakness(state, ch) {
    if (ord(state).indexOf(ch) >= state.unlocked) return 0.5;
    const st = stats(state, ch);
    if (st.status === 'review due' || st.status === 'stale') return Math.max(0.6, 1 - st.conf);
    return 1 - st.conf;
  }

  function slowPairs(state, limit) {
    const now = Date.now();
    return Object.entries(state.pairs)
      .map(([pair, arr]) => {
        const ts = arr.filter((s) => weight(s.ts, now)).map((s) => s.t).sort((a, b) => a - b);
        return { pair, n: ts.length, median: ts.length ? ts[Math.floor(ts.length / 2)] : null };
      })
      .filter((p) => p.n >= 5)
      .sort((a, b) => b.median - a.median)
      .slice(0, limit || 8);
  }

  function allConfusions(state, limit) {
    const out = [];
    for (const ch of Object.keys(state.confusions)) {
      for (const c of topConfusions(state, ch, 5)) out.push({ expected: ch, typed: c.typed, count: c.count });
    }
    return out.sort((a, b) => b.count - a.count).slice(0, limit || 10);
  }

  // ---------- words in code (main state only) ----------
  // Every identifier or keyword typed in Adaptive, Lines and My code: was it typed
  // without a mistake, and how fast (ms per character from its first to its last
  // letter). Case is kept: True and true are different words.
  // A sample is a compact pair [ms, ts]: ms > 0 clean and timed, -1 clean but
  // untimed, 0 a miss (the save stays small: about 22 bytes per sample).
  const WORD_HIST = 10; // samples kept per word
  const WORD_CAP = 200; // words kept; the least recently typed go first
  const WORD_MIN = 3; // samples in the window before a word can rank
  const WORD_DRILL = 5; // trouble words mixed into drills at once
  const WORD_BAR = 0.2; // trouble score from which a word is drilled
  const WORD_MAXLEN = 60; // longer names are not recorded
  const WORD_RE = /[A-Za-z_][A-Za-z0-9_]*/g;
  const isWordName = (w) => w.length >= 2 && w.length <= WORD_MAXLEN && /[A-Za-z]/.test(w) && w !== '__proto__';

  // Words in a lesson text: [{ word, start, end }].
  function wordSpans(text) {
    const out = [];
    let m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text))) {
      // Skip the tail of a number literal (e5 in 1e5, x1f in 0x1f).
      if (m.index > 0 && /[0-9]/.test(text[m.index - 1])) continue;
      if (isWordName(m[0])) out.push({ word: m[0], start: m.index, end: m.index + m[0].length });
    }
    return out;
  }

  function pruneSamples(h, now) {
    const cut = now - MAX_AGE_D * DAY;
    let i = 0;
    while (i < h.length && h[i][1] < cut) i++;
    if (i) h.splice(0, i);
    if (h.length > WORD_HIST) h.splice(0, h.length - WORD_HIST);
  }

  function recordWord(state, word, ok, ms) {
    if (!isWordName(word)) return;
    const now = Date.now();
    const T = (state.tokens = state.tokens || {});
    const h = (T[word] = Array.isArray(T[word]) ? T[word] : []);
    h.push([!ok ? 0 : ms != null && isFinite(ms) && ms > 0 ? Math.max(1, Math.round(ms)) : -1, now]);
    pruneSamples(h, now);
  }

  // After a lesson: drop expired samples and keep at most WORD_CAP words.
  function pruneWords(state, now) {
    now = now || Date.now();
    const T = state.tokens || {};
    const last = [];
    for (const w of Object.keys(T)) {
      if (!Array.isArray(T[w])) { delete T[w]; continue; }
      pruneSamples(T[w], now);
      if (!T[w].length) delete T[w];
      else last.push([w, T[w][T[w].length - 1][1]]);
    }
    if (last.length > WORD_CAP) {
      last.sort((a, b) => a[1] - b[1]);
      for (const [w] of last.slice(0, last.length - WORD_CAP)) delete T[w];
    }
  }

  // { word, n, miss (weighted miss rate), wpm (median clean speed), score }.
  // score = miss + half the shortfall from the target speed; 0 is a clean, fast word.
  function wordStats(state, word, now) {
    now = now || Date.now();
    const T = state.tokens || {};
    const raw = Object.prototype.hasOwnProperty.call(T, word) && Array.isArray(T[word]) ? T[word] : [];
    const h = raw.filter((s) => Array.isArray(s) && weight(s[1], now));
    let w = 0, wmiss = 0;
    const ms = [];
    for (const s of h) {
      const x = weight(s[1], now);
      w += x;
      if (s[0] === 0) wmiss += x;
      else if (s[0] > 0) ms.push(s[0]);
    }
    ms.sort((a, b) => a - b);
    const med = ms.length ? ms[Math.floor(ms.length / 2)] : null;
    const wpm = med ? 12000 / med : null;
    const miss = w ? wmiss / w : 0;
    const target = state.settings.targetWpm;
    const slow = wpm ? Math.max(0, 1 - wpm / target) : 0;
    return { word, n: h.length, miss, wpm, score: miss + 0.5 * slow };
  }

  // Words with enough samples, worst first (score > 0 only).
  function troubleWords(state, limit, now) {
    now = now || Date.now();
    return Object.keys(state.tokens || {})
      .map((w) => wordStats(state, w, now))
      .filter((x) => x.n >= WORD_MIN && x.score > 0)
      .sort((a, b) => b.score - a.score || b.n - a.n)
      .slice(0, limit || 8);
  }

  // Trouble words that drills mix in (main state only). With allowed (a Set of
  // usable symbols), words containing any other trained symbol are skipped.
  function drillWords(state, now, allowed) {
    if (state.order) return [];
    const okWord = (w) => !allowed || [...w].every((c) => !TRAIN.includes(c) || allowed.has(c));
    return troubleWords(state, 50, now).filter((x) => x.score >= WORD_BAR && okWord(x.word)).slice(0, WORD_DRILL).map((x) => x.word);
  }

  // Plain-language unlock status, e.g. "= in 4 adaptive lessons".
  CTT.unlockText = function (u, next, noun, lessonNoun) {
    const ln = lessonNoun || 'adaptive lesson';
    if (u.done) return 'all ' + (noun || 'symbol') + 's unlocked';
    if (u.allGood) return next + ' unlocks after the next lesson';
    const nm = (a) => a.join(' ');
    if (u.low.length) return next + ' waits until ' + nm(u.low) + ' ' + (u.low.length > 1 ? 'are' : 'is') + ' back above ' + Math.round(STALL_FLOOR * 100) + '%';
    if (u.notGood.length > MAX_NOT_GOOD) return next + ' waits until at most ' + MAX_NOT_GOOD + ' keys are still weak (now: ' + nm(u.notGood) + ')';
    return next + ' in ' + u.left + ' ' + ln + (u.left === 1 ? '' : 's') + ', or sooner once ' + nm(u.notGood) + (u.notGood.length === 1 ? ' reaches ' : ' reach ') + Math.round(LEARN_ACC * 100) + '%';
  };

  CTT.ENGINE = {
    record, recordPair, stats, unlockedList, focusKey, plan, afterLesson, forceUnlock, weakness, weakLetters, LETTERS,
    unlockStatus, wilson,
    topConfusions, allConfusions, slowPairs,
    wordSpans, recordWord, pruneWords, wordStats, troubleWords, drillWords,
    CONST: {
      WORD_HIST, WORD_CAP, WORD_MIN, WORD_DRILL, WORD_BAR, WORD_MAXLEN,
      DAY, HALF_LIFE_D, MAX_AGE_D, ACC_TARGET, INTERVALS, MIN_EFF, LETTER_ACC, LETTER_MIN, HIST, ATTEMPT_HALF,
      MASTER_BAR, Z_MASTER, DEMOTE_BAR, Z_DEMOTE, PASS_DAYS, DAY_ACC, STALL_LESSONS, STALL_FLOOR, MAX_NOT_GOOD,
    },
  };
})();
