// Per-key statistics, confidence, focus selection, and progressive unlocking.
(function () {
  const CTT = (window.CTT = window.CTT || {});
  const { TRAIN } = CTT.CONTENT;

  const HIST = 30; // samples kept per key
  const MIN_SAMPLES = 15; // samples before a key can count as learned
  const ACC_TARGET = 0.96;

  function record(state, ch, ok, t) {
    const k = (state.keys[ch] = state.keys[ch] || { hist: [] });
    k.hist.push(ok ? { ok: 1, t: t == null ? null : Math.round(t) } : { ok: 0 });
    if (k.hist.length > HIST) k.hist.splice(0, k.hist.length - HIST);
  }

  function stats(state, ch) {
    const h = (state.keys[ch] && state.keys[ch].hist) || [];
    const n = h.length;
    if (!n) return { n: 0, acc: null, wpm: null, conf: 0, learned: false };
    const ok = h.filter((x) => x.ok).length;
    const acc = ok / n;
    const ts = h.filter((x) => x.ok && x.t).map((x) => x.t);
    const avg = ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length : null;
    const wpm = avg ? 12000 / avg : null; // 60000 ms / (avg ms * 5 chars)
    const target = state.settings.targetWpm;
    const sp = wpm ? Math.min(1, wpm / target) : 0;
    const ac = Math.min(1, acc / ACC_TARGET);
    const vol = Math.min(1, n / MIN_SAMPLES);
    const learned = n >= MIN_SAMPLES && acc >= ACC_TARGET && wpm != null && wpm >= target;
    return { n, acc, wpm, conf: learned ? 1 : Math.min(0.99, sp * ac * vol), learned };
  }

  function unlockedList(state) {
    return TRAIN.slice(0, state.unlocked);
  }

  function focusKey(state) {
    let best = null;
    let bestConf = Infinity;
    for (const ch of unlockedList(state)) {
      const c = stats(state, ch).conf;
      if (c < bestConf) { bestConf = c; best = ch; }
    }
    return best;
  }

  // Unlock the next symbol once every unlocked one is learned.
  function maybeUnlock(state) {
    if (state.unlocked >= TRAIN.length) return null;
    if (!unlockedList(state).every((ch) => stats(state, ch).learned)) return null;
    state.unlocked++;
    return TRAIN[state.unlocked - 1];
  }

  function forceUnlock(state) {
    if (state.unlocked >= TRAIN.length) return null;
    state.unlocked++;
    return TRAIN[state.unlocked - 1];
  }

  // 0 (strong) .. 1 (weak); locked keys count as medium.
  function weakness(state, ch) {
    if (TRAIN.indexOf(ch) >= state.unlocked) return 0.5;
    return 1 - stats(state, ch).conf;
  }

  CTT.ENGINE = { record, stats, unlockedList, focusKey, maybeUnlock, forceUnlock, weakness, ACC_TARGET };
})();
