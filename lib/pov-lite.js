(function (global) {
  "use strict";
  var THREE = global.THREE;
  if (!THREE) throw new Error("pov-kit: window.THREE missing — load lib/three-vendor.js first");
  var POV = {};

  var clamp = function (x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, x)); };
  var lerp = function (a, b, k) { return a + (b - a) * k; };
  var ease = {
    linear: function (k) { return k; },
    in: function (k) { return k * k * k; },
    out: function (k) { return 1 - Math.pow(1 - k, 3); },
    inOut: function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; },
    sine: function (k) { return -(Math.cos(Math.PI * k) - 1) / 2; },
    quadOut: function (k) { return 1 - (1 - k) * (1 - k); },
    quadIn: function (k) { return k * k; },
    expoOut: function (k) { return k >= 1 ? 1 : 1 - Math.pow(2, -10 * k); },
    expoIn: function (k) { return k <= 0 ? 0 : Math.pow(2, 10 * k - 10); },
    backOut: function (k) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
    step: function (k) { return k >= 1 ? 1 : 0; },
    bounceOut: function (x) {
      var n1 = 7.5625, d1 = 2.75;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
  };
  POV.clamp = clamp; POV.lerp = lerp; POV.ease = ease;
  var matCache = {};

  POV.mat = function (color, o) {
    o = o || {};
    var key = color + "|" + JSON.stringify(o);
    if (matCache[key]) return matCache[key];
    var m = new THREE.MeshStandardMaterial({
      color: color, flatShading: o.flat !== false, roughness: o.roughness === undefined ? 0.85 : o.roughness,
      metalness: o.metalness || 0, emissive: o.emissive || 0x000000, emissiveIntensity: o.emissiveIntensity || 0,
      transparent: !!o.transparent, opacity: o.opacity === undefined ? 1 : o.opacity, side: o.side || THREE.FrontSide
    });
    matCache[key] = m;
    return m;
  };

  POV.glow = function (color, intensity) {
    return new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: intensity || 2, roughness: 1, flatShading: true });
  };

  function mesh(geo, mat, shadow) {
    var m = new THREE.Mesh(geo, mat);
    if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  }
  function c(color, o) { return typeof color === "object" && color.isMaterial ? color : POV.mat(color, o); }
  POV.box = function (w, h, d, color, o) { return mesh(new THREE.BoxGeometry(w, h, d), c(color, o)); };
  POV.cyl = function (rt, rb, h, color, seg, o) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), c(color, o)); };
  POV.cone = function (r, h, color, seg, o) { return mesh(new THREE.ConeGeometry(r, h, seg || 6), c(color, o)); };

  POV.blob = function (sx, sy, sz, color, detail, o) {
    var m = mesh(new THREE.IcosahedronGeometry(1, detail === undefined ? 1 : detail), c(color, o));
    m.scale.set(sx, sy, sz);
    return m;
  };
  POV.capsule = function (r, len, color, o) { return mesh(new THREE.CapsuleGeometry(r, len, 3, 8), c(color, o)); };
  POV.torus = function (r, tube, color, o) { return mesh(new THREE.TorusGeometry(r, tube, 6, 14), c(color, o)); };

  POV.at = function (obj, x, y, z, rx, ry, rz) {
    obj.position.set(x, y, z);
    if (rx || ry || rz) obj.rotation.set(rx || 0, ry || 0, rz || 0);
    return obj;
  };

  POV.decal = function (obj, layer) {
    var k = -(layer || 1);
    obj.traverse(function (m) {
      if (!m.isMesh) return;
      m.material = m.material.clone();
      m.material.polygonOffset = true; m.material.polygonOffsetFactor = k; m.material.polygonOffsetUnits = k * 4;
    });
    return obj;
  };
  POV.group = function () { var g = new THREE.Group(); for (var i = 0; i < arguments.length; i++) g.add(arguments[i]); return g; };
  POV.makeCat = function (o) {
    o = Object.assign({ fur: 0xf08a2e, stripe: 0xc8601a, cream: 0xfff0d8, eye: 0x9be35a, pupil: 0x141414,
      nose: 0xff8fa0, inner: 0xffb3bf, collar: 0x16c2b0, tag: 0xffd25a, bentEar: true }, o || {});
    var P = {};
    var root = new THREE.Group();
    var bodyPivot = new THREE.Group(); root.add(bodyPivot);
    var body = new THREE.Group(); body.position.y = 0.17; bodyPivot.add(body); P.body = body;
    body.add(POV.blob(0.135, 0.12, 0.22, o.fur));
    body.add(POV.at(POV.blob(0.09, 0.085, 0.07, o.cream), 0, -0.01, 0.16));
    for (var s = 0; s < 3; s++) {
      var st = POV.box(0.085, 0.012, 0.035, o.stripe); st.position.set(0, 0.108 - Math.abs(s - 1) * 0.003, -0.09 + s * 0.08); st.rotation.x = 0.05; body.add(st);
    }

    P.legs = [];
    [[-0.075, 0.13], [0.075, 0.13], [-0.075, -0.13], [0.075, -0.13]].forEach(function (p, i) {
      var leg = new THREE.Group(); leg.position.set(p[0], 0.12, p[1]);
      var lm = POV.capsule(0.032, 0.07, o.fur); lm.position.y = -0.06; leg.add(lm);
      var paw = POV.blob(0.038, 0.024, 0.045, o.cream); paw.position.set(0, -0.11, 0.008); leg.add(paw);
      bodyPivot.add(leg); P.legs.push(leg);
    });

    var neck = new THREE.Group(); neck.position.set(0, 0.25, 0.17); bodyPivot.add(neck); P.neck = neck;
    var head = new THREE.Group(); head.position.set(0, 0.06, 0.03); neck.add(head); P.head = head;
    head.add(POV.blob(0.13, 0.112, 0.11, o.fur));
    head.add(POV.at(POV.blob(0.07, 0.045, 0.05, o.cream), 0, -0.04, 0.08));
    head.add(POV.at(POV.blob(0.035, 0.03, 0.03, o.cream), -0.03, -0.035, 0.1));
    head.add(POV.at(POV.blob(0.035, 0.03, 0.03, o.cream), 0.03, -0.035, 0.1));
    var nose = POV.cone(0.018, 0.018, o.nose, 3); nose.rotation.x = Math.PI; nose.position.set(0, -0.012, 0.118); head.add(nose);
    for (var m = -1; m <= 1; m++) {
      var fs = POV.box(0.012, 0.045, 0.012, o.stripe); fs.position.set(m * 0.026, 0.07, 0.085 - Math.abs(m) * 0.01); fs.rotation.x = -0.45; head.add(fs);
    }
    var mouth = POV.blob(0.022, 0.016, 0.012, 0x6b2232); mouth.position.set(0, -0.068, 0.1); mouth.scale.y = 0.001; head.add(mouth); P.mouth = mouth;
    var tongue = new THREE.Group(); tongue.position.set(0, -0.07, 0.1); head.add(tongue); P.tongue = tongue;
    var tm = POV.blob(0.022, 0.006, 0.04, 0xff7f98, 1, { roughness: 0.5 }); tm.position.z = 0.03; tm.castShadow = false; tongue.add(tm);
    tongue.scale.setScalar(0.001);

    P.eyes = []; P.pupils = [];
    [-1, 1].forEach(function (sd) {
      var eg = new THREE.Group(); eg.position.set(sd * 0.05, 0.012, 0.088); eg.rotation.y = sd * 0.28; head.add(eg);
      var iris = POV.blob(0.034, 0.038, 0.016, o.eye, 1, { roughness: 0.35 }); eg.add(iris);
      var pupil = POV.blob(0.012, 0.03, 0.006, o.pupil, 1, { roughness: 0.2 }); pupil.position.z = 0.012; eg.add(pupil);
      var shine = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0062, 0), POV.glow(0xffffff, 1.05)); shine.position.set(-0.01, 0.014, 0.017); eg.add(shine);

      var lid = POV.blob(0.038, 0.041, 0.019, o.fur); lid.position.z = 0.006; lid.scale.y = 0.0005; lid.castShadow = false; eg.add(lid);

      var lash = POV.box(1, 0.006, 0.005, 0x3a1d0c); lash.position.z = 0.024; lash.castShadow = false; lash.visible = false; eg.add(lash);
      var shut = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0034, 4, 14, Math.PI), POV.mat(0x3a1d0c));
      shut.rotation.z = Math.PI; shut.scale.y = 0.5; shut.position.set(0, 0.002, 0.025); shut.castShadow = false; shut.visible = false; eg.add(shut);
      eg.userData.lid = lid; eg.userData.shine = shine; eg.userData.lash = lash; eg.userData.shut = shut;
      P.eyes.push(eg); P.pupils.push(pupil);
    });

    [-1, 1].forEach(function (sd) {
      for (var w = 0; w < 3; w++) {
        var wh = POV.box(0.11, 0.003, 0.003, 0xffffff); wh.castShadow = false;
        wh.position.set(sd * 0.095, -0.045 + w * 0.01, 0.09); wh.rotation.z = sd * (w - 1) * 0.12; wh.rotation.y = sd * -0.25; head.add(wh);
      }
    });

    P.ears = [];
    [-1, 1].forEach(function (sd) {
      var ear = new THREE.Group(); ear.position.set(sd * 0.072, 0.075, -0.005); ear.rotation.z = -sd * 0.38; head.add(ear);
      var bent = o.bentEar && sd < 0;
      var outer = POV.cone(0.046, bent ? 0.05 : 0.08, o.fur, 4); outer.position.y = bent ? 0.025 : 0.04; outer.rotation.y = Math.PI / 4; ear.add(outer);
      var inner = POV.cone(0.03, bent ? 0.035 : 0.058, o.inner, 4); inner.position.set(0, bent ? 0.02 : 0.032, 0.012); inner.rotation.y = Math.PI / 4; inner.castShadow = false; ear.add(inner);
      if (bent) {

        var fold = new THREE.Group(); fold.position.set(0, 0.036, 0.004); fold.rotation.x = 2.0; ear.add(fold);
        var tip = POV.cone(0.03, 0.045, o.fur, 4); tip.position.y = 0.0225; tip.rotation.y = Math.PI / 4; fold.add(tip);
      }
      P.ears.push(ear);
    });

    if (o.collar !== false) {
      var collar = POV.torus(0.085, 0.014, o.collar, { roughness: 0.5 }); collar.rotation.x = Math.PI / 2 - 0.35; collar.position.set(0, -0.005, 0.0); neck.add(collar);
      var tag = POV.cyl(0.022, 0.022, 0.008, o.tag, 6, { metalness: 0.6, roughness: 0.3 }); tag.rotation.x = Math.PI / 2; tag.position.set(0, -0.06, 0.07); neck.add(tag);
    }
    if (o.thin) body.scale.x = o.thin;

    var tailRoot = new THREE.Group(); tailRoot.position.set(0, 0.2, -0.2); bodyPivot.add(tailRoot); P.tail = [];
    var parent = tailRoot, N = 7;
    for (var i = 0; i < N; i++) {
      var seg = new THREE.Group(); seg.position.y = i === 0 ? 0 : 0.055; parent.add(seg);
      var r = 0.026 - i * 0.0016;
      var sm = POV.capsule(r, 0.04, i >= N - 2 ? o.cream : (i % 2 ? o.stripe : o.fur)); sm.position.y = 0.03; seg.add(sm);
      P.tail.push(seg); parent = seg;
    }

    function setLid(eg, b) {
      b = clamp(b);
      var u = eg.userData, h = 0.041 * b, edge = 0.041 - 2 * h;
      u.lid.scale.y = Math.max(0.0005, h); u.lid.position.y = 0.041 - h;
      u.lid.visible = b > 0.02;
      u.shine.visible = b < 0.45;
      var chord = 0.031 * Math.sqrt(Math.max(0, 1 - (edge / 0.04) * (edge / 0.04)));
      u.lash.visible = b > 0.12 && b < 0.9 && chord > 0.004; u.lash.position.y = edge + 0.0015; u.lash.scale.x = Math.max(0.001, 2 * chord);
      u.shut.visible = b >= 0.9;
    }
    var cat = {
      root: root, parts: P,

      setLid: function (i, b) { setLid(P.eyes[i], b); },
      apply: function (s) {
        s = s || {};
        var p = s.pos || [0, 0, 0];
        root.position.set(p[0], p[1], p[2]);
        root.rotation.set(s.pitch || 0, s.yaw || 0, s.roll || 0, "YXZ");
        root.scale.setScalar(s.scale || 1);
        var breathe = Math.sin(s.breathe || 0) * 0.015;
        var sq = (s.squash || 0) + breathe;
        var crouch = clamp(s.crouch || 0), lie = clamp(s.lie || 0);
        bodyPivot.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.35);
        bodyPivot.position.y = -0.07 * crouch - 0.1 * lie;

        var wa = s.walkAmp === undefined ? 1 : s.walkAmp, ph = s.walk || 0;
        P.legs.forEach(function (leg, i) {
          var off = (i === 0 || i === 3) ? 0 : Math.PI;
          leg.rotation.x = Math.sin(ph + off) * 0.55 * wa * (s.walk === undefined ? 0 : 1) + lie * (i < 2 ? -1.3 : 1.3);
          if (i === 0 && s.paw) leg.rotation.x += -1.5 * clamp(s.paw);
          leg.scale.y = 1 - lie * 0.4;
        });
        body.position.y = 0.17 + Math.abs(Math.sin(ph)) * 0.012 * wa * (s.walk === undefined ? 0 : 1);

        P.neck.rotation.set(-(s.headPitch || 0) + crouch * 0.25, s.headYaw || 0, s.headTilt || 0, "YXZ");

        var blink = clamp(s.blink || 0), pupil = s.pupil === undefined ? 0.45 : s.pupil;
        P.eyes.forEach(function (eg) { setLid(eg, blink); });
        P.pupils.forEach(function (pp) { pp.scale.x = lerp(0.004, 0.026, clamp(pupil)); pp.scale.y = lerp(0.03, 0.032, clamp(pupil)); });
        P.mouth.scale.y = Math.max(0.001, 0.02 * clamp(Math.max(s.mouth || 0, (s.tongue || 0) * 0.8)));
        var tg = clamp(s.tongue || 0); P.tongue.scale.set(Math.max(0.001, tg), Math.max(0.001, tg), Math.max(0.001, tg)); P.tongue.rotation.x = 0.5 - tg * 0.6;

        var eb = clamp(s.earsBack || 0);
        P.ears.forEach(function (ear, i) { var sd = i === 0 ? -1 : 1; ear.rotation.set(-eb * 0.9, 0, -sd * (0.38 + eb * 0.5)); });

        var tp = s.tailPhase || 0, ta = s.tailAmp === undefined ? 0.25 : s.tailAmp, tu = s.tailUp === undefined ? 0.5 : s.tailUp;
        P.tail.forEach(function (seg, i) {
          var k = (i + 1) / P.tail.length;
          seg.rotation.z = Math.sin(tp - i * 0.55) * ta * k * 1.4;
          seg.rotation.x = i === 0 ? -0.9 + (1 - tu) * -0.9 : -0.12 * tu + (1 - tu) * 0.2;
        });
      }
    };
    cat.apply({});
    return cat;
  };

  POV.blinks = function (t, times) {
    var b = 0;
    for (var i = 0; i < times.length; i++) { var d = t - times[i]; if (d > 0 && d < 0.18) b = Math.max(b, Math.sin((d / 0.18) * Math.PI)); }
    return b;
  };
  global.POV = POV;
})(window);
