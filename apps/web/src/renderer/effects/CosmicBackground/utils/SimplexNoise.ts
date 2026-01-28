/**
 * SimplexNoise - Lightweight 2D Simplex Noise implementation
 * Used for procedural nebula generation and organic shapes
 */

// Permutation table
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

// Gradient vectors for 2D
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

export class SimplexNoise {
  private perm: Uint8Array;
  private permMod8: Uint8Array;

  constructor(seed: number = 0) {
    this.perm = new Uint8Array(512);
    this.permMod8 = new Uint8Array(512);

    const p = new Uint8Array(256);

    // Initialize with values 0-255
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle using seed (simple LCG)
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = ((s * 1103515245) + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Duplicate for overflow handling
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod8[i] = this.perm[i] % 8;
    }
  }

  /**
   * 2D Simplex Noise
   * @returns Value in range [-1, 1]
   */
  public noise2D(x: number, y: number): number {
    // Skew input space to determine simplex cell
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    // Unskew back to (x, y) space
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;

    // Distance from cell origin
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine which simplex we're in
    let i1: number, j1: number;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    // Offsets for corners
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    // Hash coordinates of corners
    const ii = i & 255;
    const jj = j & 255;

    // Calculate contributions from corners
    let n0 = 0, n1 = 0, n2 = 0;

    // Corner 0
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = this.permMod8[ii + this.perm[jj]];
      t0 *= t0;
      n0 = t0 * t0 * this.dot2(GRAD2[gi0], x0, y0);
    }

    // Corner 1
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = this.permMod8[ii + i1 + this.perm[jj + j1]];
      t1 *= t1;
      n1 = t1 * t1 * this.dot2(GRAD2[gi1], x1, y1);
    }

    // Corner 2
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = this.permMod8[ii + 1 + this.perm[jj + 1]];
      t2 *= t2;
      n2 = t2 * t2 * this.dot2(GRAD2[gi2], x2, y2);
    }

    // Scale to [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }

  /**
   * Fractal Brownian Motion - layered noise for natural patterns
   * @param x X coordinate
   * @param y Y coordinate
   * @param octaves Number of noise layers (default 4)
   * @param persistence Amplitude decay per octave (default 0.5)
   * @param lacunarity Frequency increase per octave (default 2.0)
   * @returns Value roughly in range [-1, 1]
   */
  public fbm(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }

  /**
   * Turbulence - absolute value of fbm for cloud-like patterns
   */
  public turbulence(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * Math.abs(this.noise2D(x * frequency, y * frequency));
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }

  /**
   * Ridged noise - creates ridge-like patterns
   */
  public ridged(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      const n = 1.0 - Math.abs(this.noise2D(x * frequency, y * frequency));
      value += amplitude * n * n;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }

  private dot2(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }
}

// Default instance with random seed
export const noise = new SimplexNoise(Date.now());
