class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playFootstep(stepIndex: number) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Playful soft marimba/woodblock tap for low-poly footsteps
    osc.type = 'triangle';
    const baseFreq = stepIndex % 2 === 0 ? 155 : 178;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.055);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playWallThud(intensity: number) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const clamped = Math.min(1, Math.max(0.2, intensity));

    // Low punchy thud oscillator
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(130 * clamped + 50, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.14);

    gain.gain.setValueAtTime(0.32 * clamped, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);

    // Subtle crisp knock overtone so collision feels tactile and solid
    const knockOsc = ctx.createOscillator();
    const knockGain = ctx.createGain();
    knockOsc.type = 'square';
    knockOsc.frequency.setValueAtTime(290, now);
    knockOsc.frequency.exponentialRampToValueAtTime(95, now + 0.045);

    knockGain.gain.setValueAtTime(0.09 * clamped, now);
    knockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    knockOsc.connect(knockGain);
    knockGain.connect(ctx.destination);

    knockOsc.start(now);
    knockOsc.stop(now + 0.055);
  }

  public playCollect(collectedCount: number, totalCount: number) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Pitch rises playfully as player collects more items
    const progressRatio = collectedCount / Math.max(1, totalCount);
    const rootFreq = 440 + progressRatio * 260;

    const notes = [rootFreq, rootFreq * 1.25, rootFreq * 1.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      const startTime = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.03, startTime + 0.18);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.24);
    });
  }

  public playAllCollectedFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  public playVictory() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5];
    const times = [0, 0.09, 0.18, 0.28, 0.42, 0.54];
    const durations = [0.15, 0.15, 0.15, 0.2, 0.15, 0.55];

    melody.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      const startTime = now + times[idx];
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.22, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + durations[idx]);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + durations[idx] + 0.02);
    });
  }

  public playGhostVanish() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Ethereal crystalline shimmer when a fog silhouette dissolves
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.28);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.32);
  }
}

export const soundEngine = new SoundEngine();
