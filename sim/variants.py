import sim, random, statistics as S, math
orig_after = sim.after_lesson

def make(zm, zd, bar, day_floor):
    def after(k, now, rule, n, ok):
        if rule != 'new':
            return orig_after(k, now, rule, n, ok)
        w, acc, wpm = sim.stats(k, now, 'new')
        if acc is None: return None
        sim.Z = zm; lo, _ = sim.wilson(acc, w)
        sim.Z = zd; _, hi = sim.wilson(acc, w)
        due = k.level >= 1 and k.due is not None and k.due <= now
        if k.level >= 1 and hi < 0.90:
            k.level = 0; k.due = None; k.pass_days.clear(); return 'demote'
        if k.level == 0:
            today = [h for h in k.hist if int(h[2]) == int(now)]
            dacc = sum(h[0] for h in today) / len(today)
            if lo >= bar and wpm >= sim.TARGET and dacc >= day_floor:
                k.pass_days.add(int(now))
            if len(k.pass_days) >= 2:
                k.level = 1; k.due = 99; return 'master'
        return None
    return after

V = {
 'proposed (z90, bar92)':            (1.2816, 1.2816, 0.92, 0.0),
 'z95 master, bar92':               (1.645, 1.2816, 0.92, 0.0),
 'z90, bar92, day acc>=95%':        (1.2816, 1.2816, 0.92, 0.95),
 'z90, bar93, day acc>=95%':        (1.2816, 1.2816, 0.93, 0.95),
}
R = 300
for name, (zm, zd, bar, df) in V.items():
    sim.after_lesson = make(zm, zd, bar, df)
    random.seed(2)
    print('==', name)
    for acc in (0.97, 0.96, 0.95, 0.94, 0.93):
        print('  ', sim.summarize(f"acc {acc:.0%}", [sim.run_master('new', acc, 4) for _ in range(R)]))
    print('  ', sim.summarize("acc 97% w/ drift", [sim.run_master('new', 0.97, 4, drift_p=0.25) for _ in range(R)]))
print()
for zd, lab in ((1.2816, 'demote z90'), (0.8416, 'demote z80'), (0.0, 'demote point est')):
    sim.after_lesson = make(1.2816, zd, 0.92, 0.95)
    random.seed(3)
    out = []
    for sl in (0.88, 0.85, 0.80):
        res = [r for r in (sim.run_slump('new', slump=sl) for _ in range(R)) if r is not None]
        got = [r for r in res if r <= 400]
        out.append(f"{sl:.0%}: med {S.median(got):.0f} (never {sum(r>400 for r in res)/len(res):.0%})")
    bad = []
    for b, n in ((0.85, 20), (0.75, 30), (0.60, 30)):
        res = [r for r in (sim.run_bad_session('new', bad=b, bad_n=n) for _ in range(R)) if r is not None]
        bad.append(f"{b:.0%}x{n}: {sum(res)/len(res):.0%}")
    print(lab, '| slump', '; '.join(out), '| one bad lesson demotes', '; '.join(bad))
