import { AudioManager } from '../core/AudioManager'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { SaveManager, SAVE_KEYS } from '../core/SaveManager'
import { getLevel, calcStars, isLastLevel, LevelConfig } from '../data/levels'

const CX = GAME_CONFIG.width / 2
const CY = GAME_CONFIG.height / 2

interface GameInitData {
  /** 1-based level id. Defaults to the player's saved current level. */
  levelId?: number
}

export class GameScene extends Phaser.Scene {
  private dirtRT!: Phaser.GameObjects.RenderTexture
  private brush!: Phaser.GameObjects.Graphics

  // Level
  private level!: LevelConfig

  // UI
  private progressText!: Phaser.GameObjects.Text
  private progressFill!: Phaser.GameObjects.Rectangle
  private timerText!: Phaser.GameObjects.Text
  private toolIcons: Record<string, Phaser.GameObjects.Image> = {}
  private readonly progressBarW = GAME_CONFIG.width - 40

  // Particles
  private effectEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private sparkleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter

  // Game State
  private activeTool: keyof typeof BALANCING.tools = 'widesponge'
  private grid: boolean[][] = []
  private readonly CELL_SIZE = 10
  private totalCells = 0
  private cleanCells = 0
  private timeElapsedMs = 0
  private totalWipeCalls = 0
  private wasteWipeCalls = 0
  private isFinished = false
  private maskLeft = 0
  private maskTop = 0
  private maskWidth = 0
  private maskHeight = 0
  private prevPointerX = 0
  private prevPointerY = 0

  // Tutorial
  private tutorialContainer!: Phaser.GameObjects.Container
  private tutorialTween!: Phaser.Tweens.Tween
  private hasPlayerStarted = false

  constructor() {
    super({ key: 'GameScene' })
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  init(data: GameInitData): void {
    // Fall back to saved progress when no explicit level is given
    const savedLevel = SaveManager.load<number>(SAVE_KEYS.currentLevel, 1)
    const levelId = data?.levelId ?? savedLevel
    this.level = getLevel(levelId)
  }

  create(): void {
    this.cameras.main.setBackgroundColor(config.game.backgroundColor)
    this.cameras.main.fadeIn(BALANCING.sceneFadeDuration, 0, 0, 0)

    this.isFinished = false
    this.timeElapsedMs = 0
    this.totalWipeCalls = 0
    this.wasteWipeCalls = 0
    this.activeTool = 'widesponge'
    this.toolIcons = {}

    this.hasPlayerStarted = false

    this.createWorld()
    this.createVehicleAndDirt()
    this.createParticles()
    this.createHUD()
    this.createToolsUI()
    this.setupInput()

    this.brush = this.make.graphics()
    this.updateBrush()

    // Show tutorial shortly after gameplay is visible
    this.time.delayedCall(600, () => this.createTutorial())
  }

  update(_time: number, delta: number): void {
    if (this.isFinished) return
    this.timeElapsedMs += delta
    this.timerText.setText(`${Math.floor(this.timeElapsedMs / 1000)}s`)
  }

  shutdown(): void {
    this.input.off(Phaser.Input.Events.POINTER_DOWN)
    this.input.off(Phaser.Input.Events.POINTER_MOVE)
    if (this.tutorialTween?.isPlaying()) this.tutorialTween.stop()
  }

  // ─── Tutorial ────────────────────────────────────────────────────────────

  private createTutorial(): void {
    if (this.hasPlayerStarted || this.isFinished) return

    // Anchor the tutorial over the centre of the vehicle
    const handX = CX
    const handY = this.maskTop + this.maskHeight * 0.35
    const dragDist = 60 // px the hand will scrub left→right

    // ── Hand graphic (finger pointing down) ──────────────────────────────────
    const handGfx = this.make.graphics({ x: 0, y: 0 }, false)
    // Finger body
    handGfx.fillStyle(0xffe0c8, 1)
    handGfx.fillRoundedRect(-10, -30, 20, 40, 8)
    // Fingernail
    handGfx.fillStyle(0xffb8a0, 1)
    handGfx.fillRoundedRect(-8, -30, 16, 12, 5)
    // Knuckle bump
    handGfx.fillStyle(0xffd0b0, 1)
    handGfx.fillCircle(0, 12, 14)
    handGfx.fillStyle(0xffe0c8, 1)
    handGfx.fillCircle(0, 12, 10)
    // Tip dot
    handGfx.fillStyle(0xffc8a0, 1)
    handGfx.fillCircle(0, -30, 8)

    const handTex = handGfx.generateTexture('__tutorial_hand__', 48, 64)
    handGfx.destroy()
    void handTex  // suppress unused warning

    const hand = this.add.image(0, 0, '__tutorial_hand__').setOrigin(0.5, 0)

    // ── Ripple circle under the finger tip ───────────────────────────────────
    const ripple = this.add.graphics()
    ripple.lineStyle(2, 0xffffff, 0.6)
    ripple.strokeCircle(0, -30, 14)

    // ── "Drag to wash" label ──────────────────────────────────────────────────
    const label = this.add.text(0, 52, 'Drag to wash', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      resolution: 2
    }).setOrigin(0.5, 0)

    // Container at start of scrub range
    this.tutorialContainer = this.add.container(handX - dragDist / 2, handY, [ripple, hand, label])
    this.tutorialContainer.setDepth(100)

    // ── Looping scrub tween ───────────────────────────────────────────────────
    this.tutorialTween = this.tweens.add({
      targets: this.tutorialContainer,
      x: handX + dragDist / 2,
      duration: 800,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
      onStart: () => {
        // Pulse in
        this.tweens.add({
          targets: this.tutorialContainer,
          scaleX: { from: 0, to: 1 },
          scaleY: { from: 0, to: 1 },
          duration: 250,
          ease: 'Back.Out'
        })
      }
    })

    // Pulse the ripple alpha
    this.tweens.add({
      targets: ripple,
      alpha: { from: 0.8, to: 0 },
      scaleX: { from: 1, to: 2 },
      scaleY: { from: 1, to: 2 },
      duration: 700,
      repeat: -1,
      ease: 'Quad.Out'
    })
  }

  private dismissTutorial(): void {
    if (this.hasPlayerStarted) return
    this.hasPlayerStarted = true

    if (this.tutorialTween?.isPlaying()) this.tutorialTween.stop()

    if (this.tutorialContainer) {
      this.tweens.add({
        targets: this.tutorialContainer,
        alpha: 0,
        scaleX: 0.8,
        scaleY: 0.8,
        duration: 200,
        ease: 'Quad.In',
        onComplete: () => this.tutorialContainer.destroy()
      })
    }
  }

  // ─── World ────────────────────────────────────────────────────────────────

  private createWorld(): void {
    const bg = this.add.graphics()
    bg.fillStyle(0x34495e, 1)
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)

    bg.lineStyle(4, 0x2c3e50, 0.5)
    bg.beginPath()
    bg.moveTo(CX - 150, 0)
    bg.lineTo(CX - 150, GAME_CONFIG.height)
    bg.moveTo(CX + 150, 0)
    bg.lineTo(CX + 150, GAME_CONFIG.height)
    bg.strokePath()
  }

  private createVehicleAndDirt(): void {
    const vt = this.level.vehicleType
    const vKey = `vehicle_${vt}`

    // Size matches generated textures in PreloadScene
    let vw = 180
    let vh = 340
    if (vt === 1) { vw += 20; vh += 40 }  // SUV
    if (vt === 3) { vw += 30; vh += 60 }  // Truck

    this.maskLeft = CX - vw / 2
    this.maskTop = CY - 80 - vh / 2
    this.maskWidth = vw
    this.maskHeight = vh

    // Shadow
    const shadow = this.add.graphics()
    shadow.fillStyle(0x000000, 0.4)
    shadow.fillRoundedRect(this.maskLeft + 10, this.maskTop + 10, vw, vh, 20)

    // Vehicle sprite (centered on CX, CY-80)
    this.add.sprite(CX, CY - 80, vKey)

    // Dirt RenderTexture exactly overlays the vehicle
    this.dirtRT = this.add.renderTexture(this.maskLeft, this.maskTop, vw, vh)
    this.dirtRT.setOrigin(0, 0)
    this.drawDirt(vw, vh)

    // Logical grid for % tracking
    this.grid = []
    this.totalCells = 0
    this.cleanCells = 0
    const cols = Math.ceil(vw / this.CELL_SIZE)
    const rows = Math.ceil(vh / this.CELL_SIZE)
    for (let r = 0; r < rows; r++) {
      this.grid[r] = []
      for (let c = 0; c < cols; c++) {
        this.grid[r][c] = false
        this.totalCells++
      }
    }
  }

  private drawDirt(vw: number, vh: number): void {
    const dirtGen = this.make.graphics()
    const dt = this.level.dirtType

    if (dt === 'dust') {
      dirtGen.fillStyle(0xaaaaaa, 0.85)
      dirtGen.fillRect(0, 0, vw, vh)
      // Slightly uneven blotches
      dirtGen.fillStyle(0x888888, 0.4)
      for (let i = 0; i < 30; i++) {
        dirtGen.fillCircle(
          Phaser.Math.Between(0, vw),
          Phaser.Math.Between(0, vh),
          Phaser.Math.Between(15, 50)
        )
      }
    } else {
      // mud / oil / rust — richer colour, more blobs
      const base  = dt === 'mud' ? 0x8c7b70 : dt === 'oil' ? 0x2c2c2c : 0x8b3a1a
      const blob  = dt === 'mud' ? 0x5e524a : dt === 'oil' ? 0x111111 : 0x6b2a10
      dirtGen.fillStyle(base, 0.9)
      dirtGen.fillRect(0, 0, vw, vh)
      dirtGen.fillStyle(blob, 0.95)
      for (let i = 0; i < 60; i++) {
        dirtGen.fillCircle(
          Phaser.Math.Between(0, vw),
          Phaser.Math.Between(0, vh),
          Phaser.Math.Between(10, 40)
        )
      }
    }

    this.dirtRT.draw(dirtGen, 0, 0)
    dirtGen.destroy()
  }

  // ─── Particles ───────────────────────────────────────────────────────────

  private createParticles(): void {
    this.effectEmitter = this.add.particles(0, 0, 'particle', {
      speed: { min: 20, max: 60 },
      alpha: { start: 1, end: 0 },
      scale: { start: 1, end: 0.5 },
      lifespan: 400,
      frequency: -1
    })
    this.effectEmitter.setDepth(20)

    this.sparkleEmitter = this.add.particles(0, 0, 'sparkle', {
      speed: { min: 50, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 1500,
      gravityY: 100,
      frequency: -1
    })
    this.sparkleEmitter.setDepth(50)
  }

  // ─── HUD ──────────────────────────────────────────────────────────────────

  private createHUD(): void {
    const barW = this.progressBarW
    const barX = 20
    const barY = 20
    const barH = 18

    // Track
    this.add.rectangle(barX, barY, barW, barH, 0x16213e).setOrigin(0, 0)

    // Fill
    this.progressFill = this.add.rectangle(barX, barY, 0, barH, 0x4a90d9).setOrigin(0, 0)

    // Percentage label centred over bar
    this.progressText = this.add.text(barX + barW / 2, barY + barH / 2, '0%', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    // Level name (top-left below bar)
    this.add.text(20, 46, `Lvl ${this.level.id}  ${this.level.name}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#aaaacc'
    }).setOrigin(0, 0)

    // Timer (top-right)
    this.timerText = this.add.text(GAME_CONFIG.width - 20, 46, '0s', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#aaaacc',
      fontStyle: 'bold'
    }).setOrigin(1, 0)
  }

  // ─── Tools UI ─────────────────────────────────────────────────────────────

  private createToolsUI(): void {
    const toolKeys = Object.keys(BALANCING.tools) as Array<keyof typeof BALANCING.tools>
    const spacing = 100
    const startX = CX - ((toolKeys.length - 1) * spacing) / 2

    toolKeys.forEach((key, idx) => {
      const x = startX + idx * spacing
      const y = GAME_CONFIG.height - 70

      const bg = this.add.circle(x, y, 36, 0x16213e).setInteractive()
      const icon = this.add.image(x, y, 'tool_' + key).setScale(1.2)
      this.toolIcons[key] = icon

      this.add.text(x, y + 40, BALANCING.tools[key].name, {
        fontSize: '10px',
        color: '#aaaacc',
        fontFamily: 'Arial, sans-serif'
      }).setOrigin(0.5)

      bg.on('pointerdown', () => {
        this.activeTool = key
        this.updateToolHighlight()
        this.updateBrush()
      })
    })

    this.updateToolHighlight()
  }

  private updateToolHighlight(): void {
    for (const key of Object.keys(this.toolIcons)) {
      const active = key === this.activeTool
      this.toolIcons[key].setScale(active ? 1.4 : 1.0)
      this.toolIcons[key].setAlpha(active ? 1.0 : 0.5)
    }
  }

  private updateBrush(): void {
    this.brush.clear()
    const { radius, strength } = BALANCING.tools[this.activeTool]
    // Strength doubles as alpha; RT.erase is effectively binary but we keep it
    // for when the real brush shaders are added in M5.
    this.brush.fillStyle(0xffffff, strength)
    this.brush.fillCircle(radius, radius, radius)
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (ptr: Phaser.Input.Pointer) => {
      if (this.isFinished) return
      const point = this.getPointerPosition(ptr)
      this.prevPointerX = point.sceneX
      this.prevPointerY = point.sceneY
      this.handleWipe(point.localX, point.localY)
    })

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || this.isFinished) return

      const point = this.getPointerPosition(ptr)
      const dist = Phaser.Math.Distance.Between(
        this.prevPointerX,
        this.prevPointerY,
        point.sceneX,
        point.sceneY
      )
      const steps = Math.max(1, Math.floor(dist / 10))

      // Dismiss tutorial on first real drag over the vehicle
      if (!this.hasPlayerStarted) {
        const lx = point.sceneX - this.maskLeft
        const ly = point.sceneY - this.maskTop
        if (lx >= 0 && ly >= 0 && lx <= this.maskWidth && ly <= this.maskHeight) {
          this.dismissTutorial()
        }
      }

      for (let i = 0; i <= steps; i++) {
        const tx = Phaser.Math.Interpolation.Linear([this.prevPointerX, point.sceneX], i / steps)
        const ty = Phaser.Math.Interpolation.Linear([this.prevPointerY, point.sceneY], i / steps)
        this.handleWipe(tx - this.maskLeft, ty - this.maskTop)
      }

      this.prevPointerX = point.sceneX
      this.prevPointerY = point.sceneY

      // Dirt-spray particles near pointer
      const rad = BALANCING.tools[this.activeTool].radius
      this.effectEmitter.emitParticleAt(
        point.sceneX + Phaser.Math.Between(-rad / 2, rad / 2),
        point.sceneY + Phaser.Math.Between(-rad / 2, rad / 2)
      )
    })
  }

  private getPointerPosition(ptr: Phaser.Input.Pointer): {
    sceneX: number
    sceneY: number
    localX: number
    localY: number
  } {
    const camera = this.cameras.main
    const cameraPosition = ptr.positionToCamera(camera) as Phaser.Math.Vector2
    const sceneX = Number.isFinite(ptr.worldX) ? ptr.worldX : cameraPosition.x
    const sceneY = Number.isFinite(ptr.worldY) ? ptr.worldY : cameraPosition.y

    return {
      sceneX,
      sceneY,
      localX: sceneX - this.maskLeft,
      localY: sceneY - this.maskTop
    }
  }

  // ─── Wipe Logic ───────────────────────────────────────────────────────────

  private handleWipe(localX: number, localY: number): void {
    const radius = BALANCING.tools[this.activeTool].radius

    if (
      localX < -radius ||
      localY < -radius ||
      localX > this.maskWidth + radius ||
      localY > this.maskHeight + radius
    ) {
      return
    }

    // Visual erase
    this.dirtRT.erase(this.brush, localX - radius, localY - radius)

    // Logical grid update
    let cellsCleanedNow = 0
    const startCol = Math.max(0, Math.floor((localX - radius) / this.CELL_SIZE))
    const gridCols = this.grid[0] ? this.grid[0].length - 1 : 0
    const endCol   = Math.min(gridCols, Math.floor((localX + radius) / this.CELL_SIZE))
    const startRow = Math.max(0, Math.floor((localY - radius) / this.CELL_SIZE))
    const endRow   = Math.min(this.grid.length - 1, Math.floor((localY + radius) / this.CELL_SIZE))

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (!this.grid[r][c]) {
          const cx = c * this.CELL_SIZE + this.CELL_SIZE / 2
          const cy = r * this.CELL_SIZE + this.CELL_SIZE / 2
          if (Phaser.Math.Distance.Between(cx, cy, localX, localY) <= radius) {
            this.grid[r][c] = true
            cellsCleanedNow++
            this.cleanCells++
          }
        }
      }
    }

    this.totalWipeCalls++
    if (cellsCleanedNow === 0) this.wasteWipeCalls++

    this.updateProgress()
  }

  // ─── Progress & Completion ────────────────────────────────────────────────

  private updateProgress(): void {
    const ratio = Math.min(1, this.cleanCells / this.totalCells)
    const pct   = Math.floor(ratio * 100)
    this.progressText.setText(`${pct}%`)
    this.progressFill.width = this.progressBarW * ratio

    if (pct >= 98 && !this.isFinished) {
      this.triggerComplete()
    }
  }

  private triggerComplete(): void {
    this.isFinished = true

    // Flash clear remaining dirt instantly
    this.dirtRT.clear()

    // Celebration
    this.sparkleEmitter.explode(100, CX, CY - 80)
    AudioManager.playSfx(this, 'sfx_score')

    // ── Scoring ──────────────────────────────────────────────────────────────
    const seconds = this.timeElapsedMs / 1000
    const timeBonus = Math.max(0.5, 2.0 - seconds / 60)
    const wasteFraction = this.totalWipeCalls > 0 ? this.wasteWipeCalls / this.totalWipeCalls : 0
    const efficiency = 1.0 - wasteFraction * 0.3
    const finalScore = Math.floor(BALANCING.baseScore * timeBonus * efficiency)

    const stars = calcStars(seconds, this.level.parTimeSeconds)

    // ── Persist progress ──────────────────────────────────────────────────────
    // High score
    let hs = SaveManager.load<number>(SAVE_KEYS.highScore, 0)
    let isNewHS = false
    if (finalScore > hs) {
      hs = finalScore
      isNewHS = true
      SaveManager.save(SAVE_KEYS.highScore, hs)
    }

    // Per-level stars (keep best)
    const allStars = SaveManager.load<Record<number, number>>(SAVE_KEYS.levelStars, {})
    if ((allStars[this.level.id] ?? 0) < stars) {
      allStars[this.level.id] = stars
      SaveManager.save(SAVE_KEYS.levelStars, allStars)
    }

    // Advance current level pointer (only if beating a new level)
    const savedCurrent = SaveManager.load<number>(SAVE_KEYS.currentLevel, 1)
    if (this.level.id >= savedCurrent && !isLastLevel(this.level.id)) {
      SaveManager.save(SAVE_KEYS.currentLevel, this.level.id + 1)
    }

    // Legacy completedCleans counter
    const done = SaveManager.load<number>(SAVE_KEYS.completedCleans, 0)
    SaveManager.save(SAVE_KEYS.completedCleans, done + 1)

    // ── Transition ────────────────────────────────────────────────────────────
    this.time.delayedCall(2000, () => {
      this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 255, 255, 255)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('ResultScene', {
          score: finalScore,
          highScore: hs,
          isNewHighScore: isNewHS,
          stars,
          levelId: this.level.id,
          levelName: this.level.name,
          isLastLevel: isLastLevel(this.level.id)
        })
      })
    })
  }
}
