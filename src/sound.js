export function createSoundSystem() {
  let context = null;
  let noiseBuffer = null;

  function ensure() {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }
      context = new AudioContextClass();
    }
    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }
    if (!noiseBuffer) {
      const length = context.sampleRate * 0.15;
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const channel = noiseBuffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        channel[index] = Math.random() * 2 - 1;
      }
    }
    return context;
  }

  function pulse(frequency, duration, options = {}) {
    const ctx = ensure();
    if (!ctx) {
      return;
    }
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = options.type ?? "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    if (typeof options.endFrequency === "number") {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), now + duration);
    }
    if (typeof options.detune === "number") {
      oscillator.detune.setValueAtTime(options.detune, now);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(options.gain ?? 0.04, now + (options.attack ?? 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + (options.release ?? 0.05));

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + (options.release ?? 0.05) + 0.02);
  }

  function burst(duration, options = {}) {
    const ctx = ensure();
    if (!ctx || !noiseBuffer) {
      return;
    }
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = options.filterType ?? "bandpass";
    filter.frequency.setValueAtTime(options.frequency ?? 900, now);
    filter.Q.value = options.q ?? 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(options.gain ?? 0.03, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  return {
    ensure,
    select() {
      pulse(740, 0.05, { type: "square", gain: 0.018, endFrequency: 560, release: 0.03 });
    },
    step(surface = "grass") {
      const presets = {
        grass: { frequency: 720, burst: 520 },
        sand: { frequency: 480, burst: 340 },
        stone: { frequency: 920, burst: 1300 },
        wood: { frequency: 610, burst: 760 },
        water: { frequency: 360, burst: 260 },
      };
      const preset = presets[surface] ?? presets.grass;
      pulse(preset.frequency, 0.03, { type: "triangle", gain: 0.015, endFrequency: preset.frequency * 0.75, release: 0.02 });
      burst(0.05, { frequency: preset.burst, gain: 0.012, filterType: "lowpass", q: 0.6 });
    },
    jump() {
      pulse(420, 0.08, { type: "sine", gain: 0.03, endFrequency: 660, release: 0.06 });
    },
    land(intensity = 1) {
      burst(0.08, { frequency: 240 + intensity * 40, gain: Math.min(0.04, 0.012 + intensity * 0.004), filterType: "lowpass" });
    },
    mine() {
      burst(0.12, { frequency: 1600, gain: 0.04, filterType: "bandpass", q: 1.2 });
      pulse(180, 0.05, { type: "sawtooth", gain: 0.015, endFrequency: 120, release: 0.04 });
    },
    place() {
      pulse(260, 0.06, { type: "square", gain: 0.02, endFrequency: 170, release: 0.04 });
      burst(0.05, { frequency: 700, gain: 0.012, filterType: "lowpass" });
    },
    craft() {
      pulse(523, 0.07, { type: "triangle", gain: 0.022, release: 0.05 });
      setTimeout(() => pulse(784, 0.08, { type: "triangle", gain: 0.018, release: 0.05 }), 70);
    },
    hurt() {
      burst(0.12, { frequency: 280, gain: 0.05, filterType: "bandpass", q: 0.9 });
      pulse(120, 0.09, { type: "sawtooth", gain: 0.02, endFrequency: 82, release: 0.05 });
    },
    respawn() {
      pulse(320, 0.14, { type: "sine", gain: 0.03, endFrequency: 540, release: 0.08 });
      setTimeout(() => pulse(640, 0.1, { type: "triangle", gain: 0.022, release: 0.06 }), 110);
    },
  };
}
