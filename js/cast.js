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

  /* ------------------------------------------------------------ Riscei: a phone with desk gear around it */
  function roundedRect(w, h, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function screenTexture() {
    var c = document.createElement("canvas"); c.width = 540; c.height = 1170;
    var g = c.getContext("2d");
    g.fillStyle = "#0b0b0e"; g.fillRect(0, 0, 540, 1170);
    var grd = g.createRadialGradient(270, 190, 10, 270, 190, 90); grd.addColorStop(0, "#ff7a6e"); grd.addColorStop(1, "#b3261e");
    g.fillStyle = grd; g.beginPath(); g.arc(270, 190, 78, 0, PI * 2); g.fill();
    g.fillStyle = "#f4f1ea"; g.textAlign = "center";
    g.font = "700 40px system-ui, Segoe UI, Arial"; g.fillText("@riscei", 270, 335);
    var stats = [["164.9K", "Followers"], ["10.2M", "Likes"], ["256", "Videos"]];
    stats.forEach(function (s, i) {
      var x = 100 + i * 170;
      g.fillStyle = "#f4f1ea"; g.font = "700 38px system-ui, Segoe UI, Arial"; g.fillText(s[0], x, 425);
      g.fillStyle = "#8d8a86"; g.font = "400 21px system-ui, Segoe UI, Arial"; g.fillText(s[1], x, 458);
    });
    g.fillStyle = "#ff5a4f"; g.fillRect(40, 500, 460, 3);
    var tiles = ["#3a1210", "#1b1d26", "#4a1a16", "#22232b", "#5a1f1a", "#15161c", "#2b0f0d", "#1e2029", "#431714"];
    for (var i = 0; i < 9; i++) {
      var tx = 40 + (i % 3) * 156, ty = 535 + Math.floor(i / 3) * 204;
      g.fillStyle = tiles[i]; g.fillRect(tx, ty, 148, 196);
      g.fillStyle = "rgba(244,241,234,0.85)"; g.beginPath(); g.moveTo(tx + 62, ty + 80); g.lineTo(tx + 62, ty + 116); g.lineTo(tx + 92, ty + 98); g.closePath(); g.fill();
    }
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }

  Cast.makeRiscei = function () {
    var root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
    var W = 0.3, H = 0.62, D = 0.028;
    var bodyGeo = new THREE.ExtrudeGeometry(roundedRect(W, H, 0.045), { depth: D, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 8 });
    bodyGeo.translate(0, 0, -D / 2);
    var body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0xd3d6dd, roughness: 0.32, metalness: 0.35 }));
    tilt.add(body);
    var screen = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W - 0.022, H - 0.022, 0.036), 8),
      new THREE.MeshBasicMaterial({ map: screenTexture(), toneMapped: false }));
    // ShapeGeometry UVs are in shape units, so map them back onto 0..1 for the texture.
    var uv = screen.geometry.attributes.uv, pos = screen.geometry.attributes.position;
    for (var i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (W - 0.022) + 0.5, pos.getY(i) / (H - 0.022) + 0.5);
    screen.position.z = D / 2 + 0.0046; tilt.add(screen);

    var glow = new THREE.PointLight(0xfff1e0, 0.5, 2.4); glow.position.set(-0.6, 0.3, 0.9); root.add(glow);

    var props = Props(root);
    // A 60 percent keyboard: one instanced mesh for all the keys.
    var kb = new THREE.Group();
    kb.add(POV.box(0.46, 0.02, 0.17, 0x1a1b21));
    var keys = new THREE.InstancedMesh(new THREE.BoxGeometry(0.026, 0.014, 0.026), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.7 }), 70);
    var m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (var r = 0; r < 5; r++) for (var c = 0; c < 14; c++) {
      var k = r * 14 + c;
      m4.makeTranslation(-0.2015 + c * 0.031, 0.016, -0.062 + r * 0.031); keys.setMatrixAt(k, m4);
      keys.setColorAt(k, col.set((k === 0 || k === 41 || k === 69) ? 0x2a0f0b : ((r + c) % 7 === 0 ? 0x9a9da6 : 0xe9e6df)));
    }
    kb.add(keys); kb.rotation.set(0.75, -0.35, 0.12);
    props.add(kb, -0.36, -0.3, 0.12, { spin: 0, amp: 0.012, depth: 0.42 });
    // Mouse
    var mouse = new THREE.Group();
    mouse.add(POV.blob(0.045, 0.026, 0.07, 0x111217, 2, { flat: false, roughness: 0.4 }));
    mouse.add(POV.at(POV.box(0.004, 0.012, 0.03, 0xffe6dc), 0, 0.022, 0.03));
    mouse.rotation.set(0.6, 0.5, -0.2);
    props.add(mouse, 0.27, -0.24, 0.2, { spin: 0, amp: 0.02, sp: 1.2, depth: 0.55 });
    // Earbuds
    [-1, 1].forEach(function (s) {
      var bud = new THREE.Group();
      bud.add(POV.blob(0.022, 0.022, 0.018, 0xf4f1ea, 2, { flat: false, roughness: 0.3 }));
      bud.add(POV.at(POV.capsule(0.007, 0.04, 0xf4f1ea, { flat: false, roughness: 0.3 }), 0, -0.03, 0));
      props.add(bud, -0.3 + s * 0.05, 0.3 + s * 0.02, -0.1, { spin: 0.5 * s, amp: 0.02, sp: 0.8 + s * 0.1, depth: 0.16 });
    });
    // Loose keycaps
    [[0.31, 0.3, -0.2, 0xfff3e6, 0.12], [0.4, 0.06, -0.3, 0xe9e6df, 0.1], [-0.4, 0.04, 0.3, 0xe9e6df, 0.62], [0.24, -0.36, 0.34, 0x2a2c35, 0.7], [-0.22, -0.02, -0.4, 0x2a2c35, 0.08]]
      .forEach(function (a) { props.add(POV.box(0.04, 0.03, 0.04, a[3]), a[0], a[1], a[2], { spin: 0.7, depth: a[4], amp: 0.025 }); });

    return {
      root: root, h: 0, scale: 1, mobile: 0.6, fin: 0.52, intro: 0.85, shadow: false,
      update: function (f) {
        var k = 1 - f.tap, spin = f.tap > 0 ? PI * 2 * (1 - Math.pow(1 - k, 3)) : 0;   // one full turn per click, eased out
        tilt.rotation.y = -0.38 + f.px * 0.45 + Math.sin(f.t * 0.5) * 0.08 + spin;
        tilt.rotation.x = 0.06 + f.py * 0.22;
        tilt.position.y = Math.sin(f.t * 0.9) * 0.012;
        props.update(f);
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
    [[-0.24, 0.44, -0.25, 0.1], [0.3, 0.38, -0.3, 0.12], [0.33, 0.12, 0.2, 0.6], [-0.27, 0.08, 0.24, 0.66], [0.02, 0.52, -0.4, 0.06]]
      .forEach(function (a, i) { props.add(hexCell(i % 2 ? 0xf5bf3c : 0xe89a1c), a[0], a[1], a[2], { depth: a[3], spin: 0.4 }); });
    props.add(flower(0xff9fb4), -0.2, 0.27, 0.3, { depth: 0.5, spin: 0.25 });
    props.add(flower(0xffffff), 0.26, 0.5, -0.1, { depth: 0.2, spin: -0.3 });
    props.add(flower(0xff9fb4), 0.34, -0.02, -0.2, { depth: 0.14, spin: 0.3 });
    var buzz = 0;
    return {
      root: root, h: 0.37, scale: 1.85, mobile: 0.62, fin: 0.8, intro: 1.4, shadow: true,
      update: function (f) {
        var j = hop(f.tap);
        buzz = lerp(buzz, Math.max(f.moving, f.tap > 0 ? 1 : 0), 0.12);
        beepo.apply({
          pos: [0, j * 0.07, 0], yaw: f.px * 0.55 + f.d * 0.6, squash: j > 0 ? -0.12 * j : 0,
          breathe: f.t * 2.2, blink: POV.blinks(f.t % 4.6, BLINK_BEEPO),
          headYaw: f.px * 0.35, headPitch: -f.py * 0.22, headTilt: Math.sin(f.t * 0.6) * 0.06, look: [f.px, f.py],
          mouth: j > 0 ? j * 0.7 : 0,
          wing: 0.25 + buzz * 0.75, wingPhase: f.t * (18 + buzz * 60),
          bob: f.t * 3.2, bobAmp: 0.5 + buzz * 0.5, tailPhase: f.t * 3, tailAmp: 0.6,
          walk: f.walk, walkAmt: f.moving
        });
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
    props.add(yarn(0xffd25a), 0.1, 0.5, -0.36, { depth: 0.08, spin: 0.3 });
    props.add(fish(0x6fb7e8), 0.36, 0.44, -0.12, { depth: 0.2, spin: 0.25 });
    props.add(fish(0xf08a2e), -0.4, 0.08, 0.26, { depth: 0.64, spin: -0.3 });
    var R = 0.3, ang = 0, headYaw = 0;
    return {
      root: root, h: 0.3, scale: 1.12, mobile: 0.5, fin: 0.56, intro: 0.86, shadow: true,
      update: function (f) {
        var j = hop(f.tap);
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
