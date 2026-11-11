# Rule simulations

Monte Carlo tests of the mastery, demotion and unlock rules, used for the
2026-11-11 entry in `../IMPROVEMENTS.md`. They re-implement the rules in
Python (they do not run the app code), with a virtual typist whose true
accuracy and speed are set per scenario.

```
python sim.py        # old vs first proposal: mastery time, cram day, drift, bad lesson, slump
python variants.py   # mastery and demotion variants (the shipped one: z90, bar 93, day acc >= 95%, demote z80)
python unlock.py     # unlock timeline from the 2026-11-10 stats (variant loop in IMPROVEMENTS.md)
```

`sim.py`'s built-in "new" rule is the first proposal (bar 92%, demote at 90%
certainty); `variants.py` overrides it with the shipped values. Re-run after
changing a constant in `js/engine.js` and mirror the change here first.

Limitations: the learning curve is assumed (smooth, per-attempt), and the
model has no interference between neighbouring keys and no benefit from
variety.
