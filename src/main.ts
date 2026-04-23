/**
 * main.ts
 * Phaser game bootstrap.
 * - Registers the PokiPlugin with scene keys that match exactly
 * - Declares all scenes in the correct startup order
 * - ScaleManager.getPhaserScaleConfig() sets responsive portrait scaling
 */

import Phaser from 'phaser'
import { PokiPlugin } from '@poki/phaser-3'

import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { MenuScene } from './scenes/MenuScene'
import { GameScene } from './scenes/GameScene'
import { ResultScene } from './scenes/ResultScene'
import { ScaleManager } from './core/ScaleManager'
import { GAME_CONFIG } from './data/gameConfig'
import { config as runtimeConfig } from './core/Config'
import { registerSparkleWashTestBridge } from './dev/testBridge'

const isAutomatedBrowser = runtimeConfig.isDev && navigator.webdriver === true

const config: Phaser.Types.Core.GameConfig = {
  type: isAutomatedBrowser ? Phaser.CANVAS : Phaser.AUTO,

  // ScaleManager provides the full scale config block
  scale: ScaleManager.getPhaserScaleConfig(),

  backgroundColor: GAME_CONFIG.backgroundColor,

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: GAME_CONFIG.debug
    }
  },

  // ── Poki Plugin ────────────────────────────────────────────────────────────
  // Scene keys MUST match the keys used in the scene constructors above.
  // The plugin handles:
  //   • gameLoadingFinished  — auto-fired when PreloadScene finishes loading
  //   • gameplayStart        — auto-fired when GameScene starts
  //   • gameplayStop         — auto-fired when GameScene stops
  //   • Input/audio muting   — during ad breaks
  plugins: {
    global: [
      {
        plugin: PokiPlugin,
        key: 'poki',
        start: true,
        data: {
          loadingSceneKey: 'PreloadScene',
          gameplaySceneKey: 'GameScene',
          autoCommercialBreak: true
        }
      }
    ]
  },

  scene: [BootScene, PreloadScene, MenuScene, GameScene, ResultScene],

  // Performance hints
  render: {
    antialias: false,     // Pixel-perfect, better perf on mobile
    pixelArt: false,
    roundPixels: true
  },

  fps: {
    target: GAME_CONFIG.targetFps,
    forceSetTimeOut: false
  }
}

// Boot the game
const game = new Phaser.Game(config)

registerSparkleWashTestBridge(game)
