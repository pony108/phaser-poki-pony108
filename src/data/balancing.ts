/**
 * balancing.ts
 * All tunable gameplay numbers in one place.
 * Adjust here without touching system or scene code.
 */

export const BALANCING = {
  // ─── Base Score ──────────────────────────────────────────────────────────
  baseScore: 1000,
  
  // ─── Tools ───────────────────────────────────────────────────────────────
  tools: {
    widesponge: { radius: 80, strength: 0.5, name: 'WIDE SPONGE' },
    foambrush: { radius: 50, strength: 1.0, name: 'FOAM BRUSH' },
    focusspray: { radius: 30, strength: 2.0, name: 'FOCUS SPRAY' }
  },

  // ─── Sparkle Wash specifics ──────────────────────────────────────────────
  startingLives: 1, // Not used but kept for interface compatibility
  
  // ─── UI Timings ───────────────────────────────────────────────────────────
  /** Duration of scene transition fades, in milliseconds */
  sceneFadeDuration: 300,

  /** Delay before transitioning from BootScene to PreloadScene */
  bootDelay: 100
} as const

export type Balancing = typeof BALANCING
