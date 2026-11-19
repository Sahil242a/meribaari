let ctx;

/** Two-tone "ding-dong" like a clinic token bell. Needs one user tap first (browser rule). */
export function chime() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    [880, 660].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.type = 'sine';
      const t = ctx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
  } catch {
    /* audio not available */
  }
}

export function unlockAudio() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  return ctx.resume?.();
}

/** Spoken announcement in Hindi (falls back to whatever voice exists). */
export function announce(text) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'hi-IN';
  u.rate = 0.9;
  const hindi = speechSynthesis.getVoices().find((v) => v.lang?.startsWith('hi'));
  if (hindi) u.voice = hindi;
  speechSynthesis.speak(u);
}
