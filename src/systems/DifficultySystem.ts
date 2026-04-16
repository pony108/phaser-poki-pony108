/**
 * DifficultySystem.ts
 * Time-based difficulty multiplier.
 * Driven entirely by values in balancing.ts — no magic numbers here.
 *
 * Usage:
 *   const difficulty = new DifficultySystem()
 *   // In GameScene update():
 *   difficulty.update(delta)
 *   const multiplier = difficulty.getDifficultyMultiplier()
 *   const spawnInterval = BASE_INTERVAL / multiplier
 */

import { BALANCING } from '../data/balancing'

export class DifficultySystem {
  private _elapsedMs: number = 0
  private readonly rampTime: number
  private readonly maxMultiplier: number

  constructor() {
    this.rampTime = BALANCING.difficultyRampTime
    this.maxMultiplier = BALANCING.maxDifficultyMultiplier
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  /**
   * Advance the difficulty timer.
   * @param deltaMs — milliseconds since last frame (use Phaser's `delta` arg)
   */
  update(deltaMs: number): void {
    this._elapsedMs += deltaMs
  }

  // ─── Accessors ─────────────────────────────────────────────────────────────

  /**
   * Returns the current difficulty multiplier in range [1.0, maxMultiplier].
   * Uses an ease-out curve so early game feels gentle and late game intense.
   */
  getDifficultyMultiplier(): number {
    const t = Math.min(1, this._elapsedMs / this.rampTime)
    // Ease-out quad: fast early ramp, levels off near max
    const eased = 1 - (1 - t) * (1 - t)
    return 1.0 + (this.maxMultiplier - 1.0) * eased
  }

  /**
   * Returns the current spawn interval in milliseconds.
   * Clamps to BALANCING.minSpawnInterval.
   */
  getCurrentSpawnInterval(): number {
    const interval = BALANCING.initialSpawnInterval / this.getDifficultyMultiplier()
    return Math.max(BALANCING.minSpawnInterval, interval)
  }

  /**
   * Returns elapsed time in milliseconds since game start.
   */
  getElapsedMs(): number {
    return this._elapsedMs
  }

  /**
   * Returns elapsed time in whole seconds.
   */
  getElapsedSeconds(): number {
    return Math.floor(this._elapsedMs / 1000)
  }

  /**
   * Progress toward max difficulty, in range [0, 1].
   */
  getDifficultyProgress(): number {
    return Math.min(1, this._elapsedMs / this.rampTime)
  }

  /**
   * Reset the difficulty system (call on game restart).
   */
  reset(): void {
    this._elapsedMs = 0
  }
}
