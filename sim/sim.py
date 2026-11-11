"""Monte Carlo test of the old vs proposed mastery / demotion / unlock rules.

Mirrors js/engine.js (old) and the proposed design (new). Pure simulation,
no app code touched.
"""
import math, random, statistics as S, json, sys

DAY = 1.0
Z = 1.2816           # one-sided 90%
TARGET = 30.0        # WPM target

# ---------------- statistics ----------------
def wilson(p, n):
    if n <= 0:
        return 0.0, 1.0
    d = 1 + Z * Z / n
    c = p + Z * Z / (2 * n)
    r = Z * math.sqrt(max(0.0, p * (1 - p) / n + Z * Z / (4 * n * n)))
    return (c - r) / d, (c + r) / d

def day_w(age):
    return 0.0 if age > 21 else 0.5 ** (age / 10)

class Key:
    def __init__(self):
        self.hist = []      # (ok, wpm, day)
        self.level = 0
        self.due = None
        self.pass_days = set()
        self.reached = False   # new: "good enough" once
        self.rev = None

def stats(k, now, rule):
    cap = 60 if rule == 'old' else 150
    h = k.hist[-cap:]
    w = wok = wt = wtn = 0.0
    L = len(h)
    for i, (ok, wpm, d) in enumerate(h):
        x = day_w(now - d)
        if rule == 'new':
            x *= 0.5 ** ((L - 1 - i) / 100)
        if not x:
            continue
        w += x
        if ok:
            wok += x
            if wpm:
                wt += x * (12000 / wpm); wtn += x
    acc = wok / w if w else None
    wpm = 12000 / (wt / wtn) if wtn else None
    return w, acc, wpm

# ---------------- rules ----------------
INTERVALS = [0, 1, 3, 7, 14, 30]

def after_lesson(k, now, rule, lesson_n_for_key, lesson_ok_for_key):
    """Returns event string or None. Mirrors afterLesson per key."""
    w, acc, wpm = stats(k, now, rule)
    if acc is None:
        return None
    due = k.level >= 1 and k.due is not None and k.due <= now
    if rule == 'old':
        if due and lesson_n_for_key:
            r = k.rev = k.rev or [0, 0]
            r[0] += lesson_n_for_key; r[1] += lesson_ok_for_key
        if due and k.rev and k.rev[0] >= 6:
            n, ok = k.rev; k.rev = None
            if ok / n >= 0.96 and wpm >= TARGET * 0.9:
                k.level = min(5, k.level + 1); k.due = now + INTERVALS[k.level]; return 'review+'
            k.level = 0; k.due = None; return 'review-'
        if k.level >= 1 and w >= 10 and acc < 0.9:
            k.level = 0; k.due = None; k.rev = None; return 'demote'
        if k.level == 0 and w >= 10 and acc >= 0.96 and wpm >= TARGET:
            k.level = 1; k.due = now + 1; return 'master'
        return None
    # new
    lo, hi = wilson(acc, w)
    good = lo >= 0.92 and wpm >= TARGET
    if due and lesson_n_for_key:
        # review decided by the same bounds, on attempts since the review came due
        r = k.rev = k.rev or [0, 0]
        r[0] += lesson_n_for_key; r[1] += lesson_ok_for_key
        rlo, rhi = wilson(r[1] / r[0], r[0])
        if rlo >= 0.92 and wpm >= TARGET * 0.9:
            k.rev = None; k.level = min(5, k.level + 1); k.due = now + INTERVALS[k.level]; return 'review+'
        if rhi < 0.90:
            k.rev = None; k.level = 0; k.due = None; k.pass_days.clear(); return 'review-'
        return None
    if k.level >= 1 and hi < 0.90:
        k.level = 0; k.due = None; k.rev = None; k.pass_days.clear(); return 'demote'
    if k.level == 0:
        if good:
            k.pass_days.add(int(now))
        if len(k.pass_days) >= 2:
            k.level = 1; k.due = now + 1; return 'master'
    return None

# ---------------- typist model ----------------
def type_key(true_acc, true_wpm, drift):
    a = true_acc - drift
    ok = random.random() < a
    wpm = max(5.0, random.lognormvariate(math.log(true_wpm), 0.25)) if ok else None
    return ok, wpm

def lesson_on_key(k, n, true_acc, true_wpm, now, drift=0.0):
    okc = 0
    for _ in range(n):
        ok, wpm = type_key(true_acc, true_wpm, drift)
        okc += ok
        k.hist.append((1 if ok else 0, wpm, now))
    return okc

# ---------------- key-level scenarios ----------------
def run_master(rule, true_acc, per_day_lessons, n_per_lesson=25, days=30, drift_p=0.0, true_wpm=34):
    """Practise one key until mastered. Returns (attempts, day) or None."""
    k = Key(); att = 0
    for d in range(days):
        for l in range(per_day_lessons):
            now = d + l * 0.01
            drift = 0.08 if random.random() < drift_p else 0.0
            ok = lesson_on_key(k, n_per_lesson, true_acc, true_wpm, now, drift)
            att += n_per_lesson
            if after_lesson(k, now, rule, n_per_lesson, ok) == 'master':
                return att, d + 1
    return None

def run_bad_session(rule, base=0.97, bad=0.75, bad_n=30, trials=1):
    """Key mastered at `base`; one bad lesson. Demoted?"""
    k = Key()
    # build a solid history: 2 days of good practice
    for d in range(3):
        for l in range(4):
            ok = lesson_on_key(k, 25, base, 34, d + l * 0.01)
            after_lesson(k, d + l * 0.01, rule, 25, ok)
    if k.level < 1:
        return None
    k.due = 99  # keep review out of the way
    now = 3.0
    ok = lesson_on_key(k, bad_n, bad, 34, now)
    return after_lesson(k, now, rule, bad_n, ok) == 'demote'

def run_slump(rule, base=0.97, slump=0.85, max_att=400):
    k = Key()
    for d in range(3):
        for l in range(4):
            ok = lesson_on_key(k, 25, base, 34, d + l * 0.01)
            after_lesson(k, d + l * 0.01, rule, 25, ok)
    if k.level < 1:
        return None
    k.due = 99
    att = 0; now = 3.0
    while att < max_att:
        ok = lesson_on_key(k, 10, slump, 34, now)
        att += 10; now += 0.001
        if after_lesson(k, now, rule, 10, ok) == 'demote':
            return att
    return max_att + 1

def pct(xs, q):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))]

def summarize(label, res):
    got = [r for r in res if r is not None]
    if not got:
        return f"{label:<44} never (0/{len(res)})"
    a = [r[0] for r in got]; dd = [r[1] for r in got]
    day1 = sum(1 for r in got if r[1] == 1) / len(res)
    return (f"{label:<44} mastered {len(got)/len(res):>4.0%}  attempts med {S.median(a):>4.0f} "
            f"(p10 {pct(a,.1):>4}, p90 {pct(a,.9):>4})  day med {S.median(dd):>3.0f}  on day 1 {day1:>4.0%}")

def key_scenarios(R=400):
    random.seed(1)
    print("== A. Time to mastery, one key, daily practice (4 lessons x 25 attempts/day) ==")
    for acc in (0.99, 0.97, 0.96, 0.95, 0.94, 0.93):
        for rule in ('old', 'new'):
            print(summarize(f"{rule} true acc {acc:.0%}", [run_master(rule, acc, 4) for _ in range(R)]))
    print()
    print("== B. Cram day: 1 day, 16 lessons x 25 = 400 attempts, then stop ==")
    for acc in (0.97, 0.94, 0.92):
        for rule in ('old', 'new'):
            res = [run_master(rule, acc, 16, days=1) for _ in range(R)]
            print(f"{rule} true acc {acc:.0%}: mastered in that one day {sum(r is not None for r in res)/R:.0%}")
    print()
    print("== C. Clustered errors: 25% of lessons the hand drifts (-8 pts) ==")
    for acc in (0.97, 0.95):
        for rule in ('old', 'new'):
            print(summarize(f"{rule} true acc {acc:.0%} w/ drift", [run_master(rule, acc, 4, drift_p=0.25) for _ in range(R)]))
    print()
    print("== D. Mastered key at 97%, one bad lesson ==")
    for bad, n in ((0.85, 20), (0.75, 30), (0.60, 30)):
        for rule in ('old', 'new'):
            res = [run_bad_session(rule, bad=bad, bad_n=n) for _ in range(R)]
            res = [r for r in res if r is not None]
            print(f"{rule} one lesson at {bad:.0%} ({n} attempts): demoted {sum(res)/len(res):.0%}")
    print()
    print("== E. Real slump: mastered at 97%, now steadily lower (attempts until demoted) ==")
    for sl in (0.88, 0.85, 0.80, 0.70):
        for rule in ('old', 'new'):
            res = [run_slump(rule, slump=sl) for _ in range(R)]
            res = [r for r in res if r is not None]
            never = sum(r > 400 for r in res) / len(res)
            got = [r for r in res if r <= 400]
            med = S.median(got) if got else float('nan')
            print(f"{rule} slump to {sl:.0%}: median {med:>5.0f} attempts, not demoted within 400: {never:.0%}")

if __name__ == '__main__':
    key_scenarios()
