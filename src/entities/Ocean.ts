import * as THREE from 'three';

/**
 * Procedural animated ocean — large mesh with vertex displacement
 * via shader. Gerstner-ish layered sine waves. No external textures.
 */
export class Ocean {
  public mesh: THREE.Mesh;
  private uniforms: { [k: string]: THREE.IUniform };

  constructor(size = 2400, segments = 120) {
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    this.uniforms = {
      uTime:   { value: 0 },
      uDeep:   { value: new THREE.Color(0x0b1e30) },
      uShallow:{ value: new THREE.Color(0x1a3848) },
      uFoam:   { value: new THREE.Color(0x5a7888) },
      uSun:    { value: new THREE.Vector3(1, 1, 0.5).normalize() },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vWaveHeight;

        // Sum-of-sines wave displacement.
        float wave(vec2 p, vec2 dir, float wavelength, float steepness, float speed) {
          float k = 6.28318 / wavelength;
          float f = k * (dot(dir, p) - speed * uTime);
          return steepness * sin(f) / k;
        }

        void main() {
          vec3 pos = position;
          vec2 p = pos.xz;

          float h = 0.0;
          // Very subtle surface ripple — just enough to read as water
          h += wave(p, normalize(vec2( 1.0,  0.3)), 200.0, 0.08, 2.0);
          h += wave(p, normalize(vec2(-0.6,  1.0)), 140.0, 0.05, 1.5);
          h += wave(p, normalize(vec2( 0.2, -0.9)),  80.0, 0.03, 2.5);

          pos.y += h;
          vWaveHeight = h;

          // Approx normal via finite difference for lighting
          float e = 0.5;
          float hx = wave(p + vec2(e,0), normalize(vec2(1.0,0.3)), 200.0, 0.08, 2.0)
                   + wave(p + vec2(e,0), normalize(vec2(-0.6,1.0)), 140.0, 0.05, 1.5);
          float hz = wave(p + vec2(0,e), normalize(vec2(1.0,0.3)), 200.0, 0.08, 2.0)
                   + wave(p + vec2(0,e), normalize(vec2(-0.6,1.0)), 140.0, 0.05, 1.5);
          vec3 n = normalize(vec3(h - hx, e, h - hz));
          vNormal = n;

          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uFoam;
        uniform vec3 uSun;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vWaveHeight;

        void main() {
          float ndl = max(dot(normalize(vNormal), uSun), 0.0);
          vec3 base = mix(uDeep, uShallow, ndl * 0.5 + 0.3);
          // Almost no foam — clean open ocean
          float crest = smoothstep(0.12, 0.2, vWaveHeight);
          base = mix(base, uFoam, crest * 0.08);

          // Distance fog
          float dist = length(vWorldPos.xz);
          float fog = smoothstep(300.0, 900.0, dist);
          vec3 fogCol = vec3(0.35, 0.42, 0.50);
          base = mix(base, fogCol, fog);

          gl_FragColor = vec4(base, 1.0);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = -1;  // render ocean first so ships are always on top

    // Start in day mode
    this.setNight(false);
  }

  update(dt: number) {
    this.uniforms.uTime.value += dt;
  }

  setNight(night: boolean) {
    if (night) {
      // Dark North Atlantic night — near-black with deep navy
      this.uniforms.uDeep.value.set(0x0b1e30);
      this.uniforms.uShallow.value.set(0x112233);
      this.uniforms.uFoam.value.set(0x2a3a4a);
      this.uniforms.uSun.value.set(0.3, 0.15, 0.4).normalize();
    } else {
      // Bright sunny day — clear Atlantic blue
      this.uniforms.uDeep.value.set(0x0055aa);
      this.uniforms.uShallow.value.set(0x1a88dd);
      this.uniforms.uFoam.value.set(0xaaddff);
      this.uniforms.uSun.value.set(0.6, 1.0, 0.4).normalize();
    }
  }
}
