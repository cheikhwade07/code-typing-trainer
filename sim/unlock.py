import sim, random, math, statistics as S
TRAIN = ['(', ')', '[', ']', '_', ':', '=', '"', "'", ',', '.', '{', '}', '+', '-', '<', '>', '!', '#', '*', '/', '%', '&', '|', '@', 'bs']
START = {'(': (.92, 22), ')': (.78, 17), '[': (.93, 26), ']': (.95, 23), '_': (.72, 22), ':': (.82, 18)}
TAU = 600; AINF = .975; SINF = 34

class TK(sim.Key):
    def __init__(s, a0, s0):
        super().__init__(); s.a0, s.s0, s.n = a0, s0, 0
    def true(s):
        f = math.exp(-s.n / TAU)
        return AINF - (AINF - s.a0) * f, SINF - (SINF - s.s0) * f

def point(k, now):
    w, acc, wpm = sim.stats(k, now, 'old')
    return w, acc or 0, wpm or 0

def conf(k, now):
    w, acc, wpm = point(k, now)
    return min(1, wpm / 30) * min(1, acc / .96) * min(1, w / 10)

def run(rule, days=14, lessons_per_day=10, focus_n=15, other_n=3, stall=10):
    keys = {c: TK(*START[c]) for c in START}
    unl = 6; since = 0; snap = {}; weak_share = []
    for d in range(days):
        for l in range(lessons_per_day):
            now = d + l * 0.01
            act = TRAIN[:unl]
            cand = [c for c in act if keys[c].level == 0]
            focus = min(cand or act, key=lambda c: conf(keys[c], now))
            for c in act:
                k = keys[c]; n = focus_n if c == focus else other_n
                ta, ts = k.true()
                ok = sim.lesson_on_key(k, n, ta, ts, now); k.n += n
                sim.after_lesson(k, now, 'old' if rule == 'old' else 'new', n, ok)
                w, acc, wpm = point(k, now)
                if w >= 10 and acc >= .92 and wpm >= 21: k.reached = True
                if w >= 10 and acc < .80: k.reached = False
            since += 1
            accs = [point(keys[c], now)[1] for c in act]
            weak_share.append(sum(a < .9 for a in accs) / len(act))
            if unl < len(TRAIN):
                if rule == 'old':
                    go = all(keys[c].level >= 1 for c in act)
                else:
                    go = all(keys[c].reached for c in act) or (since >= stall and min(accs) >= .70)
                if go:
                    unl += 1; since = 0
                    c = TRAIN[unl - 1]; keys[c] = TK(.85, 18)
        snap[d + 1] = unl
    return snap, S.mean(weak_share)

for rule in ('old', 'new'):
    random.seed(5)
    runs = [run(rule) for _ in range(150)]
    print(rule, {d: S.median(r[0][d] for r in runs) for d in (1, 2, 3, 5, 7, 10, 14)},
          'avg share of keys under 90%:', round(S.mean(r[1] for r in runs), 2))
