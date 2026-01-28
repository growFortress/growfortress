/**
 * NebulaShader - Procedural nebula rendering using custom shaders
 * Uses perlin noise and fbm for realistic cosmic nebula effects
 */

import { Filter, GlProgram } from 'pixi.js';

// GLSL Fragment shader (WebGL)
// PixiJS v8 requires uniforms in a struct/block format
const fragmentShaderGLSL = /* glsl */ `
precision highp float;

in vec2 vTextureCoord;
out vec4 fragColor;

uniform sampler2D uTexture;

uniform nebulaUniforms {
  float uTime;
  float uIntensity;
  float uScale;
  float uSpeed;
  vec3 uNebulaColor1;
  vec3 uNebulaColor2;
  vec3 uNebulaColor3;
};

// Simplex noise
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

float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
        if (i >= octaves) break;
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

void main() {
    vec2 uv = vTextureCoord;
    float time = uTime * uSpeed;
    float scale = uScale;

    vec3 pos1 = vec3(uv * scale, time * 0.1);
    vec3 pos2 = vec3(uv * scale * 0.5 + 0.5, time * 0.08);
    vec3 pos3 = vec3(uv * scale * 2.0, time * 0.15);

    float n1 = fbm(pos1, 4);
    float n2 = fbm(pos2, 3);
    float n3 = fbm(pos3, 2);

    float nebula = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    nebula = (nebula + 1.0) * 0.5;
    nebula = pow(nebula, 1.5);

    float colorMix1 = smoothstep(0.3, 0.6, nebula);
    float colorMix2 = smoothstep(0.5, 0.8, nebula);

    vec3 color = mix(uNebulaColor1, uNebulaColor2, colorMix1);
    color = mix(color, uNebulaColor3, colorMix2);

    float alpha = nebula * uIntensity;

    float edgeFade = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x) *
                     smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.85, uv.y);

    fragColor = vec4(color, alpha * edgeFade);
}
`;

// WGSL Fragment shader (WebGPU) - reserved for future native WebGPU support
// @ts-ignore Reserved for future WebGPU support
const _fragmentShaderWGSL = /* wgsl */ `
struct NebulaUniforms {
    uTime: f32,
    uIntensity: f32,
    uScale: f32,
    uSpeed: f32,
    uNebulaColor1: vec3<f32>,
    uNebulaColor2: vec3<f32>,
    uNebulaColor3: vec3<f32>,
}

@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> nebulaUniforms: NebulaUniforms;

fn mod289_3(x: vec3<f32>) -> vec3<f32> { return x - floor(x * (1.0 / 289.0)) * 289.0; }
fn mod289_4(x: vec4<f32>) -> vec4<f32> { return x - floor(x * (1.0 / 289.0)) * 289.0; }
fn permute(x: vec4<f32>) -> vec4<f32> { return mod289_4(((x * 34.0) + 1.0) * x); }
fn taylorInvSqrt(r: vec4<f32>) -> vec4<f32> { return 1.79284291400159 - 0.85373472095314 * r; }

fn snoise(v: vec3<f32>) -> f32 {
    let C = vec2<f32>(1.0 / 6.0, 1.0 / 3.0);
    let D = vec4<f32>(0.0, 0.5, 1.0, 2.0);
    var i = floor(v + dot(v, vec3<f32>(C.y, C.y, C.y)));
    let x0 = v - i + dot(i, vec3<f32>(C.x, C.x, C.x));
    let g = step(x0.yzx, x0.xyz);
    let l = 1.0 - g;
    let i1 = min(g.xyz, l.zxy);
    let i2 = max(g.xyz, l.zxy);
    let x1 = x0 - i1 + vec3<f32>(C.x, C.x, C.x);
    let x2 = x0 - i2 + vec3<f32>(C.y, C.y, C.y);
    let x3 = x0 - vec3<f32>(D.y, D.y, D.y);
    i = mod289_3(i);
    let p = permute(permute(permute(
        i.z + vec4<f32>(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4<f32>(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4<f32>(0.0, i1.x, i2.x, 1.0));
    let n_ = 0.142857142857;
    let ns = n_ * D.wyz - D.xzx;
    let j = p - 49.0 * floor(p * ns.z * ns.z);
    let x_ = floor(j * ns.z);
    let y_ = floor(j - 7.0 * x_);
    let x = x_ * ns.x + vec4<f32>(ns.y, ns.y, ns.y, ns.y);
    let y = y_ * ns.x + vec4<f32>(ns.y, ns.y, ns.y, ns.y);
    let h = 1.0 - abs(x) - abs(y);
    let b0 = vec4<f32>(x.xy, y.xy);
    let b1 = vec4<f32>(x.zw, y.zw);
    let s0 = floor(b0) * 2.0 + 1.0;
    let s1 = floor(b1) * 2.0 + 1.0;
    let sh = -step(h, vec4<f32>(0.0, 0.0, 0.0, 0.0));
    let a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    let a1 = b1.xzyw + s1.xzyw * sh.zzww;
    var p0 = vec3<f32>(a0.xy, h.x);
    var p1 = vec3<f32>(a0.zw, h.y);
    var p2 = vec3<f32>(a1.xy, h.z);
    var p3 = vec3<f32>(a1.zw, h.w);
    let norm = taylorInvSqrt(vec4<f32>(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    var m = max(0.6 - vec4<f32>(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4<f32>(0.0, 0.0, 0.0, 0.0));
    m = m * m;
    return 42.0 * dot(m * m, vec4<f32>(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

fn fbm(p: vec3<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pos = p;
    for (var i = 0; i < 5; i++) {
        if (i >= octaves) { break; }
        value += amplitude * snoise(pos * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let time = nebulaUniforms.uTime * nebulaUniforms.uSpeed;
    let scale = nebulaUniforms.uScale;

    let pos1 = vec3<f32>(uv * scale, time * 0.1);
    let pos2 = vec3<f32>(uv * scale * 0.5 + 0.5, time * 0.08);
    let pos3 = vec3<f32>(uv * scale * 2.0, time * 0.15);

    let n1 = fbm(pos1, 4);
    let n2 = fbm(pos2, 3);
    let n3 = fbm(pos3, 2);

    var nebula = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    nebula = (nebula + 1.0) * 0.5;
    nebula = pow(nebula, 1.5);

    let colorMix1 = smoothstep(0.3, 0.6, nebula);
    let colorMix2 = smoothstep(0.5, 0.8, nebula);

    var color = mix(nebulaUniforms.uNebulaColor1, nebulaUniforms.uNebulaColor2, colorMix1);
    color = mix(color, nebulaUniforms.uNebulaColor3, colorMix2);

    let alpha = nebula * nebulaUniforms.uIntensity;

    let edgeFade = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x) *
                   smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.85, uv.y);

    return vec4<f32>(color, alpha * edgeFade);
}
`;

// Default vertex shader for GLSL
const vertexShaderGLSL = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

export interface NebulaShaderOptions {
  color1?: number;
  color2?: number;
  color3?: number;
  intensity?: number;
  scale?: number;
  speed?: number;
}

/**
 * Convert hex color to RGB array (0-1 range)
 */
function hexToRgb(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ];
}

/**
 * NebulaFilter - A PixiJS filter that renders procedural nebulae
 */
export class NebulaFilter extends Filter {
  private _time: number = 0;

  constructor(options: NebulaShaderOptions = {}) {
    const {
      color1 = 0x1a0a30,
      color2 = 0x4020a0,
      color3 = 0x8040ff,
      intensity = 0.6,
      scale = 3.0,
      speed = 0.1,
    } = options;

    const [r1, g1, b1] = hexToRgb(color1);
    const [r2, g2, b2] = hexToRgb(color2);
    const [r3, g3, b3] = hexToRgb(color3);

    const glProgram = GlProgram.from({
      vertex: vertexShaderGLSL,
      fragment: fragmentShaderGLSL,
    });

    // Note: WGSL support requires additional setup for PixiJS v8
    // For now, we'll use GLSL which works with both WebGL and WebGPU via transpilation
    super({
      glProgram,
      resources: {
        nebulaUniforms: {
          uTime: { value: 0, type: 'f32' },
          uIntensity: { value: intensity, type: 'f32' },
          uScale: { value: scale, type: 'f32' },
          uSpeed: { value: speed, type: 'f32' },
          uNebulaColor1: { value: [r1, g1, b1], type: 'vec3<f32>' },
          uNebulaColor2: { value: [r2, g2, b2], type: 'vec3<f32>' },
          uNebulaColor3: { value: [r3, g3, b3], type: 'vec3<f32>' },
        },
      },
    });
  }

  get time(): number {
    return this._time;
  }

  set time(value: number) {
    this._time = value;
    this.resources.nebulaUniforms.uniforms.uTime = value;
  }

  get intensity(): number {
    return this.resources.nebulaUniforms.uniforms.uIntensity;
  }

  set intensity(value: number) {
    this.resources.nebulaUniforms.uniforms.uIntensity = value;
  }

  get scale(): number {
    return this.resources.nebulaUniforms.uniforms.uScale;
  }

  set scale(value: number) {
    this.resources.nebulaUniforms.uniforms.uScale = value;
  }

  get speed(): number {
    return this.resources.nebulaUniforms.uniforms.uSpeed;
  }

  set speed(value: number) {
    this.resources.nebulaUniforms.uniforms.uSpeed = value;
  }

  setColors(color1: number, color2: number, color3: number): void {
    const [r1, g1, b1] = hexToRgb(color1);
    const [r2, g2, b2] = hexToRgb(color2);
    const [r3, g3, b3] = hexToRgb(color3);

    this.resources.nebulaUniforms.uniforms.uNebulaColor1 = [r1, g1, b1];
    this.resources.nebulaUniforms.uniforms.uNebulaColor2 = [r2, g2, b2];
    this.resources.nebulaUniforms.uniforms.uNebulaColor3 = [r3, g3, b3];
  }

  /**
   * Update the shader time - call this every frame
   */
  update(deltaMS: number): void {
    this.time += deltaMS / 1000;
  }
}
