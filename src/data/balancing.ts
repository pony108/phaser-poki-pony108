/**
 * balancing.ts
 * All tunable gameplay numbers in one place.
 */

import type { DirtType } from './levels'

export interface ToolConfig {
  radius: number
  strength: number
  name: string
  role: 'fan' | 'foam' | 'jet' | 'hot'
  gfxProfile: 'dust' | 'foam' | 'jet' | 'steam'
  advancesStates: string[]
  finalCleanStates: string[]
  wrongStateStrengthFactor: number
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
      role: 'fan',
      gfxProfile: 'dust',
      advancesStates: ['dust:raw:clean'],
      finalCleanStates: ['dust:raw'],
      wrongStateStrengthFactor: 0.04,
      primaryDirt: ['dust'] as DirtType[]
    },
    foam: {
      radius: 62,
      strength: 1,
      name: 'FOAM',
      role: 'foam',
      gfxProfile: 'foam',
      advancesStates: ['mud:raw:foamed', 'oil:softened:foamed', 'rust:raw:foamed'],
      finalCleanStates: [],
      wrongStateStrengthFactor: 0.02,
      primaryDirt: ['mud', 'oil', 'rust'] as DirtType[],
      prepOnly: true
    },
    jet: {
      radius: 35,
      strength: 1.35,
      name: 'JET',
      role: 'jet',
      gfxProfile: 'jet',
      advancesStates: [],
      finalCleanStates: ['dust:raw', 'mud:foamed', 'mud:ready', 'oil:foamed', 'rust:foamed'],
      wrongStateStrengthFactor: 0.08,
      primaryDirt: ['dust', 'mud', 'oil', 'rust'] as DirtType[]
    },
    hot: {
      radius: 52,
      strength: 0.95,
      name: 'HOT',
      role: 'hot',
      gfxProfile: 'steam',
      advancesStates: ['oil:raw:softened', 'mud:raw:ready'],
      finalCleanStates: [],
      wrongStateStrengthFactor: 0.04,
      primaryDirt: ['oil', 'mud'] as DirtType[]
    }
  } as Record<string, ToolConfig>,

  dirtSequences: {
    dust: ['fan'],
    mud: ['foam', 'jet'],
    oil: ['hot', 'foam', 'jet'],
    rust: ['foam', 'jet']
  } as Record<DirtType, string[]>,

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
    hot: 11   // World 3 starts with oil, so HOT must be available immediately.
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
