/**
 * NebulaMesh - Procedural nebula rendering using Mesh with custom shader
 * Uses Mesh instead of Filter for full shader control
 * WebGL-only (GLSL) - WebGPU has bind group layout issues with custom Mesh shaders
 */

import { Mesh, MeshGeometry, Shader, GlProgram, UniformGroup } from 'pixi.js';

// ============================================================================
// GLSL Shaders (WebGL)
// ============================================================================

const vertexSourceGLSL = /* glsl */ `#version 300 es
in vec2 aPosition;
in vec2 aUV;

out vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;

void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix;
    vec3 clip = mvp * vec3(aPosition, 1.0);
    gl_Position = vec4(clip.xy, 0.0, 1.0);
    vUV = aUV;
}
`;

const fragmentSourceGLSL = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uIntensity;
uniform float uScale;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

// Simplex noise functions
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Fractal Brownian Motion with more octaves
float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

// Domain warping for more organic shapes
vec3 warp(vec3 p, float time) {
    float warpStrength = 0.3;
    float wx = fbm(p + vec3(0.0, 1.3, time * 0.05), 3);
    float wy = fbm(p + vec3(1.7, 0.0, time * 0.05), 3);
    return p + vec3(wx, wy, 0.0) * warpStrength;
}

void main() {
    vec2 uv = vUV;
    float time = uTime * 0.05;  // Slower animation
    float scale = uScale;

    // Create warped coordinates for more organic look
    vec3 basePos = vec3(uv * scale, time);
    vec3 warpedPos = warp(basePos, time);

    // Multiple noise layers at different scales with warping
    float n1 = fbm(warpedPos, 5);
    float n2 = fbm(warpedPos * 0.5 + vec3(5.2, 1.3, time * 0.3), 4);
    float n3 = fbm(warpedPos * 2.0 + vec3(1.7, 9.2, time * 0.7), 3);
    float n4 = fbm(warpedPos * 0.3 + vec3(3.1, 2.7, time * 0.2), 3);

    // Combine noise layers with different weights
    float nebula = n1 * 0.4 + n2 * 0.3 + n3 * 0.15 + n4 * 0.15;

    // Remap to 0-1 with better distribution
    nebula = (nebula + 1.0) * 0.5;

    // Apply contrast curve for more dramatic look
    nebula = smoothstep(0.2, 0.8, nebula);
    nebula = pow(nebula, 1.5);

    // Create wispy tendrils effect
    float tendrils = fbm(warpedPos * 3.0 + vec3(time * 0.1), 4);
    tendrils = abs(tendrils);
    tendrils = pow(tendrils, 2.0) * 0.5;

    // Mix tendrils with main nebula
    nebula = mix(nebula, nebula + tendrils, 0.3);
    nebula = clamp(nebula, 0.0, 1.0);

    // Color gradient based on noise value - more dramatic transitions
    float colorMix1 = smoothstep(0.1, 0.4, nebula);
    float colorMix2 = smoothstep(0.3, 0.7, nebula);
    float colorMix3 = smoothstep(0.5, 0.9, nebula);

    // Three-way color blend
    vec3 color = mix(uColor1, uColor2, colorMix1);
    color = mix(color, uColor3, colorMix2);

    // Add bright highlights in densest areas
    vec3 highlight = uColor3 * 1.3;
    color = mix(color, highlight, colorMix3 * 0.4);

    // Alpha based on nebula intensity with better falloff
    float alpha = nebula * uIntensity;
    alpha = pow(alpha, 0.8);  // Boost visibility

    // Soft edge fade - gentler for full-screen effect
    float edgeFade = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x) *
                     smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.85, uv.y);

    fragColor = vec4(color, alpha * edgeFade);
}
`;

// ============================================================================
// NebulaMesh Class
// ============================================================================

export interface NebulaMeshOptions {
  color1?: number;
  color2?: number;
  color3?: number;
  intensity?: number;
  scale?: number;
}

function hexToRgb(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ];
}

/**
 * Creates a full-screen quad mesh with procedural nebula shader
 * Uses WebGL renderer with GLSL shaders
 */
export class NebulaMesh extends Mesh<MeshGeometry, Shader> {
  private _time: number = 0;
  private _uniformGroup: UniformGroup;

  constructor(width: number, height: number, options: NebulaMeshOptions = {}) {
    const {
      color1 = 0x1a0a40,
      color2 = 0x4020a0,
      color3 = 0x8040ff,
      intensity = 0.7,
      scale = 3.0,
    } = options;

    // Create full-screen quad geometry
    const geometry = new MeshGeometry({
      positions: new Float32Array([
        0, 0,           // top-left
        width, 0,       // top-right
        width, height,  // bottom-right
        0, height,      // bottom-left
      ]),
      uvs: new Float32Array([
        0, 0,   // top-left
        1, 0,   // top-right
        1, 1,   // bottom-right
        0, 1,   // bottom-left
      ]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });

    const [r1, g1, b1] = hexToRgb(color1);
    const [r2, g2, b2] = hexToRgb(color2);
    const [r3, g3, b3] = hexToRgb(color3);

    // Create uniform group for shader parameters
    const uniformGroup = new UniformGroup({
      uTime: { value: 0, type: 'f32' },
      uIntensity: { value: intensity, type: 'f32' },
      uScale: { value: scale, type: 'f32' },
      uColor1: { value: new Float32Array([r1, g1, b1]), type: 'vec3<f32>' },
      uColor2: { value: new Float32Array([r2, g2, b2]), type: 'vec3<f32>' },
      uColor3: { value: new Float32Array([r3, g3, b3]), type: 'vec3<f32>' },
    });

    // WebGL-only program (WebGPU has bind group issues with custom Mesh shaders)
    const glProgram = GlProgram.from({
      vertex: vertexSourceGLSL,
      fragment: fragmentSourceGLSL,
    });

    const shader = Shader.from({
      gl: glProgram as any,
      resources: {
        nebulaUniforms: uniformGroup,
      },
    });

    super({ geometry, shader });

    this._uniformGroup = uniformGroup;
  }

  get time(): number {
    return this._time;
  }

  set time(value: number) {
    this._time = value;
    this._uniformGroup.uniforms.uTime = value;
  }

  get intensity(): number {
    return this._uniformGroup.uniforms.uIntensity as number;
  }

  set intensity(value: number) {
    this._uniformGroup.uniforms.uIntensity = value;
  }

  get nebulaScale(): number {
    return this._uniformGroup.uniforms.uScale as number;
  }

  set nebulaScale(value: number) {
    this._uniformGroup.uniforms.uScale = value;
  }

  setColors(color1: number, color2: number, color3: number): void {
    const [r1, g1, b1] = hexToRgb(color1);
    const [r2, g2, b2] = hexToRgb(color2);
    const [r3, g3, b3] = hexToRgb(color3);

    (this._uniformGroup.uniforms.uColor1 as Float32Array).set([r1, g1, b1]);
    (this._uniformGroup.uniforms.uColor2 as Float32Array).set([r2, g2, b2]);
    (this._uniformGroup.uniforms.uColor3 as Float32Array).set([r3, g3, b3]);
  }

  /**
   * Resize the mesh to new dimensions
   */
  resize(width: number, height: number): void {
    const positions = this.geometry.getAttribute('aPosition');
    positions.buffer.data = new Float32Array([
      0, 0,
      width, 0,
      width, height,
      0, height,
    ]);
    positions.buffer.update();
  }

  /**
   * Update shader time for animation
   */
  update(deltaMS: number): void {
    this.time += deltaMS / 1000;
  }
}
