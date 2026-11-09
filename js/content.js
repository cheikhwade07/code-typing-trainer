// Drill content: Python token templates, generic idiom lines, and generators.
// Placeholders: § = identifier, ¤ = identifier or number, ¶ = number.
(function () {
  const CTT = (window.CTT = window.CTT || {});

  // Symbols trained by the adaptive engine, in unlock order.
  const TRAIN = ['(', ')', '[', ']', '_', ':', '=', '"', "'", ',', '.', '{', '}', '+', '-',
    '<', '>', '!', '#', '*', '/', '%', '&', '|', '@', '\\'];

  const IDS = ['i', 'j', 'k', 'n', 'x', 'l', 'r', 'res', 'ans', 'nums', 'arr', 'dp', 'seen',
    'node', 'root', 'grid', 'word', 'count', 'left', 'right', 'stack', 'queue', 'curr', 'prev',
    'total', 'key', 'val', 'mid', 'target', 'graph', 'head', 'path', 'memo', 'freq', 'row',
    'col', 'heap', 'char', 'num', 'max_len', 'min_heap', 'is_valid', 'word_count', 'next_node',
    'left_sum', 'best', 'visited', 'items', 'start', 'end'];
  const NUMS = ['0', '1', '2', '10', '26', '-1'];

  const TEMPLATES = [
    '§(¤)', '§[¤]', '§[¤][¤]', '§[¤:¤]', '§[:¤]', '§[¤:]', '§[-1]', '§[0]', '(¤, ¤)', '[¤, ¤]',
    '§ = []', '§ = {}', '§ = ()', '§ = ¤', '§ == ¤', '§ != ¤', '§ += 1', '§ -= 1', '§ < ¤',
    '§ <= ¤', '§ > ¤', '§ >= ¤', '§ + ¤', '§ - ¤', '§ * ¤', '§ // 2', '§ % 2', '§ ** 2',
    '§.append(¤)', '§.pop()', '§.get(¤, 0)', '§[¤] = ¤', '§.add(¤)', '§.items()', '§.keys()',
    'def §(§):', 'def §(self, §):', 'self.§', 'self.§ = §', '__init__', '__name__', '§_§', '_§',
    'if §:', 'if not §:', 'elif § > ¤:', 'while § < §:', 'for § in §:', 'for _ in range(¶):',
    'for § in range(len(§)):', 'for §, § in enumerate(§):', 'return §', 'return (§ + §) // 2',
    '"§"', "'§'", 'f"{§}"', "f'{§}'", '{§: ¤}', '{§}', '§ = {§: ¤}', 'lambda §: §[1]',
    'not §', '§ and §', '§ or §', '§ & 1', '§ | §', '§ ^ §', '# §', '@cache', '@property',
    'print(§)', 'len(§)', 'min(§, §)', 'max(§, §)', 'abs(§ - §)', '§ = [0] * (§ + 1)',
    '§ = [[0] * § for _ in range(§)]', '§[§] = §.get(§, 0) + 1', '§, § = §, §', '§ = §.next',
    'while § and §[-1] < §:', 'heapq.heappush(§, (§, §))', 'collections.defaultdict(list)',
    '§ is None', 'return -1', "§.split(',')", '§.strip()', "' '.join(§)", '"".join(§)',
    "'\\n'", '"\\t"', '§ = §[::-1]', 'sorted(§, key=lambda §: -§)', '§ = float("inf")',
    'return [§, §]', 'if § not in §:', '§ //= 2', '§ *= -1', '§ != §[-1]', '(§ & 1) == 0',
    '§ |= §', '{**§}', '[*§]', '§ % 10', '§ / 2', 'x <= y < z', 'Optional[§]', 'List[int]',
    'Dict[str, int]', '-> int:', '-> bool:', '# TODO', 'assert § == ¤', 'raise ValueError()',
    // contrast drills for common mix-ups (_ vs -, [ vs {, ( vs [, " vs ', : vs ;-free =)
    '§_§ - 1', '§_§ -= 1', '[§_§ - ¤]', '{§: [§]}', '§[§] = {}', '{§: §[¤]}', 'len(§[¤])',
    '§[§(¤)]', '(§[¤], §[¤])', '"§" + \'§\'', '§_§: int = ¤', '§[¤:¤] == §[¤:]', '§ == §_§',
    '§.§_§(¤)', '§ <= §_§ < §', '{§, §} | {§}', '§ != -1', '§ * (§ + 1) // 2',
  ];

  // Generic Python idioms for Lines mode (not solutions to any practice problem).
  const LINES = [
    'def __init__(self, val=0, next=None):',
    'self.val = val',
    'self.next = next',
    'from collections import defaultdict, deque',
    'import heapq',
    'count = defaultdict(int)',
    'seen = set()',
    'queue = deque([root])',
    'while queue:',
    'node = queue.popleft()',
    'for i in range(len(nums)):',
    'for i, num in enumerate(nums):',
    'left, right = 0, len(nums) - 1',
    'while left < right:',
    'mid = (left + right) // 2',
    'if nums[mid] < target:',
    'return [i, j]',
    'dp = [0] * (n + 1)',
    'grid = [[0] * cols for _ in range(rows)]',
    'freq[c] = freq.get(c, 0) + 1',
    'if not stack or stack[-1] != c:',
    'heapq.heappush(heap, (dist, node))',
    'dist, node = heapq.heappop(heap)',
    'res.append(path[:])',
    'return "".join(chars)',
    "words = line.split(' ')",
    'print(f"{key}: {val}")',
    'ans = max(ans, right - left + 1)',
    'graph = {i: [] for i in range(n)}',
    'graph[a].append(b)',
    'if (r, c) in visited:',
    'for dr, dc in [(1, 0), (-1, 0), (0, 1), (0, -1)]:',
    'nr, nc = r + dr, c + dc',
    'if 0 <= nr < rows and 0 <= nc < cols:',
    'items.sort(key=lambda x: x[1])',
    'memo = {}',
    'if n in memo:',
    'return memo[n]',
    "best = float('inf')",
    'total += nums[i] * 2',
    'x = x % 10',
    'n //= 2',
    'if n & 1:',
    'mask |= 1 << bit',
    'class Solution:',
    'def maxValue(self, nums: List[int]) -> int:',
    'def isValid(self, s: str) -> bool:',
    '# base case',
    'assert result == [1, 2, 3]',
    'if __name__ == "__main__":',
    "pairs = {')': '(', ']': '[', '}': '{'}",
    'return not stack',
    'prev, curr = None, head',
    'curr.next, prev, curr = prev, curr, curr.next',
    'return self.helper(root.left) + 1',
    "s = s.lower().replace(' ', '')",
    'return s == s[::-1]',
    'matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]',
    '@lru_cache(maxsize=None)',
    'counts = Counter(s)',
  ];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function fill(tpl) {
    return tpl
      .replace(/§/g, () => pick(IDS))
      .replace(/¤/g, () => (Math.random() < 0.35 ? pick(NUMS) : pick(IDS)))
      .replace(/¶/g, () => pick(NUMS.filter((n) => n[0] !== '-')));
  }

  const TRAIN_SET = new Set(TRAIN);
  function symbolsIn(s) {
    const out = new Set();
    for (const ch of s) if (TRAIN_SET.has(ch)) out.add(ch);
    return out;
  }

  // keybr-style, with a guaranteed mix so no single key takes over a lesson:
  // ~50% focus, ~30% secondary (other weak, review-due, stale, mix-up partner), ~20% any.
  // plan = { focus, secondary: [], partner }
  // Short, high-density drills for one key (learn phase): "i(", "(dp", "x(j", "((".
  const SHORT_IDS = ['i', 'j', 'k', 'n', 'x', 'l', 'r', 'dp', 'res', 'num'];
  function micro(ch) {
    const id = () => pick(SHORT_IDS);
    const forms = [
      () => id() + ch, () => ch + id(), () => id() + ch + id(), () => ch + ch,
      () => id() + ch + id() + ch, () => ch + id() + ch,
    ];
    return pick(forms)();
  }

  function adaptive(unlocked, plan, length) {
    const unl = new Set(unlocked);
    if (plan.partner) unl.add(plan.partner);
    const withChar = (c) => TEMPLATES.filter((t) => t.includes(c));
    const focusTpl = plan.focus ? withChar(plan.focus) : [];
    const shortFocus = focusTpl.filter((t) => t.length <= 12);
    const contrastTpl = plan.partner ? focusTpl.filter((t) => t.includes(plan.partner)) : [];
    const learn = plan.phase === 'learn' && plan.focus;
    const out = [];
    let size = 0;
    let guard = 0;
    while (size < length && guard++ < 2000) {
      const r = Math.random();
      let pool = TEMPLATES;
      let s = null;
      if (learn) {
        // ~45% micro drills, ~40% short real tokens, ~8% mix-up contrast, ~7% anything
        if (r < 0.45) s = micro(plan.focus);
        else if (r < 0.85 && (shortFocus.length || focusTpl.length)) pool = shortFocus.length ? shortFocus : focusTpl;
        else if (r < 0.93) pool = contrastTpl.length ? contrastTpl : focusTpl.length ? focusTpl : TEMPLATES;
      } else if (contrastTpl.length && r < 0.12) pool = contrastTpl;
      else if (focusTpl.length && r < 0.5) pool = focusTpl;
      else if (plan.secondary.length && r < 0.8) {
        const sec = withChar(pick(plan.secondary));
        if (sec.length) pool = sec;
      }
      if (s === null) s = fill(pick(pool));
      const syms = symbolsIn(s);
      if (!syms.size) continue;
      let ok = true;
      for (const c of syms) if (!unl.has(c)) { ok = false; break; }
      if (!ok) continue;
      if (out.length && out[out.length - 1] === s) continue;
      out.push(s);
      size += s.length + 1;
    }
    return out.join(' ');
  }

  // Weighted pick of lines toward weak symbols. weakness(ch) -> 0..1
  function lines(weakness, count) {
    const pool = LINES.map((l) => {
      let w = 1;
      for (const c of symbolsIn(l)) w += 2 * weakness(c);
      return { l, w };
    });
    const out = [];
    for (let k = 0; k < count && pool.length; k++) {
      const total = pool.reduce((a, p) => a + p.w, 0);
      let r = Math.random() * total;
      let idx = 0;
      while (idx < pool.length - 1 && (r -= pool[idx].w) > 0) idx++;
      out.push(pool[idx].l);
      pool.splice(idx, 1);
    }
    return out.join('\n');
  }

  // Normalize pasted code into non-empty lines (tabs -> 4 spaces, trailing space trimmed).
  function normalizeCode(text) {
    return text
      .replace(/\r/g, '')
      .split('\n')
      .map((l) => l.replace(/\t/g, '    ').replace(/\s+$/, ''))
      .filter((l) => l.trim().length);
  }

  CTT.CONTENT = { TRAIN, adaptive, lines, normalizeCode, symbolsIn };
})();
