// US QWERTY layout: key geometry, finger assignment, and char -> key lookup.
(function () {
  const CTT = (window.CTT = window.CTT || {});

  // [code, base, shifted, finger, widthUnits, label]
  function letters(codes, fingers) {
    return codes.split('').map((c, i) => ['Key' + c.toUpperCase(), c, c.toUpperCase(), fingers[i], 1]);
  }

  const ROWS = [
    [
      ['Backquote', '`', '~', 'lp', 1], ['Digit1', '1', '!', 'lp', 1], ['Digit2', '2', '@', 'lr', 1],
      ['Digit3', '3', '#', 'lm', 1], ['Digit4', '4', '$', 'li', 1], ['Digit5', '5', '%', 'li', 1],
      ['Digit6', '6', '^', 'li', 1], ['Digit7', '7', '&', 'ri', 1], ['Digit8', '8', '*', 'rm', 1],
      ['Digit9', '9', '(', 'rr', 1], ['Digit0', '0', ')', 'rp', 1], ['Minus', '-', '_', 'rp', 1],
      ['Equal', '=', '+', 'rp', 1], ['Backspace', null, null, 'rp', 2, 'backspace'],
    ],
    [
      ['Tab', null, null, 'lp', 1.5, 'tab'],
      ...letters('qwertyuiop', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr', 'rp']),
      ['BracketLeft', '[', '{', 'rp', 1], ['BracketRight', ']', '}', 'rp', 1],
      ['Backslash', '\\', '|', 'rp', 1.5],
    ],
    [
      ['CapsLock', null, null, 'lp', 1.75, 'caps'],
      ...letters('asdfghjkl', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr']),
      ['Semicolon', ';', ':', 'rp', 1], ['Quote', "'", '"', 'rp', 1],
      ['Enter', null, null, 'rp', 2.25, 'enter'],
    ],
    [
      ['ShiftLeft', null, null, 'lp', 2.25, 'shift'],
      ...letters('zxcvbnm', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri']),
      ['Comma', ',', '<', 'rm', 1], ['Period', '.', '>', 'rr', 1], ['Slash', '/', '?', 'rp', 1],
      ['ShiftRight', null, null, 'rp', 2.75, 'shift'],
    ],
    [['Space', null, null, 'th', 6.25, '']],
  ];

  const FINGER_NAMES = {
    lp: 'left pinky', lr: 'left ring', lm: 'left middle', li: 'left index',
    ri: 'right index', rm: 'right middle', rr: 'right ring', rp: 'right pinky', th: 'thumb',
  };

  const keys = {};
  const charMap = {};
  ROWS.forEach((row) =>
    row.forEach(([code, base, shifted, finger, w, label]) => {
      keys[code] = { code, base, shifted, finger, w, label };
      if (base) charMap[base] = { code, shift: false };
      if (shifted) charMap[shifted] = { code, shift: true };
    })
  );
  charMap[' '] = { code: 'Space', shift: false };
  charMap['\n'] = { code: 'Enter', shift: false };

  function hand(finger) {
    return finger && finger[0] === 'l' ? 'L' : 'R';
  }

  // Which Shift key should be held for this char (opposite hand), or null.
  function requiredShift(ch) {
    const m = charMap[ch];
    if (!m || !m.shift) return null;
    return hand(keys[m.code].finger) === 'L' ? 'ShiftRight' : 'ShiftLeft';
  }

  function describe(ch) {
    const m = charMap[ch];
    if (!m) return '';
    const k = keys[m.code];
    let s = FINGER_NAMES[k.finger];
    const sh = requiredShift(ch);
    if (sh) s += ' + ' + (sh === 'ShiftLeft' ? 'LEFT' : 'RIGHT') + ' Shift';
    return s;
  }

  CTT.LAYOUT = { ROWS, keys, charMap, requiredShift, describe, FINGER_NAMES };
})();
