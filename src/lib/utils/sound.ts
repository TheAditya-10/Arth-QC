"use client";

let ctx: AudioContext | null = null;

/** Tiny synthesized chime — no audio assets needed. */
export function playChime(kind: "correct" | "wrong") {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    const notes = kind === "correct" ? [660, 880] : [300, 240];
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx!.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.2);
    });
  } catch {
    /* audio not available */
  }
}
