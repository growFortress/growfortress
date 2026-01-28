// Nebula shader - procedural cosmic nebula with perlin noise
// For PixiJS v8 WebGPU renderer

struct GlobalUniforms {
    uProjectionMatrix: mat3x3<f32>,
    uWorldTransformMatrix: mat3x3<f32>,
    uWorldColorAlpha: vec4<f32>,
    uResolution: vec2<f32>,
}

struct LocalUniforms {
    uTime: f32,
    uNebulaColor1: vec3<f32>,
    uNebulaColor2: vec3<f32>,
    uNebulaColor3: vec3<f32>,
    uIntensity: f32,
    uScale: f32,
    uSpeed: f32,
}

@group(0) @binding(0) var<uniform> globalUniforms: GlobalUniforms;
@group(1) @binding(0) var<uniform> localUniforms: LocalUniforms;

struct VertexInput {
    @location(0) aPosition: vec2<f32>,
    @location(1) aUV: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) vUV: vec2<f32>,
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let worldPosition = globalUniforms.uWorldTransformMatrix * vec3<f32>(input.aPosition, 1.0);
    let clipPosition = globalUniforms.uProjectionMatrix * worldPosition;

    output.position = vec4<f32>(clipPosition.xy, 0.0, 1.0);
    output.vUV = input.aUV;

    return output;
}

// Simplex noise functions
fn mod289_3(x: vec3<f32>) -> vec3<f32> {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_4(x: vec4<f32>) -> vec4<f32> {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec4<f32>) -> vec4<f32> {
    return mod289_4(((x * 34.0) + 1.0) * x);
}

fn taylorInvSqrt(r: vec4<f32>) -> vec4<f32> {
    return 1.79284291400159 - 0.85373472095314 * r;
}

fn snoise(v: vec3<f32>) -> f32 {
    let C = vec2<f32>(1.0 / 6.0, 1.0 / 3.0);
    let D = vec4<f32>(0.0, 0.5, 1.0, 2.0);

    // First corner
    var i = floor(v + dot(v, vec3<f32>(C.y, C.y, C.y)));
    let x0 = v - i + dot(i, vec3<f32>(C.x, C.x, C.x));

    // Other corners
    let g = step(x0.yzx, x0.xyz);
    let l = 1.0 - g;
    let i1 = min(g.xyz, l.zxy);
    let i2 = max(g.xyz, l.zxy);

    let x1 = x0 - i1 + vec3<f32>(C.x, C.x, C.x);
    let x2 = x0 - i2 + vec3<f32>(C.y, C.y, C.y);
    let x3 = x0 - vec3<f32>(D.y, D.y, D.y);

    // Permutations
    i = mod289_3(i);
    let p = permute(permute(permute(
        i.z + vec4<f32>(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4<f32>(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4<f32>(0.0, i1.x, i2.x, 1.0));

    // Gradients
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

    // Normalise gradients
    let norm = taylorInvSqrt(vec4<f32>(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    var m = max(0.6 - vec4<f32>(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4<f32>(0.0, 0.0, 0.0, 0.0));
    m = m * m;
    return 42.0 * dot(m * m, vec4<f32>(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Fractal Brownian Motion
fn fbm(p: vec3<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pos = p;

    for (var i = 0; i < octaves; i++) {
        value += amplitude * snoise(pos * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    return value;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let uv = input.vUV;
    let time = localUniforms.uTime * localUniforms.uSpeed;

    // Create multiple noise layers at different scales
    let scale = localUniforms.uScale;

    // Base nebula shape using fbm
    let pos1 = vec3<f32>(uv * scale, time * 0.1);
    let pos2 = vec3<f32>(uv * scale * 0.5 + 0.5, time * 0.08);
    let pos3 = vec3<f32>(uv * scale * 2.0, time * 0.15);

    var n1 = fbm(pos1, 4);
    var n2 = fbm(pos2, 3);
    var n3 = fbm(pos3, 2);

    // Combine noise layers
    var nebula = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

    // Remap to 0-1 range with contrast adjustment
    nebula = (nebula + 1.0) * 0.5;
    nebula = pow(nebula, 1.5); // Increase contrast

    // Create color gradient based on noise
    let colorMix1 = smoothstep(0.3, 0.6, nebula);
    let colorMix2 = smoothstep(0.5, 0.8, nebula);

    var color = mix(localUniforms.uNebulaColor1, localUniforms.uNebulaColor2, colorMix1);
    color = mix(color, localUniforms.uNebulaColor3, colorMix2);

    // Apply intensity and create soft edges
    let alpha = nebula * localUniforms.uIntensity;

    // Edge fade for smoother blending
    let edgeFade = smoothstep(0.0, 0.1, uv.x) * smoothstep(1.0, 0.9, uv.x) *
                   smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);

    return vec4<f32>(color, alpha * edgeFade);
}
