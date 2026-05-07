/**
 * Level definitions for Sparkle Wash.
 *
 * Progression rule: each newly introduced tool appears with a matching dirt type.
 * FAN starts on dust, FOAM+JET arrive with mud, rust reinforces JET use,
 * and HOT arrives with oil.
 */

export type DirtType = 'dust' | 'mud' | 'oil' | 'rust'

export interface LevelConfig {
  /** 1-based global level number. */
  id: number
  /** World number (1-4). */
  world: number
  /** Theme label shown in HUD and ResultScene. */
  name: string
  /** Vehicle texture index. */
  vehicleType: number
  /** Optional tint for repeated vehicle sprites. */
  vehicleTint?: number
  /** Type of dirt, determines colour and cleaning mechanic. */
  dirtType: DirtType
  /** Number of passes required to fully clean a cell. */
  dirtLayers: number
  /** Seconds for a 3-star clean. */
  parTimeSeconds: number
  /** Optional bonus zones [localX, localY, w, h] relative to vehicle top-left. */
  bonusZones?: [number, number, number, number][]
}

export const WORLD_NAMES = {
  1: 'Farm',
  2: 'Ranch',
  3: 'Garage',
  4: 'Junkyard'
} as const

const WORLD_1: LevelConfig[] = [
  { id: 1, world: 1, name: 'Dusty Sedan', vehicleType: 0, dirtType: 'dust', dirtLayers: 1, parTimeSeconds: 40 },
  { id: 2, world: 1, name: 'Muddy Coupe', vehicleType: 1, dirtType: 'mud', dirtLayers: 2, parTimeSeconds: 55 },
  { id: 3, world: 1, name: 'Farm Cruiser', vehicleType: 2, dirtType: 'dust', dirtLayers: 1, parTimeSeconds: 50 },
  { id: 4, world: 1, name: 'Green Utility', vehicleType: 3, dirtType: 'dust', dirtLayers: 1, parTimeSeconds: 60 },
  { id: 5, world: 1, name: 'Rusty Runner', vehicleType: 4, dirtType: 'rust', dirtLayers: 2, parTimeSeconds: 70 },
  { id: 6, world: 1, name: 'White Van Wash', vehicleType: 9, dirtType: 'mud', dirtLayers: 2, parTimeSeconds: 60 },
  { id: 7, world: 1, name: 'Red Compact', vehicleType: 10, dirtType: 'dust', dirtLayers: 1, parTimeSeconds: 45 }
]

const WORLD_2: LevelConfig[] = [
  { id: 8, world: 2, name: 'Pink Cargo Ride', vehicleType: 11, dirtType: 'mud', dirtLayers: 2, parTimeSeconds: 60 },
  { id: 9, world: 2, name: 'Box Van Rinse', vehicleType: 5, dirtType: 'mud', dirtLayers: 2, parTimeSeconds: 65 },
  { id: 10, world: 2, name: 'Greasy Service Bus', vehicleType: 6, dirtType: 'oil', dirtLayers: 2, parTimeSeconds: 70 },
  { id: 11, world: 2, name: 'Muddy ATV', vehicleType: 7, dirtType: 'mud', dirtLayers: 2, parTimeSeconds: 60 },
  { id: 12, world: 2, name: 'Buggy Splash', vehicleType: 8, dirtType: 'rust', dirtLayers: 2, parTimeSeconds: 70 },
  { id: 13, world: 2, name: 'Blue Sedan Return', vehicleType: 0, vehicleTint: 0x66aaff, dirtType: 'mud', dirtLayers: 3, parTimeSeconds: 78 },
  { id: 14, world: 2, name: 'Orange Coupe Return', vehicleType: 1, vehicleTint: 0xffa34d, dirtType: 'mud', dirtLayers: 3, parTimeSeconds: 82 },
  { id: 15, world: 2, name: 'Purple Cruiser Return', vehicleType: 2, vehicleTint: 0xb56cff, dirtType: 'rust', dirtLayers: 3, parTimeSeconds: 85 }
]

const WORLD_3: LevelConfig[] = [
  { id: 16, world: 3, name: 'Oily Utility', vehicleType: 3, vehicleTint: 0x9fd66b, dirtType: 'oil', dirtLayers: 3, parTimeSeconds: 78 },
  { id: 17, world: 3, name: 'Garage Sport', vehicleType: 4, vehicleTint: 0xff8a3d, dirtType: 'oil', dirtLayers: 3, parTimeSeconds: 75 },
  { id: 18, world: 3, name: 'White Van Grease', vehicleType: 9, vehicleTint: 0xdfefff, dirtType: 'oil', dirtLayers: 3, parTimeSeconds: 78 },
  { id: 19, world: 3, name: 'Red Oil Job', vehicleType: 10, vehicleTint: 0xff5b4f, dirtType: 'oil', dirtLayers: 3, parTimeSeconds: 80 },
  { id: 20, world: 3, name: 'Pink Detail Wash', vehicleType: 11, vehicleTint: 0xff78b8, dirtType: 'oil', dirtLayers: 3, parTimeSeconds: 78 },
  { id: 21, world: 3, name: 'Van Degrease', vehicleType: 5, vehicleTint: 0x7fd4ff, dirtType: 'oil', dirtLayers: 3, parTimeSeconds: 85 },
  { id: 22, world: 3, name: 'Bus Deep Clean', vehicleType: 6, vehicleTint: 0xffd34d, dirtType: 'oil', dirtLayers: 4, parTimeSeconds: 100 },
  { id: 23, world: 3, name: 'ATV Oil Spill', vehicleType: 7, vehicleTint: 0x70e0a0, dirtType: 'oil', dirtLayers: 4, parTimeSeconds: 95 }
]

const WORLD_4: LevelConfig[] = [
  {
    id: 24, world: 4, name: 'Rust Buggy',
    vehicleType: 8, vehicleTint: 0xf0b040, dirtType: 'rust', dirtLayers: 3, parTimeSeconds: 82,
    bonusZones: [[45, 70, 90, 48]]
  },
  {
    id: 25, world: 4, name: 'Rust Sedan Return',
    vehicleType: 0, vehicleTint: 0xffd35a, dirtType: 'rust', dirtLayers: 3, parTimeSeconds: 84,
    bonusZones: [[34, 54, 76, 46]]
  },
  {
    id: 26, world: 4, name: 'Rust Coupe Return',
    vehicleType: 1, vehicleTint: 0x4db8ff, dirtType: 'rust', dirtLayers: 4, parTimeSeconds: 98,
    bonusZones: [[42, 64, 88, 52]]
  },
  {
    id: 27, world: 4, name: 'Rust Cruiser Return',
    vehicleType: 2, vehicleTint: 0xcc77ff, dirtType: 'rust', dirtLayers: 4, parTimeSeconds: 96,
    bonusZones: [[36, 96, 72, 50]]
  },
  {
    id: 28, world: 4, name: 'Junkyard Utility',
    vehicleType: 3, vehicleTint: 0x8bd15f, dirtType: 'rust', dirtLayers: 4, parTimeSeconds: 106,
    bonusZones: [[48, 76, 96, 54]]
  },
  {
    id: 29, world: 4, name: 'Final Van Wash',
    vehicleType: 9, vehicleTint: 0xf5f5f5, dirtType: 'rust', dirtLayers: 4, parTimeSeconds: 96,
    bonusZones: [[32, 58, 76, 46]]
  },
  {
    id: 30, world: 4, name: 'Final Show Car',
    vehicleType: 10, vehicleTint: 0xff4040, dirtType: 'rust', dirtLayers: 4, parTimeSeconds: 110,
    bonusZones: [[28, 54, 74, 44], [72, 180, 72, 56]]
  }
]

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

/** Returns the world number (1-4) for a given 1-based level id. */
export function worldForLevel(levelId: number): number {
  return getLevel(levelId).world
}

export function worldName(world: number): string {
  return WORLD_NAMES[world as keyof typeof WORLD_NAMES] ?? `World ${world}`
}

/** Returns all level ids belonging to a world (1-based world number). */
export function levelsInWorld(world: number): number[] {
  return ALL_LEVELS.filter((level) => level.world === world).map((level) => level.id)
}

export function levelIndexInWorld(levelId: number): number {
  const ids = levelsInWorld(worldForLevel(levelId))
  const idx = ids.indexOf(levelId)
  return idx === -1 ? 1 : idx + 1
}

/** Computes star count (1-3) from elapsed seconds and the level's par time. */
export function calcStars(elapsedSeconds: number, parTimeSeconds: number): number {
  if (elapsedSeconds <= parTimeSeconds) return 3
  if (elapsedSeconds <= parTimeSeconds * 1.6) return 2
  return 1
}
