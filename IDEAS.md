# Improvement ideas

Backlog for the Code Typing Trainer. Nothing here is built yet. Items marked
**(Seydi)** came from Seydi; the rest are suggestions to consider.

## 1. AI feedback with the Gemini API (Seydi)

Goal: after a session, get a short, specific coaching note instead of reading
the stats table.

- **Input:** the same data as `report.md` (per-key accuracy and speed, top
  mix-ups, slowest transitions, trends, same-hand Shift rate), plus the last
  few lessons' error positions.
- **Solid instructions (system prompt):** act as a typing coach for
  programming symbols. Name at most 3 priorities, each tied to a number from
  the data. Give one concrete drill per priority. No generic advice, no
  invented stats. If data is thin (under about 10 lessons), say so and keep it
  short.
- **Output:** a short card in Stats ("This week: `_` vs `-` mix-ups are 40% of
  your errors; drill `max_len - 1` style tokens"), optionally saved into the
  report.
- **Optional:** let the AI's priorities set the next lessons' focus keys.
- **API key safety:** the site is static (GitHub Pages), so a key in the code
  would be public. Options:
  - paste your own key in Settings, stored only in your browser (fine for
    personal use);
  - or a small serverless proxy (Cloudflare Worker or Vercel function) that
    holds the key.
- Send typing stats only, no personal data.

## 2. Pattern mode: BFS, DFS, backtracking, and more (Seydi)

Goal: muscle memory for the code shapes that come up in interviews, so the
typing is automatic and thinking time goes to the problem.

- Patterns: BFS with `deque`, DFS (recursive and stack), backtracking
  (choose, explore, unchoose), binary search, two pointers, sliding window,
  heap / top-k, union-find, topological sort, trie, 1D and 2D DP tables, grid
  neighbors loop.
- Keep them **generic skeletons** with neutral names, not solutions to
  specific LeetCode problems. That matches the practice rules in
  `technical_prep/AGENTS.md`: general templates are fine, live practice
  problems get no solution code.
- Modes inside it:
  - **Type it:** the full skeleton shown, typed with Enter and indentation.
  - **From memory:** only the pattern name and a one-line hint are shown; you
    type it, then see a diff against the reference.
- Track per-pattern accuracy and time, and schedule reviews like the symbol
  keys.

## 3. Mistake-focused LeetCode drills (Seydi)

Goal: drill the exact syntax and logic slips from recent practice and
interviews until they stop happening.

- A curated `mistakes.json` deck. Each entry has the wrong version, the right
  version, a one-line why, and tags (syntax, logic, bounds, naming).
- Seed it from the practice logs, for example:
  - 2D array aliasing: `[[0] * cols] * rows` is wrong (every row is the same
    list); `[[0] * cols for _ in range(rows)]` is right.
  - Off-by-one bound: `r = len(heights)` vs `r = len(heights) - 1`.
  - Name typos: `height` vs `heights`, `inr` vs `in`.
  - Unmatched parentheses in nested calls.
  - Appending the node instead of `node.val`.
- Modes:
  - **Retype the correct version** several times (spaced review like keys).
  - **Spot the bug:** shown the wrong line, type the fix.
- After each logged practice session, new mistakes get added to the deck, so
  recent ones show up most.

## 4. Other suggestions

- **Interview simulation mode:** no keyboard, no highlighting, no stop on
  error, Backspace allowed, a visible timer, no auto-indent (like Google Docs
  or CoderPad). Measures corrections and Backspace use, not just WPM.
- **Rhythm / consistency metric** (like monkeytype's consistency) to track
  the hesitation dips seen in the baseline tests.
- **Daily session preset:** one 10-minute button that runs 3 min Lines and
  7 min Adaptive, then shows a summary.
- **Auto-indent off option** in Lines and My code, to practice typing
  indentation the way Google Docs requires.
- **Close-bracket habit drill:** type `()` or `[]` first, then fill in the
  middle, which prevents unmatched brackets.
- **Install as an app (PWA):** a manifest plus a service worker so the
  GitHub Pages link can be installed like a desktop app and works offline.
- **Sync across devices:** progress lives in one browser today; a GitHub Gist
  or small backend could sync it.
- **Weekly comparison** in the report: this week vs last week per key.
- **Number-row variant** in Settings (9 on the middle finger, 0 on ring) if
  `(` stays slow after a few weeks.
- **Light/dark toggle** and a sound volume preset.
