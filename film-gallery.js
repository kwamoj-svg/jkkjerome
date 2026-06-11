/* film-gallery.js — vanilla three.js port of the infinite 3D gallery.
   Planes fly through z-space with fade + blur + cloth-curve on scroll.
   Auto-plays, responds to wheel / arrow keys / touch.
   Uses canvas-generated PLACEHOLDER textures (swap for real frames later). */
(function () {
  function mountFilmGallery(container, opts) {
    opts = opts || {};
    if (typeof THREE === 'undefined') { return; }

    var VISIBLE = opts.visibleCount || 12;
    var DEPTH = 50;
    var SPEED = opts.speed || 1.1;
    var MAXH = 8, MAXV = 8;
    var fade = { fadeIn: { s: 0.05, e: 0.25 }, fadeOut: { s: 0.40, e: 0.43 } };
    var blur = { inS: 0.0, inE: 0.1, outS: 0.40, outE: 0.43, max: 8.0 };

    // ── real frames (uploaded boat/yacht photography) ──
    var IMAGES = opts.images || [
      'fleet/up-bow-sunset.webp',
      'fleet/up-riva-dive.webp',
      'fleet/up-princess-cliff.webp',
      'fleet/up-deck-lounge.webp',
      'fleet/up-fairline-cove.jpeg',
      'fleet/up-aerial-wake.jpeg',
      'fleet/up-sloop-canal.jpeg'
    ];
    var loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    var textures = IMAGES.map(function (src) {
      var tex = loader.load(src, function (t) {
        t.colorSpace = THREE.SRGBColorSpace;
        // re-fit any plane already using this texture once the image is known
        if (t.image) refitForTexture(t);
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      return tex;
    });
    var TOTAL = textures.length;
    function refitForTexture(t) {
      if (!planes) return;
      var aspect = t.image.width / t.image.height;
      for (var i = 0; i < planes.length; i++) {
        if (planes[i].mat.uniforms.map.value === t) {
          if (aspect > 1) planes[i].mesh.scale.set(2 * aspect, 2, 1);
          else planes[i].mesh.scale.set(2, 2 / aspect, 1);
          planes[i].baseScale = planes[i].mesh.scale.clone();
        }
      }
    }

    // ── renderer / scene / camera ──
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    camera.position.set(0, 0, 0);

    function size() {
      var w = container.clientWidth || window.innerWidth;
      var h = container.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    size();

    // ── cloth + blur shader ──
    function makeMaterial() {
      return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          map: { value: null },
          opacity: { value: 1.0 },
          blurAmount: { value: 0.0 },
          scrollForce: { value: 0.0 },
          time: { value: 0.0 },
          isHovered: { value: 0.0 },
          texel: { value: new THREE.Vector2(1 / 600, 1 / 750) }
        },
        vertexShader: [
          'uniform float scrollForce;',
          'uniform float time;',
          'uniform float isHovered;',
          'varying vec2 vUv;',
          'void main(){',
          '  vUv = uv;',
          '  vec3 pos = position;',
          '  float curveIntensity = scrollForce * 0.3;',
          '  float d = length(pos.xy);',
          '  float curve = d * d * curveIntensity;',
          '  float r1 = sin(pos.x * 2.0 + scrollForce * 3.0) * 0.02;',
          '  float r2 = sin(pos.y * 2.5 + scrollForce * 2.0) * 0.015;',
          '  float cloth = (r1 + r2) * abs(curveIntensity) * 2.0;',
          '  float flag = 0.0;',
          '  if(isHovered > 0.5){',
          '    float damp = smoothstep(-0.5, 0.5, pos.x);',
          '    flag = sin(pos.x * 3.0 + time * 8.0) * 0.1 * damp;',
          '    flag += sin(pos.x * 5.0 + time * 12.0) * 0.03 * damp;',
          '  }',
          '  pos.z -= (curve + cloth + flag);',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform sampler2D map;',
          'uniform float opacity;',
          'uniform float blurAmount;',
          'uniform float scrollForce;',
          'uniform vec2 texel;',
          'varying vec2 vUv;',
          'void main(){',
          '  vec4 color = texture2D(map, vUv);',
          '  if(blurAmount > 0.0){',
          '    vec4 acc = vec4(0.0); float tot = 0.0;',
          '    for(float i=-2.0;i<=2.0;i+=1.0){',
          '      for(float j=-2.0;j<=2.0;j+=1.0){',
          '        vec2 off = vec2(i,j) * texel * blurAmount;',
          '        float w = 1.0 / (1.0 + length(vec2(i,j)));',
          '        acc += texture2D(map, vUv + off) * w; tot += w;',
          '      }',
          '    }',
          '    color = acc / tot;',
          '  }',
          '  float hi = abs(scrollForce) * 0.05;',
          '  color.rgb += vec3(hi * 0.1);',
          '  gl_FragColor = vec4(color.rgb, color.a * opacity);',
          '}'
        ].join('\n')
      });
    }

    // ── spatial layout + planes ──
    var geo = new THREE.PlaneGeometry(1, 1, 24, 24);
    var spatial = [];
    for (var i = 0; i < VISIBLE; i++) {
      var hA = (i * 2.618) % (Math.PI * 2);
      var vA = (i * 1.618 + Math.PI / 3) % (Math.PI * 2);
      var hR = (i % 3) * 1.2;
      var vR = ((i + 1) % 4) * 0.8;
      spatial.push({
        x: (Math.sin(hA) * hR * MAXH) / 3,
        y: (Math.cos(vA) * vR * MAXV) / 4
      });
    }

    var planes = [];
    for (var p = 0; p < VISIBLE; p++) {
      var mat = makeMaterial();
      var idx = p % TOTAL;
      mat.uniforms.map.value = textures[idx];
      var mesh = new THREE.Mesh(geo, mat);
      var tex = textures[idx];
      var aspect = tex.image ? tex.image.width / tex.image.height : 0.8;
      if (aspect > 1) mesh.scale.set(2 * aspect, 2, 1);
      else mesh.scale.set(2, 2 / aspect, 1);
      mesh.position.set(spatial[p].x, spatial[p].y, (DEPTH / VISIBLE) * p - DEPTH / 2);
      scene.add(mesh);
      planes.push({ mesh: mesh, mat: mat, z: (DEPTH / VISIBLE) * p, imageIndex: idx, baseScale: mesh.scale.clone() });
    }

    // ── interaction ──
    var velocity = 0, autoPlay = true, lastInteract = Date.now();
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

    function nudge(d) { velocity += d; autoPlay = false; lastInteract = Date.now(); }
    container.addEventListener('wheel', function (e) { nudge(e.deltaY * 0.01 * SPEED); }, { passive: true });
    var touchY = null;
    container.addEventListener('touchstart', function (e) { touchY = e.touches[0].clientY; }, { passive: true });
    container.addEventListener('touchmove', function (e) {
      if (touchY != null) { nudge((touchY - e.touches[0].clientY) * 0.04 * SPEED); touchY = e.touches[0].clientY; }
    }, { passive: true });
    window.addEventListener('keydown', function (e) {
      var r = container.getBoundingClientRect();
      if (r.bottom < 60 || r.top > window.innerHeight - 60) return; // only while hero on screen
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') nudge(-2 * SPEED);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') nudge(2 * SPEED);
    });
    setInterval(function () { if (Date.now() - lastInteract > 3000) autoPlay = true; }, 1000);

    // ── render loop ──
    var clock = new THREE.Clock();
    var imageAdvance = VISIBLE % TOTAL || TOTAL;
    function frame() {
      var delta = Math.min(clock.getDelta(), 0.05);
      var t = clock.getElapsedTime();
      if (autoPlay && !reduce) velocity += 0.3 * delta;
      velocity *= 0.95;

      for (var i = 0; i < planes.length; i++) {
        var pl = planes[i];
        var newZ = pl.z + velocity * delta * 10;
        var wf = 0, wb = 0;
        if (newZ >= DEPTH) { wf = Math.floor(newZ / DEPTH); newZ -= DEPTH * wf; }
        else if (newZ < 0) { wb = Math.ceil(-newZ / DEPTH); newZ += DEPTH * wb; }
        if (wf > 0) { pl.imageIndex = (pl.imageIndex + wf * imageAdvance) % TOTAL; pl.mat.uniforms.map.value = textures[pl.imageIndex]; }
        if (wb > 0) { pl.imageIndex = (((pl.imageIndex - wb * imageAdvance) % TOTAL) + TOTAL) % TOTAL; pl.mat.uniforms.map.value = textures[pl.imageIndex]; }
        pl.z = ((newZ % DEPTH) + DEPTH) % DEPTH;
        pl.mesh.position.z = pl.z - DEPTH / 2;

        var n = pl.z / DEPTH, op = 1;
        if (n >= fade.fadeIn.s && n <= fade.fadeIn.e) op = (n - fade.fadeIn.s) / (fade.fadeIn.e - fade.fadeIn.s);
        else if (n < fade.fadeIn.s) op = 0;
        else if (n >= fade.fadeOut.s && n <= fade.fadeOut.e) op = 1 - (n - fade.fadeOut.s) / (fade.fadeOut.e - fade.fadeOut.s);
        else if (n > fade.fadeOut.e) op = 0;
        op = Math.max(0, Math.min(1, op));

        var bl = 0;
        if (n >= blur.inS && n <= blur.inE) bl = blur.max * (1 - (n - blur.inS) / (blur.inE - blur.inS));
        else if (n < blur.inS) bl = blur.max;
        else if (n >= blur.outS && n <= blur.outE) bl = blur.max * ((n - blur.outS) / (blur.outE - blur.outS));
        else if (n > blur.outE) bl = blur.max;
        bl = Math.max(0, Math.min(blur.max, bl));

        pl.mat.uniforms.opacity.value = op;
        pl.mat.uniforms.blurAmount.value = bl;
        pl.mat.uniforms.time.value = t;
        pl.mat.uniforms.scrollForce.value = velocity;
        pl.mesh.visible = op > 0.001;
      }
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    frame();
    window.addEventListener('resize', size);
  }

  window.mountFilmGallery = mountFilmGallery;
  try { window.dispatchEvent(new Event('film-gallery-ready')); } catch (e) {}
})();
