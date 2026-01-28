// Nebula shader - procedural cosmic nebula with perlin noise
// For PixiJS v8 WebGL renderer (GLSL 300 es)

precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform vec3 uNebulaColor1;
uniform vec3 uNebulaColor2;
uniform vec3 uNebulaColor3;
uniform float uIntensity;
uniform float uScale;
uniform float uSpeed;

// Simplex noise functions
vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
    return mod289(((x * 34.0) + 1.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    // Gradients
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

    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Fractal Brownian Motion
float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < octaves; i++) {
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    return value;
}

void main() {
    vec2 uv = vUV;
    float time = uTime * uSpeed;

    // Create multiple noise layers at different scales
    float scale = uScale;

    // Base nebula shape using fbm
    vec3 pos1 = vec3(uv * scale, time * 0.1);
    vec3 pos2 = vec3(uv * scale * 0.5 + 0.5, time * 0.08);
    vec3 pos3 = vec3(uv * scale * 2.0, time * 0.15);

    float n1 = fbm(pos1, 4);
    float n2 = fbm(pos2, 3);
    float n3 = fbm(pos3, 2);

    // Combine noise layers
    float nebula = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

    // Remap to 0-1 range with contrast adjustment
    nebula = (nebula + 1.0) * 0.5;
    nebula = pow(nebula, 1.5);

    // Create color gradient based on noise
    float colorMix1 = smoothstep(0.3, 0.6, nebula);
    float colorMix2 = smoothstep(0.5, 0.8, nebula);

    vec3 color = mix(uNebulaColor1, uNebulaColor2, colorMix1);
    color = mix(color, uNebulaColor3, colorMix2);

    // Apply intensity and create soft edges
    float alpha = nebula * uIntensity;

    // Edge fade for smoother blending
    float edgeFade = smoothstep(0.0, 0.1, uv.x) * smoothstep(1.0, 0.9, uv.x) *
                     smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);

    fragColor = vec4(color, alpha * edgeFade);
}
