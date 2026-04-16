/**
 * ScaleManager.ts
 * Manages responsive canvas scaling.
 * - Maintains 9:16 portrait aspect ratio on all screen sizes
 * - Handles orientation change events
 * - Works with Phaser's built-in scale manager (Scale.FIT mode)
 *
 * Usage: Call ScaleManager.init() once in BootScene.
 * The Phaser config in main.ts already sets scale mode — this class
 * adds orientation-change handling and exposes helpers.
 */

import { GAME_CONFIG } from '../data/gameConfig'

export class ScaleManager {
  private static orientationWarning: HTMLElement | null = null

  /**
   * Initializes orientation change handling.
   * Call once from BootScene.
   */
  static init(): void {
    ScaleManager.handleOrientationChange()
    window.addEventListener('orientationchange', () => {
      // Small delay to let the browser finish rotating
      setTimeout(() => ScaleManager.handleOrientationChange(), 100)
    })
    window.addEventListener('resize', () => ScaleManager.handleOrientationChange())
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

  private static handleOrientationChange(): void {
    if (ScaleManager.isWrongOrientation()) {
      ScaleManager.showOrientationWarning()
    } else {
      ScaleManager.hideOrientationWarning()
    }
  }

  private static showOrientationWarning(): void {
    if (ScaleManager.orientationWarning) return

    const el = document.createElement('div')
    el.id = 'orientation-warning'
    el.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: #1a1a2e;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: sans-serif;
      font-size: 18px;
      text-align: center;
      padding: 24px;
    `
    el.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">📱</div>
      <div>Please rotate your device to portrait mode</div>
    `
    document.body.appendChild(el)
    ScaleManager.orientationWarning = el
  }

  private static hideOrientationWarning(): void {
    if (!ScaleManager.orientationWarning) return
    ScaleManager.orientationWarning.remove()
    ScaleManager.orientationWarning = null
  }
}
