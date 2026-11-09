// Canvas progress chart: WPM (left axis) and accuracy (right axis) per lesson.
(function () {
  const CTT = (window.CTT = window.CTT || {});

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function draw(canvas, lessons) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);

    const data = lessons.slice(-60);
    const pad = { l: 40, r: 44, t: 16, b: 24 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    g.font = '11px ' + css('--font-ui');
    g.fillStyle = css('--muted');
    g.strokeStyle = css('--grid');
    g.lineWidth = 1;

    if (!data.length) {
      g.fillText('Finish a lesson to see your progress.', pad.l, pad.t + ph / 2);
      return;
    }

    const maxW = Math.max(40, Math.ceil(Math.max(...data.map((d) => d.wpm)) / 10) * 10);
    const accMin = 80;
    const x = (i) => pad.l + (data.length === 1 ? pw / 2 : (i / (data.length - 1)) * pw);
    const yW = (v) => pad.t + ph - (v / maxW) * ph;
    const yA = (v) => pad.t + ph - ((Math.max(accMin, v * 100) - accMin) / (100 - accMin)) * ph;

    for (let k = 0; k <= 4; k++) {
      const yy = pad.t + (k / 4) * ph;
      g.beginPath();
      g.moveTo(pad.l, yy);
      g.lineTo(pad.l + pw, yy);
      g.stroke();
      g.textAlign = 'right';
      g.fillText(String(Math.round(maxW * (1 - k / 4))), pad.l - 6, yy + 4);
      g.textAlign = 'left';
      g.fillText(Math.round(100 - (k / 4) * (100 - accMin)) + '%', pad.l + pw + 6, yy + 4);
    }

    function series(color, y, key) {
      g.strokeStyle = color;
      g.fillStyle = color;
      g.lineWidth = 2;
      g.beginPath();
      data.forEach((d, i) => (i ? g.lineTo(x(i), y(d[key])) : g.moveTo(x(i), y(d[key]))));
      g.stroke();
      data.forEach((d, i) => {
        g.beginPath();
        g.arc(x(i), y(d[key]), 2.5, 0, Math.PI * 2);
        g.fill();
      });
    }
    series(css('--acc-line'), yA, 'acc');
    series(css('--accent'), yW, 'wpm');

    g.fillStyle = css('--accent');
    g.fillText('● WPM', pad.l, h - 6);
    g.fillStyle = css('--acc-line');
    g.fillText('● accuracy', pad.l + 60, h - 6);
  }

  CTT.CHART = { draw };
})();
