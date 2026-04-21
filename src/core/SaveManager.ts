/**
 * SaveManager.ts
 * localStorage wrapper with typed save/load and silent error handling.
 * Safe to use in environments where localStorage is unavailable
 * (private browsing, storage quota exceeded, etc.).
 */

const PREFIX = 'pg_' // Namespace all keys to avoid collisions

export class SaveManager {
  /**
   * Saves a value to localStorage under the given key.
   * Silently swallows storage errors (quota exceeded, private browsing).
   */
  static save<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value)
      localStorage.setItem(PREFIX + key, serialized)
    } catch {
      // Storage unavailable or quota exceeded — fail silently
    }
  }

  /**
   * Loads a value from localStorage. Returns `defaultValue` if the key
   * doesn't exist, the data is malformed, or storage is unavailable.
   */
  static load<T>(key: string, defaultValue: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (raw === null) return defaultValue
      return JSON.parse(raw) as T
    } catch {
      return defaultValue
    }
  }

  /**
   * Removes a single key from storage.
   */
  static remove(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key)
    } catch {
      // Fail silently
    }
  }

  /**
   * Removes all keys that were written by this SaveManager (prefix-scoped).
   */
  static clearAll(): void {
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(PREFIX)) {
          keysToRemove.push(k)
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))
    } catch {
      // Fail silently
    }
  }

  /**
   * Returns true if localStorage appears to be available.
   */
  static isAvailable(): boolean {
    try {
      const testKey = PREFIX + '__test__'
      localStorage.setItem(testKey, '1')
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }
}

// ─── Storage Keys ────────────────────────────────────────────────────────────
// Centralise key strings here to avoid typos across files.

export const SAVE_KEYS = {
  highScore: 'high_score',
  muted: 'muted',
  sfxVolume: 'sfx_volume',
  musicVolume: 'music_volume',
  completedCleans: 'completed_cleans',
  /** 1-based id of the next unplayed level (starts at 1) */
  currentLevel: 'current_level',
  /** Record<levelId, stars> — best star count per level */
  levelStars: 'level_stars'
} as const
