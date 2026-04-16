/**
 * balancing.ts
 * All tunable gameplay numbers in one place.
 * Adjust here without touching system or scene code.
 */

export const BALANCING = {
  // ─── Spawning ────────────────────────────────────────────────────────────
  /** Time between spawns at game start, in milliseconds */
  initialSpawnInterval: 2000,

  /** Minimum spawn interval — difficulty won't go below this */
  minSpawnInterval: 500,

  // ─── Difficulty ───────────────────────────────────────────────────────────
  /**
   * Time in milliseconds over which difficulty ramps from 1.0 to maxDifficultyMultiplier.
   * Default: 60 seconds
   */
  difficultyRampTime: 60_000,

  /** Maximum difficulty multiplier reached after difficultyRampTime has elapsed */
  maxDifficultyMultiplier: 3.0,

  // ─── Scoring ──────────────────────────────────────────────────────────────
  /** Points awarded per scoring event (e.g. dodging an obstacle, tapping a target) */
  pointsPerEvent: 10,

  /** Score multiplier applied on consecutive events without failure */
  comboMultiplier: 1.5,

  /** Number of consecutive events required to activate the combo multiplier */
  comboThreshold: 5,

  // ─── Player ───────────────────────────────────────────────────────────────
  /** Number of lives the player starts with */
  startingLives: 3,

  /** Player movement speed in pixels/second */
  playerSpeed: 300,

  // ─── UI Timings ───────────────────────────────────────────────────────────
  /** Duration of scene transition fades, in milliseconds */
  sceneFadeDuration: 300,

  /** Delay before transitioning from BootScene to PreloadScene */
  bootDelay: 100
} as const

export type Balancing = typeof BALANCING
