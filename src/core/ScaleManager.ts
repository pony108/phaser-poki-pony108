/**
 * ScaleManager.ts
 * Manages responsive canvas scaling.
 * - Maintains 9:16 portrait aspect ratio on all screen sizes
 * - Supports both portrait and landscape without blocking overlays
 * - Works with Phaser's built-in scale manager (Scale.FIT mode)
 *
 * Usage: Call ScaleManager.init() once in BootScene.
 * The Phaser config in main.ts already sets scale mode — this class
 * provides scale config and viewport helpers.
 */

import { GAME_CONFIG } from '../data/gameConfig'

export class ScaleManager {
  /**
   * Initializes scale-related runtime behavior.
   * Call once from BootScene.
   */
  static init(): void {
    // Defensive cleanup: remove stale overlay from older builds/hot-reload.
    const staleWarning = document.getElementById('orientation-warning')
    if (staleWarning) {
      staleWarning.remove()
    }
  }

  /**
   * Returns the Phaser scale config block to embed in the game config.
   */
  static getPhaserScaleConfig(): Phaser.Types.Core.ScaleConfig {
    return {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_CONFIG.width,
      height: GAME_CONFIG.height,
      parent: 'game-container',
      expandParent: true
    }
  }

  /**
   * Returns true if the current viewport is in landscape and the game
   * is designed for portrait. Useful for showing an orientation prompt.
   */
  static isWrongOrientation(): boolean {
    // Portrait game → landscape viewport is "wrong"
    return window.innerWidth > window.innerHeight && window.innerWidth < 900
  }

  /**
   * Current viewport width.
   */
  static get viewportWidth(): number {
    return window.innerWidth
  }

  /**
   * Current viewport height.
   */
  static get viewportHeight(): number {
    return window.innerHeight
  }
}
