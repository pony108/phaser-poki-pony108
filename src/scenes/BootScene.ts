/**
 * BootScene.ts
 * First scene to run. Responsible for:
 * - Initializing core services (ScaleManager, AudioManager, SaveManager)
 * - Detecting mobile vs desktop environment
 * - Transitioning quickly to PreloadScene
 *
 * No assets are loaded here — keep it fast.
 */

import { ScaleManager } from '../core/ScaleManager'
import { AudioManager } from '../core/AudioManager'
import { config } from '../core/Config'
import { BALANCING } from '../data/balancing'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  init(): void {
    // ── Core services ────────────────────────────────────────────────────────
    ScaleManager.init()
    AudioManager.init(this)

    if (config.isDev || config.game.debug) {
      console.log(`[Boot] ${config.game.title} v${config.game.version}`)
      console.log(`[Boot] Platform: ${config.isMobile ? 'mobile' : 'desktop'}`)
      console.log(`[Boot] Dev mode: ${config.isDev}`)
    }
  }

  create(): void {
    // Fade in from black
    this.cameras.main.setBackgroundColor(config.game.backgroundColor)
    this.cameras.main.fadeIn(200, 0, 0, 0)

    // Brief delay then move to PreloadScene
    this.time.delayedCall(BALANCING.bootDelay, () => {
      this.scene.start('PreloadScene')
    })
  }
}
