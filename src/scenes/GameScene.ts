import { AudioManager } from '../core/AudioManager'
import { Analytics } from '../core/Analytics'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { SaveManager, SAVE_KEYS } from '../core/SaveManager'
import { getLevel, calcStars, isLastLevel, levelIndexInWorld, levelsInWorld, LevelConfig, worldName } from '../data/levels'
import { getVehicleParts, VehiclePartDefinition } from '../data/vehicleParts'
import { EconomySystem } from '../systems/EconomySystem'
import { UpgradeSystem } from '../systems/UpgradeSystem'

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
  phase: 'arrival' | 'cleaning' | 'complete'
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
  recommendedTool: string
  prep: {
    required: boolean
    percent: number
    preppedCells: number
    totalCells: number
  }
  feedbackMessage: string
  customerBubbleVisible: boolean
  cash: number
  ownedUpgrades: Record<string, number>
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
  bonusZones: {
    total: number
    completed: number
    score: number
    zones: Array<{
      x: number
      y: number
      width: number
      height: number
      completed: boolean
    }>
  }
  parts: {
    total: number
    completed: number
    cashBonus: number
    currentHint: string
    items: Array<{
      key: string
      label: string
      completed: boolean
      progress: number
    }>
  }
  progression: {
    world: number
    worldName: string
    levelInWorld: number
    worldCompleted: number
    worldTotal: number
    unlockedTools: number
    totalTools: number
    nextUnlock: string
  }
}

interface BonusZoneState {
  localX: number
  localY: number
  width: number
  height: number
  centerX: number
  centerY: number
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
  totalCells: number
  remainingCells: number
  completed: boolean
  overlay: Phaser.GameObjects.Rectangle
}

interface PartState {
  key: string
  label: string
  rects: VehiclePartDefinition['rects']
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
  totalCells: number
  remainingCells: number
  completed: boolean
  centerX: number
  centerY: number
}

export class GameScene extends Phaser.Scene {
  private static readonly BONUS_ZONE_SCORE = 250

  private dirtRT!: Phaser.GameObjects.RenderTexture
  private foamRT!: Phaser.GameObjects.RenderTexture
  private brush!: Phaser.GameObjects.Graphics
  private foamBrush!: Phaser.GameObjects.Graphics
  private vehicleSprite!: Phaser.GameObjects.Sprite
  private vehicleShadow!: Phaser.GameObjects.Graphics
  private customerBubble?: Phaser.GameObjects.Container
  private arrivalObjects: Phaser.GameObjects.GameObject[] = []
  private phase: 'arrival' | 'cleaning' | 'complete' = 'arrival'
  private feedbackMessage = ''
  private feedbackText!: Phaser.GameObjects.Text
  private hasShownGoodToolFeedback = false
  private lastProgressMilestone = 0

  // Level
  private level!: LevelConfig

  // UI
  private progressText!: Phaser.GameObjects.Text
  private progressFill!: Phaser.GameObjects.Rectangle
  private timerText!: Phaser.GameObjects.Text
  private bonusText?: Phaser.GameObjects.Text
  private partsText!: Phaser.GameObjects.Text
  private prepText?: Phaser.GameObjects.Text
  private worldProgressText!: Phaser.GameObjects.Text
  private nextUnlockText!: Phaser.GameObjects.Text
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
  private prepGrid: boolean[][] = []
  private preppedCells = 0
  private bonusZones: BonusZoneState[] = []
  private bonusScore = 0
  private vehicleParts: PartState[] = []
  private partCashBonus = 0
  private lastCompletedPartLabel = ''
  private sprayLoopSound?: Phaser.Sound.BaseSound
  private lastClearSfxMs = -Infinity
  private hasTrackedFirstWipe = false

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
    this.arrivalObjects = []
    this.phase = 'arrival'
    this.feedbackMessage = ''
    this.hasShownGoodToolFeedback = false
    this.lastProgressMilestone = 0
    this.bonusZones = []
    this.bonusScore = 0
    this.prepGrid = []
    this.preppedCells = 0
    this.vehicleParts = []
    this.partCashBonus = 0
    this.lastCompletedPartLabel = ''
    this.lastClearSfxMs = -Infinity
    this.hasTrackedFirstWipe = false

    this.hasPlayerStarted = false

    this.createWorld()
    this.createVehicleAndDirt()
    this.createParticles()
    this.createHUD()
    this.checkAndUnlockTools()
    this.createToolsUI()
    this.refreshProgressionHud()
    this.setupInput()

    this.brush = this.make.graphics()
    this.foamBrush = this.make.graphics()
    this.weakBrush = this.make.graphics()
    this.updateBrush()
    this.createSprayLoopSound()

    // Wrong-tool flash text (hidden until needed)
    this.wrongToolWarningText = this.add.text(CX, CY + 30, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '20px',
      color: '#ffdd57',
      stroke: '#222222',
      strokeThickness: 5,
      resolution: 2
    }).setOrigin(0.5).setDepth(200).setAlpha(0)

    this.feedbackText = this.add.text(CX, CY - 8, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '18px',
      color: '#7dff9a',
      stroke: '#17351f',
      strokeThickness: 5,
      resolution: 2
    }).setOrigin(0.5).setDepth(220).setAlpha(0)

    this.createCustomerBubble()
    this.startArrivalFlow()

    Analytics.track('level_shown', {
      levelId: this.level.id,
      world: this.level.world,
      dirtType: this.level.dirtType
    })
  }

  update(_time: number, delta: number): void {
    if (this.isFinished || this.phase !== 'cleaning') return
    this.timeElapsedMs += delta
    this.timerText.setText(`${Math.floor(this.timeElapsedMs / 1000)}s`)
    if (this.wrongToolWarningTimer > 0) this.wrongToolWarningTimer -= delta
  }

  shutdown(): void {
    this.input.off(Phaser.Input.Events.POINTER_DOWN)
    this.input.off(Phaser.Input.Events.POINTER_MOVE)
    this.input.off(Phaser.Input.Events.POINTER_UP)
    this.stopSprayLoop()
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
    const wallColor = this.level.world === 1 ? 0x3d5a47 : this.level.world === 2 ? 0x5a4a36 : this.level.world === 3 ? 0x3e4650 : 0x4c433d
    const floorColor = this.level.world === 1 ? 0x49685b : this.level.world === 2 ? 0x665542 : this.level.world === 3 ? 0x46535f : 0x554d49
    bg.fillStyle(wallColor, 1)
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)

    bg.fillStyle(floorColor, 1)
    bg.fillRect(64, 118, GAME_CONFIG.width - 128, GAME_CONFIG.height)

    bg.lineStyle(4, 0x20313a, 0.35)
    bg.beginPath()
    bg.moveTo(CX - 150, 0)
    bg.lineTo(CX - 150, GAME_CONFIG.height)
    bg.moveTo(CX + 150, 0)
    bg.lineTo(CX + 150, GAME_CONFIG.height)
    bg.strokePath()

    bg.lineStyle(2, 0x8fd3ff, 0.18)
    for (let y = 150; y < GAME_CONFIG.height; y += 70) {
      bg.beginPath()
      bg.moveTo(74, y)
      bg.lineTo(GAME_CONFIG.width - 74, y)
      bg.strokePath()
    }

    bg.fillStyle(0x17252d, 0.5)
    bg.fillRoundedRect(CX - 38, GAME_CONFIG.height - 255, 76, 220, 14)
    bg.fillStyle(0x223944, 0.8)
    bg.fillRoundedRect(CX - 26, GAME_CONFIG.height - 245, 52, 200, 10)

    bg.fillStyle(0xffffff, 0.08)
    bg.fillEllipse(CX - 95, 122, 120, 18)
    bg.fillEllipse(CX + 95, 122, 120, 18)

    bg.fillStyle(0x1d2f38, 0.75)
    bg.fillRoundedRect(20, 110, 62, 160, 8)
    bg.fillStyle(0x79a6b8, 0.38)
    bg.fillRect(28, 136, 46, 8)
    bg.fillRect(28, 184, 46, 8)
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
    this.vehicleShadow = this.add.graphics()
    this.vehicleShadow.fillStyle(0x000000, 0.4)
    this.vehicleShadow.fillRoundedRect(this.maskLeft + 10, this.maskTop + 10, vw, vh, 20)

    // Vehicle sprite
    this.vehicleSprite = this.add.sprite(CX, CY - 80, vKey)

    // Dirt RenderTexture exactly overlays the vehicle
    this.dirtRT = this.add.renderTexture(this.maskLeft, this.maskTop, vw, vh)
    this.dirtRT.setOrigin(0, 0)
    this.drawDirt(vw, vh)

    this.foamRT = this.add.renderTexture(this.maskLeft, this.maskTop, vw, vh)
    this.foamRT.setOrigin(0, 0)
    this.foamRT.setDepth(11)

    // Logical grids for % tracking
    this.grid = []
    this.layerGrid = []
    this.prepGrid = []
    this.totalCells = 0
    this.cleanCells = 0
    this.preppedCells = 0
    const cols = Math.ceil(vw / this.CELL_SIZE)
    const rows = Math.ceil(vh / this.CELL_SIZE)
    for (let r = 0; r < rows; r++) {
      this.grid[r] = []
      this.layerGrid[r] = []
      this.prepGrid[r] = []
      for (let c = 0; c < cols; c++) {
        this.grid[r][c] = false
        this.layerGrid[r][c] = this.level.dirtLayers
        this.prepGrid[r][c] = this.level.dirtType === 'dust'
        this.totalCells++
        if (this.prepGrid[r][c]) this.preppedCells++
      }
    }

    this.createBonusZones()
    this.createVehicleParts(vt, vw, vh)
    this.arrivalObjects.push(this.vehicleShadow, this.vehicleSprite, this.dirtRT, this.foamRT, ...this.bonusZones.map((zone) => zone.overlay))
  }

  private drawDirt(vw: number, vh: number): void {
    const dirtGen = this.make.graphics()
    const dt = this.level.dirtType

    if (dt === 'dust') {
      dirtGen.fillStyle(0xb9b9b9, 0.78)
      dirtGen.fillRect(0, 0, vw, vh)
      // Slightly uneven blotches
      dirtGen.fillStyle(0x8f8f8f, 0.28)
      for (let i = 0; i < 24; i++) {
        dirtGen.fillCircle(
          Phaser.Math.Between(0, vw),
          Phaser.Math.Between(0, vh),
          Phaser.Math.Between(12, 42)
        )
      }
    } else {
      // mud / oil / rust — richer colour, more blobs
      const base  = dt === 'mud' ? 0x90745f : dt === 'oil' ? 0x404040 : 0x915235
      const blob  = dt === 'mud' ? 0x695645 : dt === 'oil' ? 0x1f1f1f : 0x70361f
      const baseAlpha = dt === 'oil' ? 0.72 : 0.78
      const blobAlpha = dt === 'oil' ? 0.62 : 0.68
      const blobCount = dt === 'rust' ? 50 : 42
      dirtGen.fillStyle(base, baseAlpha)
      dirtGen.fillRect(0, 0, vw, vh)
      dirtGen.fillStyle(blob, blobAlpha)
      for (let i = 0; i < blobCount; i++) {
        dirtGen.fillCircle(
          Phaser.Math.Between(0, vw),
          Phaser.Math.Between(0, vh),
          Phaser.Math.Between(10, 34)
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

    this.worldProgressText = this.add.text(20, 64, this.getWorldProgressLabel(), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#d8e6f5'
    }).setOrigin(0, 0)

    this.nextUnlockText = this.add.text(GAME_CONFIG.width / 2, 64, this.getNextUnlockLabel(), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#a8d7ff'
    }).setOrigin(0.5, 0)

    if (this.bonusZones.length > 0) {
      this.bonusText = this.add.text(GAME_CONFIG.width - 20, 64, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#f1c40f',
        fontStyle: 'bold'
      }).setOrigin(1, 0)
      this.updateBonusHud()
    }

    this.partsText = this.add.text(GAME_CONFIG.width - 20, this.bonusZones.length > 0 ? 82 : 64, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#d8e6f5',
      fontStyle: 'bold'
    }).setOrigin(1, 0)
    this.updatePartsHud()

    if (this.requiresPrep()) {
      this.prepText = this.add.text(20, 82, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#eaf8ff',
        fontStyle: 'bold'
      }).setOrigin(0, 0)
      this.updatePrepHud()
    }
  }

  private createCustomerBubble(): void {
    const bubble = this.add.graphics()
    bubble.fillStyle(0xffffff, 0.94)
    bubble.fillRoundedRect(-150, -46, 300, 92, 14)
    bubble.lineStyle(3, 0x20313a, 0.3)
    bubble.strokeRoundedRect(-150, -46, 300, 92, 14)
    bubble.fillTriangle(-20, 44, 8, 44, -8, 66)

    const avatar = this.add.circle(-118, -4, 24, this.getCustomerColor())
    const face = this.add.text(-118, -4, this.getCustomerInitial(), {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      resolution: 2
    }).setOrigin(0.5)

    const text = this.add.text(-82, -30, this.getCustomerLine(), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#20313a',
      fontStyle: 'bold',
      wordWrap: { width: 210 },
      resolution: 2
    }).setOrigin(0, 0)

    const hint = this.add.text(-82, 18, `${this.level.dirtType.toUpperCase()} needs ${this.getRecommendedToolName()}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#527080',
      resolution: 2
    }).setOrigin(0, 0)

    this.customerBubble = this.add.container(CX, 118, [bubble, avatar, face, text, hint])
    this.customerBubble.setDepth(240).setAlpha(0).setScale(0.92)
  }

  private startArrivalFlow(): void {
    const entryOffset = -430
    for (const obj of this.arrivalObjects) {
      const target = obj as unknown as Phaser.GameObjects.Components.Transform
      target.y += entryOffset
    }

    this.tweens.add({
      targets: this.arrivalObjects,
      y: `+=${Math.abs(entryOffset)}`,
      duration: 900,
      ease: 'Back.Out',
      onComplete: () => {
        if (this.phase !== 'arrival') return
        this.tweens.add({
          targets: this.customerBubble,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 220,
          ease: 'Sine.Out'
        })
        this.time.delayedCall(1600, () => this.startCleaningPhase())
      }
    })
  }

  private startCleaningPhase(): void {
    if (this.phase !== 'arrival') return
    this.phase = 'cleaning'
    this.feedbackMessage = `Use ${this.getRecommendedToolName()} on ${this.level.dirtType.toUpperCase()}`

    if (this.customerBubble) {
      this.tweens.add({
        targets: this.customerBubble,
        alpha: 0,
        y: this.customerBubble.y - 18,
        duration: 220,
        ease: 'Quad.In'
      })
    }

    this.createTutorial()
  }

  private getCustomerLine(): string {
    const byDirt: Record<string, string> = {
      dust: 'Quick wash, please!',
      mud: 'It is caked in mud!',
      oil: 'This engine is greasy.',
      rust: 'Restore this wreck!'
    }
    return byDirt[this.level.dirtType] ?? 'Clean my ride!'
  }

  private getCustomerInitial(): string {
    return ['A', 'B', 'C', 'D'][Math.max(0, this.level.world - 1)] ?? 'C'
  }

  private getCustomerColor(): number {
    return [0x4a90d9, 0x9b6a38, 0x6c7a89, 0x9b4f31][Math.max(0, this.level.world - 1)] ?? 0x4a90d9
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
        AudioManager.playSfx(this, 'sfx_switch', 0.5)
        Analytics.track('tool_selected', { levelId: this.level.id, tool: key })
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
    const tool = this.getActiveToolConfig()
    const { radius, strength } = tool

    this.brush.clear()
    this.brush.fillStyle(0xffffff, strength)
    this.brush.fillCircle(radius, radius, radius)

    this.foamBrush.clear()
    this.foamBrush.fillStyle(0xeaf8ff, 0.72)
    this.foamBrush.fillCircle(radius, radius, radius)
    this.foamBrush.fillStyle(0xffffff, 0.55)
    for (let i = 0; i < 8; i++) {
      this.foamBrush.fillCircle(
        radius + Phaser.Math.Between(-Math.floor(radius * 0.55), Math.floor(radius * 0.55)),
        radius + Phaser.Math.Between(-Math.floor(radius * 0.55), Math.floor(radius * 0.55)),
        Phaser.Math.Between(3, 8)
      )
    }

    // Weak brush for wrong-tool passes: same radius, 20% alpha
    this.weakBrush.clear()
    this.weakBrush.fillStyle(0xffffff, strength * BALANCING.wrongToolStrengthFactor)
    this.weakBrush.fillCircle(radius, radius, radius)
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (ptr: Phaser.Input.Pointer) => {
      if (this.isFinished) return
      if (this.phase === 'arrival') {
        this.startCleaningPhase()
        return
      }
      const point = this.getPointerPosition(ptr)
      if (!this.hasPlayerStarted && point.localX >= 0 && point.localY >= 0 && point.localX <= this.maskWidth && point.localY <= this.maskHeight) {
        this.dismissTutorial()
      }
      if (this.isWithinMask(point.localX, point.localY)) {
        this.startSprayLoop()
      }
      this.prevPointerX = point.sceneX
      this.prevPointerY = point.sceneY
      this.handleWipe(point.localX, point.localY)
    })

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || this.isFinished || this.phase !== 'cleaning') return

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
      const rad = this.getActiveToolConfig().radius
      this.effectEmitter.emitParticleAt(
        point.sceneX + Phaser.Math.Between(-rad / 2, rad / 2),
        point.sceneY + Phaser.Math.Between(-rad / 2, rad / 2)
      )
    })

    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.stopSprayLoop()
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
    if (this.phase !== 'cleaning') return

    const tool = this.getActiveToolConfig()
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
    const prepRequired = this.requiresPrep()
    const areaPrepped = !prepRequired || this.isAreaPrepped(localX, localY, radius)
    const shouldPrep = !!tool.prepOnly && isEffective
    const layerReduction = isEffective && areaPrepped
      ? tool.strength
      : tool.strength * (isEffective ? BALANCING.unpreppedStrengthFactor : BALANCING.wrongToolStrengthFactor)

    if (!this.hasTrackedFirstWipe && this.isWithinMask(localX, localY)) {
      this.hasTrackedFirstWipe = true
      Analytics.track('first_wipe_started', {
        levelId: this.level.id,
        world: this.level.world,
        tool: this.activeTool
      })
    }

    if (shouldPrep) {
      this.foamRT.draw(this.foamBrush, localX - radius, localY - radius)
      this.updatePrepCells(localX, localY, radius)
      this.showPrepFeedback()
      this.effectEmitter.emitParticleAt(this.maskLeft + localX, this.maskTop + localY, 8)
      this.totalWipeCalls++
      this.updatePrepHud()
      return
    }

    if (isEffective && areaPrepped) {
      this.dirtRT.erase(this.brush, localX - radius, localY - radius)
      this.showGoodToolFeedback()
    } else if (isEffective && prepRequired && !areaPrepped) {
      this.dirtRT.erase(this.weakBrush, localX - radius, localY - radius)
      this.showPrepWarning()
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
              if (this.foamRT && this.prepGrid[r]?.[c]) {
                this.foamRT.erase(this.brush, localX - radius, localY - radius)
              }
              cellsCleanedNow++
              this.cleanCells++
              this.updateBonusZoneCell(r, c)
              this.updatePartCell(r, c)
            }
          }
        }
      }
    }

    this.totalWipeCalls++
    if (cellsCleanedNow === 0) this.wasteWipeCalls++
    if (cellsCleanedNow > 0 && this.time.now - this.lastClearSfxMs >= BALANCING.clearSfxCooldownMs) {
      AudioManager.playSfx(this, 'sfx_clear', 0.35)
      this.lastClearSfxMs = this.time.now
    }

    this.updateProgress()
  }

  // ─── Progress & Completion ────────────────────────────────────────────────

  private updateProgress(): void {
    const ratio = Math.min(1, this.cleanCells / this.totalCells)
    const pct   = Math.floor(ratio * 100)
    this.progressText.setText(`${pct}%`)
    this.progressFill.width = this.progressBarW * ratio
    const milestone = Math.floor(pct / 25) * 25
    if (milestone > this.lastProgressMilestone && milestone < 100) {
      this.lastProgressMilestone = milestone
      this.pulseProgressBar()
    }

    if (pct >= BALANCING.completionPercent && !this.isFinished) {
      this.triggerComplete()
    }
  }

  private triggerComplete(): void {
    this.isFinished = true
    this.phase = 'complete'
    this.stopSprayLoop()

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
    const baseScore = Math.floor(BALANCING.baseScore * timeBonus * efficiency)
    const finalScore = baseScore + this.bonusScore

    const stars = calcStars(seconds, this.level.parTimeSeconds)
    const completedBonusZones = this.getCompletedBonusZoneCount()
    const completedParts = this.getCompletedPartCount()
    const cashEarned = EconomySystem.calculateCashReward({
      stars,
      wasteFraction,
      bonusZonesCompleted: completedBonusZones,
      partsCompleted: completedParts
    })
    const cashTotal = EconomySystem.addCash(cashEarned)
    Analytics.track('level_completed', {
      levelId: this.level.id,
      world: this.level.world,
      stars,
      score: finalScore,
      timeSeconds: Number(seconds.toFixed(2)),
      cashEarned
    })

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
    const completedJobs = SaveManager.load<Record<number, boolean>>(SAVE_KEYS.completedJobs, {})
    completedJobs[this.level.id] = true
    SaveManager.save(SAVE_KEYS.completedJobs, completedJobs)

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
          isLastLevel: isLastLevel(this.level.id),
          bonusZonesTotal: this.bonusZones.length,
          bonusZonesCompleted: completedBonusZones,
          bonusScore: this.bonusScore,
          partsTotal: this.vehicleParts.length,
          partsCompleted: completedParts,
          partCashBonus: this.partCashBonus,
          cashEarned,
          cashTotal
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
      newlyUnlocked.forEach(k => this.showToolUnlockBanner(k))
      Analytics.track('tool_unlocked', {
        levelId: this.level.id,
        tools: newlyUnlocked.join(',')
      })
    }

    this.refreshProgressionHud()
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

    const betterTool = this.getRecommendedToolName()
    this.feedbackMessage = `${this.level.dirtType.toUpperCase()} needs ${betterTool}`
    this.wrongToolWarningText.setText(this.feedbackMessage)
    this.wrongToolWarningText.setText(`⚠️ Try ${betterTool}!`)
    this.wrongToolWarningText.setText(this.feedbackMessage)
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

  private showGoodToolFeedback(): void {
    if (this.hasShownGoodToolFeedback) return
    this.hasShownGoodToolFeedback = true
    this.feedbackMessage = `${this.getRecommendedToolName()} is working`
    this.feedbackText.setText('GOOD TOOL')
    this.feedbackText.setAlpha(1).setScale(0.85)

    this.tweens.killTweensOf(this.feedbackText)
    this.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 850,
      delay: 250,
      ease: 'Sine.Out'
    })
  }

  private showPrepFeedback(): void {
    this.feedbackMessage = `Foam loosens ${this.level.dirtType.toUpperCase()}`
    this.feedbackText.setText('FOAM PREP')
    this.feedbackText.setColor('#eaf8ff')
    this.feedbackText.setAlpha(1).setScale(0.85)

    this.tweens.killTweensOf(this.feedbackText)
    this.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 520,
      ease: 'Sine.Out'
    })
  }

  private showPrepWarning(): void {
    if (this.wrongToolWarningTimer > 0) return
    this.wrongToolWarningTimer = BALANCING.wrongToolWarningCooldown
    this.feedbackMessage = `${this.level.dirtType.toUpperCase()} needs FOAM first`

    this.wrongToolWarningText.setText('Use FOAM first')
    this.wrongToolWarningText.setAlpha(1).setScale(0.9)

    this.tweens.add({
      targets: this.wrongToolWarningText,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 130,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.Out',
      onComplete: () => {
        this.tweens.add({
          targets: this.wrongToolWarningText,
          alpha: 0,
          duration: 260,
          delay: 500
        })
      }
    })
  }

  private pulseProgressBar(): void {
    this.tweens.add({
      targets: [this.progressFill, this.progressText],
      scaleY: 1.35,
      duration: 130,
      yoyo: true,
      ease: 'Sine.Out'
    })
  }

  private getRecommendedToolName(): string {
    if (this.requiresPrep() && this.getPrepRatio() < 0.72) return 'FOAM'

    const dt = this.level.dirtType
    if (dt === 'rust' || dt === 'oil') return 'JET'
    if (dt === 'mud') return 'JET'
    return 'FAN'
  }

  private getActiveToolConfig() {
    return UpgradeSystem.applyToTool(this.activeTool, BALANCING.tools[this.activeTool], this.level.dirtType)
  }

  private requiresPrep(): boolean {
    return this.level.dirtType !== 'dust'
  }

  private getPrepRatio(): number {
    if (!this.requiresPrep()) return 1
    return this.totalCells > 0 ? this.preppedCells / this.totalCells : 0
  }

  private isAreaPrepped(localX: number, localY: number, radius: number): boolean {
    if (!this.requiresPrep()) return true

    const startCol = Math.max(0, Math.floor((localX - radius * 0.45) / this.CELL_SIZE))
    const gridCols = this.grid[0] ? this.grid[0].length - 1 : 0
    const endCol = Math.min(gridCols, Math.floor((localX + radius * 0.45) / this.CELL_SIZE))
    const startRow = Math.max(0, Math.floor((localY - radius * 0.45) / this.CELL_SIZE))
    const endRow = Math.min(this.grid.length - 1, Math.floor((localY + radius * 0.45) / this.CELL_SIZE))
    let checked = 0
    let ready = 0

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (this.grid[r]?.[c]) continue
        checked++
        if (this.prepGrid[r]?.[c]) ready++
      }
    }

    return checked === 0 || ready / checked >= 0.45
  }

  private updatePrepCells(localX: number, localY: number, radius: number): void {
    if (!this.requiresPrep()) return

    const startCol = Math.max(0, Math.floor((localX - radius) / this.CELL_SIZE))
    const gridCols = this.grid[0] ? this.grid[0].length - 1 : 0
    const endCol = Math.min(gridCols, Math.floor((localX + radius) / this.CELL_SIZE))
    const startRow = Math.max(0, Math.floor((localY - radius) / this.CELL_SIZE))
    const endRow = Math.min(this.grid.length - 1, Math.floor((localY + radius) / this.CELL_SIZE))

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (this.grid[r][c] || this.prepGrid[r][c]) continue
        const cx = c * this.CELL_SIZE + this.CELL_SIZE / 2
        const cy = r * this.CELL_SIZE + this.CELL_SIZE / 2
        if (Phaser.Math.Distance.Between(cx, cy, localX, localY) <= radius) {
          this.prepGrid[r][c] = true
          this.preppedCells++
        }
      }
    }
  }

  private updatePrepHud(): void {
    if (!this.prepText) return
    const prepPct = Math.floor(this.getPrepRatio() * 100)
    const nextStep = prepPct >= 72 ? `Use ${this.getRecommendedToolName()} now` : 'Use FOAM first'
    this.prepText.setText(`PREP ${prepPct}%  ${nextStep}`)
  }

  private createBonusZones(): void {
    const definitions = this.level.bonusZones ?? []
    this.bonusZones = definitions.map(([localX, localY, width, height]) => {
      const overlay = this.add.rectangle(
        this.maskLeft + localX + width / 2,
        this.maskTop + localY + height / 2,
        width,
        height,
        0xf1c40f,
        0.08
      )
        .setStrokeStyle(2, 0xf1c40f, 0.65)
        .setDepth(12)

      const zone: BonusZoneState = {
        localX,
        localY,
        width,
        height,
        centerX: this.maskLeft + localX + width / 2,
        centerY: this.maskTop + localY + height / 2,
        rowStart: Math.max(0, Math.floor(localY / this.CELL_SIZE)),
        rowEnd: Math.min(this.grid.length - 1, Math.floor((localY + height) / this.CELL_SIZE)),
        colStart: Math.max(0, Math.floor(localX / this.CELL_SIZE)),
        colEnd: Math.min((this.grid[0]?.length ?? 1) - 1, Math.floor((localX + width) / this.CELL_SIZE)),
        totalCells: 0,
        remainingCells: 0,
        completed: false,
        overlay
      }

      for (let row = zone.rowStart; row <= zone.rowEnd; row++) {
        for (let col = zone.colStart; col <= zone.colEnd; col++) {
          const centerX = col * this.CELL_SIZE + this.CELL_SIZE / 2
          const centerY = row * this.CELL_SIZE + this.CELL_SIZE / 2
          if (this.isPointInsideBonusZone(zone, centerX, centerY)) {
            zone.totalCells++
            zone.remainingCells++
          }
        }
      }

      return zone
    })
  }

  private updateBonusZoneCell(row: number, col: number): void {
    if (this.bonusZones.length === 0) return

    const cellCenterX = col * this.CELL_SIZE + this.CELL_SIZE / 2
    const cellCenterY = row * this.CELL_SIZE + this.CELL_SIZE / 2

    for (const zone of this.bonusZones) {
      if (zone.completed) continue
      if (row < zone.rowStart || row > zone.rowEnd || col < zone.colStart || col > zone.colEnd) continue
      if (!this.isPointInsideBonusZone(zone, cellCenterX, cellCenterY)) continue

      zone.remainingCells = Math.max(0, zone.remainingCells - 1)
      if (zone.remainingCells === 0 && zone.totalCells > 0) {
        this.completeBonusZone(zone)
      }
    }
  }

  private completeBonusZone(zone: BonusZoneState): void {
    zone.completed = true
    this.bonusScore += GameScene.BONUS_ZONE_SCORE
    this.updateBonusHud()

    zone.overlay.setFillStyle(0x2ecc71, 0.18)
    zone.overlay.setStrokeStyle(3, 0x2ecc71, 1)

    this.sparkleEmitter.explode(28, zone.centerX, zone.centerY)
    this.effectEmitter.emitParticleAt(zone.centerX, zone.centerY, 12)

    this.tweens.add({
      targets: zone.overlay,
      alpha: 0.25,
      duration: 220,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.Out'
    })
  }

  private updateBonusHud(): void {
    if (!this.bonusText) return

    this.bonusText.setText(
      `BONUS ${this.getCompletedBonusZoneCount()}/${this.bonusZones.length}  +${this.bonusScore}`
    )
  }

  private getCompletedBonusZoneCount(): number {
    return this.bonusZones.filter((zone) => zone.completed).length
  }

  private createVehicleParts(vehicleType: number, width: number, height: number): void {
    const definitions = getVehicleParts(vehicleType, width, height)
    this.vehicleParts = definitions.map((definition) => {
      let minX = Number.POSITIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      let maxX = 0
      let maxY = 0

      for (const partRect of definition.rects) {
        minX = Math.min(minX, partRect.x)
        minY = Math.min(minY, partRect.y)
        maxX = Math.max(maxX, partRect.x + partRect.width)
        maxY = Math.max(maxY, partRect.y + partRect.height)
      }

      const part: PartState = {
        key: definition.key,
        label: definition.label,
        rects: definition.rects,
        rowStart: Math.max(0, Math.floor(minY / this.CELL_SIZE)),
        rowEnd: Math.min(this.grid.length - 1, Math.floor(maxY / this.CELL_SIZE)),
        colStart: Math.max(0, Math.floor(minX / this.CELL_SIZE)),
        colEnd: Math.min((this.grid[0]?.length ?? 1) - 1, Math.floor(maxX / this.CELL_SIZE)),
        totalCells: 0,
        remainingCells: 0,
        completed: false,
        centerX: this.maskLeft + (minX + maxX) / 2,
        centerY: this.maskTop + (minY + maxY) / 2
      }

      for (let row = part.rowStart; row <= part.rowEnd; row++) {
        for (let col = part.colStart; col <= part.colEnd; col++) {
          const centerX = col * this.CELL_SIZE + this.CELL_SIZE / 2
          const centerY = row * this.CELL_SIZE + this.CELL_SIZE / 2
          if (this.isPointInsidePart(part, centerX, centerY)) {
            part.totalCells++
            part.remainingCells++
          }
        }
      }

      return part
    }).filter((part) => part.totalCells > 0)
  }

  private updatePartCell(row: number, col: number): void {
    if (this.vehicleParts.length === 0) return

    const cellCenterX = col * this.CELL_SIZE + this.CELL_SIZE / 2
    const cellCenterY = row * this.CELL_SIZE + this.CELL_SIZE / 2

    for (const part of this.vehicleParts) {
      if (part.completed) continue
      if (row < part.rowStart || row > part.rowEnd || col < part.colStart || col > part.colEnd) continue
      if (!this.isPointInsidePart(part, cellCenterX, cellCenterY)) continue

      part.remainingCells = Math.max(0, part.remainingCells - 1)
      if (part.remainingCells === 0) {
        this.completeVehiclePart(part)
      }
    }
  }

  private completeVehiclePart(part: PartState): void {
    part.completed = true
    this.partCashBonus += BALANCING.cash.partCompleteCash
    this.lastCompletedPartLabel = part.label
    this.feedbackMessage = `${part.label} clean`
    this.updatePartsHud()

    const label = this.add.text(part.centerX, part.centerY, `${part.label.toUpperCase()} CLEAN +$${BALANCING.cash.partCompleteCash}`, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#16351d',
      strokeThickness: 5,
      resolution: 2
    }).setOrigin(0.5).setDepth(230).setAlpha(0).setScale(0.85)

    this.sparkleEmitter.explode(18, part.centerX, part.centerY)
    AudioManager.playSfx(this, 'sfx_clear', 0.45)

    this.tweens.add({
      targets: label,
      alpha: 1,
      y: part.centerY - 20,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: 'Back.Out',
      onComplete: () => {
        this.time.delayedCall(550, () => {
          this.tweens.add({
            targets: label,
            alpha: 0,
            y: label.y - 18,
            duration: 250,
            ease: 'Quad.In',
            onComplete: () => label.destroy()
          })
        })
      }
    })
  }

  private updatePartsHud(): void {
    if (!this.partsText) return
    this.partsText.setText(`PARTS ${this.getCompletedPartCount()}/${this.vehicleParts.length}  +$${this.partCashBonus}`)
  }

  private getCompletedPartCount(): number {
    return this.vehicleParts.filter((part) => part.completed).length
  }

  private getNextDirtyPartLabel(): string {
    const nextPart = this.vehicleParts.find((part) => !part.completed)
    return nextPart ? `${nextPart.label} dirty` : 'All parts clean'
  }

  private createSprayLoopSound(): void {
    if (!this.cache.audio.has('spray_loop')) return
    this.sprayLoopSound = this.sound.add('spray_loop', {
      loop: true,
      volume: 0.18
    })
  }

  private startSprayLoop(): void {
    if (AudioManager.muted || !this.sprayLoopSound || this.sprayLoopSound.isPlaying) return
    try {
      this.sprayLoopSound.play()
    } catch {
      // Ignore audio startup failures in unsupported environments.
    }
  }

  private stopSprayLoop(): void {
    if (!this.sprayLoopSound?.isPlaying) return
    this.sprayLoopSound.stop()
  }

  private isWithinMask(localX: number, localY: number): boolean {
    return localX >= 0 && localY >= 0 && localX <= this.maskWidth && localY <= this.maskHeight
  }

  private isPointInsideBonusZone(zone: BonusZoneState, x: number, y: number): boolean {
    return (
      x >= zone.localX &&
      x <= zone.localX + zone.width &&
      y >= zone.localY &&
      y <= zone.localY + zone.height
    )
  }

  private isPointInsidePart(part: PartState, x: number, y: number): boolean {
    return part.rects.some((partRect) => (
      x >= partRect.x &&
      x <= partRect.x + partRect.width &&
      y >= partRect.y &&
      y <= partRect.y + partRect.height
    ))
  }

  private getWorldProgressLabel(): string {
    const world = this.level.world
    const ids = levelsInWorld(world)
    const completed = SaveManager.load<Record<number, boolean>>(SAVE_KEYS.levelCompleted, {})
    const cleared = ids.filter((id) => completed[id]).length
    return `World ${world} ${worldName(world)} • ${cleared}/${ids.length} cleared`
  }

  private getNextUnlockLabel(): string {
    const unlocked = SaveManager.load<string[]>(SAVE_KEYS.unlockedTools, ['fan'])
    const nextUnlock = Object.entries(BALANCING.toolUnlockAtLevel)
      .sort((a, b) => a[1] - b[1])
      .find(([toolKey]) => !unlocked.includes(toolKey))

    if (!nextUnlock) {
      return `Tools ${unlocked.length}/${Object.keys(BALANCING.tools).length} • All unlocked`
    }

    const [toolKey, unlockLevel] = nextUnlock
    return `Next unlock: ${BALANCING.tools[toolKey].name} at Lv${unlockLevel}`
  }

  private refreshProgressionHud(): void {
    this.worldProgressText.setText(this.getWorldProgressLabel())
    this.nextUnlockText.setText(this.getNextUnlockLabel())
  }

  public getDebugState(): GameDebugState {
    const availableTools = Object.keys(this.toolIcons)
    const progressRatio = this.totalCells > 0 ? this.cleanCells / this.totalCells : 0
    const wasteRatio = this.totalWipeCalls > 0 ? this.wasteWipeCalls / this.totalWipeCalls : 0
    const world = this.level.world
    const ids = levelsInWorld(world)
    const completed = SaveManager.load<Record<number, boolean>>(SAVE_KEYS.levelCompleted, {})
    const cleared = ids.filter((id) => completed[id]).length
    const unlockedTools = SaveManager.load<string[]>(SAVE_KEYS.unlockedTools, ['fan'])

    return {
      mode: 'game',
      sceneKey: this.scene.key,
      coordinateSystem: 'Origin is top-left. X increases right, Y increases down.',
      phase: this.phase,
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
      effectiveTool: this.getActiveToolConfig().primaryDirt.includes(this.level.dirtType),
      recommendedTool: this.getRecommendedToolName(),
      prep: {
        required: this.requiresPrep(),
        percent: Math.floor(this.getPrepRatio() * 100),
        preppedCells: this.preppedCells,
        totalCells: this.totalCells
      },
      feedbackMessage: this.feedbackMessage,
      customerBubbleVisible: !!this.customerBubble?.active && this.customerBubble.alpha > 0,
      cash: EconomySystem.getCash(),
      ownedUpgrades: UpgradeSystem.loadLevels(),
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
      },
      bonusZones: {
        total: this.bonusZones.length,
        completed: this.getCompletedBonusZoneCount(),
        score: this.bonusScore,
        zones: this.bonusZones.map((zone) => ({
          x: zone.localX,
          y: zone.localY,
          width: zone.width,
          height: zone.height,
          completed: zone.completed
        }))
      },
      parts: {
        total: this.vehicleParts.length,
        completed: this.getCompletedPartCount(),
        cashBonus: this.partCashBonus,
        currentHint: this.lastCompletedPartLabel ? `${this.lastCompletedPartLabel} clean` : this.getNextDirtyPartLabel(),
        items: this.vehicleParts.map((part) => ({
          key: part.key,
          label: part.label,
          completed: part.completed,
          progress: part.totalCells > 0 ? Number(((part.totalCells - part.remainingCells) / part.totalCells).toFixed(2)) : 0
        }))
      },
      progression: {
        world,
        worldName: worldName(world),
        levelInWorld: levelIndexInWorld(this.level.id),
        worldCompleted: cleared,
        worldTotal: ids.length,
        unlockedTools: unlockedTools.length,
        totalTools: Object.keys(BALANCING.tools).length,
        nextUnlock: this.getNextUnlockLabel()
      }
    }
  }
}
