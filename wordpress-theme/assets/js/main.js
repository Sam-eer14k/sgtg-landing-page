/* SG Technology Group landing page.
   Plain JS, no libraries. Each module runs inside safe(), so one failure can't
   stop the others. Modules, in page order:
   util · visibility · cursor · magnetic · cards (spotlight + tilt) · orbs ·
   nav (scrollspy, anchors, header, menu) · hero video · network monitor ·
   stages · network map · counters · services · symptoms · tiles · marquee ·
   calculator · checklist · timeline · cases · reviews · faq · form ·
   back to top · headings + reveals */
(function () {
  'use strict';

  /* ================= util ================= */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var root = document.documentElement;
  function safe(name, fn) { try { fn(); } catch (e) { if (window.console) console.error('[' + name + ']', e); } }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /* Tween a number shown in an element; always lands on the final value. */
  function tween(el, from, to, dur, fmt) {
    if (reduce) { el.textContent = fmt(to); return; }
    var t0 = null;
    cancelAnimationFrame(el._raf);
    clearTimeout(el._end);
    el._end = setTimeout(function () { cancelAnimationFrame(el._raf); el.textContent = fmt(to); }, dur + 150);
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) el._raf = requestAnimationFrame(step);
    }
    el._raf = requestAnimationFrame(step);
  }
  function scrollToEl(el, focus) {
    if (!el) return;
    var y = el.getBoundingClientRect().top + window.scrollY - (el.id === 'top' ? 0 : 76);
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
    if (focus) {
      if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
  }
  /* Bridge into the contact form (picker, service CTAs, stages, calculator, checklist). */
  var formApi = { prefill: function () {} };
  /* One throttled scroll loop shared by several modules. */
  var onScrollFns = [];

  if (reduce || !finePointer) root.classList.add('no-tilt');

  safe('year', function () { $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); }); });

  /* ================= visibility: .is-vis on sections on screen (pauses loops elsewhere) ================= */
  safe('visibility', function () {
    var secs = $$('main > section, .cta-strip');
    if (!('IntersectionObserver' in window)) { secs.forEach(function (s) { s.classList.add('is-vis'); }); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { e.target.classList.toggle('is-vis', e.isIntersecting); });
    }, { rootMargin: '120px 0px' });
    secs.forEach(function (s) { io.observe(s); });
  });

  /* ================= cursor: dot + lerped ring (mouse only) ================= */
  safe('cursor', function () {
    if (!finePointer || reduce) return;
    var cur = $('.cursor');
    var dot = $('.cursor__dot', cur);
    var ring = $('.cursor__ring', cur);
    var label = $('.cursor__label', cur);
    root.classList.add('has-cursor');
    var mx = -100, my = -100, rx = -100, ry = -100, shown = false;
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      if (!shown) { rx = mx; ry = my; shown = true; cur.classList.remove('is-off'); cur.classList.add('is-ready'); }
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
    }, { passive: true });
    (function loop() {
      rx += (mx - rx) * 0.15;
      ry += (my - ry) * 0.15;
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      requestAnimationFrame(loop);
    })();
    var hoverSel = 'a, button, [role="button"], [role="slider"], [role="tab"], label, tr[tabindex], .card';
    document.addEventListener('pointerover', function (e) {
      var t = e.target;
      if (t.closest('input:not([type="checkbox"]), textarea, select')) { cur.classList.add('is-off'); return; }
      if (shown) cur.classList.remove('is-off');
      var lab = t.closest('[data-cursor]');
      var hov = t.closest(hoverSel);
      cur.classList.toggle('is-label', !!lab);
      cur.classList.toggle('is-hover', !lab && !!hov);
      label.textContent = lab ? lab.getAttribute('data-cursor') : '';
    });
    document.addEventListener('pointerdown', function () { cur.classList.add('is-down'); });
    document.addEventListener('pointerup', function () { cur.classList.remove('is-down'); });
    root.addEventListener('pointerleave', function () { cur.classList.add('is-off'); shown = false; });
  });

  /* ================= magnetic primary buttons (desktop only) ================= */
  safe('magnetic', function () {
    if (!finePointer || reduce) return;
    $$('[data-magnetic]').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.22;
        var y = (e.clientY - r.top - r.height / 2) * 0.35;
        b.style.transform = 'translate(' + clamp(x, -10, 10) + 'px,' + clamp(y, -8, 8) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  });

  /* ================= cards: cursor spotlight on every card, 3D tilt on [data-tilt] ================= */
  safe('cards', function () {
    if (!finePointer) return;
    var tilt = !reduce;
    var active = null, ev = null, raf = 0;
    function frame() {
      raf = 0;
      if (!active || !ev) return;
      var r = active.getBoundingClientRect();
      var x = ev.clientX - r.left, y = ev.clientY - r.top;
      active.style.setProperty('--mx', x + 'px');
      active.style.setProperty('--my', y + 'px');
      var deg = parseFloat(active.getAttribute('data-tilt'));
      if (tilt && deg) {
        var ry = (x / r.width - 0.5) * deg * 2;
        var rx = -(y / r.height - 0.5) * deg * 2;
        active.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-3px)';
      }
    }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var c = e.target.closest ? e.target.closest('.card') : null;
      if (c !== active) {
        if (active) active.style.transform = '';
        active = c;
      }
      ev = e;
      if (active && !raf) raf = requestAnimationFrame(frame);
    }, { passive: true });
    document.addEventListener('pointerleave', function () { if (active) active.style.transform = ''; active = null; });
  });

  /* ================= floating orbs follow the mouse (desktop only) ================= */
  safe('orbs', function () {
    if (!finePointer || reduce) return;
    var px = 0, py = 0, raf = 0;
    function frame() {
      raf = 0;
      $$('.is-vis > .orbs').forEach(function (o) { o.style.setProperty('--px', px.toFixed(3)); o.style.setProperty('--py', py.toFixed(3)); });
    }
    document.addEventListener('pointermove', function (e) {
      px = (e.clientX / window.innerWidth - 0.5) * 2;
      py = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(frame);
    }, { passive: true });
  });

  /* ================= nav: scrollspy ================= */
  safe('scrollspy', function () {
    var links = $$('.nav a[href^="#"]');
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var watched = Object.keys(map).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!('IntersectionObserver' in window)) return;
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      var current = null;
      watched.forEach(function (s) { if (visible[s.id] && !current) current = s.id; });
      links.forEach(function (a) {
        if (current && a === map[current]) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    watched.forEach(function (s) { io.observe(s); });
  });

  /* ================= in-page links: smooth scroll ================= */
  safe('anchors', function () {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      var id = a.getAttribute('href').slice(1);
      var el = id ? document.getElementById(id) : null;
      if (!el) return;
      e.preventDefault();
      if (a.hasAttribute('data-to-top')) {
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        var plate = $('.head__plate');
        if (plate) plate.focus({ preventScroll: true });
        return;
      }
      scrollToEl(el, !a.closest('[data-svc], [data-prefill], [data-sym-go], [data-calc-go], [data-chk-go], [data-stage-cta]'));
      if (history.replaceState) history.replaceState(null, '', '#' + id);
    });
  });

  /* ================= scroll loop ================= */
  safe('scroll', function () {
    var ticking = false;
    function run() { ticking = false; onScrollFns.forEach(function (f) { f(); }); }
    function req() { if (!ticking) { ticking = true; requestAnimationFrame(run); } }
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req);
    setTimeout(run, 0);
  });

  safe('header', function () {
    var head = $('#head');
    onScrollFns.push(function () { head.classList.toggle('is-stuck', window.scrollY > 40); });
  });

  /* ================= mobile menu ================= */
  safe('menu', function () {
    var menu = $('#menu');
    var burger = $('.burger');
    var last = null;
    function open() {
      last = document.activeElement;
      menu.hidden = false;
      document.body.classList.add('is-locked');
      burger.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () { menu.classList.add('is-open'); $('.menu__close', menu).focus(); });
    }
    function close(restore) {
      menu.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      burger.setAttribute('aria-expanded', 'false');
      setTimeout(function () { menu.hidden = true; }, reduce ? 0 : 300);
      if (restore !== false && last) last.focus({ preventScroll: true });
    }
    burger.addEventListener('click', open);
    $('.menu__close', menu).addEventListener('click', close);
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { close(false); }); });
    document.addEventListener('keydown', function (e) {
      if (menu.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        var f = $$('a, button', menu);
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    window.addEventListener('resize', function () { if (!menu.hidden && window.innerWidth >= 1100) close(false); });
  });

  /* ================= hero video (desktop only, after first paint) ================= */
  safe('hero-video', function () {
    var v = $('.hero__video');
    if (!v) return;
    var desktop = window.matchMedia('(min-width: 1024px)').matches;
    var saveData = navigator.connection && navigator.connection.saveData;
    if (!desktop || reduce || saveData) { v.remove(); return; }
    function start() {
      v.src = v.getAttribute('data-src');
      v.muted = true;
      v.autoplay = true;
      v.addEventListener('playing', function () { $('.hero').classList.add('has-video'); }, { once: true });
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* autoplay refused: the poster stays */ });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) {
          if (en[0].isIntersecting) { var q = v.play(); if (q && q.catch) q.catch(function () {}); } else v.pause();
        }).observe(v);
      }
    }
    function later() { ('requestIdleCallback' in window) ? requestIdleCallback(start, { timeout: 2000 }) : setTimeout(start, 600); }
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
  });

  /* ================= SG Network Monitor (decorative hero panel) ================= */
  safe('monitor', function () {
    var mon = $('[data-mon]');
    if (!mon || getComputedStyle(mon).display === 'none') return;
    var hero = $('.hero');
    var rows = $$('.mon__rows li', mon);
    var nodes = {};
    $$('.mon__node', mon).forEach(function (n) { nodes[n.getAttribute('data-k')] = n; });
    var links = {};
    $$('.mon__links path', mon).forEach(function (p) { links[p.getAttribute('data-k')] = p; });
    var bar = $('[data-mon-bar]', mon);
    var msg = $('[data-mon-msg]', mon);
    var done = $('[data-mon-done]', mon);
    var clock = $('[data-mon-clock]', mon);
    var rate = $('[data-mon-rate]', mon);
    var line = $('.mon__line', mon);
    var area = $('.mon__area', mon);

    // Hovering a row lights its node on the map.
    rows.forEach(function (r) {
      var k = r.getAttribute('data-k');
      r.addEventListener('mouseenter', function () { nodes[k].classList.add('is-hot'); });
      r.addEventListener('mouseleave', function () { nodes[k].classList.remove('is-hot'); });
    });

    // Sparkline: a random walk of sample traffic values.
    var pts = [];
    for (var i = 0; i < 32; i++) pts.push(40 + Math.sin(i / 3) * 10 + Math.random() * 8);
    function drawSpark() {
      var step = 160 / (pts.length - 1);
      var p = pts.map(function (v, j) { return (j * step).toFixed(1) + ',' + (30 - v * 0.4).toFixed(1); });
      line.setAttribute('points', p.join(' '));
      area.setAttribute('d', 'M0 30L' + p.join('L') + 'L160 30Z');
      rate.textContent = Math.round(pts[pts.length - 1]);
    }
    drawSpark();
    if (reduce) return;   // static final state

    mon.classList.add('mon--live');
    var t0 = Date.now();
    function visible() { return hero.classList.contains('is-vis') && !document.hidden; }
    setInterval(function () {
      var s = Math.floor((Date.now() - t0) / 1000);
      clock.textContent = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
      if (visible()) {
        var last = pts[pts.length - 1];
        pts.shift();
        pts.push(clamp(last + (Math.random() - 0.5) * 14, 18, 68));
        drawSpark();
      }
    }, 700);

    var LOOP = 12000;
    function run() {
      if (!visible()) { setTimeout(run, 800); return; }
      var start = Date.now();
      rows.forEach(function (r) { r.className = ''; });
      Object.keys(nodes).forEach(function (k) { nodes[k].classList.remove('is-on', 'is-scan'); links[k].classList.remove('is-lit'); });
      bar.style.transform = 'scaleX(0)';
      msg.textContent = 'Scanning network';
      done.textContent = '0/' + rows.length;
      var i = 0;
      (function next() {
        if (i === rows.length) {
          msg.textContent = 'All systems normal';
          setTimeout(run, Math.max(2000, LOOP - (Date.now() - start)));
          return;
        }
        var r = rows[i], k = r.getAttribute('data-k');
        r.classList.add('is-in', 'is-scan');
        nodes[k].classList.add('is-scan');
        links[k].classList.add('is-lit');
        msg.textContent = 'Checking ' + $('.mon__lbl', r).textContent.toLowerCase();
        setTimeout(function () {
          r.classList.remove('is-scan');
          r.classList.add('is-ok');
          nodes[k].classList.remove('is-scan');
          nodes[k].classList.add('is-on');
          var c = $('[data-mon-count]', r);
          if (c) tween(c, 0, +c.getAttribute('data-mon-count'), 500, function (v) { return String(Math.round(v)); });
          i++;
          bar.style.transform = 'scaleX(' + (i / rows.length) + ')';
          done.textContent = i + '/' + rows.length;
          setTimeout(next, 220);
        }, 720);
      })();
    }
    setTimeout(run, 1600);
  });

  /* ================= how we work: three stages (auto-cycle until the visitor interacts) ================= */
  safe('stages', function () {
    var wrap = $('[data-stages]');
    var stages = $$('.stage', wrap);
    var steps = $$('[data-stage-go]');
    var stepList = $('.how__steps');
    var wide = window.matchMedia('(min-width: 900px)');
    var cur = 0;
    function open(idx, toggle) {
      var s = stages[idx];
      var willOpen = toggle ? !s.classList.contains('is-open') : true;
      if (wide.matches && !willOpen) return;
      stages.forEach(function (o, j) {
        var on = j === idx && willOpen;
        o.classList.toggle('is-open', on);
        $('.stage__btn', o).setAttribute('aria-expanded', on ? 'true' : 'false');
        $('.stage__body', o).hidden = !on;
      });
      cur = idx;
      steps.forEach(function (b, j) { if (j === idx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      if (stepList) stepList.style.setProperty('--stp', String(idx / (stages.length - 1)));
    }
    function stopCycle() { wrap.classList.remove('is-cycling'); }
    stages.forEach(function (s, idx) {
      $('.stage__btn', s).addEventListener('click', function () { stopCycle(); open(idx, true); });
      $('.stage__timer i', s).addEventListener('animationend', function () {
        if (wrap.classList.contains('is-cycling')) open((cur + 1) % stages.length);
      });
    });
    steps.forEach(function (b) {
      b.addEventListener('click', function () { stopCycle(); open(+b.getAttribute('data-stage-go')); });
    });
    // Any real interaction ends the auto-cycle; hovering only pauses it.
    ['pointerdown', 'keydown', 'focusin'].forEach(function (t) { wrap.addEventListener(t, stopCycle); });
    wrap.addEventListener('mouseenter', function () { wrap.classList.add('is-held'); });
    wrap.addEventListener('mouseleave', function () { wrap.classList.remove('is-held'); });
    $$('[data-stage-cta]').forEach(function (a) {
      a.addEventListener('click', function () { formApi.prefill('', 'I\'d like to talk about the "' + a.getAttribute('data-stage-cta') + '" stage. '); });
    });
    open(0);
    if (wide.matches && !reduce) wrap.classList.add('is-cycling');
  });

  /* ================= about: explorable network map ================= */
  safe('netmap', function () {
    var map = $('.netmap');
    var nodes = $$('.node', map);
    var cards = $$('[data-panel]');
    var links = $$('.netmap__links path', map);
    function show(key) {
      nodes.forEach(function (n) { var on = n.getAttribute('data-node') === key; n.classList.toggle('is-active', on); n.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      map.classList.toggle('has-active', key !== 'intro');
      var node = nodes.filter(function (n) { return n.getAttribute('data-node') === key; })[0];
      var lit = node ? node.getAttribute('data-links').split(' ') : [];
      links.forEach(function (l) { l.classList.toggle('is-lit', lit.indexOf(l.id) > -1); });
      cards.forEach(function (c) { var on = c.getAttribute('data-panel') === key; c.hidden = !on; c.classList.toggle('is-current', on); });
    }
    nodes.forEach(function (n) {
      var key = n.getAttribute('data-node');
      n.setAttribute('aria-pressed', 'false');
      n.addEventListener('mouseenter', function () { show(key); });
      n.addEventListener('focus', function () { show(key); });
      n.addEventListener('click', function () { show(key); });
      n.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(key); }
        if (e.key === 'Escape') show('intro');
      });
    });
  });

  /* ================= stats: count-ups ================= */
  safe('counters', function () {
    var nums = $$('[data-count]');
    if (reduce || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        tween(el, +el.getAttribute('data-from') || 0, +el.getAttribute('data-count'), 1800, function (v) { return String(Math.round(v)); });
        io.unobserve(el);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) {
      if (n.getBoundingClientRect().top > window.innerHeight) { n.textContent = n.getAttribute('data-from') || '0'; io.observe(n); }
    });
  });

  /* ================= services: split panel / accordion ================= */
  var openService = function () {};
  safe('services', function () {
    var items = $$('.svc__item');
    var tabs = items.map(function (i) { return $('.svc__tab', i); });
    var wide = window.matchMedia('(min-width: 900px)');
    function set(item, on) {
      item.classList.toggle('is-open', on);
      $('.svc__tab', item).setAttribute('aria-expanded', on ? 'true' : 'false');
      $('.svc__panel', item).hidden = !on;
    }
    openService = function (key, toggle) {
      var target = items.filter(function (i) { return i.getAttribute('data-key') === key; })[0];
      if (!target) return;
      var closing = toggle && target.classList.contains('is-open');
      if (closing && wide.matches) return;
      items.forEach(function (i) { set(i, i === target && !closing); });
    };
    tabs.forEach(function (t, idx) {
      t.addEventListener('click', function () { openService(items[idx].getAttribute('data-key'), true); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = null;
        if (k === 'ArrowDown') n = (idx + 1) % tabs.length;
        if (k === 'ArrowUp') n = (idx - 1 + tabs.length) % tabs.length;
        if (k === 'Home') n = 0;
        if (k === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault();
        tabs[n].focus();
        if (wide.matches) openService(items[n].getAttribute('data-key'));
      });
    });
    $$('[data-svc]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var key = a.getAttribute('data-svc');
        openService(key);
        var target = items.filter(function (i) { return i.getAttribute('data-key') === key; })[0];
        scrollToEl(wide.matches ? $('#services') : target);
        setTimeout(function () { $('.svc__tab', target).focus({ preventScroll: true }); }, reduce ? 0 : 500);
      });
    });
    $$('[data-prefill]').forEach(function (a) {
      a.addEventListener('click', function () { formApi.prefill(a.getAttribute('data-prefill')); });
    });
  });

  /* ================= symptom picker ================= */
  safe('symptoms', function () {
    var data = {
      wifi: { svc: 'Infrastructure design and setup', opt: 'IT infrastructure design and implementation', key: 'infra', label: 'Wi-Fi keeps dropping',
        title: 'Find the dead spots, then fix the setup', text: 'We check where the signal is weak and what is crowding it, then rework the network so it covers the whole office.' },
      email: { svc: 'Cloud computing solutions', opt: 'Cloud computing solutions', key: 'cloud', label: 'Email isn\'t syncing',
        title: 'Trace where the mail stops', text: 'We work out whether it is the account, the device or the server, then get every phone and computer seeing the same inbox again.' },
      slow: { svc: 'IT training and support', opt: 'IT training and support', key: 'training', label: 'Computers are slow',
        title: 'Find out why before buying anything', text: 'Old hardware, a full drive, too much running at startup or malware. We repair what can be fixed and tell you straight what can\'t.' },
      breach: { svc: 'Cybersecurity and risk management', opt: 'Cybersecurity and risk management', key: 'security', label: 'Worried about a breach',
        title: 'Start with a threat assessment', text: 'We look at where you are exposed, close the obvious gaps and put data protection in place, so one bad click doesn\'t cost you your files.' },
      move: { svc: 'IT project management', opt: 'IT project management', key: 'projects', label: 'Moving offices',
        title: 'Plan the move before the boxes', text: 'We plan the move with you so phones, network and computers are ready when your team walks into the new office.' },
      server: { svc: 'Infrastructure design and setup', opt: 'IT infrastructure design and implementation', key: 'infra', label: 'Need a new server',
        title: 'Size it, install it, move your files', text: 'We size the server for how many people use it and what runs on it, install it, and move your data across.' }
    };
    var chips = $$('.chip');
    var ticket = $('.ticket');
    var empty = $('[data-sym-empty]');
    var result = $('[data-sym-result]');
    var status = $('[data-sym-status]');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var key = c.getAttribute('data-sym');
        var on = c.getAttribute('aria-pressed') !== 'true';
        chips.forEach(function (o) { o.setAttribute('aria-pressed', o === c && on ? 'true' : 'false'); });
        var cur = on ? data[key] : null;
        ticket.classList.toggle('is-set', !!cur);
        empty.hidden = !!cur;
        result.hidden = !cur;
        status.textContent = cur ? 'Likely fix' : 'Waiting for a pick';
        if (!cur) return;
        $('[data-sym-svc]').textContent = cur.svc;
        $('[data-sym-title]').textContent = cur.title;
        $('[data-sym-text]').textContent = cur.text;
        result.style.animation = 'none'; void result.offsetWidth; result.style.animation = '';
        openService(cur.key);
        formApi.prefill(cur.opt, cur.label + '. ');
      });
    });
  });

  /* ================= tiles (support + industries): tap to expand on touch ================= */
  safe('tiles', function () {
    var all = $$('.tile > button, .ind-tile');
    all.forEach(function (b) {
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-expanded') !== 'true';
        all.forEach(function (o) { o.setAttribute('aria-expanded', 'false'); });
        b.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
    });
  });

  /* ================= trusted-by marquee: duplicate for a continuous loop ================= */
  safe('marquee', function () {
    var list = $('.marquee__list');
    if (!list || reduce) return;
    $$('li', list).forEach(function (li) { var c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); list.appendChild(c); });
  });

  /* ================= downtime calculator ================= */
  safe('calculator', function () {
    var box = $('[data-calc]');
    var people = $('#c-people'), rate = $('#c-rate'), hours = $('#c-hours');
    var outMonth = $('[data-res="month"]'), outYear = $('[data-res="year"]');
    var last = { m: 0, y: 0 };
    function fill(i) { i.style.setProperty('--p', ((i.value - i.min) / (i.max - i.min) * 100) + '%'); }
    function update(animate) {
      var p = +people.value, r = +rate.value, h = +hours.value;
      $('[data-out="people"]', box).textContent = p;
      $('[data-out="rate"]', box).textContent = '$' + r;
      $('[data-out="hours"]', box).textContent = (h % 1 ? h.toFixed(1) : h) + ' h';
      [people, rate, hours].forEach(fill);
      var m = p * r * h, y = m * 12;
      if (animate) { tween(outMonth, last.m, m, 450, money); tween(outYear, last.y, y, 450, money); }
      else { outMonth.textContent = money(m); outYear.textContent = money(y); }
      last = { m: m, y: y };
    }
    [people, rate, hours].forEach(function (i) { i.addEventListener('input', function () { update(true); }); });
    update(false);
    $('[data-calc-go]').addEventListener('click', function () {
      formApi.prefill('', 'Our downtime calculator estimate is ' + money(last.m) + ' a month (' + people.value + ' people, $' + rate.value + '/hour, ' + hours.value + ' hours down). ');
    });
  });

  /* ================= security checklist ================= */
  safe('checklist', function () {
    var list = $('[data-chk]');
    var boxes = $$('input[type="checkbox"]', list);
    var panel = $('.chk__score');
    var scoreEl = $('[data-chk-score]');
    var tier = $('[data-chk-tier]');
    var msg = $('[data-chk-msg]');
    var gauge = $('.gauge__fill');
    var last = 0;
    var tiers = [
      { max: 0, key: '', t: 'Start ticking', m: 'Your score updates as you go.' },
      { max: 3, key: 'low', t: 'High risk', m: 'Several basic protections are missing. These are the gaps attackers look for first.' },
      { max: 6, key: 'mid', t: 'Some gaps', m: 'You have some of the basics covered. The missing pieces still leave you exposed.' },
      { max: 7, key: 'high', t: 'Nearly there', m: 'One thing left. Worth closing before it becomes the one that matters.' },
      { max: 8, key: 'high', t: 'Strong basics', m: 'Good habits. A second pair of eyes can confirm nothing slipped through.' }
    ];
    function update() {
      var n = boxes.filter(function (b) { return b.checked; }).length;
      tween(scoreEl, last, n, 400, function (v) { return String(Math.round(v)); });
      last = n;
      gauge.style.setProperty('--g', String(100 - n / boxes.length * 100));
      var t = tiers.filter(function (x) { return n <= x.max; })[0];
      tier.textContent = t.t;
      msg.textContent = t.m;
      panel.setAttribute('data-tier', t.key);
    }
    boxes.forEach(function (b) { b.addEventListener('change', update); });
    $('[data-chk-go]').addEventListener('click', function () {
      var missing = boxes.filter(function (b) { return !b.checked; }).map(function (b) { return b.value.toLowerCase(); });
      var n = boxes.length - missing.length;
      formApi.prefill('Cybersecurity and risk management', 'Security checklist: ' + n + '/' + boxes.length + '.' + (missing.length ? ' Missing: ' + missing.join('; ') + '.' : '') + ' ');
    });
  });

  /* ================= process timeline: line fills as you scroll ================= */
  safe('timeline', function () {
    var tl = $('[data-timeline]');
    var fill = $('[data-timeline-fill]', tl);
    var steps = $$('.tl-step', tl);
    onScrollFns.push(function () {
      var r = tl.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      var mark = window.innerHeight * 0.62;
      var p = clamp((mark - r.top) / r.height, 0, 1);
      fill.style.setProperty('--p', p.toFixed(3));
      var reached = -1;
      steps.forEach(function (s, i) {
        var n = $('.tl-step__num', s).getBoundingClientRect();
        var on = n.top + n.height / 2 < mark;
        s.classList.toggle('is-reached', on);
        if (on) reached = i;
      });
      steps.forEach(function (s, i) { s.classList.toggle('is-current', i === reached && p < 1); });
    });
  });

  /* ================= case results: tabs + before/after sliders ================= */
  safe('cases', function () {
    var tabs = $$('.cases__tabs [role="tab"]');
    function select(t, focus) {
      tabs.forEach(function (o) {
        var on = o === t;
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        o.tabIndex = on ? 0 : -1;
        document.getElementById(o.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) t.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') n = 0;
        if (e.key === 'End') n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); select(tabs[n], true); }
      });
    });
    $$('[data-ba]').forEach(function (ba) {
      var handle = $('.ba__handle', ba);
      var pos = 50;
      function set(v) {
        pos = clamp(v, 0, 100);
        ba.style.setProperty('--pos', pos + '%');
        handle.setAttribute('aria-valuenow', String(Math.round(pos)));
        handle.setAttribute('aria-valuetext', pos < 5 ? 'Showing after' : pos > 95 ? 'Showing before' : Math.round(pos) + '% before, ' + Math.round(100 - pos) + '% after');
      }
      function fromX(x) { var r = ba.getBoundingClientRect(); set((x - r.left) / r.width * 100); }
      ba.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        ba.classList.add('is-drag');
        ba.setPointerCapture(e.pointerId);
        fromX(e.clientX);
      });
      ba.addEventListener('pointermove', function (e) { if (ba.classList.contains('is-drag')) fromX(e.clientX); });
      ['pointerup', 'pointercancel'].forEach(function (t) { ba.addEventListener(t, function () { ba.classList.remove('is-drag'); }); });
      handle.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 20 : 5;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(pos - step); }
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(pos + step); }
        if (e.key === 'Home') { e.preventDefault(); set(0); }
        if (e.key === 'End') { e.preventDefault(); set(100); }
      });
      set(50);
    });
  });

  /* ================= testimonials: auto-advance, pause, swipe ================= */
  safe('reviews', function () {
    var box = $('[data-qslider]');
    var slides = $$('.q', box);
    var bar = $('[data-q-progress]', box);
    var at = $('[data-q-at]', box);
    var pauseBtn = $('[data-q="pause"]', box);
    var i = 0, held = false, userPaused = reduce;
    function restartBar() {
      bar.classList.remove('is-run');
      if (userPaused) { bar.style.transform = 'scaleX(0)'; return; }
      bar.style.transform = '';
      void bar.offsetWidth;
      bar.classList.add('is-run');
    }
    function go(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) {
        var on = k === i;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
        if ('inert' in s) s.inert = !on;
      });
      at.textContent = pad(i + 1);
      restartBar();
    }
    function sync() { box.classList.toggle('is-paused', held || userPaused); }
    bar.addEventListener('animationend', function () { go(i + 1); });
    $('[data-q="next"]', box).addEventListener('click', function () { go(i + 1); });
    $('[data-q="prev"]', box).addEventListener('click', function () { go(i - 1); });
    pauseBtn.addEventListener('click', function () {
      userPaused = !userPaused;
      pauseBtn.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
      pauseBtn.textContent = userPaused ? 'Play' : 'Pause';
      sync();
      restartBar();
    });
    if (reduce) { pauseBtn.textContent = 'Play'; pauseBtn.setAttribute('aria-pressed', 'true'); }
    box.addEventListener('mouseenter', function () { held = true; sync(); });
    box.addEventListener('mouseleave', function () { held = false; sync(); });
    box.addEventListener('focusin', function () { held = true; sync(); });
    box.addEventListener('focusout', function (e) { if (!box.contains(e.relatedTarget)) { held = false; sync(); } });
    var track = $('.qslider__track', box), x0 = null;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') x0 = e.clientX; });
    track.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { held = !en[0].isIntersecting; sync(); }).observe(box);
    go(0);
  });

  /* ================= FAQ: accordion + search ================= */
  safe('faq', function () {
    var items = $$('[data-faq-item]');
    var input = $('#faq-q');
    var empty = $('[data-faq-empty]');
    var count = $('[data-faq-count]');
    function toggle(item, force) {
      var btn = $('button', item);
      var on = typeof force === 'boolean' ? force : btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      item.classList.toggle('is-open', on);
    }
    items.forEach(function (item) {
      item._q = $('button span', item).textContent;
      item._a = $('.acc__panel', item).textContent.toLowerCase();
      $('button', item).addEventListener('click', function () { toggle(item); });
    });
    function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function escHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    var t = null;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
        var shown = 0;
        items.forEach(function (item) {
          var span = $('button span', item);
          var hay = item._q.toLowerCase() + ' ' + item._a;
          var match = words.every(function (w) { return hay.indexOf(w) > -1; });
          item.hidden = !match;
          if (match) shown++;
          if (words.length && match) {
            var re = new RegExp('(' + words.map(esc).join('|') + ')', 'gi');
            span.innerHTML = escHtml(item._q).replace(re, '<mark class="hl">$1</mark>');
            var inQ = words.every(function (w) { return item._q.toLowerCase().indexOf(w) > -1; });
            toggle(item, !inQ);
          } else {
            span.textContent = item._q;
            if (!words.length) toggle(item, false);
          }
        });
        empty.hidden = shown > 0;
        count.textContent = words.length && shown ? shown + ' of ' + items.length + ' questions match.' : '';
      }, 120);
    });
    $$('[data-faq]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var item = document.getElementById(a.getAttribute('data-faq'));
        if (!item) return;
        input.value = ''; input.dispatchEvent(new Event('input'));
        toggle(item, true);
        scrollToEl(item);
        setTimeout(function () { $('button', item).focus({ preventScroll: true }); }, reduce ? 0 : 500);
      });
    });
  });

  /* ================= contact form =================
     data-mode="wp": validate, then post to admin-post.php.
     data-mode="mailto": validate, then open the visitor's email app.
     data-mode="none": no inbox configured yet, so show the phone number and a copy button. */
  safe('form', function () {
    var form = $('#contact-form');
    var done = $('#form-done');
    var mode = form.getAttribute('data-mode');
    var copyBtn = $('[data-form-copy]');
    var msgEl = $('#f-message');
    var counter = $('[data-count-msg]');
    var lastPrefill = '';
    var lastBody = '';
    var rules = {
      name: function (v) { return v.length >= 2 ? '' : 'Please add your name so we know who to ask for.'; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'That email doesn\'t look right. Try something like jane@company.com.'; },
      phone: function (v) { return !v || v.replace(/\D/g, '').length >= 10 ? '' : 'Phone numbers need at least 10 digits. You can also leave this blank.'; },
      message: function (v) { return v.length >= 10 ? '' : 'Tell us a little more, a sentence is plenty (10 characters or more).'; }
    };
    function check(name) {
      var el = form.elements[name];
      var v = el.value.trim();
      var m = rules[name](v);
      var wrap = el.closest('.fl');
      wrap.classList.toggle('is-invalid', !!m);
      wrap.classList.toggle('is-valid', !m && !!v);
      el.setAttribute('aria-invalid', m ? 'true' : 'false');
      $('#e-' + name).textContent = m;
      return !m;
    }
    Object.keys(rules).forEach(function (n) {
      var el = form.elements[n];
      el.addEventListener('blur', function () { if (el.value.trim() || el.closest('.fl').classList.contains('is-invalid')) check(n); });
      el.addEventListener('input', function () { if (el.closest('.fl').classList.contains('is-invalid')) check(n); });
    });
    function count() { counter.textContent = msgEl.value.length; }
    msgEl.addEventListener('input', count);
    formApi.prefill = function (service, message) {
      var sel = $('#f-service');
      if (service) $$('option', sel).forEach(function (o) { if ((o.value || o.textContent) === service) sel.value = o.value || o.textContent; });
      if (message && (!msgEl.value.trim() || msgEl.value === lastPrefill)) { msgEl.value = message; lastPrefill = message; count(); }
    };
    form.addEventListener('submit', function (e) {
      var bad = Object.keys(rules).filter(function (n) { return !check(n); });
      if (bad.length) { e.preventDefault(); form.elements[bad[0]].focus(); return; }
      if (form.elements.website && form.elements.website.value) { e.preventDefault(); return; }
      var btn = $('[type="submit"]', form);
      if (mode === 'wp') { btn.disabled = true; $('span', btn).textContent = 'Sending...'; return; }
      e.preventDefault();
      var v = function (n) { return (form.elements[n].value || '').trim(); };
      var service = v('service') || 'Not sure yet';
      lastBody = ['Name: ' + v('name'), 'Email: ' + v('email'), 'Phone: ' + (v('phone') || 'Not given'), 'Service: ' + service, '', v('message')].join('\n');
      $('#form-done-title').textContent = 'Thanks, ' + v('name').split(' ')[0] + '.';
      if (mode === 'mailto') {
        var to = (form.getAttribute('action') || '').replace(/^mailto:/, '');
        window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Callback request: ' + service + ', ' + v('name')) + '&body=' + encodeURIComponent(lastBody);
        $('#form-done-text').textContent = 'Your email app should open with your details filled in. Press send there and we\'ll call you back. If nothing opened, call us on 347.674.8324.';
        copyBtn.hidden = true;
      } else {
        $('#form-done-text').textContent = 'For the fastest reply, call us on 347.674.8324. You can also copy your message to paste into an email or text.';
        copyBtn.hidden = !navigator.clipboard;
      }
      form.hidden = true;
      done.hidden = false;
      done.focus();
    });
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(lastBody).then(function () { $('span', copyBtn).textContent = 'Copied'; }, function () { $('span', copyBtn).textContent = 'Copy failed'; });
    });
    $('[data-form-reset]').addEventListener('click', function () {
      done.hidden = true; form.hidden = false;
      $('span', copyBtn).textContent = 'Copy my message';
      $('#f-name').focus();
    });
    $$('a[href="#contact"]').forEach(function (a) {
      a.addEventListener('click', function () {
        setTimeout(function () {
          if (form.hidden) return;
          var first = ['name', 'email', 'message'].map(function (n) { return form.elements[n]; }).filter(function (el) { return !el.value.trim(); })[0];
          (first || $('#f-name')).focus({ preventScroll: true });
        }, reduce ? 0 : 700);
      });
    });
    var status = $('#form-status');
    if (status && status.textContent.trim()) { status.setAttribute('tabindex', '-1'); setTimeout(function () { status.focus(); }, 300); }
    count();
  });

  /* ================= back to top ================= */
  safe('totop', function () {
    var btn = $('.totop');
    var fill = $('.totop__fill', btn);
    onScrollFns.push(function () {
      var y = window.scrollY;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      btn.classList.toggle('is-visible', y > 400);
      fill.style.setProperty('--off', String(100 - 100 * clamp(y / (max || 1), 0, 1)));
    });
  });

  /* ================= headings (word by word) + scroll reveals =================
     Fail-safe: nothing is hidden until JS adds .js-reveal, and anything at or
     above the viewport line is revealed on every scroll. */
  safe('reveals', function () {
    // Split headings into words; the chrome <em> stays one word.
    $$('[data-reveal="words"]').forEach(function (h) {
      var n = 0;
      Array.prototype.slice.call(h.childNodes).forEach(function (node) {
        if (node.nodeType === 3) {
          var frag = document.createDocumentFragment();
          node.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var s = document.createElement('span');
            s.className = 'wd'; s.style.setProperty('--wi', n++); s.textContent = part;
            frag.appendChild(s);
          });
          h.replaceChild(frag, node);
        } else if (node.nodeType === 1) {
          node.classList.add('wd'); node.style.setProperty('--wi', n++);
        }
      });
    });
    if (reduce) return;
    var els = $$('[data-reveal]');
    $$('[data-stagger]').forEach(function (g) {
      $$('[data-reveal]', g).forEach(function (el, i) { el.style.setProperty('--d', (i * 0.08) + 's'); });
    });
    var line = function () { return window.innerHeight * 0.9; };
    function reveal(el) {
      el.classList.add('is-in');
      if (el.classList.contains('circuit')) {
        setTimeout(function () { el.classList.add('is-live'); }, 2800);
        return;
      }
      if (el.getAttribute('data-reveal') === 'words') return;
      // Hand transitions back to the element's own hover styles once it has arrived.
      var d = parseFloat(el.style.getPropertyValue('--d')) || 0;
      setTimeout(function () { el.removeAttribute('data-reveal'); el.style.removeProperty('--d'); }, 1000 + d * 1000);
    }
    var pending = els.filter(function (el) {
      if (el.getBoundingClientRect().top < line()) { reveal(el); return false; }
      return true;
    });
    root.classList.add('js-reveal');
    onScrollFns.push(function () {
      var l = line();
      pending = pending.filter(function (el) {
        if (el.getBoundingClientRect().top < l) { reveal(el); return false; }
        return true;
      });
    });
  });
})();
