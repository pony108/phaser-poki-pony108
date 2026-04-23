/**
 * balancing.ts
 * All tunable gameplay numbers in one place.
 */

import type { DirtType } from './levels'

export interface ToolConfig {
  radius: number
  strength: number
  name: string
  /** Dirt types this nozzle is effective against. Wrong type = 20% speed. */
  primaryDirt: DirtType[]
}

export const BALANCING = {
  // ─── Base Score ────────────────────────────────────────────────────────────
  baseScore: 1000,

  // ─── Nozzles ───────────────────────────────────────────────────────────────
  // GDD: Fan (wide arc), Jet (narrow stream), Hot (medium cone + steam)
  tools: {
    fan: {
      radius: 80,
      strength: 1.0,
      name: 'FAN',
      primaryDirt: ['dust'] as DirtType[]
    },
    jet: {
      radius: 35,
      strength: 1.5,
      name: 'JET',
      primaryDirt: ['dust', 'mud', 'oil', 'rust'] as DirtType[]
    },
    hot: {
      radius: 55,
      strength: 1.2,
      name: 'HOT',
      primaryDirt: ['dust', 'mud'] as DirtType[]
    }
  } as Record<string, ToolConfig>,

  // ─── Tool Effectiveness ────────────────────────────────────────────────────
  /** Fraction of normal wipe speed when using the wrong nozzle for the dirt type. */
  wrongToolStrengthFactor: 0.2,

  /** Minimum ms between wrong-tool warning flashes (throttle). */
  wrongToolWarningCooldown: 2500,

  // ─── Tool Unlock Levels ───────────────────────────────────────────────────
  /** Level ID at which each tool first becomes available. */
  toolUnlockAtLevel: {
    fan: 1,   // available from the start
    jet: 7,   // World 2 (Ranch) — level 7
    hot: 12   // World 3 (Garage) — level 12
  } as Record<string, number>,

  // ─── World Progression ────────────────────────────────────────────────────
  /** Number of levels per world that must be completed (any stars) to unlock the next world. */
  worldUnlockThreshold: 3,

  /** Inclusive [first, last] level id per world (index = world - 1). */
  worldLevelRanges: [
    [1,  5],   // World 1 — Farm
    [6,  10],  // World 2 — Ranch
    [11, 15],  // World 3 — Garage
    [16, 20]   // World 4 — Junkyard
  ] as [number, number][],

  // ─── UI / Scene Timings ───────────────────────────────────────────────────
  startingLives: 1,           // retained for interface compatibility
  sceneFadeDuration: 300,
  bootDelay: 100
}

export type Balancing = typeof BALANCING
