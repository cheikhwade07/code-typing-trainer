// Drill content: Python token templates, generic idiom lines, and generators.
// Placeholders: § = identifier, ¤ = identifier or number, ¶ = number.
(function () {
  const CTT = (window.CTT = window.CTT || {});

  // Symbols trained by the adaptive engine, in unlock order.
  const TRAIN = ['(', ')', '[', ']', '_', ':', '=', '"', "'", ',', '.', '{', '}', '+', '-',
    '<', '>', '!', '#', '*', '/', '%', '&', '|', '@', '\\'];

  // Real names only: common interview identifiers, everyday English variable names,
  // and a few single letters (they are common in real code too).
  const IDS = ['i', 'j', 'n', 'x', 'res', 'ans', 'nums', 'arr', 'dp', 'seen',
    'node', 'root', 'grid', 'word', 'count', 'left', 'right', 'stack', 'queue', 'curr', 'prev',
    'total', 'key', 'val', 'mid', 'target', 'graph', 'head', 'path', 'memo', 'freq', 'row',
    'col', 'heap', 'char', 'num', 'max_len', 'min_heap', 'is_valid', 'word_count', 'next_node',
    'left_sum', 'best', 'visited', 'items', 'start', 'end',
    'name', 'user', 'data', 'text', 'line', 'file', 'price', 'score', 'level', 'color', 'size',
    'index', 'value', 'result', 'output', 'title', 'city', 'order', 'item', 'list_of_names',
    'user_name', 'file_path', 'max_score', 'total_cost', 'start_time'];
  // Callable names, used wherever a template calls something: §( becomes one of these.
  const FUNCS = ['len', 'print', 'range', 'sum', 'min', 'max', 'sorted', 'abs', 'int', 'str',
    'list', 'set', 'dict', 'enumerate', 'zip', 'any', 'all', 'helper', 'dfs', 'bfs', 'solve',
    'search', 'merge', 'build', 'update', 'process', 'validate', 'load_data', 'get_user'];
  const NUMS = ['0', '1', '2', '10', '26', '-1'];

  // Learn-phase drills per symbol: real words and keywords with a high density of that key.
  const MICRO = {
    '(': ['print(', 'len(', 'range(', 'sum(', 'max(', 'min(', 'sorted(', 'append(', 'int(', 'str(',
      'list(', 'dict(', 'set(', 'zip(', 'enumerate(', 'helper(', 'dfs(', 'input(', 'open(', 'abs('],
    ')': ['()', 'self)', 'nums)', 'node)', 'root)', 'x)', 'i)', 'n)', 'key)', 'word)', 'data)',
      'text)', 'name)', 'value)', 'path)', 'line)'],
    '[': ['nums[', 'grid[', 'dp[', 'memo[', 'arr[', 'stack[', 'words[', 'matrix[', 'seen[', 'data[',
      'names[', 'row['],
    ']': ['i]', 'j]', '0]', '1]', 'key]', 'mid]', 'n]', 'idx]', 'row]', 'col]', 'name]', 'word]'],
    '_': ['__init__', '__name__', 'max_len', 'min_heap', 'user_name', 'is_valid', 'word_count',
      'left_sum', 'next_node', 'file_path', 'start_time', '_helper', 'total_cost', 'max_score',
      'first_name', 'is_empty', 'num_rows', 'snake_case'],
    ':': ['else:', 'try:', 'finally:', 'def run():', 'class Node:', 'if done:', 'for x in data:',
      'while queue:', 'lambda x:', 'nums[1:]', 'if not seen:', 'return x[:2]', 'except:',
      'elif found:', 'with open(path):'],
    '=': ['x = 0', 'count = 1', 'name = data', 'total == 0', 'i = j', 'best = res', 'seen = set()',
      'a == b', 'x != y', 'left = 0', 'right = n'],
    '"': ['"name"', '"data"', '"hello"', '"key"', '"value"', '"user"', '"text"', 'print("hi")'],
    "'": ["'name'", "'data'", "'hello'", "'key'", "'a'", "'b'", "' '", "'user'"],
    ',': ['a, b', 'i, j', 'x, y', 'left, right', 'key, value', 'name, age', 'row, col', '(1, 2)'],
    '.': ['self.val', 'node.next', 'root.left', 'nums.sort()', 'data.items()', 'word.lower()',
      'text.split()', 'stack.pop()', 'os.path', 'line.strip()'],
  };

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

  const SNAKE = ['max_len', 'min_heap', 'is_valid', 'word_count', 'next_node', 'left_sum',
    'user_name', 'file_path', 'start_time', 'total_cost', 'max_score', 'first_name', 'is_empty',
    'num_rows', 'num_cols', 'end_index', 'char_count', 'prev_node', 'max_profit', 'row_sum',
    'last_seen', 'best_score', 'page_size', 'item_price', 'new_list'];
  const PRIVATE = ['_helper', '_cache', '_build', '_reset', '_size', '_data', '_check'];

  // Weak letters (set per lesson): about half of the names picked contain one.
  let weakLetters = [];
  function pickId(arr) {
    if (weakLetters.length && Math.random() < 0.5) {
      const m = arr.filter((w) => weakLetters.some((c) => w.includes(c)));
      if (m.length) return pick(m);
    }
    return pick(arr);
  }

  function fill(tpl) {
    return tpl
      .replace(/§_§/g, () => pickId(SNAKE))
      .replace(/(^|[^\w])_§/g, (m, pre) => pre + pickId(PRIVATE))
      .replace(/def §\(/g, () => 'def ' + pickId(FUNCS.slice(17)) + '(')
      .replace(/(^|[^.\w])§\(/g, (m, pre) => pre + pickId(FUNCS) + '(')
      .replace(/§/g, () => pickId(IDS))
      .replace(/¤/g, () => (Math.random() < 0.35 ? pick(NUMS) : pickId(IDS)))
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
  // Short, high-density drills for one key (learn phase), made of real words:
  // "print(", "nums[", "max_len", "else:". Falls back to short real tokens.
  function micro(ch, allowed) {
    const ok = (s) => [...symbolsIn(s)].every((c) => allowed.has(c));
    const list = (MICRO[ch] || []).filter(ok);
    if (list.length) return pick(list);
    const short = TEMPLATES.filter((t) => t.includes(ch) && t.length <= 10);
    for (let k = 0; k < 20 && short.length; k++) {
      const s = fill(pick(short));
      if (ok(s)) return s;
    }
    return pickId(IDS) + ch + pickId(IDS);
  }

  function adaptive(unlocked, plan, length) {
    weakLetters = plan.letters || [];
    try { return adaptiveText(unlocked, plan, length); } finally { weakLetters = []; }
  }

  function adaptiveText(unlocked, plan, length) {
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
        if (r < 0.45) s = micro(plan.focus, unl);
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
  // letters: weak letters; lines using them get a small extra weight.
  function lines(weakness, count, letters) {
    const pool = LINES.map((l) => {
      let w = 1;
      for (const c of symbolsIn(l)) w += 2 * weakness(c);
      for (const c of letters || []) w += 0.25 * Math.min(4, l.split(c).length - 1);
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
