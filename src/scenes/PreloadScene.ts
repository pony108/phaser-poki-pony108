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
    // Fade out then jump straight into gameplay — no menu friction
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('GameScene')
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

    const w = 180
    const h = 340 // Base vehicle size

    // Vehicle 0: Sedan (Blue)
    const v0 = this.make.graphics({ x: 0, y: 0 }, false)
    v0.fillStyle(0x4a90d9) // Blue body
    v0.fillRoundedRect(0, 0, w, h, 20)
    v0.fillStyle(0x222222) // Windshield
    v0.fillRoundedRect(20, h * 0.2, w - 40, 50, 10)
    v0.fillRoundedRect(20, h * 0.7, w - 40, 40, 10)
    v0.generateTexture('vehicle_0', w, h)
    v0.destroy()

    // Vehicle 1: SUV (Red)
    const v1 = this.make.graphics({ x: 0, y: 0 }, false)
    v1.fillStyle(0xe74c3c)
    v1.fillRoundedRect(0, 0, w + 20, h + 40, 15)
    v1.fillStyle(0x222222)
    v1.fillRoundedRect(20, h * 0.2, w - 20, 60, 15)
    v1.fillRoundedRect(20, h * 0.7, w - 20, 50, 10)
    v1.generateTexture('vehicle_1', w + 20, h + 40)
    v1.destroy()

    // Vehicle 2: Sports (Yellow)
    const v2 = this.make.graphics({ x: 0, y: 0 }, false)
    v2.fillStyle(0xf1c40f)
    v2.fillRoundedRect(10, 0, w - 20, h, 30)
    v2.fillStyle(0x222222)
    v2.fillRoundedRect(25, h * 0.25, w - 50, 45, 15)
    v2.generateTexture('vehicle_2', w, h)
    v2.destroy()

    // Vehicle 3: Truck (Green)
    const v3 = this.make.graphics({ x: 0, y: 0 }, false)
    v3.fillStyle(0x2ecc71)
    v3.fillRect(0, 0, w + 30, h + 60)
    v3.fillStyle(0x222222)
    v3.fillRoundedRect(30, h * 0.15, w - 30, 40, 5) // Cab
    v3.fillStyle(0x555555) // Bed
    v3.fillRect(10, h * 0.4, w + 10, h * 0.5)
    v3.generateTexture('vehicle_3', w + 30, h + 60)
    v3.destroy()

    // Vehicle 4: Vintage (Purple)
    const v4 = this.make.graphics({ x: 0, y: 0 }, false)
    v4.fillStyle(0x9b59b6)
    v4.fillRoundedRect(15, 0, w - 30, h, 40)
    v4.fillCircle(15, 40, 25)
    v4.fillCircle(w - 15, 40, 25)
    v4.fillStyle(0x222222)
    v4.fillRoundedRect(30, h * 0.3, w - 60, 40, 5)
    v4.generateTexture('vehicle_4', w, h)
    v4.destroy()

    // Dirt Textures (Generated procedurally in GameScene on the render texture, 
    // but we can make a basic dirt blob here if needed. We'll use graphics primitives for dirt).

    // Tools
    const makeTool = (key: string, color: number) => {
      const tg = this.make.graphics({ x: 0, y: 0 }, false)
      tg.fillStyle(color)
      tg.fillCircle(24, 24, 24)
      tg.generateTexture(key, 48, 48)
      tg.destroy()
    }
    makeTool('tool_widesponge', 0x3498db) // Blueish
    makeTool('tool_foambrush', 0xffffff) // White
    makeTool('tool_focusspray', 0x1abc9c) // Cyan/Aquamarine

    // Particle — small white dot
    const particleGfx = this.make.graphics({ x: 0, y: 0 }, false)
    particleGfx.fillStyle(0xffffff, 0.8)
    particleGfx.fillCircle(4, 4, 4)
    particleGfx.generateTexture('particle', 8, 8)
    particleGfx.destroy()
    
    // Sparkle
    const sp = this.make.graphics({ x: 0, y: 0 }, false)
    sp.fillStyle(0xffffff, 1)
    sp.beginPath()
    sp.moveTo(8, 0)
    sp.lineTo(10, 6)
    sp.lineTo(16, 8)
    sp.lineTo(10, 10)
    sp.lineTo(8, 16)
    sp.lineTo(6, 10)
    sp.lineTo(0, 8)
    sp.lineTo(6, 6)
    sp.fillPath()
    sp.generateTexture('sparkle', 16, 16)
    sp.destroy()
    
    // Bubble
    const bb = this.make.graphics({ x: 0, y: 0 }, false)
    bb.lineStyle(2, 0xffffff, 0.8)
    bb.strokeCircle(8, 8, 6)
    bb.generateTexture('bubble', 16, 16)
    bb.destroy()

    // We don't have real audio assets so we omit them to prevent loading errors.
  }
}
