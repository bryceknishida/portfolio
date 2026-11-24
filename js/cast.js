/* cast.js: the things on stage. Each maker returns { root, h, scale, mobile, shadow, update(f) }.
 * f = { t, dt, px, py, d, walk, moving, tap } where px/py is the pointer (-1..1), d is how far the item is from
 * centre stage in sections, walk is a phase that advances with scrolling, and tap is 0..1 after a click. */
(function () {
  "use strict";
  var THREE = window.THREE, POV = window.POV, PI = Math.PI;
  var clamp = POV.clamp, lerp = POV.lerp;
  var Cast = {};

  /* Floating props: each drifts on its own phase and shifts by its own amount as sections change, which reads as depth. */
  function Props(parent) {
    var list = [], n = 0;
    return {
      add: function (obj, x, y, z, o) {
        o = o || {}; n++;
        var ph = (Math.sin(n * 127.1) * 43758.5453) % (PI * 2);
        obj.position.set(x, y, z);
        obj.userData.p = { x: x, y: y, z: z, ph: ph, amp: o.amp === undefined ? 0.018 : o.amp, sp: o.sp || 0.9,
          spin: o.spin === undefined ? 0.35 : o.spin, depth: o.depth === undefined ? 0.25 : o.depth };
        parent.add(obj); list.push(obj);
        return obj;
      },
      update: function (f) {
        var k = Math.max(0.001, 1 - f.fin);   // props shrink away for the group line-up at the end
        for (var i = 0; i < list.length; i++) {
          var o = list[i], p = o.userData.p;
          o.scale.setScalar(k);
          o.position.y = p.y + Math.sin(f.t * p.sp + p.ph) * p.amp - f.d * p.depth;
          o.position.x = p.x + f.px * p.depth * 0.08;
          o.rotation.y += f.dt * p.spin; o.rotation.x += f.dt * p.spin * 0.6;
        }
      }
    };
  }

  var BLINK_BEEPO = [1.1, 3.4, 3.7], BLINK_PIP = [0.8, 2.9], BLINK_NOODLE = [1.4, 4.1];
  function sstep(a, b, x) { var k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); }
  function hop(k) { return k > 0 ? Math.sin(PI * (1 - k)) : 0; }

  /* ------------------------------------------------------------ Riscei: a healing orb and a rising crystal wall (original shapes) */
  function haloTexture(rgb) {
    var c = document.createElement("canvas"); c.width = c.height = 128;
    var g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    r.addColorStop(0, "rgba(" + rgb + ",0.9)"); r.addColorStop(0.35, "rgba(" + rgb + ",0.28)"); r.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  Cast.makeRiscei = function () {
    var root = new THREE.Group(), JADE = 0x49e3c4;
    // See-through crystal: a tinted, glowing body with a faint bright wireframe so the facets catch the eye.
    var crystalMat = new THREE.MeshStandardMaterial({ color: 0x7ff2dc, emissive: 0x1fb89a, emissiveIntensity: 0.6, roughness: 0.25, flatShading: true, transparent: true, opacity: 0.46, depthWrite: false });
    var edgeMat = new THREE.LineBasicMaterial({ color: 0xd4fff5, transparent: true, opacity: 0.55, toneMapped: false });
    var shards = [];
    [[-0.66, 0.34, 0.1, 0.06, -0.12], [-0.54, 0.52, 0.02, 0.075, 0.05], [-0.41, 0.42, 0.1, 0.066, -0.05], [-0.3, 0.26, 0.04, 0.052, 0.13]].forEach(function (a, i) {
      var g = new THREE.CylinderGeometry(a[3] * 0.35, a[3], a[1], 6, 1); g.translate(0, a[1] / 2, 0);   // origin at the base, so it grows upward
      var m = new THREE.Mesh(g, crystalMat); m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat));   // outline the facets only
      m.position.set(a[0], -0.5, a[2]); m.rotation.set(0, i * 0.7, a[4]);
      root.add(m); shards.push(m);
    });

    var orb = new THREE.Group(); orb.position.set(-0.46, 0.2, 0.25); root.add(orb);
    var core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 1), new THREE.MeshStandardMaterial({ color: 0xbafff0, emissive: JADE, emissiveIntensity: 1.5, roughness: 0.2, flatShading: true }));
    orb.add(core);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture("73,227,196"), transparent: true, depthWrite: false, toneMapped: false }));
    halo.scale.setScalar(0.46); orb.add(halo);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.004, 6, 44), new THREE.MeshBasicMaterial({ color: 0xbafff0, transparent: true, opacity: 0, toneMapped: false }));
    orb.add(ring);
    var bits = [];
    for (var b = 0; b < 6; b++) { var bit = new THREE.Mesh(new THREE.OctahedronGeometry(0.012 + (b % 3) * 0.004, 0), crystalMat); orb.add(bit); bits.push(bit); }
    var orbLight = new THREE.PointLight(JADE, 0.5, 0.55); orb.add(orbLight);   // short reach: it must not tint the animals in a line-up

    var rise = 0;
    return {
      root: root, h: 0, scale: 1, mobile: 0.6, fin: 0.56, intro: 0.8, cx: 0.46, my: -0.2, shadow: false,   // cx, my: nudge on phones so the wall sits beside the artwork, clear of the face
      update: function (f) {
        orbLight.distance = 0.4 * root.scale.x;                              // a light's reach does not shrink with its parent, so do it by hand
        var line = f.fin;                                                    // 1 while the cast stands in a line-up
        var want = Math.max(line, 1 - clamp(Math.abs(f.d) * 1.5));           // the wall is up while Riscei holds the stage
        rise = lerp(rise, want, 0.06);
        for (var i = 0; i < shards.length; i++) {
          var k = clamp(rise * 1.5 - i * 0.14), e = 1 - Math.pow(1 - k, 3);
          shards[i].scale.set(0.6 + 0.4 * e, Math.max(0.001, e), 0.6 + 0.4 * e);
        }
        // The orb drifts toward the pointer; in a line-up it floats above the wall.
        var ox = lerp(-0.46 + f.px * 0.2, -0.46, line), oy = lerp(0.2 - f.py * 0.18, 0.2, line) + Math.sin(f.t * 1.3) * 0.02;
        orb.position.x = lerp(orb.position.x, ox, 0.07); orb.position.y = lerp(orb.position.y, oy, 0.07);
        core.rotation.y += f.dt * 0.9; core.rotation.x += f.dt * 0.5;
        halo.scale.setScalar(0.46 + Math.sin(f.t * 2.1) * 0.03 + f.tap * 0.25);
        var p = 1 - f.tap;                                                   // a click sends one pulse ring outward
        ring.visible = f.tap > 0; ring.scale.setScalar(1 + p * 5); ring.material.opacity = f.tap * 0.7;
        for (var j = 0; j < bits.length; j++) {
          var a = f.t * (0.8 + j * 0.13) + j * 1.05, r = 0.11 + (j % 2) * 0.035;
          bits[j].position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.05, Math.sin(a) * r);
          bits[j].rotation.y += f.dt * 2;
        }
      }
    };
  };

  /* ------------------------------------------------------------ Beepo */
  function hexCell(color) { var m = POV.cyl(0.05, 0.05, 0.022, color, 6, { emissive: color, emissiveIntensity: 0.45 }); m.rotation.x = PI / 2; return m; }
  function flower(petal) {
    var g = new THREE.Group();
    for (var i = 0; i < 5; i++) { var a = i / 5 * PI * 2; g.add(POV.at(POV.blob(0.02, 0.02, 0.008, petal), Math.cos(a) * 0.026, Math.sin(a) * 0.026, 0)); }
    g.add(POV.blob(0.014, 0.014, 0.012, 0xffc83d));
    return g;
  }

  Cast.makeBeepo = function () {
    var root = new THREE.Group();
    var beepo = POV.makeBeepo();
    root.add(beepo.root);
    var props = Props(root);
    [[-0.25, 0.42, -0.25, 0.1], [0.31, 0.3, -0.3, 0.14], [0.3, 0.02, 0.22, 0.6]]
      .forEach(function (a, i) { props.add(hexCell(i % 2 ? 0xf5bf3c : 0xe89a1c), a[0], a[1], a[2], { depth: a[3], spin: 0.4 }); });
    var glow = new THREE.PointLight(0xffc24a, 0, 0.5); glow.position.set(0, 0.47, 0.06); root.add(glow);   // warm light from the antenna tips
    var buzz = 0, wingPhase = 0;
    return {
      root: root, h: 0.37, scale: 1.85, mobile: 0.62, fin: 0.8, intro: 1.4, shadow: true,
      update: function (f) {
        var j = hop(f.tap);
        buzz = lerp(buzz, Math.max(f.moving, f.tap > 0 ? 1 : 0), 0.12);
        wingPhase += f.dt * (18 + buzz * 60);   // integrate, so a change of speed never makes the wings jump
        beepo.apply({
          pos: [0, j * 0.07, 0], yaw: f.px * 0.55 + f.d * 0.6, squash: j > 0 ? -0.12 * j : 0,
          breathe: f.t * 2.2, blink: POV.blinks(f.t % 4.6, BLINK_BEEPO),
          headYaw: f.px * 0.35, headPitch: -f.py * 0.22, headTilt: Math.sin(f.t * 0.6) * 0.06, look: [f.px, -f.py],
          mouth: j > 0 ? j * 0.7 : 0,
          wing: 0.25 + buzz * 0.75, wingPhase: wingPhase,
          bob: f.t * 3.2, bobAmp: 0.5 + buzz * 0.5, tailPhase: f.t * 3, tailAmp: 0.6,
          walk: f.walk, walkAmt: f.moving,
          antGlow: clamp(0.65 + 0.35 * Math.sin(f.t * 2.4) + buzz * 0.3), pawUp: j > 0 ? j : 0
        });
        glow.distance = 0.5 * root.scale.x / 1.85;   // keep the glow on the antennae at any size
        glow.intensity = 0.16 + 0.1 * Math.sin(f.t * 2.4) + buzz * 0.14;
        props.update(f);
      }
    };
  };

  /* ------------------------------------------------------------ Noodle and Pip
   * Noodle is the cat rig in its default colours. Pip is the same rig with pale colours, 0.42 scale,
   * a bigger head and eyes, a second catchlight and scruffy tufts. */
  function makePip() {
    var S = 0.42;
    var cat = POV.makeCat({ fur: 0xd8bf9f, stripe: 0xa88a68, cream: 0xf7f1e8, eye: 0x8fd2f2, nose: 0xf3a1ae, inner: 0xf6bcc6, collar: false, bentEar: false, thin: 0.8 });
    var P = cat.parts;
    P.head.scale.setScalar(1.22);
    P.eyes.forEach(function (eg) {
      eg.scale.setScalar(1.32);
      eg.userData.shine.scale.setScalar(1.35);
      var s2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0034, 0), POV.glow(0xffffff, 1.0)); s2.position.set(0.011, -0.012, 0.016); eg.add(s2);
      eg.userData.shine2 = s2;
    });
    var furM = POV.mat(0xd8bf9f);
    function tuft(par, x, y, z, rx, rz, r, h) { var c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), furM); c.position.set(x, y, z); c.rotation.set(rx, 0, rz); par.add(c); }
    tuft(P.head, -0.022, 0.103, 0.01, -0.25, 0.35, 0.016, 0.05); tuft(P.head, 0.004, 0.108, 0.0, -0.35, -0.05, 0.016, 0.055); tuft(P.head, 0.028, 0.1, 0.012, -0.2, -0.45, 0.014, 0.045);
    [-1, 1].forEach(function (s) { tuft(P.head, s * 0.118, -0.02, 0.03, 0, -s * 1.5, 0.016, 0.05); tuft(P.head, s * 0.112, -0.05, 0.035, 0.2, -s * 1.85, 0.013, 0.04); });
    [[-0.03, 0.115, -0.06, -0.6, 0.4], [0.025, 0.118, 0.02, -0.5, -0.3], [-0.01, 0.112, 0.1, -0.4, 0.2], [0.03, 0.105, -0.14, -0.8, -0.4]].forEach(function (b) { tuft(P.body, b[0], b[1], b[2], b[3], b[4], 0.018, 0.05); });
    var apply0 = cat.apply;
    cat.apply = function (s) {
      s = Object.assign({ scale: S }, s || {});
      s.pupil = s.pupil === undefined ? 0.62 : 0.3 + 0.45 * s.pupil;
      apply0(s);
      P.eyes.forEach(function (eg) { eg.userData.shine2.visible = eg.userData.shine.visible; });
    };
    return cat;
  }

  function yarn(color) {
    var g = new THREE.Group();
    g.add(POV.blob(0.04, 0.04, 0.04, color));
    var a = POV.torus(0.041, 0.004, 0xffffff); a.rotation.x = 1.1; g.add(a);
    var b = POV.torus(0.041, 0.004, 0xffffff); b.rotation.set(0.3, 0.9, 0); g.add(b);
    return g;
  }
  function fish(color) {
    var g = new THREE.Group();
    g.add(POV.blob(0.04, 0.02, 0.012, color));
    var t = POV.cone(0.018, 0.03, color, 4); t.rotation.z = -PI / 2; t.position.x = -0.048; g.add(t);
    return g;
  }

  Cast.makeNoodlePip = function () {
    var root = new THREE.Group();
    var noodle = POV.makeCat(), pip = makePip();
    root.add(noodle.root); root.add(pip.root);
    var props = Props(root);
    props.add(yarn(0x16c2b0), -0.36, 0.34, -0.2, { depth: 0.12, spin: 0.5 });
    props.add(yarn(0xff8fa0), 0.4, 0.2, 0.22, { depth: 0.6, spin: -0.4 });
    props.add(fish(0x6fb7e8), 0.34, 0.46, -0.12, { depth: 0.2, spin: 0.25 });
    var R = 0.3, ang = 0, headYaw = 0;
    return {
      root: root, h: 0.3, scale: 1.12, mobile: 0.5, fin: 0.56, intro: 0.86, shadow: true,
      update: function (f) {
        var j = hop(f.tap);
        if (f.mode === "walk") {
          // Side view: both walk toward +x, Pip a step behind and taking two steps for each of Noodle's.
          noodle.apply({ pos: [0, 0, 0], yaw: PI / 2, walk: f.walk, walkAmp: f.moving, breathe: f.t * 2.1, headYaw: -0.55 * (1 - f.moving) + f.px * 0.2, headPitch: -f.py * 0.15,
            blink: POV.blinks(f.t % 5.2, BLINK_NOODLE), pupil: 0.6, tailPhase: f.t * 3.2, tailAmp: 0.35, tailUp: 0.85, paw: j });
          pip.apply({ pos: [-0.44, j * 0.05, 0.13], yaw: PI / 2, walk: f.walk * 1.9, walkAmp: f.moving, breathe: f.t * 3, headYaw: -0.5 * (1 - f.moving), headPitch: 0.1,
            blink: POV.blinks(f.t % 3.9, BLINK_PIP), pupil: 0.8, tailPhase: f.t * 5, tailAmp: 0.5, tailUp: 0.9, squash: j > 0 ? -0.15 * j : 0 });
          props.update(f);
          return;
        }
        // Pip trots a circle round Noodle; scrolling speeds him up.
        ang += f.dt * (0.55 + f.moving * 1.6);
        var x = Math.sin(ang) * R, z = Math.cos(ang) * R;
        pip.apply({
          pos: [x, j * 0.05, z], yaw: ang + PI / 2, walk: ang * R / 0.03, walkAmp: 1,
          breathe: f.t * 3, tailPhase: f.t * 5, tailAmp: 0.5, tailUp: 0.85,
          headYaw: -0.35, headPitch: 0.1, blink: POV.blinks(f.t % 3.9, BLINK_PIP), pupil: 0.8,
          squash: j > 0 ? -0.15 * j : 0, mouth: j > 0 ? j * 0.6 : 0
        });
        // Noodle sits, watches the pointer and keeps half an eye on Pip.
        var toPip = Math.atan2(x, z), base = 0.45 + f.d * 0.5;
        var off = POV_unwrap(base, toPip) - base;
        // Follow Pip while he is in front; let go smoothly as he passes behind so the head never snaps across.
        var watch = clamp(off, -0.9, 0.9) * (1 - sstep(1.6, 2.6, Math.abs(off)));
        headYaw = lerp(headYaw, clamp(watch * 0.55 + f.px * 0.5, -1, 1), 0.1);
        noodle.apply({
          pos: [0, 0, 0], yaw: base, breathe: f.t * 2.1,
          headYaw: headYaw, headPitch: -f.py * 0.25, headTilt: Math.sin(f.t * 0.5) * 0.07,
          blink: POV.blinks(f.t % 5.2, BLINK_NOODLE), pupil: 0.55 + f.moving * 0.35,
          tailPhase: f.t * 2.6, tailAmp: 0.35, tailUp: 0.6, earsBack: f.moving * 0.25,
          paw: j, lie: 0, crouch: f.moving * 0.12
        });
        props.update(f);
      }
    };
  };
  function POV_unwrap(a, b) { while (b - a > PI) b -= 2 * PI; while (a - b > PI) b += 2 * PI; return b; }

  window.Cast = Cast;
})();
