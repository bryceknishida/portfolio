/* main.js: a four-slide brand slider. Structure and timings follow the MotionSites "Smoothie Slider" reference.
 * Slides: 0 Riscei, 1 Beepo, 2 Noodle and Pip, 3 Contact. All slide content is laid out on a 1440 x 900 design frame. */
(function () {
  "use strict";
  var root = document.documentElement, stage = document.getElementById("stage");
  var slides = [].slice.call(document.querySelectorAll(".slide"));
  var tabs = [].slice.call(document.querySelectorAll(".tabs button")), underline = document.querySelector(".underline");
  var statLists = [].slice.call(document.querySelectorAll(".stats")), sheets = [].slice.call(document.querySelectorAll(".sheet"));
  var N = slides.length, FW = 1440, FH = 900;
  var clamp = function (x, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, x)); };
  var lerp = function (a, b, k) { return a + (b - a) * k; };
  var calmQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var calm = !!(calmQuery && calmQuery.matches);
  if (calmQuery && calmQuery.addEventListener) calmQuery.addEventListener("change", function (e) { calm = e.matches; });

  /* ---------------------------------------------------------------- floating pieces: [kind, x, y, width, rotation, layer, extra class or colour] */
  var PIECES = [
    [["orb", 1096, 150, 132, 10, "fruit"], ["orb", 262, 168, 92, -16, "fruit"],
     ["orb", -50, 540, 300, 0, "corner"], ["orb", 1250, 0, 230, 24, "corner"]],
    [["hex", 372, 176, 92, 12, "fruit"], ["hex", 986, 226, 112, -8, "fruit", "dark"], ["hex", 292, 470, 120, 20, "fruit", "dark"],
     ["hex", 1236, 452, 104, -14, "fruit"], ["hex", 968, 596, 96, 30, "fruit"],
     ["hex", -20, 580, 250, 10, "corner", "dark"], ["hex", 1280, 30, 200, -12, "corner"]],
    [["yarn", 360, 200, 96, 0, "fruit", "#16c2b0"], ["yarn", 1010, 190, 84, 0, "fruit", "#ff8fa0"], ["yarn", 1228, 470, 110, 0, "fruit", "#f08a2e"],
     ["yarn", 300, 500, 76, 0, "fruit", "#ffd25a"], ["yarn", -30, 590, 240, 0, "corner", "#ff8fa0"], ["yarn", 1290, 20, 200, 0, "corner", "#16c2b0"]],
    [["dot", 330, 210, 26, 0, "fruit"], ["dot", 1090, 250, 18, 0, "fruit"], ["dot", 1180, 600, 30, 0, "fruit"], ["dot", 250, 640, 16, 0, "fruit"]]
  ];
  var SHADOWS = [[], [[720, 716, 330, 30]], [[720, 690, 520, 32]], []];
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  slides.forEach(function (sl, i) {
    PIECES[i].forEach(function (p) {
      var el = document.createElement("div"), inner = document.createElement("b"), u = "calc(" , v = " * var(--u))";
      el.className = "piece " + p[0] + (p[6] && p[6][0] !== "#" ? " " + p[6] : "");
      el.style.cssText = "left:" + u + p[1] + v + ";top:" + u + p[2] + v + ";width:" + u + p[3] + v + ";height:" + u + (p[0] === "orb" ? p[3] * 1.85 : p[3]) + v;
      inner.style.cssText = "--rot:" + p[4] + "deg;--dur:" + (3.2 + rnd() * 1.8).toFixed(2) + "s;--delay:-" + (rnd() * 4).toFixed(2) + "s" + (p[6] && p[6][0] === "#" ? ";--c:" + p[6] : "");
      el.appendChild(inner); sl.querySelector("." + p[5]).appendChild(el);
    });
    SHADOWS[i].forEach(function (s) {
      var sh = document.createElement("i"), u = "calc(", v = " * var(--u))";
      sh.style.cssText = "left:" + u + (s[0] - s[2] / 2) + v + ";top:" + u + (s[1] - s[3] / 2) + v + ";width:" + u + s[2] + v + ";height:" + u + s[3] + v;
      sl.querySelector(".shadow").appendChild(sh);
    });
    sl.layers = ["word", "shadow", "hero", "fruit", "corner"].map(function (n) { return sl.querySelector("." + n); });
  });
  var FACTOR = [0.40, 0.30, 0.15, 0.55, 0.75];   // how far each layer travels when a slide arrives: far things move least

  /* ---------------------------------------------------------------- scale: one unit for the frame, one for the UI */
  var u = 1, vw = 1, vh = 1, mobile = false, fy = 0;
  var meter = document.createElement("canvas").getContext("2d");
  function fitWords() {
    var visible = (mobile ? Math.min(FW, vw / u) * 0.92 : 1330);
    slides.forEach(function (sl) {
      var span = sl.querySelector(".word span"), text = sl.dataset.word;
      span.textContent = text;
      meter.font = "700 100px Poppins, system-ui, sans-serif";
      var m = meter.measureText(text), ink = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 100 || text.length * 0.6;
      var size = 445, track = "0.005em";
      if (ink * size > visible) { track = "-0.035em"; size = Math.min(445, (mobile ? visible : 1400) / (ink * 0.94)); }
      var base = 403.5 + 0.698 * size / 2;   // every word shares one cap line
      span.style.fontSize = "calc(" + size.toFixed(1) + " * var(--u))"; span.style.letterSpacing = track;
      span.style.top = "calc(" + (base - 0.85 * size).toFixed(1) + " * var(--u))";
    });
  }
  function layout() {
    vw = Math.max(1, window.innerWidth); vh = Math.max(1, window.innerHeight);
    mobile = vw <= 820 || vh > vw;
    u = mobile ? Math.min(vw / 640, (vh - 200) / 620) : Math.min(vw / FW, vh / FH);
    fy = mobile ? 8 : 0;
    root.style.setProperty("--u", u.toFixed(4) + "px");
    root.style.setProperty("--fy", fy + "px");
    if (!mobile) root.style.setProperty("--n", clamp(Math.min(vw / FW, vh / FH), 0.5, 1.3).toFixed(4) + "px"); else root.style.removeProperty("--n");
    fitWords(); moveUnderline();
    if (renderer) { renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.updateProjectionMatrix(); }
  }

  /* ---------------------------------------------------------------- slide state */
  var cur = 0, anim = null, sheetOpen = null, lastInput = 0;
  function moveUnderline() {
    var t = tabs[anim ? anim.to : cur];
    underline.style.width = t.offsetWidth + "px"; underline.style.transform = "translateX(" + t.offsetLeft + "px)";
  }
  function showUI(i) {
    root.dataset.s = String(i);
    tabs.forEach(function (t, k) { t.setAttribute("aria-current", String(k === i)); });
    statLists.forEach(function (s) { s.classList.toggle("on", +s.dataset.for === i); });
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = getComputedStyle(slides[i]).backgroundColor;
    moveUnderline();
  }
  function setLayers(sl, shift, k) {   // shift in frame widths; each layer scaled by its own factor when k is true
    for (var i = 0; i < 5; i++) sl.layers[i].style.transform = shift ? "translateX(" + (shift * (k ? FACTOR[i] : 1) * FW * u).toFixed(1) + "px)" : "";
  }
  function playClip() {
    var v = document.querySelector(".card video"); if (!v) return;
    if (cur === 0 && !anim && !calm && !document.hidden) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
  }
  function go(to, dir) {
    to = (to + N) % N;
    if (anim || to === cur || sheetOpen !== null) return;
    if (calm) { slides[cur].classList.remove("on"); cur = to; slides[cur].classList.add("on"); showUI(cur); playClip(); return; }
    anim = { from: cur, to: to, dir: dir || (to > cur ? 1 : -1), t0: performance.now(), c: 0, k: 0 };
    slides[to].classList.add("under");
    showUI(to); playClip();
  }
  // Measured from the reference: a slow start, a rush through the middle, a long soft settle.
  var CT = [0, 0.031, 0.134, 0.206, 0.278, 0.34, 0.412, 0.485, 0.546, 0.583, 0.62, 0.69, 0.79, 0.85, 0.93, 1];
  var CC = [0, 0.006, 0.012, 0.023, 0.047, 0.07, 0.105, 0.158, 0.246, 0.55, 0.825, 0.9, 0.94, 0.956, 0.975, 1];
  function cover(t) {
    if (t >= 1) return 1;
    for (var i = 1; i < CT.length; i++) if (t <= CT[i]) { var k = (t - CT[i - 1]) / (CT[i] - CT[i - 1]); k = k * k * (3 - 2 * k); return lerp(CC[i - 1], CC[i], k); }
    return 1;
  }
  function stepAnim(now) {
    var a = anim, t = (now - a.t0) / 970, A = slides[a.from], B = slides[a.to];
    a.c = cover(clamp(t)); var kk = clamp((t - 0.5) / 0.42); a.k = 1 - (1 - kk) * (1 - kk);
    A.style.clipPath = a.dir > 0 ? "inset(0 " + (a.c * 100).toFixed(2) + "% 0 0)" : "inset(0 0 0 " + (a.c * 100).toFixed(2) + "%)";
    setLayers(A, -a.dir * a.c * 0.14, false);
    setLayers(B, a.dir * (1 - a.k), true);
    if (a.k >= 1 && t >= 1) {
      A.classList.remove("on"); A.style.clipPath = ""; setLayers(A, 0); setLayers(B, 0);
      B.classList.remove("under"); B.classList.add("on");
      cur = a.to; anim = null; playClip();
    }
  }

  /* ---------------------------------------------------------------- detail sheets */
  function openSheet(i) {
    var sh = sheets.filter(function (s) { return +s.dataset.for === i; })[0];
    if (!sh || anim) return;
    sheetOpen = i; sh.hidden = false; sh.scrollTop = 0;
    requestAnimationFrame(function () { sh.classList.add("open"); });
    sh.querySelector(".close").focus({ preventScroll: true });
  }
  function closeSheet() {
    if (sheetOpen === null) return;
    var sh = sheets.filter(function (s) { return +s.dataset.for === sheetOpen; })[0];
    sh.classList.remove("open"); sheetOpen = null;
    setTimeout(function () { if (!sh.classList.contains("open")) sh.hidden = true; }, 720);
    document.getElementById("more").focus({ preventScroll: true });
  }
  sheets.forEach(function (sh) { sh.querySelector(".close").addEventListener("click", closeSheet); });
  document.getElementById("more").addEventListener("click", function () { openSheet(cur); });

  /* ---------------------------------------------------------------- controls: tabs, arrows, keys, wheel, swipe */
  [].forEach.call(document.querySelectorAll("[data-go]"), function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); closeSheet(); go(+el.dataset.go); });
  });
  document.getElementById("prev").addEventListener("click", function () { go(cur - 1, -1); });
  document.getElementById("next").addEventListener("click", function () { go(cur + 1, 1); });
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") return closeSheet();
    if (sheetOpen !== null) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") go(cur + 1, 1);
    if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") go(cur - 1, -1);
  });
  window.addEventListener("wheel", function (e) {
    if (sheetOpen !== null || Math.abs(e.deltaY) < 12) return;
    var now = performance.now(); if (now - lastInput < 1100) return;
    lastInput = now;
    if (e.deltaY > 0 && cur < N - 1) go(cur + 1, 1); else if (e.deltaY < 0 && cur > 0) go(cur - 1, -1);
  }, { passive: true });
  var down = null, tap = 0;
  stage.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY }; });
  window.addEventListener("pointerup", function (e) {
    if (!down) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
    if (sheetOpen !== null) return closeSheet();
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    else if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) { if (dy < 0 && cur < N - 1) go(cur + 1, 1); else if (dy > 0 && cur > 0) go(cur - 1, -1); }
    else if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && !calm) tap = 1;   // a plain tap makes the character react
  });
  var px = 0, py = 0, tx = 0, ty = 0;
  window.addEventListener("pointermove", function (e) { tx = e.clientX / vw * 2 - 1; ty = e.clientY / vh * 2 - 1; }, { passive: true });

  /* ---------------------------------------------------------------- 3D characters, placed in design-frame pixels */
  var THREE = window.THREE, Cast = window.Cast, canvas = document.getElementById("gl");
  var renderer = null, scene, camera, cast = [];
  var CAM_Z = 2.2, FOV = 32, LOOK_Y = 0.16, HALF_H = Math.tan(FOV / 2 * Math.PI / 180) * CAM_Z;
  // Where each character stands on each slide: centre x, centre y and height in design pixels. m = phone override; null = not on that slide.
  var POSES = [
    { 1: { x: 720, y: 486, h: 470 }, 3: { x: 286, y: 590, h: 300, m: { x: 720, y: 262, h: 200 } } },
    { 2: { x: 720, y: 520, h: 330, m: { x: 690, y: 500, h: 236 } }, 3: { x: 1150, y: 610, h: 220, m: null } }
  ];
  function pose(ci, si) { var p = POSES[ci][si]; if (!p) return null; return mobile && "m" in p ? p.m : p; }
  try {
    if (!THREE || !Cast) throw new Error("3D libraries did not load");
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 20);
    camera.position.set(0, LOOK_Y, CAM_Z); camera.lookAt(0, LOOK_Y, 0);
    scene.add(new THREE.HemisphereLight(0xdff1ff, 0x8a7a66, 1.1));
    var sun = new THREE.DirectionalLight(0xfff1d6, 2.2); sun.position.set(3, 6, 2); scene.add(sun);
    cast = [Cast.makeBeepo(), Cast.makeNoodlePip()];
    cast.forEach(function (c) { scene.add(c.root); });
  } catch (err) {
    console.warn("3D stage unavailable; showing the page without it.", err);
    root.classList.add("no3d"); renderer = null;
  }
  function place(c, p, shiftPx) {
    var ppw = vh / (2 * HALF_H), s = (p.h * u / ppw) / c.h;                       // pixels per world unit; scale to the wanted height
    var sx = (p.x - FW / 2) * u + shiftPx, sy = (p.y - FH / 2) * u + fy;
    c.root.scale.setScalar(s);
    c.root.position.set(sx / ppw, LOOK_Y - sy / ppw - s * c.h / 2, 0);
  }
  var F = { t: 0, dt: 0, px: 0, py: 0, d: 0, fin: 1, walk: 0, moving: 0, tap: 0 }, last = 0, raf = 0;
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    var t = ms / 1000, dt = last ? Math.min(0.05, Math.max(0, t - last)) : 0.016; last = t;
    if (!root.classList.contains("ready")) root.classList.add("ready");
    if (anim) stepAnim(ms);
    px = lerp(px, tx, 0.08); py = lerp(py, ty, 0.08);
    if (tap > 0) tap = Math.max(0, tap - dt / 0.6);
    // A few pixels of parallax against the pointer on the resting slide: near layers move most.
    if (!anim && !calm && !mobile) for (var i = 0; i < 5; i++) slides[cur].layers[i].style.transform = "translate(" + (-px * FACTOR[i] * 26 * u).toFixed(1) + "px," + (-py * FACTOR[i] * 14 * u).toFixed(1) + "px)";
    if (renderer) {
      F.t = calm ? 0 : t; F.dt = calm ? 0 : dt; F.px = calm ? 0 : px; F.py = calm ? 0 : py; F.tap = tap;
      F.moving = lerp(F.moving, anim ? 1 : 0, 0.1); F.walk += dt * F.moving * 9;
      for (var ci = 0; ci < cast.length; ci++) {
        var c = cast[ci], pa = pose(ci, anim ? anim.from : cur), pb = anim ? pose(ci, anim.to) : null, P = null, shift = 0;
        if (anim) {
          if (pa && pb) { var e = anim.c; P = { x: lerp(pa.x, pb.x, e), y: lerp(pa.y, pb.y, e), h: lerp(pa.h, pb.h, e) }; }
          else if (pa) { P = pa; shift = -anim.dir * anim.c * vw * 1.05; }            // leaves with the slide it belongs to
          else if (pb) { P = pb; shift = anim.dir * (1 - anim.k) * FW * u * 0.6; if (anim.c < 0.5) P = null; }   // arrives once the wipe is half done
        } else P = pa;
        c.root.visible = !!P;
        if (P) { place(c, P, shift); c.update(F); }
      }
      renderer.render(scene, camera);
    }
  }
  function start() { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); playClip(); });
  canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); });

  slides[0].classList.add("on");
  layout(); showUI(0);
  window.addEventListener("resize", layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  // Opening: the first slide's layers glide in from the right, far layers leading.
  if (!calm) {
    setLayers(slides[0], 1, true);
    slides[0].layers.forEach(function (l) { l.style.transition = "transform 900ms cubic-bezier(0.22, 0.8, 0.3, 1)"; });
    requestAnimationFrame(function () { requestAnimationFrame(function () { setLayers(slides[0], 0); }); });
    setTimeout(function () { slides[0].layers.forEach(function (l) { l.style.transition = ""; }); playClip(); }, 1000);
  } else playClip();
  setTimeout(function () { root.classList.add("ready"); }, 3000);   // failsafe: the UI never stays hidden
  start();
})();
