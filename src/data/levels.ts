/**
 * levels.ts
 * World and level definitions for Sparkle Wash.
 *
 * GDD worlds:
 *   World 1 (Farm)    – Dust, levels 1–5
 *   World 2 (Ranch)   – Mud,  levels 6–10  (M4)
 *   World 3 (Garage)  – Oil,  levels 11–15 (M4)
 *   World 4 (Junkyard)– Rust, levels 16–20 (M4)
 *
 * Star thresholds (advisory timer, no fail):
 *   3 stars: ≤ parTimeSeconds
 *   2 stars: ≤ parTimeSeconds × 1.6
 *   1 star : anything else
 */

export type DirtType = 'dust' | 'mud' | 'oil' | 'rust'

export interface LevelConfig {
  /** 1-based global level number */
  id: number
  /** World number (1-4) */
  world: number
  /** Human-readable name shown in HUD / ResultScene */
  name: string
  /** Which placeholder vehicle sprite to use (0–4) */
  vehicleType: number
  /** Type of dirt — determines colour and layer count */
  dirtType: DirtType
  /** Number of dirt layers (1 = dust, 4 = rust) */
  dirtLayers: number
  /** Time in seconds for a 3-star clean */
  parTimeSeconds: number
}

// ─── World 1 — Farm (dust, 1 layer) ──────────────────────────────────────────

const WORLD_1: LevelConfig[] = [
  {
    id: 1,
    world: 1,
    name: 'Dusty Sedan',
    vehicleType: 0,
    dirtType: 'dust',
    dirtLayers: 1,
    parTimeSeconds: 40
  },
  {
    id: 2,
    world: 1,
    name: 'Muddy SUV',
    vehicleType: 1,
    dirtType: 'dust',
    dirtLayers: 1,
    parTimeSeconds: 50
  },
  {
    id: 3,
    world: 1,
    name: 'Grimy Sports',
    vehicleType: 2,
    dirtType: 'dust',
    dirtLayers: 1,
    parTimeSeconds: 45
  },
  {
    id: 4,
    world: 1,
    name: 'Filthy Truck',
    vehicleType: 3,
    dirtType: 'dust',
    dirtLayers: 1,
    parTimeSeconds: 60
  },
  {
    id: 5,
    world: 1,
    name: 'Vintage Grime',
    vehicleType: 4,
    dirtType: 'dust',
    dirtLayers: 1,
    parTimeSeconds: 55
  }
]

// ─── All Levels ───────────────────────────────────────────────────────────────

export const ALL_LEVELS: LevelConfig[] = [
  ...WORLD_1
  // World 2–4 will be added in M4
]

export const TOTAL_LEVELS = ALL_LEVELS.length

/** Returns the LevelConfig for a 1-based level id. Clamps to valid range. */
export function getLevel(levelId: number): LevelConfig {
  const idx = Math.max(0, Math.min(levelId - 1, ALL_LEVELS.length - 1))
  return ALL_LEVELS[idx]
}

/** Returns true if levelId is the final level. */
export function isLastLevel(levelId: number): boolean {
  return levelId >= TOTAL_LEVELS
}

/**
 * Computes star count (1–3) from elapsed seconds and the level's par time.
 *   3 stars: elapsed ≤ par
 *   2 stars: elapsed ≤ par × 1.6
 *   1 star : elapsed > par × 1.6
 */
export function calcStars(elapsedSeconds: number, parTimeSeconds: number): number {
  if (elapsedSeconds <= parTimeSeconds) return 3
  if (elapsedSeconds <= parTimeSeconds * 1.6) return 2
  return 1
}
