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
  /** Prep tools mark dirty cells but do not directly remove dirt layers. */
  prepOnly?: boolean
}

export const BALANCING = {
  // ─── Base Score ────────────────────────────────────────────────────────────
  baseScore: 1000,
  completionPercent: 98,
  rewardedScoreBonus: 400,
  clearSfxCooldownMs: 90,
  unpreppedStrengthFactor: 0.08,

  cash: {
    basePay: 120,
    starBonus: 45,
    efficiencyBonus: 60,
    bonusZoneCash: 50,
    partCompleteCash: 20
  },

  upgrades: {
    pressure: {
      name: 'Pressure',
      description: 'More cleaning power for every tool.',
      basePrice: 250,
      priceStep: 180,
      maxLevel: 5,
      strengthBonusPerLevel: 0.12
    },
    sprayWidth: {
      name: 'Spray Width',
      description: 'Wider fan coverage.',
      basePrice: 350,
      priceStep: 220,
      maxLevel: 4,
      fanRadiusBonusPerLevel: 5
    },
    soapQuality: {
      name: 'Soap Quality',
      description: 'Hot nozzle cuts mud faster.',
      basePrice: 450,
      priceStep: 260,
      maxLevel: 4,
      hotMudStrengthBonusPerLevel: 0.16
    }
  },

  // ─── Nozzles ───────────────────────────────────────────────────────────────
  // GDD: Fan (wide arc), Jet (narrow stream), Hot (medium cone + steam)
  tools: {
    fan: {
      radius: 72,
      strength: 0.42,
      name: 'FAN',
      primaryDirt: ['dust'] as DirtType[]
    },
    foam: {
      radius: 62,
      strength: 1,
      name: 'FOAM',
      primaryDirt: ['mud', 'oil', 'rust'] as DirtType[],
      prepOnly: true
    },
    jet: {
      radius: 35,
      strength: 1.35,
      name: 'JET',
      primaryDirt: ['dust', 'mud', 'oil', 'rust'] as DirtType[]
    },
    hot: {
      radius: 52,
      strength: 0.95,
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
    foam: 6,  // World 2 introduces pre-treatment
    jet: 6,   // World 2 needs a pressure follow-up after foam
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
