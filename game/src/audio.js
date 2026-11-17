// Synthesized sound: no audio files, everything is WebAudio oscillators and
// filtered noise, started on the first user gesture.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    } catch {
      return false;
    }
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    return true;
  }

  function blip(freq, duration, type, volume) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  function noiseBurst(duration, volume) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  return {
    unlock() { ensure(); },
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
    },
    isMuted() { return muted; },
    /** Engine hum follows speed 0..1; 0 silences it. */
    engine(speedRatio, on) {
      if (!ctx || muted) return;
      const target = on ? 0.02 + speedRatio * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + speedRatio * 130, ctx.currentTime, 0.08);
    },
    /** Dust-storm wind: a looping filtered noise bed, on or off. */
    wind(on) {
      if (!ensure()) return;
      if (on && !windSource) {
        const len = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
        windSource = ctx.createBufferSource();
        windSource.buffer = buffer;
        windSource.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 500;
        filter.Q.value = 0.6;
        windGain = ctx.createGain();
        windGain.gain.value = muted ? 0 : 0.05;
        windSource.connect(filter);
        filter.connect(windGain);
        windGain.connect(ctx.destination);
        windSource.start();
      } else if (!on && windSource) {
        try { windSource.stop(); } catch { /* already stopped */ }
        windSource = null;
        windGain = null;
      }
    },
    pickup() { blip(880, 0.12, 'sine', 0.1); blip(1320, 0.16, 'sine', 0.07); },
    coin() { blip(1175, 0.09, 'sine', 0.09); },
    crash() { noiseBurst(0.25, 0.22); blip(70, 0.2, 'sawtooth', 0.14); },
    punch() { noiseBurst(0.08, 0.12); },
    siren() { blip(660, 0.3, 'triangle', 0.05); blip(880, 0.3, 'triangle', 0.05); },
    mission() { blip(523, 0.14, 'square', 0.07); blip(659, 0.14, 'square', 0.07); blip(784, 0.28, 'square', 0.08); },
    fail() { blip(220, 0.3, 'sawtooth', 0.08); blip(165, 0.4, 'sawtooth', 0.08); },
    fuel() { blip(440, 0.1, 'sine', 0.07); },
  };
}
