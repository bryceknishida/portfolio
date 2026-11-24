/* main.js: the scroll film. One GSAP timeline, scrubbed by the scroll position, drives everything:
 * the gameplay footage frame, the 3D camera and characters, the giant words and every block of text.
 * The timeline is 100 units long. Rhythm: travel, then hold. Text only arrives during a hold. */
(function () {
  "use strict";
  var root = document.documentElement, body = document.body;
  var clamp = function (x, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, x)); };
  var lerp = function (a, b, k) { return a + (b - a) * k; };
  var calmQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var calm = !!(calmQuery && calmQuery.matches);
  var vw = 1, vh = 1, wide = true;
  function size() { vw = Math.max(1, window.innerWidth); vh = Math.max(1, window.innerHeight); wide = vw > 820 && vw >= vh; }
  size();

  /* Everything the timeline animates that is not a DOM element lives on this one object. */
  var S = { frame: 0, az: 0, el: 0.16, dist: 3, ty: 0.2, shift: 0,
            bvis: 0, bx: 0, by: 0, byaw: 0, bwalk: 0,
            nvis: 0, nx: 0, nmove: 0, nmode: 1, nyaw: 0, fin: 0 };

  /* ---------------------------------------------------------------- footage: an image sequence drawn to a canvas, one frame per scroll step */
  var film = document.getElementById("film"), fctx = film.getContext("2d"), FRAMES = 152, frames = [], drawn = -1;
  function loadFrames() {
    var i = 0;
    (function next() {
      if (i >= FRAMES) return;
      var img = new Image(), n = i++;
      img.onload = function () { frames[n] = img; if (n === 0 || n === Math.round(S.frame)) drawn = -1; next(); };
      img.onerror = next;
      img.src = "media/film/f_" + ("00" + n).slice(-3) + ".webp";
    })();
  }
  function drawFilm() {
    var want = clamp(Math.round(S.frame), 0, FRAMES - 1), f = want;
    while (f > 0 && !frames[f]) f--;                       // fall back to the nearest earlier frame that has arrived
    if (!frames[f] || f === drawn) return;
    var img = frames[f], cw = film.width, ch = film.height, s = Math.max(cw / img.width, ch / img.height);
    fctx.drawImage(img, (cw - img.width * s) / 2, (ch - img.height * s) / 2, img.width * s, img.height * s);
    drawn = f;
  }
  function sizeFilm() { var d = Math.min(window.devicePixelRatio || 1, 1.5); film.width = Math.round(vw * d); film.height = Math.round(vh * d); drawn = -1; }

  /* ---------------------------------------------------------------- 3D: photographed, not pasted on */
  var THREE = window.THREE, Cast = window.Cast, canvas = document.getElementById("gl");
  var renderer = null, scene, camera, beepo, cats;
  try {
    if (!THREE || !Cast) throw new Error("3D libraries did not load");
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;      // keeps the characters' own colours
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;   // soft-edged shadows
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
    // A bright room to reflect: light comes from an environment, not just from lamps.
    var room = new THREE.Scene(); room.background = new THREE.Color(0xcfd6dc);
    [[0, 5, 0, 9, 0xffffff], [6, 2, 3, 5, 0xfff0d8], [-6, 1, -2, 5, 0xdfeeff]].forEach(function (p) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(p[3] / 3, 12, 8), new THREE.MeshBasicMaterial({ color: p[4] })); m.position.set(p[0], p[1], p[2]); room.add(m);
    });
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(room, 0.03).texture; scene.environmentIntensity = 0.6; pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xdff1ff, 0x8a7a66, 0.45));
    var sun = new THREE.DirectionalLight(0xfff1d6, 2.3); sun.position.set(2.2, 4.5, 2.6);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 8; sun.shadow.blurSamples = 14;
    sun.shadow.camera.left = -1.8; sun.shadow.camera.right = 1.8; sun.shadow.camera.top = 1.8; sun.shadow.camera.bottom = -1.8;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 12; sun.shadow.bias = -0.0006;
    scene.add(sun); scene.add(sun.target);
    // Shadow catcher: an invisible floor that only shows the shadow, so the characters touch the ground.
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.24 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    beepo = Cast.makeBeepo(); cats = Cast.makeNoodlePip();
    scene.add(beepo.root); scene.add(cats.root);
    // The kit's meshes receive their own soft shadow, which smears on faceted fur: let them cast only.
    [beepo.root, cats.root].forEach(function (r) { r.traverse(function (o) { if (o.isMesh) { o.receiveShadow = false; if (o.material && o.material.transparent) o.castShadow = false; } }); });
    var sunRef = sun;
  } catch (err) {
    console.warn("3D stage unavailable; showing the page without it.", err);
    root.classList.add("no3d"); renderer = null;
  }
  function sizeGL() { if (!renderer) return; renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.updateProjectionMatrix(); }

  var px = 0, py = 0, tx = 0, ty = 0, tap = 0, last = 0, raf = 0, walkB = 0;
  var FB = { t: 0, dt: 0, px: 0, py: 0, d: 0, fin: 1, walk: 0, moving: 0, tap: 0 };
  var FC = { t: 0, dt: 0, px: 0, py: 0, d: 0, fin: 1, walk: 0, moving: 0, tap: 0, mode: "walk" };
  function render3D(t, dt) {
    var portrait = !wide, k = portrait ? Math.max(1, 0.8 / camera.aspect) : 1;
    var dist = S.dist * k, ce = Math.cos(S.el), shift = portrait ? 0 : S.shift;
    var rx = Math.cos(S.az), rz = -Math.sin(S.az);                                   // the camera's right-hand direction
    var lx = -shift * rx, lz = -shift * rz, ly = S.ty + (portrait ? 0.1 * dist / 2.4 : 0);   // look beside the subject so it sits off-centre
    camera.position.set(lx + dist * ce * Math.sin(S.az), ly + dist * Math.sin(S.el), lz + dist * ce * Math.cos(S.az));
    camera.lookAt(lx, ly, lz);
    beepo.root.visible = S.bvis > 0.5; cats.root.visible = S.nvis > 0.5;
    if (beepo.root.visible) {
      beepo.root.position.set(S.bx * (portrait ? lerp(1, 0.42, S.fin) : 1), S.by, 0); beepo.root.rotation.y = S.byaw; beepo.root.scale.setScalar(1);
      walkB += dt * S.bwalk * 11;
      FB.t = t; FB.dt = dt; FB.px = px; FB.py = py; FB.walk = walkB; FB.moving = S.bwalk; FB.tap = tap;
      beepo.update(FB);
    }
    if (cats.root.visible) {
      cats.root.position.set(S.nx * (portrait ? lerp(1, 0.55, S.fin) : 1), 0, 0); cats.root.rotation.y = S.nyaw; cats.root.scale.setScalar(1);
      FC.t = t; FC.dt = dt; FC.px = px; FC.py = py; FC.walk = S.nx * 26; FC.moving = S.nmove; FC.tap = tap; FC.mode = S.nmode > 0.5 ? "walk" : "";
      cats.update(FC);
    }
    sunRef.target.position.set(S.bvis > 0.5 ? S.bx : S.nx, 0, 0);
    renderer.render(scene, camera);
  }
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    var t = ms / 1000, dt = last ? Math.min(0.05, Math.max(0, t - last)) : 0.016; last = t;
    px = lerp(px, tx, 0.08); py = lerp(py, ty, 0.08);
    if (tap > 0) tap = Math.max(0, tap - dt / 0.6);
    drawFilm();
    if (renderer && (S.bvis > 0.5 || S.nvis > 0.5)) render3D(calm ? 0 : t, calm ? 0 : dt);
    else if (renderer && canvas.dataset.clear !== "1") { renderer.clear(); canvas.dataset.clear = "1"; }
    if (S.bvis > 0.5 || S.nvis > 0.5) canvas.dataset.clear = "0";
  }
  function start() { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  window.addEventListener("pointermove", function (e) { tx = e.clientX / vw * 2 - 1; ty = e.clientY / vh * 2 - 1; }, { passive: true });
  window.addEventListener("click", function (e) { if (!(e.target.closest && e.target.closest("a, button")) && !calm) tap = 1; });

  /* ---------------------------------------------------------------- headline decode: letters settle left to right */
  function scramble(el) {
    var h = el.matches("[data-scramble]") ? el : el.querySelector("[data-scramble]");
    if (!h || calm) return;
    var text = h.dataset.text || (h.dataset.text = h.textContent), glyphs = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789/#", t0 = performance.now();
    h.setAttribute("aria-label", text);
    (function step(now) {
      var k = clamp((now - t0) / 700), n = Math.floor(text.length * k), out = text.slice(0, n);
      for (var i = n; i < text.length; i++) out += text[i] === " " ? " " : glyphs[(Math.random() * glyphs.length) | 0];
      h.textContent = k < 1 ? out : text;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------------------------------------------------------------- the timeline */
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) {            // without the timeline, show the words plainly instead of nothing
    [].forEach.call(document.querySelectorAll(".k"), function (k) { k.style.cssText = "position:static;opacity:1;visibility:visible;translate:none;rotate:none;margin:8vh 6vw;"; });
    document.querySelector(".hud").style.position = "static"; document.getElementById("track").style.display = "none";
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  var bar = document.querySelector(".progress i");
  var tl = gsap.timeline({
    defaults: { ease: "power3.out", duration: 2.4 },
    scrollTrigger: { trigger: "#track", start: "top top", end: "bottom bottom", scrub: calm ? true : 0.9,
      onUpdate: function (self) { bar.style.transform = "scaleX(" + self.progress.toFixed(4) + ")"; body.classList.toggle("light", self.progress > 0.325); } }
  });
  // GSAP owns the transform of everything it moves, so centring and the cards' resting tilt are set here, not in CSS.
  var TILT = { s1: -5, s2: 4, s3: 5, s4: -4 };
  function anchor() {
    gsap.set(".word, .stamp", { xPercent: -50, yPercent: -50 });
    gsap.set("#sage, .cta, .k.mid", { xPercent: -50 });
    gsap.set(".k.left", { yPercent: wide ? -50 : 0 });
  }
  anchor();
  // Bring a block in from one side during a hold, then send it out another way.
  function show(sel, tin, tout, from, to) {
    var el = document.querySelector(sel), rest = 0;
    for (var key in TILT) if (el.classList.contains(key)) rest = TILT[key];
    tl.fromTo(el, { autoAlpha: 0, x: from.x || 0, y: from.y || 0, scale: from.s || 1, rotation: from.r || 0 },
                  { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: rest, duration: from.d || 2.2, ease: from.e || "power3.out" }, tin);
    tl.call(scramble, [el], tin + 0.2);
    if (tout !== null) tl.to(el, { autoAlpha: 0, x: (to && to.x) || 0, y: (to && to.y) || 0, scale: (to && to.s) || 1, duration: 1.6, ease: "power2.in" }, tout);
  }
  var none = "none", W = function () { return vw; }, H = function () { return vh; };

  // ---- Round 01, Riscei: my real footage scrubs under Sage. The wall goes up because you scrolled.
  gsap.set("#film", { opacity: 1 }); gsap.set("#w-riscei", { autoAlpha: 1 }); gsap.set("#k-intro", { autoAlpha: 1 });
  tl.to(S, { frame: 46, duration: 9, ease: none }, 0)
    .to("#k-intro", { autoAlpha: 0, y: -50, duration: 2, ease: "power2.in" }, 2.2)
    .to("#sage", { x: function () { return wide ? W() * 0.2 : 0; }, y: function () { return wide ? 0 : H() * 0.05; }, scale: 0.94, duration: 9, ease: "power1.inOut" }, 0)
    .to("#w-riscei", { x: function () { return -W() * 0.07; }, duration: 9, ease: none }, 0)
    .to(S, { frame: 60, duration: 4.5, ease: none }, 9);
  show("#k-wall", 8.6, 13.4, { x: -120 }, { x: -80 });
  tl.to(S, { frame: 118, duration: 8.5, ease: none }, 13.5)
    .to("#sage", { x: function () { return W() * 0.85; }, rotation: 9, autoAlpha: 0, duration: 5, ease: "power2.in" }, 13.5)
    .to(".tint", { opacity: 0.22, duration: 6, ease: none }, 13.5)
    .to("#w-riscei", { scale: 1.7, autoAlpha: 0, duration: 5, ease: "power2.in" }, 14)
    .to(S, { frame: 151, duration: 7, ease: none }, 22);
  show("#k-ace", 22, 29.2, { s: 2.6, d: 1.6, e: "expo.out" }, { s: 0.5 });
  show("#s-views", 23.0, 29.0, { x: -260, r: -14 }, { x: -320 });
  show("#s-likes", 23.5, 29.2, { x: 260, r: 14 }, { x: 320 });
  show("#s-foll", 24.0, 29.4, { y: 220, r: 10 }, { y: 260 });
  show("#s-mil", 24.5, 29.6, { y: -220, r: -10 }, { y: -260 });
  show("#c-riscei", 25.2, 29.8, { y: 80 }, { y: 80 });
  tl.to("#film", { opacity: 0, duration: 5, ease: "power1.inOut" }, 29.5)
    .to(".tint", { opacity: 0, duration: 4 }, 29.5)
    .to(body, { backgroundColor: "#f4cf63", duration: 5, ease: "power1.inOut" }, 29.5);

  // ---- Round 02, Beepo: he drops in, the camera pushes round to his face, then cranes overhead as he trots off.
  tl.set(S, { bvis: 1, bx: 0, by: 1.5, byaw: -0.5, az: -0.6, el: 0.34, dist: 3.3, ty: 0.19, shift: 0 }, 34.4)
    .to(S, { by: 0, duration: 4.2, ease: "bounce.out" }, 34.5)
    .to(S, { az: 0.12, el: 0.13, dist: 1.45, byaw: 0, shift: 0.26, duration: 6, ease: "power2.inOut" }, 34.5)
    .fromTo("#w-beepo", { autoAlpha: 0, x: function () { return W() * 0.7; } }, { autoAlpha: 1, x: 0, duration: 5 }, 34.5);
  show("#k-beepo", 40.2, 45.2, { x: -120 }, { x: -80 });
  tl.to(S, { az: 0.95, el: 0.06, dist: 1.02, ty: 0.25, shift: 0, duration: 7, ease: "power2.inOut" }, 45.3)
    .to("#w-beepo", { x: function () { return -W() * 0.2; }, duration: 7, ease: none }, 45.3);
  show("#b-foll", 51.6, 57.0, { x: -260, r: -14 }, { x: -320 });
  show("#b-likes", 52.1, 57.2, { x: 260, r: 14 }, { x: 320 });
  show("#b-plat", 52.6, 57.4, { y: 220, r: -10 }, { y: 260 });
  show("#c-beepo", 53.2, 57.6, { y: 80 }, { y: 80 });
  tl.to(S, { az: 2.1, el: 1.18, dist: 2.3, ty: 0.1, duration: 5.4, ease: "power2.inOut" }, 57.4)
    .to(S, { bwalk: 1, duration: 1.2 }, 58.4)
    .to(S, { bx: -1.5, byaw: -1.57, duration: 4.2, ease: "power1.in" }, 58.6)
    .to("#w-beepo", { autoAlpha: 0, scale: 0.7, duration: 4, ease: "power2.in" }, 57.6)
    .to(body, { backgroundColor: "#b9e3d6", duration: 5, ease: "power1.inOut" }, 58.4);

  // ---- Round 03, Noodle and Pip: they walk in from the left with your scroll, stop, and look at you.
  tl.set(S, { bvis: 0, bwalk: 0, nvis: 1, nmode: 1, nx: -2.3, nmove: 1, nyaw: 0, az: 0, el: 0.07, dist: 2.5, ty: 0.17, shift: 0 }, 63.2)
    .to(S, { nx: 0.05, duration: 7, ease: none }, 63.3)
    .fromTo("#w-np", { autoAlpha: 0, x: function () { return -W() * 0.7; } }, { autoAlpha: 1, x: 0, duration: 6 }, 63.3)
    .to(S, { nmove: 0, shift: 0.32, duration: 1.4 }, 69.6);
  show("#k-np", 70.2, 75.0, { x: -120 }, { x: -80 });
  tl.to(S, { az: -0.75, el: 0.2, dist: 1.75, shift: 0, duration: 6, ease: "power2.inOut" }, 75.1)
    .set(S, { nmode: 0 }, 76.6)
    .to("#w-np", { x: function () { return W() * 0.12; }, duration: 6, ease: none }, 75.1);
  show("#n-foll", 80.4, 85.2, { x: -260, r: -14 }, { x: -320 });
  show("#n-likes", 80.9, 85.4, { x: 260, r: 14 }, { x: 320 });
  tl.to("#w-np", { autoAlpha: 0, scale: 0.7, duration: 3.4, ease: "power2.in" }, 85.2)
    .to(body, { backgroundColor: "#efe2d4", duration: 5, ease: "power1.inOut" }, 85.4);

  // ---- Match point: everyone on stage together.
  tl.to(S, { nx: 0.42, az: 0, el: 0.1, dist: 3.3, ty: 0.56, fin: 1, duration: 5, ease: "power2.inOut" }, 85.4)
    .set(S, { bvis: 1, bx: -0.62, by: 1.4, byaw: 0.35 }, 86.2)
    .to(S, { by: 0, duration: 3.6, ease: "bounce.out" }, 86.3)
    .fromTo("#w-gg", { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 0.5, scale: 1, duration: 4 }, 87);
  show("#k-gg", 90.5, null, { y: 90 });
  tl.to({}, { duration: 6 }, 94);            // the last hold, so the end of the page is still

  /* ---------------------------------------------------------------- boot */
  function resize() { size(); sizeFilm(); sizeGL(); anchor(); ScrollTrigger.refresh(); }
  sizeFilm(); sizeGL(); loadFrames();
  window.addEventListener("resize", function () { clearTimeout(resize.t); resize.t = setTimeout(resize, 160); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  if (!calm) gsap.from(".stage, .hud, .nav", { autoAlpha: 0, duration: 1.1, ease: "power2.out" });
  start();
})();
