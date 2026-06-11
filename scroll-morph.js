/* ════════════════════════════════════════════════════════════════════
   SCROLL MORPH — scatter → ring → rainbow-arc image morph
   Vanilla-JS port of the React/Framer-Motion `scroll-morph-hero`, adapted
   to the JKK JEROME brand (black/gold, real yacht frames) and driven by
   the PAGE's own scroll through a pinned section — no wheel hijacking.

   Spring physics replicate Framer's per-card `useSpring`
   (stiffness 40 / damping 15) via a semi-implicit Euler integrator.

   Usage:
     mountScrollMorph(sectionEl, stageEl, { images: [url, …] });
   ════════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  var TOTAL = 20;
  var IMG_W = 64;
  var IMG_H = 90;

  var prefersReduced =
    global.matchMedia &&
    global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function lerp(a, b, t) {
    return a * (1 - t) + b * t;
  }

  function Spring(v, k, c, m) {
    this.value = v;
    this.target = v;
    this.vel = 0;
    this.k = k;
    this.c = c;
    this.m = m;
  }
  Spring.prototype.set = function (t) {
    this.target = t;
  };
  Spring.prototype.step = function (dt) {
    if (dt > 0.05) dt = 0.05;
    var a = (-this.k * (this.value - this.target) - this.c * this.vel) / this.m;
    this.vel += a * dt;
    this.value += this.vel * dt;
    return (
      Math.abs(this.vel) > 1e-3 || Math.abs(this.value - this.target) > 1e-3
    );
  };

  function mountScrollMorph(section, stage, opts) {
    opts = opts || {};
    var imgs = opts.images || [];
    var cardsWrap = stage.querySelector(".morph-cards");
    var introEl = stage.querySelector(".morph-intro");
    var arcEl = stage.querySelector(".morph-arc-content");
    var cueEl = stage.querySelector(".morph-scrollcue");

    // random scatter start positions (stable per mount)
    var scatter = [];
    for (var i = 0; i < TOTAL; i++) {
      scatter.push({
        x: (Math.random() - 0.5) * 1500,
        y: (Math.random() - 0.5) * 1000,
        r: (Math.random() - 0.5) * 180,
        s: 0.6,
      });
    }

    // build flip cards
    var cards = [];
    for (var j = 0; j < TOTAL; j++) {
      var card = document.createElement("div");
      card.className = "mc-card";

      var inner = document.createElement("div");
      inner.className = "mc-inner";

      var front = document.createElement("div");
      front.className = "mc-face mc-front";
      var img = document.createElement("img");
      img.src = imgs.length ? imgs[j % imgs.length] : "";
      img.alt = "";
      img.loading = "eager";
      img.decoding = "async";
      var ov = document.createElement("div");
      ov.className = "ov";
      front.appendChild(img);
      front.appendChild(ov);

      var back = document.createElement("div");
      back.className = "mc-face mc-back";
      back.innerHTML = '<span class="k">View</span><span class="v">Frame</span>';

      inner.appendChild(front);
      inner.appendChild(back);
      card.appendChild(inner);
      cardsWrap.appendChild(card);

      var sp = scatter[j];
      cards.push({
        el: card,
        x: new Spring(sp.x, 40, 15, 1),
        y: new Spring(sp.y, 40, 15, 1),
        r: new Spring(sp.r, 40, 15, 1),
        s: new Spring(sp.s, 40, 15, 1),
        o: new Spring(0, 40, 15, 1),
      });
    }

    // intro sequence (kicked off on first reveal)
    var phase = "scatter";
    var introStarted = false;
    function startIntro() {
      if (introStarted) return;
      introStarted = true;
      if (prefersReduced) {
        phase = "circle";
        return;
      }
      setTimeout(function () {
        phase = "line";
      }, 500);
      setTimeout(function () {
        phase = "circle";
      }, 2200);
    }

    // mouse parallax
    var parallax = 0,
      parallaxTarget = 0;
    section.addEventListener("mousemove", function (e) {
      var rect = stage.getBoundingClientRect();
      if (!rect.width) return;
      var nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      parallaxTarget = nx * 100;
    });

    function scrollProgress() {
      var sc = section.offsetHeight - global.innerHeight;
      var top = section.getBoundingClientRect().top;
      return clamp(-top / (sc || 1), 0, 1);
    }

    var introO = 0,
      arcO = 0;

    function setTargets() {
      parallax = lerp(parallax, parallaxTarget, 0.1);
      var p = scrollProgress();
      var morph = clamp(p / 0.28, 0, 1); // ring → arc over first 28%
      var rotProg = clamp((p - 0.28) / 0.72, 0, 1); // then sweep the arc
      var w = stage.clientWidth,
        h = stage.clientHeight;
      var isMobile = w < 768;
      var minDim = Math.min(w, h);

      for (var i = 0; i < TOTAL; i++) {
        var tx, ty, tr, ts, to;
        if (phase === "scatter") {
          var s0 = scatter[i];
          tx = s0.x;
          ty = s0.y;
          tr = s0.r;
          ts = s0.s;
          to = 0;
        } else if (phase === "line") {
          var spc = 70;
          var tw = TOTAL * spc;
          tx = i * spc - tw / 2;
          ty = 0;
          tr = 0;
          ts = 1;
          to = 1;
        } else {
          // ring
          var cr = Math.min(minDim * 0.35, 350);
          var ca = (i / TOTAL) * 360;
          var crad = (ca * Math.PI) / 180;
          var ccx = Math.cos(crad) * cr;
          var ccy = Math.sin(crad) * cr;
          var ccr = ca + 90;
          // bottom rainbow arc
          var baseR = Math.min(w, h * 1.5);
          var arcR = baseR * (isMobile ? 1.4 : 1.1);
          var apex = h * (isMobile ? 0.35 : 0.25);
          var cenY = apex + arcR;
          var spread = isMobile ? 100 : 130;
          var sa = -90 - spread / 2;
          var step = spread / (TOTAL - 1);
          var maxRot = spread * 0.8;
          var bRot = -rotProg * maxRot;
          var aa = sa + i * step + bRot;
          var arad = (aa * Math.PI) / 180;
          var ax = Math.cos(arad) * arcR + parallax;
          var ay = Math.sin(arad) * arcR + cenY;
          var ar = aa + 90;
          var asc = isMobile ? 1.4 : 1.8;

          tx = lerp(ccx, ax, morph);
          ty = lerp(ccy, ay, morph);
          tr = lerp(ccr, ar, morph);
          ts = lerp(1, asc, morph);
          to = 1;
        }
        var c = cards[i];
        c.x.set(tx);
        c.y.set(ty);
        c.r.set(tr);
        c.s.set(ts);
        c.o.set(to);
      }

      introO = phase === "circle" ? clamp(1 - morph * 2, 0, 1) : 0;
      arcO = clamp((morph - 0.8) / 0.2, 0, 1);
    }

    function write(dt) {
      for (var i = 0; i < TOTAL; i++) {
        var c = cards[i];
        c.x.step(dt);
        c.y.step(dt);
        c.r.step(dt);
        c.s.step(dt);
        c.o.step(dt);
        c.el.style.transform =
          "translate(" +
          c.x.value +
          "px," +
          c.y.value +
          "px) rotate(" +
          c.r.value +
          "deg) scale(" +
          c.s.value +
          ")";
        c.el.style.opacity = c.o.value;
        c.el.style.pointerEvents = c.o.value > 0.85 ? "auto" : "none";
      }
      if (introEl) introEl.style.opacity = introO;
      if (arcEl) arcEl.style.opacity = arcO;
      if (cueEl) cueEl.style.opacity = introO;
    }

    /* ── loop, gated to when the section is near the viewport ── */
    var raf = 0,
      last = 0,
      active = false;
    function frame(now) {
      var dt = last ? (now - last) / 1000 : 0.016;
      last = now;
      setTargets();
      write(dt);
      if (active) raf = requestAnimationFrame(frame);
      else {
        raf = 0;
        last = 0;
      }
    }
    function run() {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    }

    // prime a first frame so it isn't blank before reveal
    setTargets();
    write(0.016);

    // kick off immediately (intro + loop); the observer only pauses the
    // RAF when the section is far off-screen, for perf.
    startIntro();
    active = true;
    run();

    if ("IntersectionObserver" in global) {
      var io = new IntersectionObserver(
        function (entries) {
          var e = entries[0];
          if (e.isIntersecting) {
            startIntro();
            if (!active) {
              active = true;
              run();
            }
          } else {
            active = false;
          }
        },
        { rootMargin: "300px 0px 300px 0px" }
      );
      io.observe(section);
    }

    return {
      destroy: function () {
        active = false;
        if (raf) cancelAnimationFrame(raf);
      },
    };
  }

  global.mountScrollMorph = mountScrollMorph;
})(window);
