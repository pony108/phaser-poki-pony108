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

interface GameDebugState {
  mode: 'game'
  sceneKey: string
  coordinateSystem: string
  level: {
    id: number
    name: string
    dirtType: string
    dirtLayers: number
  }
  progress: {
    percent: number
    cleanCells: number
    totalCells: number
  }
  timerSeconds: number
  activeTool: string
  availableTools: string[]
  effectiveTool: boolean
  tutorialVisible: boolean
  maskBounds: {
    left: number
    top: number
    width: number
    height: number
  }
  completion: {
    finished: boolean
    wasteRatio: number
  }
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
  private activeTool = 'fan'
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

  // Multi-layer dirt tracking
  private layerGrid: number[][] = []

  // Wrong-tool feedback
  private weakBrush!: Phaser.GameObjects.Graphics
  private wrongToolWarningText!: Phaser.GameObjects.Text
  private wrongToolWarningTimer = 0

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
    this.wrongToolWarningTimer = 0
    this.activeTool = 'fan'
    this.toolIcons = {}

    this.hasPlayerStarted = false

    this.createWorld()
    this.createVehicleAndDirt()
    this.createParticles()
    this.createHUD()
    this.checkAndUnlockTools()
    this.createToolsUI()
    this.setupInput()

    this.brush = this.make.graphics()
    this.weakBrush = this.make.graphics()
    this.updateBrush()

    // Wrong-tool flash text (hidden until needed)
    this.wrongToolWarningText = this.add.text(CX, CY + 30, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '20px',
      color: '#ffdd57',
      stroke: '#222222',
      strokeThickness: 5,
      resolution: 2
    }).setOrigin(0.5).setDepth(200).setAlpha(0)

    // Show tutorial shortly after gameplay is visible
    this.time.delayedCall(600, () => this.createTutorial())
  }

  update(_time: number, delta: number): void {
    if (this.isFinished) return
    this.timeElapsedMs += delta
    this.timerText.setText(`${Math.floor(this.timeElapsedMs / 1000)}s`)
    if (this.wrongToolWarningTimer > 0) this.wrongToolWarningTimer -= delta
  }

  shutdown(): void {
    this.input.off(Phaser.Input.Events.POINTER_DOWN)
    this.input.off(Phaser.Input.Events.POINTER_MOVE)
    if (this.tutorialTween?.isPlaying()) this.tutorialTween.stop()
  }

  // ─── Tutorial ────────────────────────────────────────────────────────────

  private createTutorial(): void {
    if (this.hasPlayerStarted || this.isFinished) return

    const handX = CX
    const handY = this.maskTop + this.maskHeight * 0.38
    const dragDist = 72 // px the hand scrubs left→right

    // ── Glow circle beneath the finger ───────────────────────────────────────
    const glow = this.add.graphics()
    glow.fillStyle(0xffffff, 0.18)
    glow.fillCircle(0, 8, 36)

    // ── Three motion-trail dots (left of hand, fading) ────────────────────────
    const trailDots = this.add.graphics()
    trailDots.fillStyle(0xffffff, 0.55)
    trailDots.fillCircle(-30, 8, 5)
    trailDots.fillStyle(0xffffff, 0.30)
    trailDots.fillCircle(-48, 8, 3.5)
    trailDots.fillStyle(0xffffff, 0.12)
    trailDots.fillCircle(-62, 8, 2)

    // ── Emoji hand — 👆 rotated 90° points right (scrub direction) ───────────
    const hand = this.add.text(0, 0, '👆', {
      fontSize: '52px',
      resolution: 2
    }).setOrigin(0.5, 0.5).setAngle(90)

    // ── "Drag to wash" label ──────────────────────────────────────────────────
    const label = this.add.text(0, 46, 'Drag to wash ✨', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '19px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#1a1a2e',
      strokeThickness: 5,
      resolution: 2
    }).setOrigin(0.5, 0)

    // Container starts at left of scrub range, hidden (scale 0)
    this.tutorialContainer = this.add.container(
      handX - dragDist / 2, handY,
      [glow, trailDots, hand, label]
    )
    this.tutorialContainer.setDepth(100).setScale(0)

    // ── Spring pop-in ─────────────────────────────────────────────────────────
    this.tweens.add({
      targets: this.tutorialContainer,
      scaleX: 1,
      scaleY: 1,
      duration: 320,
      ease: 'Back.Out'
    })

    // ── Looping scrub tween (starts after pop-in) ─────────────────────────────
    this.tutorialTween = this.tweens.add({
      targets: this.tutorialContainer,
      x: handX + dragDist / 2,
      duration: 700,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
      delay: 350
    })

    // ── Tilt the hand during scrub (±12°) ────────────────────────────────────
    this.tweens.add({
      targets: hand,
      angle: 78,           // 90° - 12° on left swing
      duration: 700,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
      delay: 350
    })

    // ── Trail dots flip direction on yoyo (mirror on right swing) ────────────
    this.tweens.add({
      targets: trailDots,
      scaleX: -1,          // mirror so dots trail behind on both directions
      duration: 700,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
      delay: 350
    })

    // ── Glow breathe ─────────────────────────────────────────────────────────
    this.tweens.add({
      targets: glow,
      alpha: { from: 1, to: 0.4 },
      scaleX: { from: 1, to: 1.5 },
      scaleY: { from: 1, to: 1.5 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    })

    // ── Label gentle bob ─────────────────────────────────────────────────────
    this.tweens.add({
      targets: label,
      y: { from: 46, to: 52 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
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

    // Dimensions must match textures generated in PreloadScene.loadAssets()
    const sizes: Record<number, [number, number]> = {
      0: [180, 340], // sedan
      1: [200, 380], // sports (was SUV +20/+40)
      2: [180, 340], // pickup
      3: [210, 400], // big truck (+30/+60)
      4: [180, 340], // vintage
      5: [180, 380], // van
      6: [210, 400], // bus
      7: [200, 320], // ATV
      8: [200, 340], // buggy
      9: [180, 300]  // engine block
    }
    const [vw, vh] = sizes[vt] ?? [180, 340]

    this.maskLeft = CX - vw / 2
    this.maskTop = CY - 80 - vh / 2
    this.maskWidth = vw
    this.maskHeight = vh

    // Shadow
    const shadow = this.add.graphics()
    shadow.fillStyle(0x000000, 0.4)
    shadow.fillRoundedRect(this.maskLeft + 10, this.maskTop + 10, vw, vh, 20)

    // Vehicle sprite
    this.add.sprite(CX, CY - 80, vKey)

    // Dirt RenderTexture exactly overlays the vehicle
    this.dirtRT = this.add.renderTexture(this.maskLeft, this.maskTop, vw, vh)
    this.dirtRT.setOrigin(0, 0)
    this.drawDirt(vw, vh)

    // Logical grids for % tracking
    this.grid = []
    this.layerGrid = []
    this.totalCells = 0
    this.cleanCells = 0
    const cols = Math.ceil(vw / this.CELL_SIZE)
    const rows = Math.ceil(vh / this.CELL_SIZE)
    for (let r = 0; r < rows; r++) {
      this.grid[r] = []
      this.layerGrid[r] = []
      for (let c = 0; c < cols; c++) {
        this.grid[r][c] = false
        this.layerGrid[r][c] = this.level.dirtLayers
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

    // Level name + dirt type badge (top-left below bar)
    const dirtLabels: Record<string, string> = {
      dust: '💨 DUST', mud: '🟫 MUD', oil: '🖤 OIL', rust: '🔶 RUST'
    }
    const layerDots = '●'.repeat(this.level.dirtLayers)
    this.add.text(20, 46, `Lvl ${this.level.id}  ${this.level.name}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#aaaacc'
    }).setOrigin(0, 0)

    this.add.text(GAME_CONFIG.width / 2, 46,
      `${dirtLabels[this.level.dirtType] ?? this.level.dirtType}  ${layerDots}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#ffcc88'
    }).setOrigin(0.5, 0)

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
    // Only show tools the player has unlocked
    const unlockedTools = SaveManager.load<string[]>(SAVE_KEYS.unlockedTools, ['fan'])
    const allKeys = Object.keys(BALANCING.tools)
    const toolKeys = allKeys.filter(k => unlockedTools.includes(k))
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
    const tool = BALANCING.tools[this.activeTool]
    const { radius, strength } = tool

    this.brush.clear()
    this.brush.fillStyle(0xffffff, strength)
    this.brush.fillCircle(radius, radius, radius)

    // Weak brush for wrong-tool passes: same radius, 20% alpha
    this.weakBrush.clear()
    this.weakBrush.fillStyle(0xffffff, strength * BALANCING.wrongToolStrengthFactor)
    this.weakBrush.fillCircle(radius, radius, radius)
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (ptr: Phaser.Input.Pointer) => {
      if (this.isFinished) return
      const point = this.getPointerPosition(ptr)
      if (!this.hasPlayerStarted && point.localX >= 0 && point.localY >= 0 && point.localX <= this.maskWidth && point.localY <= this.maskHeight) {
        this.dismissTutorial()
      }
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
      if (!this.hasPlayerStarted && point.localX >= 0 && point.localY >= 0 && point.localX <= this.maskWidth && point.localY <= this.maskHeight) {
        this.dismissTutorial()
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
    const tool = BALANCING.tools[this.activeTool]
    const radius = tool.radius

    if (
      localX < -radius ||
      localY < -radius ||
      localX > this.maskWidth + radius ||
      localY > this.maskHeight + radius
    ) {
      return
    }

    // Check tool effectiveness against current dirt type
    const isEffective = tool.primaryDirt.includes(this.level.dirtType)
    const layerReduction = isEffective ? 1.0 : BALANCING.wrongToolStrengthFactor

    if (isEffective) {
      this.dirtRT.erase(this.brush, localX - radius, localY - radius)
    } else {
      this.dirtRT.erase(this.weakBrush, localX - radius, localY - radius)
      this.showWrongToolWarning()
    }

    // Logical grid update (layerGrid drives cell completion)
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
            this.layerGrid[r][c] = Math.max(0, this.layerGrid[r][c] - layerReduction)
            if (this.layerGrid[r][c] <= 0) {
              this.grid[r][c] = true
              cellsCleanedNow++
              this.cleanCells++
            }
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

    // Mark level as completed (for world-unlock threshold)
    const completed = SaveManager.load<Record<number, boolean>>(SAVE_KEYS.levelCompleted, {})
    completed[this.level.id] = true
    SaveManager.save(SAVE_KEYS.levelCompleted, completed)

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

  // ─── Tool Unlock ──────────────────────────────────────────────────────────

  private checkAndUnlockTools(): void {
    const unlocked = SaveManager.load<string[]>(SAVE_KEYS.unlockedTools, ['fan'])
    const newlyUnlocked: string[] = []

    for (const [key, unlockLevel] of Object.entries(BALANCING.toolUnlockAtLevel)) {
      if (this.level.id >= unlockLevel && !unlocked.includes(key)) {
        unlocked.push(key)
        newlyUnlocked.push(key)
      }
    }

    if (newlyUnlocked.length > 0) {
      SaveManager.save(SAVE_KEYS.unlockedTools, unlocked)
      // Rebuild tool UI with new tools
      newlyUnlocked.forEach(k => this.showToolUnlockBanner(k))
    }
  }

  private showToolUnlockBanner(toolKey: string): void {
    const tool = BALANCING.tools[toolKey]
    if (!tool) return

    const banner = this.add.text(CX, GAME_CONFIG.height - 130,
      `🔧 NEW NOZZLE: ${tool.name}!`, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      stroke: '#1a1a2e',
      strokeThickness: 6,
      resolution: 2
    }).setOrigin(0.5).setDepth(300).setAlpha(0).setScale(0.5)

    this.tweens.add({
      targets: banner,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 350,
      ease: 'Back.Out',
      onComplete: () => {
        this.time.delayedCall(2200, () => {
          this.tweens.add({
            targets: banner,
            alpha: 0,
            y: GAME_CONFIG.height - 160,
            duration: 400,
            ease: 'Quad.In',
            onComplete: () => banner.destroy()
          })
        })
      }
    })
  }

  // ─── Wrong-Tool Warning ───────────────────────────────────────────────────

  private showWrongToolWarning(): void {
    if (this.wrongToolWarningTimer > 0) return
    this.wrongToolWarningTimer = BALANCING.wrongToolWarningCooldown

    const betterTool = this.getBetterToolName()
    this.wrongToolWarningText.setText(`⚠️ Try ${betterTool}!`)
    this.wrongToolWarningText.setAlpha(1)

    this.tweens.killTweensOf(this.wrongToolWarningText)
    this.tweens.add({
      targets: this.wrongToolWarningText,
      alpha: 0,
      y: CY + 10,
      duration: 1200,
      delay: 600,
      ease: 'Quad.In',
      onComplete: () => {
        this.wrongToolWarningText.setY(CY + 30)
      }
    })
  }

  private getBetterToolName(): string {
    const dt = this.level.dirtType
    if (dt === 'rust' || dt === 'oil') return 'JET'
    if (dt === 'mud') return 'HOT'
    return 'JET'
  }

  public getDebugState(): GameDebugState {
    const availableTools = Object.keys(this.toolIcons)
    const progressRatio = this.totalCells > 0 ? this.cleanCells / this.totalCells : 0
    const wasteRatio = this.totalWipeCalls > 0 ? this.wasteWipeCalls / this.totalWipeCalls : 0

    return {
      mode: 'game',
      sceneKey: this.scene.key,
      coordinateSystem: 'Origin is top-left. X increases right, Y increases down.',
      level: {
        id: this.level.id,
        name: this.level.name,
        dirtType: this.level.dirtType,
        dirtLayers: this.level.dirtLayers
      },
      progress: {
        percent: Math.floor(progressRatio * 100),
        cleanCells: this.cleanCells,
        totalCells: this.totalCells
      },
      timerSeconds: Math.floor(this.timeElapsedMs / 1000),
      activeTool: this.activeTool,
      availableTools,
      effectiveTool: BALANCING.tools[this.activeTool].primaryDirt.includes(this.level.dirtType),
      tutorialVisible: !this.hasPlayerStarted && !!this.tutorialContainer?.active,
      maskBounds: {
        left: this.maskLeft,
        top: this.maskTop,
        width: this.maskWidth,
        height: this.maskHeight
      },
      completion: {
        finished: this.isFinished,
        wasteRatio: Number(wasteRatio.toFixed(2))
      }
    }
  }
}
