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
    this.load.image('vehicle_0', 'assets/vehicles/vehicle_0.png')
    // ── Placeholder textures (generated at runtime — no files needed) ────────

    const w = 180
    const h = 340 // Base vehicle size

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

    // ── Tool icons — each nozzle has a distinct silhouette ───────────────────

    // FAN — wide blue arc (wide sponge / fan spray)
    const fanGfx = this.make.graphics({ x: 0, y: 0 }, false)
    fanGfx.fillStyle(0x3498db)
    fanGfx.fillTriangle(24, 4, 4, 44, 44, 44)    // wide triangle = fan shape
    fanGfx.fillStyle(0x5dade2, 0.7)
    fanGfx.fillRect(20, 40, 8, 8)                 // handle stub
    fanGfx.generateTexture('tool_fan', 48, 48)
    fanGfx.destroy()

    // JET — narrow teal cone (high-pressure jet)
    const jetGfx = this.make.graphics({ x: 0, y: 0 }, false)
    jetGfx.fillStyle(0x1abc9c)
    jetGfx.fillTriangle(24, 4, 20, 44, 28, 44)   // narrow triangle = jet
    jetGfx.fillStyle(0x16a085)
    jetGfx.fillRect(22, 38, 4, 10)               // nozzle body
    jetGfx.generateTexture('tool_jet', 48, 48)
    jetGfx.destroy()

    // HOT — orange circle with steam dots (hot steam nozzle)
    const hotGfx = this.make.graphics({ x: 0, y: 0 }, false)
    hotGfx.fillStyle(0xe67e22)
    hotGfx.fillCircle(24, 32, 16)                // main body
    hotGfx.fillStyle(0xffffff, 0.8)
    hotGfx.fillCircle(18, 14, 4)                 // steam dot
    hotGfx.fillCircle(24, 9, 3)                  // steam dot
    hotGfx.fillCircle(30, 14, 4)                 // steam dot
    hotGfx.generateTexture('tool_hot', 48, 48)
    hotGfx.destroy()

    // ── Vehicle 5 — Van (grey, boxy) ─────────────────────────────────────────
    const v5 = this.make.graphics({ x: 0, y: 0 }, false)
    v5.fillStyle(0x7f8c8d)
    v5.fillRoundedRect(0, 0, 180, 380, 10)
    v5.fillStyle(0x222222)
    v5.fillRoundedRect(15, 30, 150, 50, 8)       // front window
    v5.fillRoundedRect(15, 160, 150, 30, 5)      // side window strip
    v5.fillStyle(0x555555)
    v5.fillRect(10, 340, 70, 40)                 // rear door left
    v5.fillRect(100, 340, 70, 40)                // rear door right
    v5.generateTexture('vehicle_5', 180, 380)
    v5.destroy()

    // ── Vehicle 6 — Bus (green, wide) ─────────────────────────────────────────
    const v6 = this.make.graphics({ x: 0, y: 0 }, false)
    v6.fillStyle(0x27ae60)
    v6.fillRoundedRect(0, 0, 210, 400, 8)
    v6.fillStyle(0x222222)
    for (let i = 0; i < 4; i++) {               // row of bus windows
      v6.fillRoundedRect(10, 30 + i * 80, 190, 50, 6)
    }
    v6.generateTexture('vehicle_6', 210, 400)
    v6.destroy()

    // ── Vehicle 7 — ATV (brown, chunky, no roof) ──────────────────────────────
    const v7 = this.make.graphics({ x: 0, y: 0 }, false)
    v7.fillStyle(0xa04000)
    v7.fillRoundedRect(20, 60, 160, 200, 12)    // body
    v7.fillStyle(0x222222)
    v7.fillCircle(40, 280, 35)                  // rear wheel
    v7.fillCircle(160, 280, 35)                 // front wheel
    v7.fillCircle(40, 60, 25)                   // rear top wheel arch
    v7.fillCircle(160, 60, 25)                  // front top wheel arch
    v7.fillStyle(0xa04000)
    v7.fillCircle(40, 60, 18)
    v7.fillCircle(160, 60, 18)
    v7.generateTexture('vehicle_7', 200, 320)
    v7.destroy()

    // ── Vehicle 8 — Buggy (yellow, open frame) ────────────────────────────────
    const v8 = this.make.graphics({ x: 0, y: 0 }, false)
    v8.fillStyle(0xf39c12)
    v8.fillRoundedRect(40, 80, 120, 160, 8)     // seat/frame centre
    v8.lineStyle(6, 0xd68910)
    v8.strokeRect(20, 40, 160, 240)             // roll cage outline
    v8.fillStyle(0x222222)
    v8.fillCircle(35, 290, 30)                  // wheel
    v8.fillCircle(165, 290, 30)                 // wheel
    v8.generateTexture('vehicle_8', 200, 340)
    v8.destroy()

    // ── Vehicle 9 — Engine Block (dark metal, novelty object) ─────────────────
    const v9 = this.make.graphics({ x: 0, y: 0 }, false)
    v9.fillStyle(0x424242)
    v9.fillRect(10, 10, 160, 280)               // block body
    v9.fillStyle(0x616161)
    for (let i = 0; i < 3; i++) {              // cylinder tops
      v9.fillCircle(40 + i * 40, 40, 18)
    }
    v9.fillStyle(0x333333)
    v9.fillRoundedRect(15, 90, 150, 60, 5)     // oil pan
    v9.fillStyle(0x888888)
    v9.fillRect(60, 200, 60, 80)               // exhaust block
    v9.generateTexture('vehicle_9', 180, 300)
    v9.destroy()

    // ── Particle — small white dot ─────────────────────────────────────────────
    const particleGfx = this.make.graphics({ x: 0, y: 0 }, false)
    particleGfx.fillStyle(0xffffff, 0.8)
    particleGfx.fillCircle(4, 4, 4)
    particleGfx.generateTexture('particle', 8, 8)
    particleGfx.destroy()

    // ── Sparkle ────────────────────────────────────────────────────────────────
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

    // ── Bubble ─────────────────────────────────────────────────────────────────
    const bb = this.make.graphics({ x: 0, y: 0 }, false)
    bb.lineStyle(2, 0xffffff, 0.8)
    bb.strokeCircle(8, 8, 6)
    bb.generateTexture('bubble', 16, 16)
    bb.destroy()

    // We don't have real audio assets so we omit them to prevent loading errors.
  }
}

