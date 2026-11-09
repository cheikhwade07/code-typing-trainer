// Per-key statistics with time decay, spaced review, focus rotation,
// mix-up (confusion) tracking, and slow-transition (pair) tracking.
(function () {
  const CTT = (window.CTT = window.CTT || {});
  const { TRAIN } = CTT.CONTENT;

  const DAY = 86400000;
  const HALF_LIFE_D = 10; // a sample's weight halves every 10 days
  const MAX_AGE_D = 21; // samples older than 3 weeks are dropped
  const HIST = 60; // max samples kept per key
  const MIN_EFF = 10; // weighted samples needed before a key can count as learned
  const ACC_TARGET = 0.96;
  const INTERVALS = [0, 1, 3, 7, 14, 30]; // review gap in days for mastery level 1..5
  const ROTATE_AFTER = 5; // lessons on one focus without progress before rotating
  const COOLDOWN = 3; // lessons a rotated-out key rests
  // A key leaves single-key focus once it is reasonably solid (it keeps being
  // trained in the mixed phase until fully learned).
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
    let w = 0, wok = 0, wt = 0, wtn = 0, raw = 0;
    for (const s of k.hist) {
      const x = weight(s.ts, now);
      if (!x) continue;
      raw++;
      w += x;
      if (s.ok) {
        wok += x;
        if (s.t) { wt += x * s.t; wtn += x; }
      }
    }
    const acc = w ? wok / w : null;
    const avg = wtn ? wt / wtn : null;
    const wpm = avg ? 12000 / avg : null; // 60000 ms / (avg ms * 5 chars)
    const target = state.settings.targetWpm;
    const learned = w >= MIN_EFF && acc >= ACC_TARGET && wpm != null && wpm >= target;
    const sp = wpm ? Math.min(1, wpm / target) : 0;
    const ac = acc == null ? 0 : Math.min(1, acc / ACC_TARGET);
    const conf = learned ? 1 : Math.min(0.99, sp * ac * Math.min(1, w / MIN_EFF));

    const locked = TRAIN.indexOf(ch) >= state.unlocked;
    let status = 'learning';
    if (locked) status = 'locked';
    else if (k.level >= 1 && k.due != null && k.due <= now) status = 'review due';
    else if (k.level >= 1) status = 'mastered';
    else if (raw > 0 && w < 3) status = 'stale';
    return { n: raw, eff: w, acc, wpm, conf, learned, level: k.level || 0, due: k.due, status };
  }

  function unlockedList(state) {
    return TRAIN.slice(0, state.unlocked);
  }

  function needsWork(st) {
    return st.status === 'learning' || st.status === 'review due' || st.status === 'stale';
  }

  // Weakest key that needs work, skipping keys resting after a rotation.
  function focusKey(state) {
    const now = Date.now();
    // Single-key style: stay on the current focus key until it leaves the learn phase.
    const run = state.focusRun;
    if (state.settings.focusStyle !== 'mixed' && run && TRAIN.indexOf(run.ch) < state.unlocked && !(state.cooldown[run.ch] > 0)) {
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

  // Lesson plan for Adaptive mode: focus, secondary keys, and a contrast partner.
  function plan(state) {
    const now = Date.now();
    const focus = focusKey(state);
    const unl = unlockedList(state);
    const secondary = unl.filter((ch) => ch !== focus && needsWork(stats(state, ch, now)));
    const top = focus ? topConfusions(state, focus, 1)[0] : null;
    // The mix-up partner is drilled even if it is not unlocked yet (e.g. - for _).
    const partner = top && TRAIN.includes(top.typed) ? top.typed : null;
    if (partner && !secondary.includes(partner)) secondary.push(partner);
    // keybr-style "learn" phase: while the focus key is new or weak, lessons are
    // almost entirely that one key so the finger movement becomes automatic.
    let phase = 'mix';
    if (focus && state.settings.focusStyle !== 'mixed') {
      if (inLearnPhase(state, stats(state, focus, now))) phase = 'learn';
    }
    return { focus, secondary, partner, phase };
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
        // Review attempts accumulate across lessons until there are enough to judge.
        const r = (k.rev = k.rev || { n: 0, ok: 0, tSum: 0, tN: 0 });
        r.n += L.n; r.ok += L.ok; r.tSum += L.tSum; r.tN += L.tN;
      }
      if (due && k.rev && k.rev.n >= 6) {
        const r = k.rev;
        k.rev = null;
        const lacc = r.ok / r.n;
        const lwpm = r.tN ? 12000 / (r.tSum / r.tN) : 0;
        if (lacc >= ACC_TARGET && lwpm >= target * 0.9) {
          k.level = Math.min(INTERVALS.length - 1, k.level + 1);
          k.due = now + INTERVALS[k.level] * DAY;
          events.push('Review passed: ' + ch + ' (next in ' + INTERVALS[k.level] + 'd)');
        } else {
          k.level = 0;
          k.due = null;
          events.push('Review missed: ' + ch + ' is back to learning');
        }
      } else if (k.level >= 1 && st.eff >= MIN_EFF && st.acc < 0.9) {
        k.level = 0;
        k.due = null;
        k.rev = null;
        events.push(ch + ' slipped below 90%, back to learning');
      } else if (k.level === 0 && st.learned) {
        k.level = 1;
        k.due = now + INTERVALS[1] * DAY;
        events.push('Mastered: ' + ch + ' (review tomorrow)');
      }
    }

    if (mode === 'adaptive') {
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

    if (state.unlocked < TRAIN.length && unlockedList(state).every((ch) => (state.keys[ch] || {}).level >= 1)) {
      state.unlocked++;
      events.push('New symbol unlocked: ' + TRAIN[state.unlocked - 1]);
    }
    return events;
  }

  function forceUnlock(state) {
    if (state.unlocked >= TRAIN.length) return null;
    state.unlocked++;
    return TRAIN[state.unlocked - 1];
  }

  // 0 (strong) .. 1 (weak); locked keys count as medium.
  function weakness(state, ch) {
    if (TRAIN.indexOf(ch) >= state.unlocked) return 0.5;
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

  CTT.ENGINE = {
    record, recordPair, stats, unlockedList, focusKey, plan, afterLesson, forceUnlock, weakness,
    topConfusions, allConfusions, slowPairs,
    CONST: { DAY, HALF_LIFE_D, MAX_AGE_D, ACC_TARGET, INTERVALS, MIN_EFF },
  };
})();
