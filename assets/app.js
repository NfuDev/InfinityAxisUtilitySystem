/* Shared helpers for the Behavioral Mathematics study guide. No dependencies. */
(function () {
  'use strict';

  var PAGES = [
    { file: 'index.html', n: '0', title: 'Start here' },
    { file: '1-decisions.html', n: '1', title: 'How decisions work' },
    { file: '2-utility.html', n: '2', title: 'Utility' },
    { file: '3-curves.html', n: '3', title: 'Functions and response curves' },
    { file: '4-weighting.html', n: '4', title: 'Normalising and weighting' },
    { file: '5-decision-model.html', n: '5', title: 'Building a decision' },
    { file: '6-iaus-goap.html', n: '6', title: 'Infinite Axis Utility + GOAP' }
  ];

  /* ---------- theme ---------- */
  function getStoredTheme() { try { return localStorage.getItem('bm-theme'); } catch (e) { return null; } }
  function storeTheme(t) { try { localStorage.setItem('bm-theme', t); } catch (e) { /* ignore */ } }
  var stored = getStoredTheme();
  if (stored) document.documentElement.setAttribute('data-theme', stored);

  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  var redrawHooks = [];
  function onRedraw(fn) { redrawHooks.push(fn); }
  function redrawAll() { redrawHooks.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }

  /* ---------- page chrome ---------- */
  function buildChrome() {
    var here = (location.pathname.split('/').pop() || 'index.html');
    var idx = 0;
    PAGES.forEach(function (p, i) { if (p.file === here) idx = i; });

    var main = document.querySelector('main');
    if (!main) return;
    var shell = document.createElement('div');
    shell.className = 'shell';
    var side = document.createElement('aside');
    side.className = 'side';

    var html = '<p class="brand">Behavioral Mathematics for Game AI<small>Interactive study guide</small></p><nav>';
    PAGES.forEach(function (p, i) {
      html += '<a href="' + p.file + '"' + (i === idx ? ' class="on"' : '') + '><span class="n">' + p.n + '</span><span>' + p.title + '</span></a>';
    });
    html += '</nav>';

    var heads = main.querySelectorAll('h2[id]');
    if (heads.length) {
      html += '<ul class="toc">';
      heads.forEach(function (h) { html += '<li><a href="#' + h.id + '">' + h.textContent + '</a></li>'; });
      html += '</ul>';
    }
    html += '<button class="theme-btn" type="button">Switch light / dark</button>';
    side.innerHTML = html;

    document.body.insertBefore(shell, main);
    shell.appendChild(side);
    shell.appendChild(main);

    side.querySelector('.theme-btn').addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      storeTheme(next);
      redrawAll();
    });

    var pager = document.createElement('div');
    pager.className = 'pager';
    var prev = PAGES[idx - 1], next = PAGES[idx + 1];
    pager.innerHTML =
      (prev ? '<a href="' + prev.file + '">&larr; ' + prev.title + '</a>' : '<span></span>') +
      (next ? '<a href="' + next.file + '">' + next.title + ' &rarr;</a>' : '<span></span>');
    main.appendChild(pager);
  }

  /* ---------- small utilities ---------- */
  function $(id) { return document.getElementById(id); }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function fmt(v, d) {
    if (!isFinite(v)) return String(v);
    if (d === undefined) d = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
    return v.toFixed(d);
  }
  function val(id) { var el = $(id); return el.type === 'checkbox' ? el.checked : parseFloat(el.value); }

  /* Keeps the <output> inside each .ctl label in sync and calls fn on every change. */
  function wire(ids, fn) {
    function sync() {
      ids.forEach(function (id) {
        var el = $(id); if (!el) return;
        var lab = el.closest('.ctl');
        var out = lab ? lab.querySelector('output') : null;
        if (out && el.type === 'range') {
          var suffix = el.getAttribute('data-suffix') || '';
          out.textContent = el.value + suffix;
        }
      });
      fn();
    }
    ids.forEach(function (id) {
      var el = $(id); if (!el) return;
      el.addEventListener('input', sync);
      el.addEventListener('change', sync);
    });
    onRedraw(fn);
    sync();
  }

  /* ---------- canvas plot ---------- */
  function Plot(canvas, opt) {
    this.c = typeof canvas === 'string' ? $(canvas) : canvas;
    this.o = Object.assign({ xmin: 0, xmax: 1, ymin: 0, ymax: 1, xlabel: '', ylabel: '', pad: [14, 14, 34, 44] }, opt || {});
    this.series = []; this.marks = []; this.hover = null;
    var self = this;
    this.c.addEventListener('pointermove', function (e) {
      var r = self.c.getBoundingClientRect();
      self.hover = (e.clientX - r.left) / r.width;
      self.render();
    });
    this.c.addEventListener('pointerleave', function () { self.hover = null; self.render(); });
    window.addEventListener('resize', function () { self.render(); });
  }
  Plot.prototype.set = function (opt) { Object.assign(this.o, opt); return this; };
  Plot.prototype.draw = function (series, marks) {
    this.series = series || []; this.marks = marks || []; this.render();
  };
  Plot.prototype.render = function () {
    var c = this.c, o = this.o, dpr = window.devicePixelRatio || 1;
    var w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    var g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var pt = o.pad[0], pr = o.pad[1], pb = o.pad[2], pl = o.pad[3];
    var pw = w - pl - pr, ph = h - pt - pb;
    var X = function (x) { return pl + (x - o.xmin) / (o.xmax - o.xmin) * pw; };
    var Y = function (y) { return pt + (1 - (y - o.ymin) / (o.ymax - o.ymin)) * ph; };
    var ink = css('--ink-2'), grid = css('--grid');

    g.font = '11px ' + css('--mono');
    g.lineWidth = 1;
    var i, t;
    for (i = 0; i <= 5; i++) {
      t = o.xmin + (o.xmax - o.xmin) * i / 5;
      g.strokeStyle = grid; g.beginPath(); g.moveTo(X(t), pt); g.lineTo(X(t), pt + ph); g.stroke();
      g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(niceNum(t), X(t), pt + ph + 5);
    }
    for (i = 0; i <= 4; i++) {
      t = o.ymin + (o.ymax - o.ymin) * i / 4;
      g.strokeStyle = grid; g.beginPath(); g.moveTo(pl, Y(t)); g.lineTo(pl + pw, Y(t)); g.stroke();
      g.fillStyle = ink; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillText(niceNum(t), pl - 6, Y(t));
    }
    g.fillStyle = ink; g.textAlign = 'right'; g.textBaseline = 'bottom';
    if (o.xlabel) g.fillText(o.xlabel, pl + pw, h - 3);
    if (o.ylabel) { g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(o.ylabel, pl + 4, pt + 2); }

    g.save();
    g.beginPath(); g.rect(pl, pt, pw, ph); g.clip();
    var self = this;
    this.series.forEach(function (s) {
      g.strokeStyle = css(s.color || '--c1') || s.color;
      g.lineWidth = s.width || 2.2;
      g.setLineDash(s.dash || []);
      g.beginPath();
      var started = false;
      if (s.points) {
        s.points.forEach(function (p) {
          if (!started) { g.moveTo(X(p[0]), Y(p[1])); started = true; } else g.lineTo(X(p[0]), Y(p[1]));
        });
      } else {
        var N = Math.max(60, Math.round(pw));
        for (var k = 0; k <= N; k++) {
          var x = o.xmin + (o.xmax - o.xmin) * k / N, y = s.fn(x);
          if (!isFinite(y)) { started = false; continue; }
          y = clamp(y, o.ymin - (o.ymax - o.ymin) * 3, o.ymax + (o.ymax - o.ymin) * 3);
          if (!started) { g.moveTo(X(x), Y(y)); started = true; } else g.lineTo(X(x), Y(y));
        }
      }
      g.stroke();
    });
    g.setLineDash([]);
    this.marks.forEach(function (m) {
      var col = css(m.color || '--c1') || m.color;
      if (m.vline) { g.strokeStyle = col; g.setLineDash([4, 4]); g.lineWidth = 1.2; g.beginPath(); g.moveTo(X(m.x), pt); g.lineTo(X(m.x), pt + ph); g.stroke(); g.setLineDash([]); }
      if (m.hline) { g.strokeStyle = col; g.setLineDash([4, 4]); g.lineWidth = 1.2; g.beginPath(); g.moveTo(pl, Y(m.y)); g.lineTo(pl + pw, Y(m.y)); g.stroke(); g.setLineDash([]); }
      if (m.y !== undefined && m.x !== undefined && !m.noDot) {
        g.fillStyle = col; g.beginPath(); g.arc(X(m.x), Y(clamp(m.y, o.ymin, o.ymax)), 5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = css('--bg'); g.lineWidth = 2; g.stroke();
      }
    });
    g.restore();

    /* legend */
    var lx = pl + 8, ly = pt + (o.ylabel ? 30 : 16);
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '12px ' + css('--sans');
    this.series.forEach(function (s) {
      if (!s.label) return;
      g.fillStyle = css(s.color || '--c1') || s.color;
      g.fillRect(lx, ly - 2, 14, 4);
      g.fillStyle = css('--ink'); g.fillText(s.label, lx + 20, ly);
      ly += 16;
    });

    /* hover read-out on the first function series */
    if (this.hover !== null) {
      var hx = this.hover * w;
      if (hx >= pl && hx <= pl + pw) {
        var xv = o.xmin + (hx - pl) / pw * (o.xmax - o.xmin);
        g.strokeStyle = ink; g.lineWidth = 1; g.setLineDash([2, 3]);
        g.beginPath(); g.moveTo(hx, pt); g.lineTo(hx, pt + ph); g.stroke(); g.setLineDash([]);
        var lines = ['x = ' + niceNum(xv)];
        this.series.forEach(function (s) { if (s.fn) lines.push((s.label ? s.label + ': ' : 'y = ') + fmt(s.fn(xv), 3)); });
        g.font = '11px ' + css('--mono');
        var bw = 0; lines.forEach(function (l) { bw = Math.max(bw, g.measureText(l).width); });
        var bx = hx + 10; if (bx + bw + 12 > w) bx = hx - bw - 22;
        var by = pt + ph - lines.length * 14 - 12;
        g.fillStyle = css('--panel'); g.strokeStyle = css('--line');
        g.fillRect(bx, by, bw + 12, lines.length * 14 + 8); g.strokeRect(bx, by, bw + 12, lines.length * 14 + 8);
        g.fillStyle = css('--ink'); g.textAlign = 'left'; g.textBaseline = 'top';
        lines.forEach(function (l, k) { g.fillText(l, bx + 6, by + 5 + k * 14); });
      }
    }
  };
  function niceNum(v) {
    var a = Math.abs(v);
    if (a >= 1000) return Math.round(v).toString();
    if (a >= 10 || a === 0) return (Math.round(v * 10) / 10).toString();
    return (Math.round(v * 100) / 100).toString();
  }

  /* ---------- DOM bar list ---------- */
  /* items: [{label, value, note}] ; opt: {max, best:'max'|'min'|null, digits, dimBelow} */
  function bars(el, items, opt) {
    el = typeof el === 'string' ? $(el) : el;
    opt = opt || {};
    var max = opt.max;
    if (max === undefined) { max = 0; items.forEach(function (it) { if (isFinite(it.value)) max = Math.max(max, it.value); }); }
    if (!max) max = 1;
    var bestIdx = -1;
    if (opt.best) {
      items.forEach(function (it, i) {
        if (!isFinite(it.value)) return;
        if (bestIdx < 0) { bestIdx = i; return; }
        if (opt.best === 'max' ? it.value > items[bestIdx].value : it.value < items[bestIdx].value) bestIdx = i;
      });
    }
    var html = '';
    items.forEach(function (it, i) {
      var pct = clamp(it.value / max * 100, 0, 100);
      var cls = 'bar' + (i === bestIdx || it.best ? ' best' : '') + (it.dim ? ' dim' : '');
      var style = it.color ? ' style="width:' + pct + '%;background:' + css(it.color) + '"' : ' style="width:' + pct + '%"';
      html += '<div class="' + cls + '" title="' + (it.note || '') + '"><span class="lbl">' + it.label + '</span>' +
        '<span class="track"><span class="fill"' + style + '></span></span>' +
        '<span class="val">' + (it.text !== undefined ? it.text : fmt(it.value, opt.digits)) + '</span></div>';
    });
    el.className = 'bars';
    el.innerHTML = html;
    return bestIdx;
  }

  /* ---------- response-curve library (used on several pages) ---------- */
  var Curves = {
    /* All take x in [0,1] and return y clamped to [0,1]. m = slope, k = exponent, b = y-shift, c = x-shift */
    linear: function (x, p) { return clamp(p.m * (x - p.c) + p.b, 0, 1); },
    poly: function (x, p) {
      var d = x - p.c;
      var v = Math.pow(Math.abs(d), p.k);
      if (d < 0 && Math.round(p.k) % 2 === 1) v = -v;
      return clamp(p.m * v + p.b, 0, 1);
    },
    logistic: function (x, p) { return clamp(p.k / (1 + Math.exp(-p.m * 10 * (x - p.c))) + p.b, 0, 1); },
    logit: function (x, p) {
      var xx = clamp(x - p.c + 0.5, 1e-6, 1 - 1e-6);
      return clamp(p.m * (Math.log(xx / (1 - xx)) / 10) + 0.5 + p.b, 0, 1);
    },
    eval: function (type, x, p) { return (Curves[type] || Curves.linear)(clamp(x, 0, 1), p); },
    text: function (type, p) {
      var m = fmt(p.m, 2), k = fmt(p.k, 2), b = fmt(p.b, 2), c = fmt(p.c, 2);
      if (type === 'linear') return 'y = ' + m + ' * (x - ' + c + ') + ' + b;
      if (type === 'poly') return 'y = ' + m + ' * (x - ' + c + ')^' + k + ' + ' + b;
      if (type === 'logistic') return 'y = ' + k + ' / (1 + e^(-' + m + ' * 10 * (x - ' + c + '))) + ' + b;
      return 'y = ' + m + ' * ln(x\' / (1 - x\')) / 10 + 0.5 + ' + b + '   where x\' = x - ' + c + ' + 0.5';
    }
  };

  /* seeded-free helpers for weighted picks */
  function weightedPick(weights) {
    var total = 0, i;
    for (i = 0; i < weights.length; i++) total += weights[i];
    var r = Math.random() * total, acc = 0;
    for (i = 0; i < weights.length; i++) { acc += weights[i]; if (r < acc) return i; }
    return weights.length - 1;
  }

  window.BM = { $: $, css: css, clamp: clamp, fmt: fmt, val: val, wire: wire, Plot: Plot, bars: bars, Curves: Curves, weightedPick: weightedPick, onRedraw: onRedraw };
  /* app.js is loaded at the end of <body>, after <main>, so the chrome can be built right away
     and page scripts that follow see the final layout. */
  if (document.querySelector('main')) buildChrome();
  else document.addEventListener('DOMContentLoaded', function () { buildChrome(); redrawAll(); });
})();
