/**
 * PreloadScene.ts
 * Loads all game assets and shows a progress bar during loading.
 *
 * Poki: The PokiPlugin automatically calls gameLoadingFinished
 * when this scene's load completes (configured via loadingSceneKey in main.ts).
 *
 * Add your real assets in the loadAssets() method below.
 * Placeholder colored textures are generated programmatically so the
 * game runs immediately without any external asset files.
 */

import { ProgressBar } from '../components/ProgressBar'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'

const CX = GAME_CONFIG.width / 2
const CY = GAME_CONFIG.height / 2

export class PreloadScene extends Phaser.Scene {
  private progressBar!: ProgressBar
  private loadingText!: Phaser.GameObjects.Text
  private percentText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(config.game.backgroundColor)

    this.createLoadingUI()
    this.registerLoadEvents()
    this.loadAssets()
  }

  create(): void {
    // Fade out then transition to MenuScene
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('MenuScene')
    )
  }

  // ─── Loading UI ────────────────────────────────────────────────────────────

  private createLoadingUI(): void {
    // Game title
    this.add
      .text(CX, CY - 100, config.game.title, {
        fontSize: '32px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        fontStyle: 'bold',
        resolution: 2
      })
      .setOrigin(0.5)

    // Status label
    this.loadingText = this.add
      .text(CX, CY - 20, 'Loading...', {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#aaaacc',
        resolution: 2
      })
      .setOrigin(0.5)

    // Progress bar
    this.progressBar = new ProgressBar({
      scene: this,
      x: CX,
      y: CY + 20,
      width: 300,
      height: 20
    })

    // Percentage label
    this.percentText = this.add
      .text(CX, CY + 60, '0%', {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#aaaacc',
        resolution: 2
      })
      .setOrigin(0.5)

    // Version stamp
    this.add
      .text(CX, GAME_CONFIG.height - 30, `v${config.game.version}`, {
        fontSize: '12px',
        fontFamily: 'Arial, sans-serif',
        color: '#555577',
        resolution: 2
      })
      .setOrigin(0.5)
  }

  private registerLoadEvents(): void {
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      this.progressBar.setValue(value)
      this.percentText.setText(`${Math.round(value * 100)}%`)
    })

    this.load.on(Phaser.Loader.Events.COMPLETE, () => {
      this.loadingText.setText('Ready!')
      this.progressBar.setValue(1)
      this.percentText.setText('100%')
    })
  }

  // ─── Asset Loading ────────────────────────────────────────────────────────
  // Replace generateTexture() calls with real asset loads for your game.
  // Example:
  //   this.load.image('player', 'assets/player.png')
  //   this.load.spritesheet('explosion', 'assets/explosion.png', { frameWidth: 64, frameHeight: 64 })
  //   this.load.audio('bgm', 'assets/bgm.mp3')

  private loadAssets(): void {
    // ── Placeholder textures (generated at runtime — no files needed) ────────

    // Player — blue rounded square
    const playerGfx = this.make.graphics({ x: 0, y: 0 }, false)
    playerGfx.fillStyle(0x4a90d9)
    playerGfx.fillRoundedRect(0, 0, 48, 48, 10)
    playerGfx.generateTexture('player', 48, 48)
    playerGfx.destroy()

    // Enemy — red rounded square
    const enemyGfx = this.make.graphics({ x: 0, y: 0 }, false)
    enemyGfx.fillStyle(0xe74c3c)
    enemyGfx.fillRoundedRect(0, 0, 40, 40, 8)
    enemyGfx.generateTexture('enemy', 40, 40)
    enemyGfx.destroy()

    // Coin / collectible — gold circle
    const coinGfx = this.make.graphics({ x: 0, y: 0 }, false)
    coinGfx.fillStyle(0xf1c40f)
    coinGfx.fillCircle(16, 16, 16)
    coinGfx.generateTexture('coin', 32, 32)
    coinGfx.destroy()

    // Particle — small white dot (used for effects)
    const particleGfx = this.make.graphics({ x: 0, y: 0 }, false)
    particleGfx.fillStyle(0xffffff, 0.8)
    particleGfx.fillCircle(4, 4, 4)
    particleGfx.generateTexture('particle', 8, 8)
    particleGfx.destroy()

    // TODO: Load real audio assets here once they exist
    // this.load.audio('bgm', 'assets/bgm.mp3')
    // this.load.audio('sfx_score', 'assets/sfx_score.wav')
    // this.load.audio('sfx_hurt', 'assets/sfx_hurt.wav')
    // this.load.audio('sfx_button', 'assets/sfx_button.wav')
  }
}
