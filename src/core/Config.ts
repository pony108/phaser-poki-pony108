/**
 * Config.ts
 * Typed runtime config interface and accessor.
 * Wraps GAME_CONFIG and BALANCING into a single injectable object
 * that scenes and systems can import without circular dependencies.
 */

import { GAME_CONFIG, type GameConfig } from '../data/gameConfig'
import { BALANCING, type Balancing } from '../data/balancing'

export interface RuntimeConfig {
  game: GameConfig
  balancing: Balancing
  /** True when running on localhost or 127.0.0.1 */
  isDev: boolean
  /** True when the device reports touch support */
  isMobile: boolean
}

function detectIsDev(): boolean {
  const { hostname } = window.location
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function detectIsMobile(): boolean {
  return navigator.maxTouchPoints > 0
}

/**
 * Singleton config instance.
 * Import `config` anywhere — it's safe to use before Phaser boots.
 */
export const config: RuntimeConfig = {
  game: GAME_CONFIG,
  balancing: BALANCING,
  isDev: detectIsDev(),
  isMobile: detectIsMobile()
}
