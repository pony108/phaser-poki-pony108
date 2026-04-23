/**
 * levels.ts
 * World and level definitions for Sparkle Wash.
 *
 * GDD worlds:
 *   World 1 (Farm)     – Dust,  levels  1–5   – Fan nozzle
 *   World 2 (Ranch)    – Mud,   levels  6–10  – Jet unlocks at level 7
 *   World 3 (Garage)   – Oil,   levels 11–15  – Hot unlocks at level 12
 *   World 4 (Junkyard) – Rust,  levels 16–20  – All nozzles, bonus zones
 *
 * Star thresholds (advisory timer, no fail):
 *   3 stars: elapsed ≤ parTimeSeconds
 *   2 stars: elapsed ≤ parTimeSeconds × 1.6
 *   1 star : anything else
 *
 * Vehicle types:
 *   0 = sedan     1 = sports car  2 = pickup truck
 *   3 = big truck  4 = vintage     5 = van
 *   6 = bus        7 = ATV         8 = buggy       9 = engine block
 */

export type DirtType = 'dust' | 'mud' | 'oil' | 'rust'

export interface LevelConfig {
  /** 1-based global level number */
  id: number
  /** World number (1-4) */
  world: number
  /** Theme label shown in HUD and ResultScene */
  name: string
  /** Vehicle texture index (0–9) */
  vehicleType: number
  /** Type of dirt — determines colour and cleaning mechanic */
  dirtType: DirtType
  /** Number of passes required to fully clean a cell (1=dust, 2=mud, 3=oil, 4=rust) */
  dirtLayers: number
  /** Seconds for a 3-star clean */
  parTimeSeconds: number
  /** Optional gold bonus zones [localX, localY, w, h] relative to vehicle top-left */
  bonusZones?: [number, number, number, number][]
}

// ─── World 1 — Farm (Dust, Fan nozzle) ────────────────────────────────────────

const WORLD_1: LevelConfig[] = [
  { id: 1,  world: 1, name: 'Dusty Sedan',        vehicleType: 0, dirtType: 'dust', dirtLayers: 1, parTimeSeconds: 40 },
  { id: 2,  world: 1, name: 'Grimy Hatchback',    vehicleType: 1, dirtType: 'dust', dirtLayers: 1, parTimeSeconds: 45 },
  { id: 3,  world: 1, name: 'Farm Pickup',         vehicleType: 2, dirtType: 'dust', dirtLayers: 1, parTimeSeconds: 50 },
  { id: 4,  world: 1, name: 'Old Tractor',         vehicleType: 3, dirtType: 'dust', dirtLayers: 1, parTimeSeconds: 60 },
  { id: 5,  world: 1, name: 'Vintage Banger',      vehicleType: 4, dirtType: 'dust', dirtLayers: 1, parTimeSeconds: 55 }
]

// ─── World 2 — Ranch (Mud, Jet nozzle unlocks at level 7) ─────────────────────

const WORLD_2: LevelConfig[] = [
  { id: 6,  world: 2, name: 'Muddy ATV',           vehicleType: 7, dirtType: 'mud', dirtLayers: 2, parTimeSeconds: 55 },
  { id: 7,  world: 2, name: 'Ranch Pickup',         vehicleType: 2, dirtType: 'mud', dirtLayers: 2, parTimeSeconds: 60 },
  { id: 8,  world: 2, name: 'Caked SUV',            vehicleType: 1, dirtType: 'mud', dirtLayers: 2, parTimeSeconds: 65 },
  { id: 9,  world: 2, name: 'Boot Hill Bus',        vehicleType: 6, dirtType: 'mud', dirtLayers: 3, parTimeSeconds: 80 },
  { id: 10, world: 2, name: 'Swamp Buggy',          vehicleType: 8, dirtType: 'mud', dirtLayers: 3, parTimeSeconds: 75 }
]

// ─── World 3 — Garage (Oil, Hot nozzle unlocks at level 12) ───────────────────

const WORLD_3: LevelConfig[] = [
  { id: 11, world: 3, name: 'Greasy Coupe',         vehicleType: 0, dirtType: 'oil', dirtLayers: 2, parTimeSeconds: 60 },
  { id: 12, world: 3, name: 'Engine Block',         vehicleType: 9, dirtType: 'oil', dirtLayers: 3, parTimeSeconds: 70 },
  { id: 13, world: 3, name: 'Sump Truck',           vehicleType: 2, dirtType: 'oil', dirtLayers: 3, parTimeSeconds: 75 },
  { id: 14, world: 3, name: 'Oily Vintage',         vehicleType: 4, dirtType: 'oil', dirtLayers: 3, parTimeSeconds: 70 },
  { id: 15, world: 3, name: 'Slick Racer',          vehicleType: 1, dirtType: 'oil', dirtLayers: 4, parTimeSeconds: 85 }
]

// ─── World 4 — Junkyard (Rust, all nozzles, bonus zones) ──────────────────────

const WORLD_4: LevelConfig[] = [
  {
    id: 16, world: 4, name: 'Rusty Wreck',
    vehicleType: 0, dirtType: 'rust', dirtLayers: 3, parTimeSeconds: 75,
    bonusZones: [[20, 60, 80, 40]]
  },
  {
    id: 17, world: 4, name: 'Iron Giant',
    vehicleType: 6, dirtType: 'rust', dirtLayers: 4, parTimeSeconds: 95,
    bonusZones: [[10, 20, 100, 30]]
  },
  {
    id: 18, world: 4, name: 'Scrap Heap',
    vehicleType: 2, dirtType: 'rust', dirtLayers: 4, parTimeSeconds: 90,
    bonusZones: [[30, 80, 60, 40]]
  },
  {
    id: 19, world: 4, name: 'Abandoned Van',
    vehicleType: 5, dirtType: 'rust', dirtLayers: 4, parTimeSeconds: 85,
    bonusZones: [[15, 40, 70, 50]]
  },
  {
    id: 20, world: 4, name: 'The Final Rust',
    vehicleType: 4, dirtType: 'rust', dirtLayers: 4, parTimeSeconds: 105,
    bonusZones: [[10, 30, 60, 30], [80, 80, 50, 40]]
  }
]

// ─── All Levels ────────────────────────────────────────────────────────────────

export const ALL_LEVELS: LevelConfig[] = [
  ...WORLD_1,
  ...WORLD_2,
  ...WORLD_3,
  ...WORLD_4
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
 * Returns the world number (1–4) for a given 1-based level id.
 */
export function worldForLevel(levelId: number): number {
  return getLevel(levelId).world
}

/**
 * Returns all level ids belonging to a world (1-based world number).
 */
export function levelsInWorld(world: number): number[] {
  return ALL_LEVELS.filter(l => l.world === world).map(l => l.id)
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
