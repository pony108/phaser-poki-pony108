/**
 * ScoreSystem.ts
 * Manages the player's current score and persisted high score.
 *
 * Usage:
 *   const score = new ScoreSystem()
 *   score.add(10)
 *   score.getScore()      // → 10
 *   score.getHighScore()  // → persisted best
 *   score.reset()
 */

import { SaveManager, SAVE_KEYS } from '../core/SaveManager'

export class ScoreSystem {
  private _score: number = 0
  private _highScore: number = 0

  constructor() {
    this._highScore = SaveManager.load<number>(SAVE_KEYS.highScore, 0)
  }

  // ─── Score Mutation ────────────────────────────────────────────────────────

  /**
   * Add points to the current score.
   * Negative values are clamped to zero (score can't go below 0).
   */
  add(points: number): void {
    this._score = Math.max(0, this._score + points)
    if (this._score > this._highScore) {
      this._highScore = this._score
      SaveManager.save(SAVE_KEYS.highScore, this._highScore)
    }
  }

  /**
   * Reset the current game score to zero.
   * High score is unaffected.
   */
  reset(): void {
    this._score = 0
  }

  // ─── Accessors ─────────────────────────────────────────────────────────────

  getScore(): number {
    return this._score
  }

  getHighScore(): number {
    return this._highScore
  }

  /**
   * Returns true if the current score equals the all-time high score.
   */
  isNewHighScore(): boolean {
    return this._score > 0 && this._score >= this._highScore
  }

  /**
   * Reset the stored high score (e.g. for a "reset data" option).
   */
  clearHighScore(): void {
    this._highScore = 0
    SaveManager.remove(SAVE_KEYS.highScore)
  }
}
