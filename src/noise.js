const smoothstep = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (value) => value - Math.floor(value);

export function hash2D(x, z, seed = 0) {
  return fract(Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123);
}

export function hash3D(x, y, z, seed = 0) {
  return fract(
    Math.sin(x * 127.1 + y * 269.5 + z * 311.7 + seed * 74.7) * 43758.5453123,
  );
}

export function createNoise(seed = 0) {
  function value2(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const tx = smoothstep(x - x0);
    const tz = smoothstep(z - z0);

    const v00 = hash2D(x0, z0, seed);
    const v10 = hash2D(x0 + 1, z0, seed);
    const v01 = hash2D(x0, z0 + 1, seed);
    const v11 = hash2D(x0 + 1, z0 + 1, seed);

    return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), tz);
  }

  function value3(x, y, z) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const tx = smoothstep(x - x0);
    const ty = smoothstep(y - y0);
    const tz = smoothstep(z - z0);

    const c000 = hash3D(x0, y0, z0, seed);
    const c100 = hash3D(x0 + 1, y0, z0, seed);
    const c010 = hash3D(x0, y0 + 1, z0, seed);
    const c110 = hash3D(x0 + 1, y0 + 1, z0, seed);
    const c001 = hash3D(x0, y0, z0 + 1, seed);
    const c101 = hash3D(x0 + 1, y0, z0 + 1, seed);
    const c011 = hash3D(x0, y0 + 1, z0 + 1, seed);
    const c111 = hash3D(x0 + 1, y0 + 1, z0 + 1, seed);

    const x00 = lerp(c000, c100, tx);
    const x10 = lerp(c010, c110, tx);
    const x01 = lerp(c001, c101, tx);
    const x11 = lerp(c011, c111, tx);
    const y0Mix = lerp(x00, x10, ty);
    const y1Mix = lerp(x01, x11, ty);
    return lerp(y0Mix, y1Mix, tz);
  }

  function fbm2(x, z, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amplitude = 0.5;
    let frequency = 1;
    let sum = 0;
    let total = 0;

    for (let octave = 0; octave < octaves; octave += 1) {
      sum += value2(x * frequency, z * frequency) * amplitude;
      total += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return total === 0 ? 0 : sum / total;
  }

  function fbm3(x, y, z, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amplitude = 0.5;
    let frequency = 1;
    let sum = 0;
    let total = 0;

    for (let octave = 0; octave < octaves; octave += 1) {
      sum += value3(x * frequency, y * frequency, z * frequency) * amplitude;
      total += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return total === 0 ? 0 : sum / total;
  }

  return {
    value2,
    value3,
    fbm2,
    fbm3,
  };
}
