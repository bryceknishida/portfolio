/* main.js: scroll position picks the section; the section picks the colours and who is on stage.
 * Sections: 0 opening line-up, 1 Riscei, 2 Beepo, 3 Noodle and Pip, 4 contact line-up. */
(function () {
  "use strict";
  var root = document.documentElement;
  var secs = [].slice.call(document.querySelectorAll("[data-sec]"));
  var giants = [].slice.call(document.querySelectorAll(".giant span"));
  var navs = [].slice.call(document.querySelectorAll("[data-nav]"));
  var LAST = secs.length - 1;
  var clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };
  var lerp = function (a, b, k) { return a + (b - a) * k; };
  var smooth = function (a, b, x) { var k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

  /* ---------------------------------------------------------------- scroll to section progress */
  var tops = [], vh = 1, vw = 1;
  function measure() {
    vh = Math.max(1, window.innerHeight); vw = Math.max(1, window.innerWidth);
    tops = secs.map(function (s) { return s.getBoundingClientRect().top + window.scrollY; });
  }
  // Moves only while a section edge crosses the middle of the screen, so a character holds still while its section is read.
  function progress() {
    var y = window.scrollY + vh * 0.5, p = 0;
    for (var i = 1; i < tops.length; i++) p += smooth(tops[i] - vh * 0.35, tops[i] + vh * 0.35, y);
    return p;
  }
  var current = -1;
  function setSection(i) {
    if (i === current) return;
    current = i;
    root.dataset.s = String(i);
    giants.forEach(function (g, k) { g.classList.toggle("on", k === i); });
    navs.forEach(function (a) { a.setAttribute("aria-current", String(+a.dataset.nav === i)); });
  }
  function onScroll() {
    var p = progress();
    setSection(Math.round(p));
    root.style.setProperty("--gx", ((current - p) * vw * 0.3).toFixed(1) + "px");   // the giant word slides as its section leaves
    root.classList.toggle("scrolled", window.scrollY > 80);
  }
  function remeasure() { measure(); onScroll(); }
  remeasure();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", remeasure);
  window.addEventListener("load", remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

  /* ---------------------------------------------------------------- text reveals, counting numbers, the clip */
  var rvs = [].slice.call(document.querySelectorAll(".rv"));
  var calm = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function countUp(el) {
    var end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || "", t0 = performance.now();
    if (calm) return;
    (function step(now) {
      var k = clamp((now - t0) / 1400, 0, 1), e = 1 - Math.pow(1 - k, 4);
      el.textContent = (end * e).toFixed(dec) + suf;
      if (k < 1) requestAnimationFrame(step); else el.textContent = end.toFixed(dec) + suf;
    })(t0);
  }
  if ("IntersectionObserver" in window) {
    root.classList.add("anim");
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, sibs = [].slice.call(el.parentNode.children).filter(function (c) { return c.classList.contains("rv"); });
        el.style.transitionDelay = Math.min(sibs.indexOf(el), 6) * 70 + "ms";   // siblings arrive one after another
        el.classList.add("in");
        setTimeout(function () { el.style.transitionDelay = ""; }, 1600);       // then drop the delay so later colour melts stay in step
        [].forEach.call(el.matches("[data-count]") ? [el] : el.querySelectorAll("[data-count]"), countUp);
        seen.unobserve(el);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    rvs.forEach(function (el) { seen.observe(el); });
    // The gameplay clip only downloads and plays while it is on screen.
    var clip = document.querySelector(".clip video");
    if (clip) new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting && !calm) { var p = clip.play(); if (p && p.catch) p.catch(function () {}); } else clip.pause(); });
    }, { threshold: 0.25 }).observe(clip);
  } else rvs.forEach(function (el) { el.classList.add("in"); });

  /* ---------------------------------------------------------------- 3D stage */
  var THREE = window.THREE, Cast = window.Cast, canvas = document.getElementById("stage");
  var renderer, scene, camera, cast = [];
  var CAM_Z = 2.2, FOV = 32, LOOK_Y = 0.16, HALF_H = Math.tan(FOV / 2 * Math.PI / 180) * CAM_Z;
  var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduced = !!(motionQuery && motionQuery.matches);
  if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener("change", function (e) { reduced = e.matches; });

  try {
    if (!THREE || !Cast) throw new Error("3D libraries did not load");
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));   // keeps the frame buffer small
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;                        // same colour settings the characters were designed under
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 20);
    camera.position.set(0, LOOK_Y + 0.05, CAM_Z); camera.lookAt(0, LOOK_Y, 0);
    scene.add(new THREE.HemisphereLight(0xdff1ff, 0x8a7a66, 1.1));
    var sun = new THREE.DirectionalLight(0xfff1d6, 2.2); sun.position.set(3, 6, 2); scene.add(sun);

    cast = [Cast.makeRiscei(), Cast.makeBeepo(), Cast.makeNoodlePip()];
    // Soft blob under each animal instead of a real shadow map: no extra render pass, no large texture.
    var shadowTex = (function () {
      var c = document.createElement("canvas"); c.width = c.height = 128;
      var g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      r.addColorStop(0, "rgba(40,24,10,0.34)"); r.addColorStop(1, "rgba(40,24,10,0)");
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    cast.forEach(function (c) {
      scene.add(c.root);
      if (c.shadow) {
        var s = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
        s.rotation.x = -Math.PI / 2; s.position.y = 0.002; c.root.add(s);
      }
    });
  } catch (err) {
    console.warn("3D stage unavailable; showing the page without it.", err);
    root.classList.add("no3d");
    remeasure();
    return;
  }

  var wide = true, halfW = 1;
  function resize() {
    var w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    halfW = HALF_H * camera.aspect; wide = w > 860;
  }
  resize();
  window.addEventListener("resize", resize);

  var px = 0, py = 0, tx = 0, ty = 0;
  window.addEventListener("pointermove", function (e) { tx = e.clientX / vw * 2 - 1; ty = e.clientY / vh * 2 - 1; }, { passive: true });
  var tap = 0;
  // "click" and not "pointerdown": a swipe to scroll on a phone must not set the characters hopping.
  window.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("a, button")) return;
    if (!reduced) tap = 1;
  });

  function bounce(x) {
    var n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  }

  var F = { t: 0, dt: 0, px: 0, py: 0, d: 0, fin: 0, walk: 0, moving: 0, tap: 0 };   // one frame-state object, reused
  var lastY = window.scrollY, last = 0, raf = 0, born = -1, sentX = 0, sentY = 0;

  // Where one cast member stands for scroll progress p. Returns how far it is from centre stage, in sections.
  function place(c, i, p, age) {
    var intro = clamp(1 - p, 0, 1), fin = clamp(p - (LAST - 1), 0, 1), d = i - clamp(p - 1, 0, 2);
    var fit = wide ? clamp(halfW / 1.0, 0.72, 1) : 1;
    // Solo: centre stage (right half on wide screens), arriving from below and leaving upward.
    var s = c.scale * (wide ? fit : c.mobile), x = wide ? halfW * 0.5 : (c.cx || 0) * c.scale * c.mobile * 0.62, y = (wide ? 0 : HALF_H * 0.42 + (c.my || 0)) - d * HALF_H * 3.2, ry = d * 1.2;
    if (intro > 0) {
      // Opening: all three across the middle of the screen, each dropping in with a bounce on load.
      var gap = wide ? Math.min(0.64, halfW * 0.5) : halfW * 0.56, k = wide ? fit : 0.32;
      var drop = reduced ? 0 : (1 - bounce(clamp((age - 0.25 - i * 0.22) / 0.95, 0, 1))) * HALF_H * 2.8;
      s = lerp(s, c.intro * k, intro); x = lerp(x, (i - 1) * gap + (c.cx || 0) * c.intro * k, intro);
      y = lerp(y, (wide ? -0.06 : 0.02) + drop, intro); ry = lerp(ry, drop * 2.2, intro);
    } else if (fin > 0) {
      // Ending: the three together beside the contact text.
      var m = wide ? fit : 0.42;
      s = lerp(s, c.fin * m, fin); x = lerp(x, (wide ? halfW * 0.44 : 0) + (i - 1) * (wide ? 0.3 * fit : halfW * 0.62) + (c.cx || 0) * c.fin * m, fin);
      y = lerp(y, wide ? 0 : HALF_H * 0.42, fin); ry = lerp(ry, 0, fin);
    }
    c.root.visible = Math.abs(d) < 0.98 || intro > 0.02 || fin > 0.02;
    c.root.scale.setScalar(s);
    c.root.position.set(x, LOOK_Y + y - s * c.h / 2, 0);
    c.root.rotation.y = ry;
    F.fin = Math.max(intro, fin);
    return d * (1 - F.fin);
  }

  function frame(ms) {
    raf = requestAnimationFrame(frame);
    var t = ms / 1000;
    if (born < 0) { born = t; root.classList.add("ready"); }
    var dt = last ? Math.min(0.05, Math.max(0, t - last)) : 0.016; last = t;
    var sy = window.scrollY, dy = sy - lastY; lastY = sy;
    px = lerp(px, tx, 0.08); py = lerp(py, ty, 0.08);
    if (tap > 0) tap = Math.max(0, tap - dt / 0.6);
    if (Math.abs(px - sentX) + Math.abs(py - sentY) > 0.004) {   // the Sage artwork leans a few pixels against the pointer
      sentX = px; sentY = py; root.style.setProperty("--mx", px.toFixed(3)); root.style.setProperty("--my", py.toFixed(3));
    }
    var p = progress(), lineUp = p < 0.5 || p > LAST - 0.5, active = Math.round(clamp(p - 1, 0, 2));
    F.t = reduced ? 0 : t; F.dt = reduced ? 0 : dt; F.px = reduced ? 0 : px; F.py = reduced ? 0 : py;
    F.walk += reduced ? 0 : Math.abs(dy) * 0.045;
    F.moving = reduced ? 0 : lerp(F.moving, clamp(Math.abs(dy) / 14, 0, 1), 0.14);
    for (var i = 0; i < cast.length; i++) {
      var d = place(cast[i], i, p, t - born);
      if (!cast[i].root.visible) continue;
      F.d = clamp(d, -1.2, 1.2); F.tap = (lineUp || i === active) ? tap : 0;
      cast[i].update(F);
    }
    renderer.render(scene, camera);
  }
  function start() { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });   // no work in a hidden tab
  canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); stop(); });
  canvas.addEventListener("webglcontextrestored", start);
  start();
})();
