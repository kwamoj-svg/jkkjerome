/* gradient-wave.js — vanilla port of the stripe-style animated WebGL gradient.
   window.mountGradientWave(canvas, colors[], opts) -> Gradient instance (auto-starts).
   Colors are hex strings. Self-contained; no deps. */
(function () {
  function normalizeColor(hexCode) {
    return [((hexCode >> 16) & 255) / 255, ((hexCode >> 8) & 255) / 255, (255 & hexCode) / 255];
  }

  function MiniGl(canvas) {
    var _miniGl = this;
    this.canvas = canvas;
    var gl = canvas.getContext('webgl', { antialias: true });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;
    var context = gl;
    this.meshes = [];

    this.Uniform = function (e) {
      this.type = 'float';
      Object.assign(this, e);
      var typeMap = { float: '1f', int: '1i', vec2: '2fv', vec3: '3fv', vec4: '4fv', mat4: 'Matrix4fv' };
      this.typeFn = typeMap[this.type] || '1f';
      this.update = function (location) {
        if (this.value === undefined || location === null) return;
        var isMatrix = this.typeFn.indexOf('Matrix') === 0;
        var fn = 'uniform' + this.typeFn;
        if (isMatrix) context[fn](location, this.transpose || false, this.value);
        else context[fn](location, this.value);
      };
      this.getDeclaration = function (name, type, length) {
        if (this.excludeFrom === type) return '';
        if (this.type === 'array') {
          return this.value[0].getDeclaration(name, type, this.value.length) + '\nconst int ' + name + '_length = ' + this.value.length + ';';
        }
        if (this.type === 'struct') {
          var nameNoPrefix = name.replace('u_', '');
          nameNoPrefix = nameNoPrefix.charAt(0).toUpperCase() + nameNoPrefix.slice(1);
          var fields = Object.entries(this.value).map(function (kv) {
            return kv[1].getDeclaration(kv[0], type).replace(/^uniform/, '');
          }).join('');
          return 'uniform struct ' + nameNoPrefix + ' {\n' + fields + '} ' + name + (length ? '[' + length + ']' : '') + ';';
        }
        return 'uniform ' + this.type + ' ' + name + (length ? '[' + length + ']' : '') + ';';
      };
    };

    this.Attribute = function (e) {
      this.type = context.FLOAT;
      this.normalized = false;
      this.buffer = context.createBuffer();
      Object.assign(this, e);
      this.update = function () {
        if (this.values) {
          context.bindBuffer(this.target, this.buffer);
          context.bufferData(this.target, this.values, context.STATIC_DRAW);
        }
      };
      this.attach = function (e2, t) {
        var n = context.getAttribLocation(t, e2);
        if (this.target === context.ARRAY_BUFFER) {
          context.bindBuffer(this.target, this.buffer);
          context.enableVertexAttribArray(n);
          context.vertexAttribPointer(n, this.size, this.type, this.normalized, 0, 0);
        }
        return n;
      };
      this.use = function (e2) {
        context.bindBuffer(this.target, this.buffer);
        if (this.target === context.ARRAY_BUFFER) {
          context.enableVertexAttribArray(e2);
          context.vertexAttribPointer(e2, this.size, this.type, this.normalized, 0, 0);
        }
      };
    };

    this.Material = function (vertexShaders, fragments, uniforms) {
      uniforms = uniforms || {};
      var material = this;
      this.uniforms = uniforms;
      this.uniformInstances = [];

      function getShader(type, source) {
        var shader = context.createShader(type);
        context.shaderSource(shader, source);
        context.compileShader(shader);
        if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
          console.error(context.getShaderInfoLog(shader));
          throw new Error('Shader compilation error');
        }
        return shader;
      }
      function getUniformDeclarations(u, type) {
        return Object.entries(u).map(function (kv) { return kv[1].getDeclaration(kv[0], type); }).join('\n');
      }
      var prefix = 'precision highp float;';
      var vertexSource = prefix + '\n' +
        'attribute vec4 position;\nattribute vec2 uv;\nattribute vec2 uvNorm;\n' +
        getUniformDeclarations(_miniGl.commonUniforms, 'vertex') + '\n' +
        getUniformDeclarations(uniforms, 'vertex') + '\n' + vertexShaders;
      var fragmentSource = prefix + '\n' +
        getUniformDeclarations(_miniGl.commonUniforms, 'fragment') + '\n' +
        getUniformDeclarations(uniforms, 'fragment') + '\n' + fragments;

      material.program = context.createProgram();
      context.attachShader(material.program, getShader(context.VERTEX_SHADER, vertexSource));
      context.attachShader(material.program, getShader(context.FRAGMENT_SHADER, fragmentSource));
      context.linkProgram(material.program);
      if (!context.getProgramParameter(material.program, context.LINK_STATUS)) {
        console.error(context.getProgramInfoLog(material.program));
        throw new Error('Program linking error');
      }
      context.useProgram(material.program);

      this.attachUniforms = function (name, uni) {
        if (name === undefined) {
          Object.entries(uni).forEach(function (kv) { material.attachUniforms(kv[0], kv[1]); });
        } else if (uni.type === 'array') {
          uni.value.forEach(function (u, i) { material.attachUniforms(name + '[' + i + ']', u); });
        } else if (uni.type === 'struct') {
          Object.entries(uni.value).forEach(function (kv) { material.attachUniforms(name + '.' + kv[0], kv[1]); });
        } else {
          material.uniformInstances.push({ uniform: uni, location: context.getUniformLocation(material.program, name) });
        }
      };
      material.attachUniforms(undefined, _miniGl.commonUniforms);
      material.attachUniforms(undefined, material.uniforms);
    };

    this.PlaneGeometry = function () {
      var geo = this;
      this.width = 1; this.height = 1; this.vertexCount = 0; this.xSegCount = 0; this.ySegCount = 0;
      this.attributes = {
        position: new _miniGl.Attribute({ target: context.ARRAY_BUFFER, size: 3 }),
        uv: new _miniGl.Attribute({ target: context.ARRAY_BUFFER, size: 2 }),
        uvNorm: new _miniGl.Attribute({ target: context.ARRAY_BUFFER, size: 2 }),
        index: new _miniGl.Attribute({ target: context.ELEMENT_ARRAY_BUFFER, size: 3, type: context.UNSIGNED_SHORT })
      };
      this.setTopology = function (xSegs, ySegs) {
        xSegs = xSegs || 1; ySegs = ySegs || 1;
        geo.xSegCount = xSegs; geo.ySegCount = ySegs;
        geo.vertexCount = (geo.xSegCount + 1) * (geo.ySegCount + 1);
        var quadCount = geo.xSegCount * geo.ySegCount * 2;
        geo.attributes.uv.values = new Float32Array(2 * geo.vertexCount);
        geo.attributes.uvNorm.values = new Float32Array(2 * geo.vertexCount);
        geo.attributes.index.values = new Uint16Array(3 * quadCount);
        for (var y = 0; y <= geo.ySegCount; y++) {
          for (var x = 0; x <= geo.xSegCount; x++) {
            var i = y * (geo.xSegCount + 1) + x;
            geo.attributes.uv.values[2 * i] = x / geo.xSegCount;
            geo.attributes.uv.values[2 * i + 1] = 1 - y / geo.ySegCount;
            geo.attributes.uvNorm.values[2 * i] = (x / geo.xSegCount) * 2 - 1;
            geo.attributes.uvNorm.values[2 * i + 1] = 1 - (y / geo.ySegCount) * 2;
            if (x < geo.xSegCount && y < geo.ySegCount) {
              var s = y * geo.xSegCount + x;
              geo.attributes.index.values[6 * s] = i;
              geo.attributes.index.values[6 * s + 1] = i + 1 + geo.xSegCount;
              geo.attributes.index.values[6 * s + 2] = i + 1;
              geo.attributes.index.values[6 * s + 3] = i + 1;
              geo.attributes.index.values[6 * s + 4] = i + 1 + geo.xSegCount;
              geo.attributes.index.values[6 * s + 5] = i + 2 + geo.xSegCount;
            }
          }
        }
        geo.attributes.uv.update(); geo.attributes.uvNorm.update(); geo.attributes.index.update();
      };
      this.setSize = function (width, height) {
        width = width || 1; height = height || 1;
        geo.width = width; geo.height = height;
        geo.attributes.position.values = new Float32Array(3 * geo.vertexCount);
        var offsetX = width / -2, offsetY = height / -2;
        var segWidth = width / geo.xSegCount, segHeight = height / geo.ySegCount;
        for (var y = 0; y <= geo.ySegCount; y++) {
          var posY = offsetY + y * segHeight;
          for (var x = 0; x <= geo.xSegCount; x++) {
            var posX = offsetX + x * segWidth;
            var idx = y * (geo.xSegCount + 1) + x;
            geo.attributes.position.values[3 * idx] = posX;
            geo.attributes.position.values[3 * idx + 1] = -posY;
            geo.attributes.position.values[3 * idx + 2] = 0;
          }
        }
        geo.attributes.position.update();
      };
    };

    this.Mesh = function (geometry, material) {
      var mesh = this;
      this.geometry = geometry; this.material = material; this.attributeInstances = [];
      Object.entries(geometry.attributes).forEach(function (kv) {
        mesh.attributeInstances.push({ attribute: kv[1], location: kv[1].attach(kv[0], material.program) });
      });
      _miniGl.meshes.push(this);
      this.draw = function () {
        context.useProgram(material.program);
        material.uniformInstances.forEach(function (o) { o.uniform.update(o.location); });
        mesh.attributeInstances.forEach(function (o) { o.attribute.use(o.location); });
        context.drawElements(context.TRIANGLES, geometry.attributes.index.values.length, context.UNSIGNED_SHORT, 0);
      };
    };

    var I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    this.commonUniforms = {
      projectionMatrix: new this.Uniform({ type: 'mat4', value: I }),
      modelViewMatrix: new this.Uniform({ type: 'mat4', value: I }),
      resolution: new this.Uniform({ type: 'vec2', value: [1, 1] }),
      aspectRatio: new this.Uniform({ type: 'float', value: 1 })
    };

    this.setSize = function (w, h) {
      w = w || 640; h = h || 480;
      this.width = w; this.height = h;
      this.canvas.width = w; this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
      this.commonUniforms.resolution.value = [w, h];
      this.commonUniforms.aspectRatio.value = w / h;
    };
    this.setOrthographicCamera = function () {
      this.commonUniforms.projectionMatrix.value = [2 / this.width, 0, 0, 0, 0, 2 / this.height, 0, 0, 0, 0, -0.001, 0, 0, 0, 0, 1];
    };
    this.render = function () {
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clearDepth(1);
      this.meshes.forEach(function (m) { m.draw(); });
    };
  }

  function Gradient(canvas, colors, opts) {
    opts = opts || {};
    var self = this;
    this.canvas = canvas; this.colors = colors; this.time = 0; this.last = 0; this.isPlaying = false;
    this.minigl = new MiniGl(canvas);

    var sectionColors = colors.map(function (hex) { return normalizeColor(parseInt(hex.replace('#', '0x'), 16)); });
    var U = this.minigl.Uniform;
    var uniforms = {
      u_time: new U({ value: 0 }),
      u_shadow_power: new U({ value: 5 }),
      u_darken_top: new U({ value: 0 }),
      u_active_colors: new U({ value: [1, 1, 1, 1], type: 'vec4' }),
      u_global: new U({ value: {
        noiseFreq: new U({ value: opts.noiseFrequency || [0.00014, 0.00029], type: 'vec2' }),
        noiseSpeed: new U({ value: opts.noiseSpeed || 0.000005 })
      }, type: 'struct' }),
      u_vertDeform: new U({ value: {
        incline: new U({ value: (opts.deform && opts.deform.incline) || 0 }),
        offsetTop: new U({ value: -0.5 }),
        offsetBottom: new U({ value: -0.5 }),
        noiseFreq: new U({ value: [3, 4], type: 'vec2' }),
        noiseAmp: new U({ value: (opts.deform && opts.deform.noiseAmp) || 320 }),
        noiseSpeed: new U({ value: 10 }),
        noiseFlow: new U({ value: (opts.deform && opts.deform.noiseFlow) || 3 }),
        noiseSeed: new U({ value: 5 })
      }, type: 'struct', excludeFrom: 'fragment' }),
      u_baseColor: new U({ value: sectionColors[0], type: 'vec3', excludeFrom: 'fragment' }),
      u_waveLayers: new U({ value: [], excludeFrom: 'fragment', type: 'array' })
    };
    for (var i = 1; i < sectionColors.length; i++) {
      uniforms.u_waveLayers.value.push(new U({ value: {
        color: new U({ value: sectionColors[i], type: 'vec3' }),
        noiseFreq: new U({ value: [2 + i / sectionColors.length, 3 + i / sectionColors.length], type: 'vec2' }),
        noiseSpeed: new U({ value: 11 + 0.3 * i }),
        noiseFlow: new U({ value: 6.5 + 0.3 * i }),
        noiseSeed: new U({ value: 5 + 10 * i }),
        noiseFloor: new U({ value: 0.1 }),
        noiseCeil: new U({ value: 0.63 + 0.07 * i })
      }, type: 'struct' }));
    }

    var vertexShader =
      'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}\n' +
      'vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}\n' +
      'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}\n' +
      'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}\n' +
      'float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);' +
      'vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;' +
      'vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;' +
      'i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));' +
      'float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);' +
      'vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);' +
      'vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));' +
      'vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;' +
      'vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);' +
      'vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;' +
      'vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;' +
      'return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}\n' +
      'vec3 blendNormal(vec3 base,vec3 blend){return blend;}\n' +
      'vec3 blendNormal(vec3 base,vec3 blend,float opacity){return (blend*opacity+base*(1.0-opacity));}\n' +
      'varying vec3 v_color;\n' +
      'void main(){\n' +
      'float time=u_time*u_global.noiseSpeed;\n' +
      'vec2 noiseCoord=resolution*uvNorm*u_global.noiseFreq;\n' +
      'float tilt=resolution.y/2.0*uvNorm.y;\n' +
      'float incline=resolution.x*uvNorm.x/2.0*u_vertDeform.incline;\n' +
      'float offset=resolution.x/2.0*u_vertDeform.incline*mix(u_vertDeform.offsetBottom,u_vertDeform.offsetTop,uv.y);\n' +
      'float noise=snoise(vec3(noiseCoord.x*u_vertDeform.noiseFreq.x+time*u_vertDeform.noiseFlow,noiseCoord.y*u_vertDeform.noiseFreq.y,time*u_vertDeform.noiseSpeed+u_vertDeform.noiseSeed))*u_vertDeform.noiseAmp;\n' +
      'noise*=1.0-pow(abs(uvNorm.y),2.0);noise=max(0.0,noise);\n' +
      'vec3 pos=vec3(position.x,position.y+tilt+incline+noise-offset,position.z);\n' +
      'v_color=u_baseColor;\n' +
      'for(int i=0;i<u_waveLayers_length;i++){\n' +
      'if(u_active_colors[i+1]==1.){WaveLayers layer=u_waveLayers[i];\n' +
      'float layerNoise=smoothstep(layer.noiseFloor,layer.noiseCeil,snoise(vec3(noiseCoord.x*layer.noiseFreq.x+time*layer.noiseFlow,noiseCoord.y*layer.noiseFreq.y,time*layer.noiseSpeed+layer.noiseSeed))/2.0+0.5);\n' +
      'v_color=blendNormal(v_color,layer.color,pow(layerNoise,4.));}}\n' +
      'gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);\n}';

    var fragmentShader =
      'varying vec3 v_color;\nvoid main(){\nvec3 color=v_color;\n' +
      'if(u_darken_top==1.0){vec2 st=gl_FragCoord.xy/resolution.xy;color.g-=pow(st.y+sin(-12.0)*st.x,u_shadow_power)*0.4;}\n' +
      'gl_FragColor=vec4(color,1.0);\n}';

    var material = new this.minigl.Material(vertexShader, fragmentShader, uniforms);
    var geometry = new this.minigl.PlaneGeometry();
    this.mesh = new this.minigl.Mesh(geometry, material);
    if (opts.darkenTop) material.uniforms.u_darken_top.value = 1;
    if (opts.shadowPower) material.uniforms.u_shadow_power.value = opts.shadowPower;

    this.resize = function () {
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      self.minigl.setSize(w, h);
      self.minigl.setOrthographicCamera();
      var xSegCount = Math.ceil(w * 0.02);
      var ySegCount = Math.ceil(h * 0.05);
      self.mesh.geometry.setTopology(xSegCount, ySegCount);
      self.mesh.geometry.setSize(w, h);
    };
    this.animate = function (t) {
      if (!self.isPlaying) return;
      self.time += Math.min(t - self.last, 1000 / 15);
      self.last = t;
      self.mesh.material.uniforms.u_time.value = self.time;
      self.minigl.render();
      self.animationId = requestAnimationFrame(self.animate);
    };
    this.start = function () { self.isPlaying = true; self.last = performance.now(); self.animationId = requestAnimationFrame(self.animate); };
    this.stop = function () { self.isPlaying = false; if (self.animationId) cancelAnimationFrame(self.animationId); };

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  window.mountGradientWave = function (canvas, colors, opts) {
    try {
      var g = new Gradient(canvas, colors, opts || {});
      g.start();
      return g;
    } catch (e) { console.error('GradientWave failed:', e); return null; }
  };
})();
