// Cross-version probe: identical script run on HEAD (:8801) and the new build (:8802).
window.XV = async function () {
  const out = {};
  const T0 = new Date(); T0.setHours(12, 0, 0, 0); const t0 = T0.getTime();
  T.freeze(t0);
  const isNew = !!CTT.WORDS;
  for (const [name, fx] of [['syn', T.fsyn(t0)], ['w10', T.fw(10, t0)]]) {
    await T.load(fx);
    T.freeze(t0);
    if (isNew) { T.mode('words'); await T.wait(10); for (let k = 0; k < 50; k++) T.esc(); }
    T.mode('adaptive'); await T.wait(20);
    T.freeze(t0);
    const m = CTT.STORE.merge(T.st());
    out[name + '_derived'] = T.hash(T.mainDerived(m));
    out[name + '_report'] = T.hash(T.mainReport(m));
    out[name + '_mainSnap'] = T.hash(T.mainSnap(m));
    // seeded content generation (ISO-5)
    T.seedRandom(42);
    const p = CTT.ENGINE.plan(m);
    let gen = [0, 1, 2, 3, 4].map(() => CTT.CONTENT.adaptive(CTT.ENGINE.unlockedList(m), p, 70))
      .concat([0, 1, 2].map(() => CTT.CONTENT.lines((c) => CTT.ENGINE.weakness(m, c), 3, CTT.ENGINE.weakLetters(m))));
    const p2 = Object.assign({}, p, { phase: 'learn' });
    gen = gen.concat([0, 1, 2, 3, 4].map(() => CTT.CONTENT.adaptive(CTT.ENGINE.unlockedList(m), p2, 70)));
    T.unseed();
    out[name + '_gen'] = T.hash(JSON.stringify(gen));
    // DOM (practice) and Symbols stats view
    T.seedRandom(7); T.esc(); T.unseed(); await T.wait(10);
    const d = JSON.parse(T.dom());
    out[name + '_strip'] = T.hash(d.strip);
    out[name + '_metrics'] = T.hash(d.wpm + d.acc + d.shift + d.today + d.wpmD + d.accD);
    out[name + '_focus'] = T.hash(d.focus);
    document.getElementById('statsBtn').click(); await T.wait(20);
    const sd = JSON.parse(T.statsDom());
    for (const k of Object.keys(sd)) out[name + '_stats_' + k] = T.hash(sd[k]);
    document.getElementById('statsBtn').click(); await T.wait(10);
  }
  T.thaw();
  out.errors = T.errors.slice();
  return out;
};
