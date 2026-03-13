// Deterministic PRNG — xoshiro128** for reproducible scenarios
// Plus Box-Muller transform for gaussian noise

export class SeededRNG {
  private s: Uint32Array;

  constructor(seed: number) {
    // SplitMix32 to initialize state from single seed
    this.s = new Uint32Array(4);
    for (let i = 0; i < 4; i++) {
      seed += 0x9e3779b9;
      let t = seed;
      t = Math.imul(t ^ (t >>> 16), 0x85ebca6b);
      t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35);
      this.s[i] = (t ^ (t >>> 16)) >>> 0;
    }
  }

  // xoshiro128** — returns [0, 1)
  next(): number {
    const s = this.s;
    const result = Math.imul(s[1] * 5, 7) >>> 0;
    const t = s[1] << 9;

    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = ((s[3] << 11) | (s[3] >>> 21)) >>> 0;

    return (result >>> 0) / 0x100000000;
  }

  // Uniform random in [min, max)
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Box-Muller gaussian (mean=0, stddev=1)
  gaussian(): number {
    const u1 = this.next() || 1e-10; // avoid log(0)
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Gaussian with custom mean and stddev
  normalDist(mean: number, stddev: number): number {
    return mean + this.gaussian() * stddev;
  }
}
