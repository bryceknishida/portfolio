(function () {
  "use strict";
  var POV = window.POV, PI = Math.PI;

  function colorize(geom, fn) {
    var g = geom.index ? geom.toNonIndexed() : geom;
    var p = g.attributes.position, n = p.count, cols = new Float32Array(n * 3), col = new THREE.Color();
    var box = new THREE.Box3().setFromBufferAttribute(p), ctr = box.getCenter(new THREE.Vector3()), half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    for (var i = 0; i < n; i += 3) {
      var cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      col.setHex(fn((cx - ctr.x) / (half.x || 1), (cy - ctr.y) / (half.y || 1), (cz - ctr.z) / (half.z || 1)));
      for (var k = 0; k < 3; k++) { cols[(i + k) * 3] = col.r; cols[(i + k) * 3 + 1] = col.g; cols[(i + k) * 3 + 2] = col.b; }
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return g;
  }
  var FACET = null;
  function facetMat() { return FACET || (FACET = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 })); }
  function facet(geom, fn) {
    var m = new THREE.Mesh(colorize(geom, fn), facetMat());
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function blob(sx, sy, sz, detail, fn) { var m = facet(new THREE.IcosahedronGeometry(1, detail), fn); m.scale.set(sx, sy, sz); return m; }
  function solid(c) { return function () { return c; }; }
  function hex(x, y, r) { var ax = Math.abs(x), ay = Math.abs(y); return Math.max(ax * 0.866 + ay * 0.5, ay) <= r; }

  POV.makeBeepo = function (o) {
    o = Object.assign({ fur: 0xf5bf3c, band: 0x4a3226, cream: 0xfff3d6, sock: 0x4a3226, inner: 0xffb0b8, nose: 0xf28a9a,
      iris: 0x8a4f1c, pupil: 0x1a0f08, blush: 0xff9aa8, wing: 0xeef8ff, wingLine: 0xb98c4a }, o || {});
    var P = {};
    var root = new THREE.Group(); root.name = "beepo"; root.userData.beepo = true;
    var pivot = new THREE.Group(); root.add(pivot);
    var body = new THREE.Group(); pivot.add(body); P.body = body;

    var torso = blob(0.085, 0.095, 0.08, 3, function (x, y, z) {
      if (z > 0.35 && hex(x * 1.05, y + 0.05, 0.62)) return o.cream;
      var yy = y - 0.18 * z;
      if ((yy > 0.2 && yy < 0.44) || (yy > -0.28 && yy < -0.06)) return o.band;
      return o.fur;
    });
    torso.position.set(0, 0.095, -0.005); body.add(torso); P.torso = torso;
    P.hind = [];
    [-1, 1].forEach(function (s) {
      var h = blob(0.05, 0.046, 0.066, 3, function (x, y, z) { return (z < 0.5 && y > 0.0 && y < 0.38) ? o.band : o.fur; });
      h.position.set(s * 0.056, 0.046, -0.022); body.add(h);
      var f = blob(0.022, 0.014, 0.036, 1, solid(o.sock)); f.position.set(s * 0.062, 0.013, 0.03); body.add(f);

      P.hind.push({ s: s, h: h, f: f, hp: h.position.clone(), fp: f.position.clone(), pv: new THREE.Vector3(s * 0.056, 0.075, -0.03) });
    });

    P.legs = [];
    [-1, 1].forEach(function (s) {
      var g = new THREE.Group(); g.position.set(s * 0.032, 0.075, 0.05); body.add(g);
      var leg = blob(0.021, 0.04, 0.022, 2, function (x, y) { return y < -0.45 ? o.sock : o.fur; });
      leg.position.y = -0.03; g.add(leg);
      var paw = blob(0.024, 0.016, 0.029, 1, solid(o.sock)); paw.position.set(0, -0.062, 0.012); g.add(paw);
      P.legs.push({ g: g, s: s });
    });

    var tail = new THREE.Group(); tail.position.set(0, 0.035, -0.075); body.add(tail);
    P.tail = []; var parent = tail;
    for (var i = 0; i < 7; i++) {
      var seg = new THREE.Group(); seg.position.set(0, i ? 0.026 : 0, i ? 0 : 0); parent.add(seg);
      var r = 0.019 - i * 0.0012;
      var b = blob(r, 0.017, r, 1, solid(i % 2 ? o.band : o.fur)); b.position.y = 0.013; seg.add(b);
      P.tail.push(seg); parent = seg;
    }

    var wings = new THREE.Group(); wings.position.set(0, 0.13, -0.075); body.add(wings); P.wingRoot = wings;
    var wMat = new THREE.MeshStandardMaterial({ color: o.wing, emissive: 0xa8dcff, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.1,
      transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false });
    var lMat = new THREE.LineBasicMaterial({ color: o.wingLine, transparent: true, opacity: 1 });
    function wingMesh(rx, ry) {
      var sh = new THREE.Shape(), N = 24, pts = [];
      for (var k = 0; k <= N; k++) { var a = k / N * PI * 2, px = rx + Math.cos(a) * rx, py = Math.sin(a) * ry * (1 - 0.25 * Math.cos(a)); pts.push(new THREE.Vector2(px, py)); }
      sh.setFromPoints(pts);
      var g = new THREE.Group();
      var m = new THREE.Mesh(new THREE.ShapeGeometry(sh), wMat); m.renderOrder = 2; g.add(m);
      g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map(function (q) { return new THREE.Vector3(q.x, q.y, 0.0005); })), lMat));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.004, 0, 0.0006), new THREE.Vector3(rx * 1.6, ry * 0.15, 0.0006)]), lMat));
      return g;
    }
    P.wings = [];
    [-1, 1].forEach(function (s) {
      [[0.094, 0.05, 0.45, 0.0], [0.062, 0.034, 0.12, -0.026]].forEach(function (w, j) {
        var piv = new THREE.Group(); piv.position.set(s * 0.04, w[3], -0.004 * j); wings.add(piv);
        var wm = wingMesh(w[0], w[1]); if (s < 0) wm.scale.x = -1; piv.add(wm);
        P.wings.push({ piv: piv, s: s, up: w[2], hind: j });
      });
    });

    var neck = new THREE.Group(); neck.position.set(0, 0.17, 0.0); body.add(neck); P.neck = neck;
    var head = new THREE.Group(); head.position.set(0, 0.05, 0.015); neck.add(head); P.head = head;
    var skull = blob(0.12, 0.105, 0.105, 3, function (x, y, z) {
      if (z > 0.7 && y < -0.12 && y > -0.75 && Math.abs(x) < 0.38) return o.cream;
      if (z < -0.3 && y > -0.15 && y < 0.22) return o.band;
      return o.fur;
    });
    head.add(skull);
    [-1, 1].forEach(function (s) {
      var ear = new THREE.Group(); ear.position.set(s * 0.068, 0.078, -0.01); ear.rotation.set(-0.12, 0, -s * 0.38); head.add(ear);
      var outer = facet(new THREE.ConeGeometry(0.043, 0.078, 4), function (x, y) { return y > 0.45 ? o.band : o.fur; });
      outer.rotation.y = PI / 4; outer.position.y = 0.03; ear.add(outer);
      var inner = facet(new THREE.ConeGeometry(0.026, 0.05, 3), solid(o.inner)); inner.position.set(0, 0.022, 0.016); inner.scale.z = 0.45; ear.add(inner);
      P["ear" + s] = ear;
    });
    P.antennae = [];
    [-1, 1].forEach(function (s) {
      var a = new THREE.Group(); a.position.set(s * 0.022, 0.098, 0.018); head.add(a);
      var stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0034, 0.058, 5), POV.mat(o.band)); stalk.position.y = 0.029; a.add(stalk);
      var tip = blob(0.011, 0.011, 0.011, 1, solid(o.band)); tip.position.y = 0.062; a.add(tip);
      var gMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb43c, emissiveIntensity: 1, roughness: 0.6, flatShading: true });
      var glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0128, 1), gMat); glow.position.y = 0.062; glow.visible = false; a.add(glow);
      P.antennae.push({ g: a, s: s, stalk: stalk, tip: tip, glow: glow });
    });

    P.eyes = [];
    [-1, 1].forEach(function (s) {

      var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1000);
      var eyeMat = new THREE.MeshStandardMaterial({ color: o.iris, roughness: 0.25, metalness: 0.05, clippingPlanes: [plane] });
      var pupMat = new THREE.MeshStandardMaterial({ color: o.pupil, roughness: 0.2, clippingPlanes: [plane] });
      var hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff, clippingPlanes: [plane] });
      var e = new THREE.Group(); e.position.set(s * 0.051, -0.013, 0.085); e.rotation.set(0.04, s * 0.42, 0); head.add(e);
      var lid = new THREE.Group(); e.add(lid);
      var ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), eyeMat); ball.scale.set(0.033, 0.034, 0.016); lid.add(ball);
      var pup = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), pupMat); pup.scale.set(0.0285, 0.0285, 0.0125); pup.position.set(0, -0.0035, 0.0052); lid.add(pup);
      var h1 = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), hiMat); h1.scale.set(0.0105, 0.0105, 0.004); h1.position.set(-0.008, 0.007, 0.0162); lid.add(h1);
      var h2 = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), hiMat); h2.scale.set(0.0045, 0.0045, 0.003); h2.position.set(0.0105, -0.0125, 0.0152); lid.add(h2);
      var shut = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0024, 4, 12, PI), POV.mat(o.band)); shut.rotation.z = PI; shut.position.set(0, 0.004, 0.012); shut.visible = false; e.add(shut);
      var joy = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.0026, 4, 12, PI), POV.mat(o.band)); joy.position.set(0, -0.006, 0.013); joy.visible = false; e.add(joy);
      var lash = new THREE.Mesh(new THREE.CapsuleGeometry(0.0021, 1, 2, 6), POV.mat(o.band)); e.add(lash);
      P.eyes.push({ e: e, lid: lid, pup: pup, shut: shut, joy: joy, lash: lash, plane: plane, h1: h1, h2: h2, s: s });
    });
    var nose = facet(new THREE.ConeGeometry(0.0095, 0.008, 3), solid(o.nose)); nose.rotation.set(PI + 0.25, 0, 0); nose.position.set(0, -0.03, 0.103); head.add(nose);
    var smile = new THREE.Group(); smile.position.set(0, -0.043, 0.1); head.add(smile); P.smile = smile;
    [-1, 1].forEach(function (s) {
      var arc = new THREE.Mesh(new THREE.TorusGeometry(0.0058, 0.0014, 4, 10, PI), POV.mat(o.band)); arc.rotation.z = PI; arc.position.x = s * 0.0058; smile.add(arc);
    });
    var mouth = blob(0.007, 0.006, 0.003, 1, solid(0xc85a6a)); mouth.position.set(0, -0.049, 0.099); head.add(mouth); P.mouth = mouth;
    var blushMat = new THREE.MeshBasicMaterial({ color: o.blush, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    var whiskMat = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });
    [-1, 1].forEach(function (s) {
      var bl = new THREE.Mesh(new THREE.CircleGeometry(0.014, 14), blushMat); bl.scale.y = 0.6; bl.position.set(s * 0.08, -0.04, 0.073); bl.rotation.y = s * 0.7; head.add(bl);
      [0.12, -0.05].forEach(function (a) {
        var w = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0005, 0.07, 4), whiskMat);
        w.rotation.z = s * (PI / 2 - a); w.position.set(s * (0.085 + 0.03), -0.037 + 0.03 * Math.sin(a), 0.075); head.add(w);
      });
    });

    var EXPR = {
      neutral: {},
      happy:   { joy: 1, mouth: 0.6, earsBack: 0 },
      sad:     { lid: 0.32, lidTilt: -1, pupil: 1.08, sparkle: 1, earsBack: 0.7 },
      cross:   { lid: 0.36, lidTilt: 1, pupil: 0.9, earsBack: 0.9 },
      shocked: { pupil: 0.55, mouth: 1, earsBack: 0.4, lid: 0 },
      smug:    { lid: 0.48, lidTilt: 0.2, pupil: 0.95, look: [0.6, 0] },
      sleepy:  { lid: 0.62, bobAmp: 0.15 }
    };
    function apply(st) {
      st = Object.assign({}, EXPR[(st && st.expr) || "neutral"] || {}, st || {});
      var p = st.pos || [0, 0, 0], sc = st.scale || 1, loaf = st.loaf || 0, br = Math.sin(st.breathe || 0);
      root.position.set(p[0], p[1], p[2]); root.rotation.set(0, st.yaw || 0, 0); root.scale.setScalar(sc);
      var sq = (st.squash || 0) + 0.18 * loaf;
      pivot.scale.set(1 + sq * 0.5, 1 - sq + br * 0.012, 1 + sq * 0.5);
      torso.scale.set(0.085, 0.095 * (1 + br * 0.015), 0.08);

      var kn = st.knead || 0, kp = st.kneadPhase || 0;
      var pw = st.pawUp || 0;
      var tA = Math.min(1, Math.max(0, st.walkAmt || 0)), tP = st.walk || 0;
      P.legs.forEach(function (L) {
        var lift = kn * Math.max(0, Math.sin(kp + (L.s > 0 ? PI : 0)));
        var up = Math.min(1, Math.max(0, Array.isArray(pw) ? (pw[L.s < 0 ? 0 : 1] || 0) : pw));

        var u = tP + (L.s > 0 ? PI : 0), sw = tA * Math.sin(u), wl = tA * Math.max(0, Math.cos(u));
        L.g.position.set(L.s * 0.032, 0.075 + lift * 0.02 - loaf * 0.03 + wl * 0.016, 0.05 + lift * 0.008 + loaf * 0.01 + sw * 0.006);
        L.g.rotation.set(-lift * 0.35 - loaf * 1.2 - up * 2.55 - sw * 0.5 + wl * 0.25, 0, L.s * up * 0.42);
        L.g.scale.set(1, (1 - loaf * 0.45) * (1 + up * 0.7), 1);
      });
      P.hind.forEach(function (Hd) {
        if (tA <= 0) { Hd.h.position.copy(Hd.hp); Hd.h.rotation.set(0, 0, 0); Hd.f.position.copy(Hd.fp); return; }
        var u = tP + (Hd.s > 0 ? 0 : PI), sw = tA * Math.sin(u), wl = tA * Math.max(0, Math.cos(u)), a = -0.32 * sw + 0.1 * wl;
        var dy = Hd.hp.y - Hd.pv.y, dz = Hd.hp.z - Hd.pv.z, c = Math.cos(a), sn = Math.sin(a);
        Hd.h.position.set(Hd.hp.x, Hd.pv.y + dy * c - dz * sn, Hd.pv.z + dy * sn + dz * c); Hd.h.rotation.set(a, 0, 0);
        Hd.f.position.set(Hd.fp.x, Hd.fp.y + wl * 0.014, Hd.fp.z + sw * 0.024);
      });

      var bnc = tA * Math.cos(2 * tP);
      body.rotation.set(tA * 0.05, 0, tA * 0.025 * Math.sin(tP));
      if (tA > 0) pivot.scale.set(pivot.scale.x * (1 - 0.012 * bnc), pivot.scale.y * (1 + 0.035 * bnc), pivot.scale.z * (1 - 0.012 * bnc));

      var tph = st.tailPhase || 0, tam = st.tailAmp === undefined ? 0.4 : st.tailAmp;
      tph += tA * 0.9 * Math.sin(tP);
      P.tail.forEach(function (seg, i) {
        var curl = i === 0 ? -1.15 : (0.22 + i * 0.04) * (1 - loaf * 0.6);
        seg.rotation.set(curl, 0, Math.sin(tph - i * 0.55) * 0.16 * tam);
      });

      var wa = st.wing || 0, wp = st.wingPhase || 0, fold = st.wingFold || 0;
      P.wings.forEach(function (W) {
        var flap = (Math.sin(wp + W.hind * 0.9) - 0.32) * 0.4 * wa;
        var up = W.up * (1 - fold * 0.85) + flap;

        W.piv.rotation.set(-0.1 - fold * 0.05, W.s * (0.63 + fold * 0.22), W.s * up);
      });

      neck.position.set(0, 0.17 - loaf * 0.04, 0.0 + loaf * 0.01);
      head.rotation.set(-(st.headPitch || 0) - tA * (0.04 - 0.035 * Math.cos(2 * tP)), st.headYaw || 0, (st.headTilt || 0) - tA * 0.02 * Math.sin(tP));
      var bob = st.bob || 0, ba = st.bobAmp === undefined ? 0.5 : st.bobAmp;
      var ad = Math.min(1.2, Math.max(-0.3, st.antDown || 0)), ag = Math.min(1, Math.max(0, st.antGlow || 0)), adk = Math.min(1, Math.max(0, ad));
      P.antennae.forEach(function (A) {
        A.g.rotation.set(0.18 + Math.sin(bob * 1.3 + A.s) * 0.1 * ba * (1 - adk) - ad * 1.55, 0,
          -A.s * (0.32 + ad * 0.25) + Math.sin(bob + A.s * 0.8) * 0.14 * ba * (1 - adk));
        A.g.scale.set(1, 1 - 0.3 * adk, 1);
        A.glow.visible = ag > 0.01; A.tip.visible = !A.glow.visible;
        if (A.glow.visible) { A.glow.material.emissiveIntensity = 0.4 + 2.4 * ag; A.glow.scale.setScalar(1 + 0.25 * ag); }
      });
      var bl = Math.min(1, Math.max(0, st.blink || 0)), lk = st.look || [0, 0], joy = st.joy || 0;
      var lidC = Math.min(1, Math.max(0, st.lid || 0)), lt = st.lidTilt || 0, pu = st.pupil || 1, sp = st.sparkle || 0;
      P.eyes.forEach(function (E) {
        var open = 1 - Math.max(bl, joy);
        E.lid.scale.set(1, Math.max(0.06, open), 1);
        E.lid.visible = open > 0.12;
        E.shut.visible = open <= 0.12 && joy < 0.5; E.joy.visible = open <= 0.12 && joy >= 0.5;
        E.pup.scale.set(0.0285 * pu, 0.0285 * pu, 0.0125);
        E.pup.position.set(lk[0] * 0.003, -0.0035 + lk[1] * 0.003, 0.0052);
        E.h1.scale.set(0.0105 * (1 + 0.25 * sp), 0.0105 * (1 + 0.25 * sp), 0.004);
        E.h2.scale.setScalar(0.0045 * (1 + 0.6 * sp)); E.h2.scale.z = 0.003;

        var phi = E.s * lt * 0.42, y0 = 0.036 - lidC * 0.07, on = lidC > 0.01 && E.lid.visible;
        E.lash.visible = on;
        if (on) {
          var k = Math.sqrt(Math.max(0.05, 1 - (y0 / 0.034) * (y0 / 0.034)));
          E.lash.scale.set(1, 0.033 * k * 2.15, 1); E.lash.rotation.set(0, 0, phi + PI / 2);
          E.lash.position.set(0, y0, 0.016 * k + 0.0012);
        }
        E.local = on ? [Math.sin(phi), -Math.cos(phi), y0 * Math.cos(phi)] : null;
      });
      var eb = st.earsBack || 0;
      var ebn = tA * 0.1 * Math.max(0, Math.cos(2 * tP - 0.6));
      [-1, 1].forEach(function (s) { P["ear" + s].rotation.set(-0.12 - eb * 0.5 - ebn, 0, -s * (0.38 + eb * 0.55 + ebn * 0.6)); });
      root.updateMatrixWorld(true);
      P.eyes.forEach(function (E) {
        if (!E.local) { E.plane.set(new THREE.Vector3(0, 1, 0), 1000); return; }
        E.plane.set(new THREE.Vector3(E.local[0], E.local[1], 0), E.local[2]).applyMatrix4(E.e.matrixWorld);
      });
      var mo = Math.min(1, Math.max(0, st.mouth || 0));
      P.mouth.visible = mo > 0.02; P.mouth.scale.set(0.007, 0.006 * (0.4 + mo), 0.003);
      P.smile.visible = mo < 0.5;
    }
    apply({});
    return { root: root, parts: P, apply: apply };
  };
})();
