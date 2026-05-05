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
    this.load.image('vehicle_1', 'assets/vehicles/vehicle_1.png')
    this.load.image('vehicle_2', 'assets/vehicles/vehicle_2.png')
    this.load.image('vehicle_3', 'assets/vehicles/vehicle_3.png')
    this.load.image('vehicle_4', 'assets/vehicles/vehicle_4.png')
    this.load.image('vehicle_9', 'assets/vehicles/vehicle_9.png')
    this.load.audio('spray_loop', 'assets/audio/spray_loop.wav')
    this.load.audio('sfx_clear', 'assets/audio/sfx_clear.wav')
    this.load.audio('sfx_switch', 'assets/audio/sfx_switch.wav')
    this.load.audio('sfx_score', 'assets/audio/sfx_score.wav')
    // ── Placeholder textures (generated at runtime — no files needed) ────────


    // ── Tool icons — each nozzle has a distinct silhouette ───────────────────

    // FAN — wide blue arc (wide sponge / fan spray)
    const fanGfx = this.make.graphics({ x: 0, y: 0 }, false)
    fanGfx.fillStyle(0x3498db)
    fanGfx.fillTriangle(24, 4, 4, 44, 44, 44)    // wide triangle = fan shape
    fanGfx.fillStyle(0x5dade2, 0.7)
    fanGfx.fillRect(20, 40, 8, 8)                 // handle stub
    fanGfx.generateTexture('tool_fan', 48, 48)
    fanGfx.destroy()

    // FOAM - soft white blob with bubbles (pre-treatment)
    const foamGfx = this.make.graphics({ x: 0, y: 0 }, false)
    foamGfx.fillStyle(0xeaf8ff, 0.95)
    foamGfx.fillCircle(18, 26, 13)
    foamGfx.fillCircle(30, 25, 12)
    foamGfx.fillCircle(24, 16, 10)
    foamGfx.fillCircle(24, 34, 11)
    foamGfx.fillStyle(0x7ed6ff, 0.55)
    foamGfx.fillCircle(15, 16, 4)
    foamGfx.fillCircle(33, 35, 4)
    foamGfx.fillCircle(24, 25, 3)
    foamGfx.generateTexture('tool_foam', 48, 48)
    foamGfx.destroy()

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

    const foamBubble = this.make.graphics({ x: 0, y: 0 }, false)
    foamBubble.fillStyle(0xffffff, 0.9)
    foamBubble.fillCircle(8, 8, 7)
    foamBubble.lineStyle(2, 0xbfe9ff, 0.8)
    foamBubble.strokeCircle(8, 8, 6)
    foamBubble.fillStyle(0xeaf8ff, 0.65)
    foamBubble.fillCircle(5, 5, 2)
    foamBubble.generateTexture('fx_foam_bubble', 16, 16)
    foamBubble.destroy()

    const steam = this.make.graphics({ x: 0, y: 0 }, false)
    steam.fillStyle(0xffffff, 0.45)
    steam.fillEllipse(8, 10, 10, 14)
    steam.fillStyle(0xffe1bd, 0.28)
    steam.fillEllipse(9, 9, 7, 12)
    steam.generateTexture('fx_steam', 16, 20)
    steam.destroy()

    const dustMote = this.make.graphics({ x: 0, y: 0 }, false)
    dustMote.fillStyle(0xc6c0b4, 0.78)
    dustMote.fillCircle(4, 4, 4)
    dustMote.fillStyle(0x8f8a80, 0.45)
    dustMote.fillCircle(6, 5, 2)
    dustMote.generateTexture('fx_dust_mote', 10, 10)
    dustMote.destroy()

    const jetSplash = this.make.graphics({ x: 0, y: 0 }, false)
    jetSplash.fillStyle(0xb7f1ff, 0.95)
    jetSplash.fillTriangle(8, 0, 2, 16, 14, 16)
    jetSplash.fillStyle(0xffffff, 0.75)
    jetSplash.fillCircle(8, 13, 3)
    jetSplash.generateTexture('fx_jet_splash', 16, 18)
    jetSplash.destroy()

    const weakScratch = this.make.graphics({ x: 0, y: 0 }, false)
    weakScratch.lineStyle(2, 0xffffff, 0.55)
    weakScratch.beginPath()
    weakScratch.moveTo(2, 10)
    weakScratch.lineTo(14, 5)
    weakScratch.strokePath()
    weakScratch.lineStyle(1, 0xffb0a8, 0.45)
    weakScratch.beginPath()
    weakScratch.moveTo(4, 14)
    weakScratch.lineTo(13, 11)
    weakScratch.strokePath()
    weakScratch.generateTexture('fx_weak_scratch', 16, 16)
    weakScratch.destroy()

    // We don't have real audio assets so we omit them to prevent loading errors.
  }
}

