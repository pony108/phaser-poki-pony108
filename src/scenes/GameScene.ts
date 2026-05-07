import { AudioManager } from '../core/AudioManager'
import { Analytics } from '../core/Analytics'
import { UIButton } from '../components/UIButton'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { SaveManager, SAVE_KEYS } from '../core/SaveManager'
import { getLevel, calcStars, isLastLevel, levelIndexInWorld, levelsInWorld, LevelConfig, worldName } from '../data/levels'
import { getVehicleParts, VehiclePartDefinition } from '../data/vehicleParts'
import { PokiBridge } from '../lib/poki/PokiBridge'
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
  arrivalSkipped: boolean
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
  guidedTool: string
  requiredSequence: string[]
  currentSequenceStep: string
  readyToCleanPercent: number
  toolEffectiveness: 'correct_step' | 'useful_shortcut' | 'wrong_order' | 'wrong_dirt' | 'final_clean'
  handPointerVisible: boolean
  handPointerTarget: string
  prep: {
    required: boolean
    percent: number
    preppedCells: number
    totalCells: number
  }
  cellStateSummary: Record<string, number>
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

interface ArrivalTarget {
  obj: Phaser.GameObjects.GameObject
  y: number
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

type DirtCellState = 'raw' | 'softened' | 'foamed' | 'ready'
type WipeResult = 'cleaned' | 'advanced' | 'blocked_wrong_order' | 'wrong_tool' | 'empty'

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
  private arrivalTargets: ArrivalTarget[] = []
  private arrivalSkipped = false
  private phase: 'arrival' | 'cleaning' | 'complete' = 'arrival'
  private hasPlayerStarted = true
  private feedbackMessage = ''
  private coachBaseMessage = ''
  private coachMessageText!: Phaser.GameObjects.Text
  private coachMessageBg!: Phaser.GameObjects.Graphics
  private coachOverrideTimer?: Phaser.Time.TimerEvent
  private coachToastQueue: string[] = []
  private coachToastActive = false
  private tutorialContainer?: Phaser.GameObjects.Container
  private tutorialTween?: Phaser.Tweens.Tween
  private hasShownGoodToolFeedback = false
  private lastProgressMilestone = 0

  // Level
  private level!: LevelConfig

  // UI
  private progressText!: Phaser.GameObjects.Text
  private progressFill!: Phaser.GameObjects.Rectangle
  private timerText!: Phaser.GameObjects.Text
  private topHintText!: Phaser.GameObjects.Text
  private toolSequenceText?: Phaser.GameObjects.Text
  private toolHand?: Phaser.GameObjects.Text
  private toolHandTween?: Phaser.Tweens.Tween
  private pauseButton?: UIButton
  private pauseOverlay?: Phaser.GameObjects.Container
  private pauseResumeButton?: UIButton
  private pauseReplayButton?: UIButton
  private pauseMenuButton?: UIButton
  private escKey?: Phaser.Input.Keyboard.Key
  private targetPartOverlay?: Phaser.GameObjects.Graphics
  private targetPartLabel?: Phaser.GameObjects.Text
  private targetPartTween?: Phaser.Tweens.Tween
  private currentTargetPartKey = ''
  private toolIcons: Record<string, Phaser.GameObjects.Image> = {}
  private toolBacks: Record<string, Phaser.GameObjects.Arc> = {}
  private toolLabels: Record<string, Phaser.GameObjects.Text> = {}
  private toolPositions: Record<string, { x: number; y: number }> = {}
  private handPointerTarget = ''
  private readonly progressBarW = GAME_CONFIG.width - 40

  // Particles
  private effectEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private foamEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private steamEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private jetEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private scratchEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
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
  private isPaused = false
  private maskLeft = 0
  private maskTop = 0
  private maskWidth = 0
  private maskHeight = 0
  private prevPointerX = 0
  private prevPointerY = 0

  // Multi-layer dirt tracking
  private layerGrid: number[][] = []
  private prepGrid: boolean[][] = []
  private cellStateGrid: DirtCellState[][] = []
  private preppedCells = 0
  private bonusZones: BonusZoneState[] = []
  private bonusScore = 0
  private vehicleParts: PartState[] = []
  private partCashBonus = 0
  private sprayLoopSound?: Phaser.Sound.BaseSound
  private lastClearSfxMs = -Infinity
  private hasTrackedFirstWipe = false
  private streakCells = 0
  private lastStreakMilestone = 0

  // Wrong-tool feedback
  private weakBrush!: Phaser.GameObjects.Graphics
  private wrongToolWarningTimer = 0

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
    this.isPaused = false
    this.timeElapsedMs = 0
    this.totalWipeCalls = 0
    this.wasteWipeCalls = 0
    this.wrongToolWarningTimer = 0
    this.activeTool = 'fan'
    this.toolIcons = {}
    this.toolBacks = {}
    this.toolLabels = {}
    this.toolPositions = {}
    this.handPointerTarget = ''
    this.arrivalObjects = []
    this.arrivalTargets = []
    this.arrivalSkipped = false
    this.phase = 'arrival'
    this.feedbackMessage = ''
    this.coachBaseMessage = ''
    this.hasShownGoodToolFeedback = false
    this.lastProgressMilestone = 0
    this.bonusZones = []
    this.bonusScore = 0
    this.prepGrid = []
    this.cellStateGrid = []
    this.preppedCells = 0
    this.vehicleParts = []
    this.partCashBonus = 0
    this.lastClearSfxMs = -Infinity
    this.hasTrackedFirstWipe = false
    this.streakCells = 0
    this.lastStreakMilestone = 0
    this.coachToastQueue = []
    this.coachToastActive = false

    this.createWorld()
    this.createVehicleAndDirt()
    this.createParticles()
    this.createHUD()
    this.createPauseUI()
    this.checkAndUnlockTools()
    this.createToolsUI()
    this.setupInput()

    this.brush = this.make.graphics()
    this.foamBrush = this.make.graphics()
    this.weakBrush = this.make.graphics()
    this.updateBrush()
    this.createSprayLoopSound()

    this.createCoachMessage()

    this.createCustomerBubble()
    this.startArrivalFlow()

    Analytics.track('level_shown', {
      levelId: this.level.id,
      world: this.level.world,
      dirtType: this.level.dirtType
    })
  }

  update(_time: number, delta: number): void {
    if (this.isFinished || this.isPaused || this.phase !== 'cleaning') return
    this.timeElapsedMs += delta
    this.timerText.setText(`${Math.floor(this.timeElapsedMs / 1000)}s`)
    if (this.wrongToolWarningTimer > 0) this.wrongToolWarningTimer -= delta
    this.layoutCoachMessage()
  }

  shutdown(): void {
    PokiBridge.gameplayStop('scene_shutdown')
    this.input.off(Phaser.Input.Events.POINTER_DOWN)
    this.input.off(Phaser.Input.Events.POINTER_MOVE)
    this.input.off(Phaser.Input.Events.POINTER_UP)
    this.stopSprayLoop()
    this.pauseOverlay?.destroy()
    this.pauseButton?.destroy()
    this.pauseResumeButton?.destroy()
    this.pauseReplayButton?.destroy()
    this.pauseMenuButton?.destroy()
    this.escKey?.destroy()
    this.targetPartTween?.stop()
    this.targetPartOverlay?.destroy()
    this.targetPartLabel?.destroy()
    if (this.toolHandTween?.isPlaying()) this.toolHandTween.stop()
    this.coachOverrideTimer?.remove(false)
  }

  // ─── Tutorial ────────────────────────────────────────────────────────────

  public createTutorial(): void {
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

  public dismissTutorial(): void {
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
        onComplete: () => this.tutorialContainer?.destroy()
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
    this.cellStateGrid = []
    this.totalCells = 0
    this.cleanCells = 0
    this.preppedCells = 0
    const cols = Math.ceil(vw / this.CELL_SIZE)
    const rows = Math.ceil(vh / this.CELL_SIZE)
    for (let r = 0; r < rows; r++) {
      this.grid[r] = []
      this.layerGrid[r] = []
      this.prepGrid[r] = []
      this.cellStateGrid[r] = []
      for (let c = 0; c < cols; c++) {
        this.grid[r][c] = false
        this.layerGrid[r][c] = this.level.dirtLayers
        this.cellStateGrid[r][c] = 'raw'
        this.prepGrid[r][c] = !this.requiresPrep()
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
      dirtGen.fillStyle(0xc8c8c2, 0.74)
      dirtGen.fillRect(0, 0, vw, vh)
      // Slightly uneven blotches
      dirtGen.fillStyle(0x8f8f86, 0.22)
      for (let i = 0; i < 34; i++) {
        dirtGen.fillCircle(
          Phaser.Math.Between(0, vw),
          Phaser.Math.Between(0, vh),
          Phaser.Math.Between(8, 32)
        )
      }
      dirtGen.lineStyle(2, 0xe7e3d8, 0.2)
      for (let i = 0; i < 10; i++) {
        const y = Phaser.Math.Between(20, vh - 20)
        dirtGen.beginPath()
        dirtGen.moveTo(Phaser.Math.Between(0, 30), y)
        dirtGen.lineTo(Phaser.Math.Between(vw - 45, vw), y + Phaser.Math.Between(-8, 8))
        dirtGen.strokePath()
      }
    } else {
      // mud / oil / rust — richer colour, more blobs
      const base  = dt === 'mud' ? 0x8d623f : dt === 'oil' ? 0x1d2024 : 0x9c4f2e
      const blob  = dt === 'mud' ? 0x5d3d27 : dt === 'oil' ? 0x050607 : 0x6f2d18
      const baseAlpha = dt === 'oil' ? 0.66 : 0.68
      const blobAlpha = dt === 'oil' ? 0.74 : 0.76
      const blobCount = dt === 'rust' ? 58 : dt === 'oil' ? 44 : 52
      dirtGen.fillStyle(base, baseAlpha)
      dirtGen.fillRect(0, 0, vw, vh)
      dirtGen.fillStyle(blob, blobAlpha)
      for (let i = 0; i < blobCount; i++) {
        const x = Phaser.Math.Between(0, vw)
        const y = Phaser.Math.Between(0, vh)
        if (dt === 'oil') {
          dirtGen.fillEllipse(x, y, Phaser.Math.Between(18, 52), Phaser.Math.Between(10, 32))
          dirtGen.fillStyle(0x56606b, 0.18)
          dirtGen.fillEllipse(x - 3, y - 3, Phaser.Math.Between(10, 26), Phaser.Math.Between(5, 14))
          dirtGen.fillStyle(blob, blobAlpha)
        } else {
          dirtGen.fillCircle(x, y, Phaser.Math.Between(dt === 'rust' ? 8 : 12, dt === 'rust' ? 26 : 34))
          if (dt === 'mud') {
            dirtGen.fillStyle(0xb18a66, 0.26)
            dirtGen.fillCircle(x - 4, y - 5, Phaser.Math.Between(4, 11))
            dirtGen.fillStyle(blob, blobAlpha)
          }
        }
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

    this.foamEmitter = this.add.particles(0, 0, 'fx_foam_bubble', {
      speed: { min: 15, max: 70 },
      angle: { min: 0, max: 360 },
      alpha: { start: 0.92, end: 0 },
      scale: { start: 1.1, end: 0.25 },
      lifespan: 650,
      frequency: -1
    })
    this.foamEmitter.setDepth(35)

    this.steamEmitter = this.add.particles(0, 0, 'fx_steam', {
      speedY: { min: -70, max: -25 },
      speedX: { min: -18, max: 18 },
      alpha: { start: 0.62, end: 0 },
      scale: { start: 1.15, end: 1.8 },
      lifespan: 760,
      frequency: -1
    })
    this.steamEmitter.setDepth(34)

    this.dustEmitter = this.add.particles(0, 0, 'fx_dust_mote', {
      speed: { min: 45, max: 150 },
      angle: { min: 170, max: 370 },
      alpha: { start: 0.78, end: 0 },
      scale: { start: 1, end: 0.2 },
      lifespan: 520,
      frequency: -1
    })
    this.dustEmitter.setDepth(32)

    this.jetEmitter = this.add.particles(0, 0, 'fx_jet_splash', {
      speed: { min: 80, max: 210 },
      angle: { min: 250, max: 290 },
      alpha: { start: 0.95, end: 0 },
      scale: { start: 1.1, end: 0.25 },
      lifespan: 360,
      frequency: -1
    })
    this.jetEmitter.setDepth(36)

    this.scratchEmitter = this.add.particles(0, 0, 'fx_weak_scratch', {
      speed: { min: 12, max: 45 },
      angle: { min: 0, max: 360 },
      alpha: { start: 0.55, end: 0 },
      scale: { start: 0.9, end: 0.1 },
      lifespan: 300,
      frequency: -1
    })
    this.scratchEmitter.setDepth(37)

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

  private getSceneLayout(): {
    safeX: number
    topY: number
    hintY: number
    progressWidth: number
    coachY: number
    coachMaxWidth: number
    toolY: number
    sequenceY: number
  } {
    const safeX = 20
    const toolY = GAME_CONFIG.height - 56
    return {
      safeX,
      topY: 20,
      hintY: 46,
      progressWidth: GAME_CONFIG.width - safeX * 2,
      coachY: toolY - 126,
      coachMaxWidth: GAME_CONFIG.width - safeX * 2,
      toolY,
      sequenceY: toolY - 76
    }
  }

  private fitTextToWidth(text: Phaser.GameObjects.Text, maxWidth: number, maxFontSize: number, minFontSize: number): void {
    let fontSize = maxFontSize
    text.setFontSize(fontSize)
    while (fontSize > minFontSize && text.getBounds().width > maxWidth) {
      fontSize -= 1
      text.setFontSize(fontSize)
    }
  }

  private createHUD(): void {
    const layout = this.getSceneLayout()
    const barW = layout.progressWidth
    const barX = layout.safeX
    const barY = layout.topY
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

    const dirtLabels: Record<string, string> = {
      dust: 'DUST / FAN',
      mud: 'MUD / FOAM -> JET',
      oil: 'OIL / FOAM -> JET',
      rust: 'RUST / FOAM -> JET'
    }
    this.topHintText = this.add.text(layout.safeX, layout.hintY, dirtLabels[this.level.dirtType] ?? this.level.dirtType.toUpperCase(), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#d8e6f5',
      fontStyle: 'bold'
    }).setOrigin(0, 0)
    this.updateTopHint()

    // Timer (top-right)
    this.timerText = this.add.text(GAME_CONFIG.width - layout.safeX, layout.hintY, '0s', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#9fb3c9',
      fontStyle: 'bold'
    }).setOrigin(1, 0)
  }

  private createPauseUI(): void {
    this.pauseButton = new UIButton({
      scene: this,
      x: GAME_CONFIG.width - 34,
      y: 34,
      width: 44,
      height: 36,
      label: 'II',
      fontSize: 16,
      color: 0x2c3e50,
      hoverColor: 0x3d5166,
      pressColor: 0x1a252f,
      onClick: () => this.togglePause()
    })
    this.pauseButton.setDepth(260)

    const backdrop = this.add.rectangle(
      GAME_CONFIG.width / 2,
      GAME_CONFIG.height / 2,
      GAME_CONFIG.width,
      GAME_CONFIG.height,
      0x000000,
      0.62
    )
    const panel = this.add.graphics()
    panel.fillStyle(0x16213e, 0.95)
    panel.fillRoundedRect(CX - 140, CY - 120, 280, 240, 18)
    panel.lineStyle(2, 0x4a90d9, 0.35)
    panel.strokeRoundedRect(CX - 140, CY - 120, 280, 240, 18)

    const title = this.add.text(CX, CY - 88, 'PAUSED', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      resolution: 2
    }).setOrigin(0.5)

    this.pauseResumeButton = new UIButton({
      scene: this,
      x: CX,
      y: CY - 20,
      width: 190,
      height: 54,
      label: 'RESUME',
      fontSize: 22,
      color: 0x27ae60,
      hoverColor: 0x2ecc71,
      pressColor: 0x1e8449,
      onClick: () => this.resumeGame()
    })

    this.pauseReplayButton = new UIButton({
      scene: this,
      x: CX - 62,
      y: CY + 54,
      width: 112,
      height: 46,
      label: 'REPLAY',
      fontSize: 14,
      color: 0x4a90d9,
      hoverColor: 0x5ba3f5,
      pressColor: 0x357abd,
      onClick: () => this.replayFromPause()
    })

    this.pauseMenuButton = new UIButton({
      scene: this,
      x: CX + 62,
      y: CY + 54,
      width: 112,
      height: 46,
      label: 'MENU',
      fontSize: 14,
      color: 0x2c3e50,
      hoverColor: 0x3d5166,
      pressColor: 0x1a252f,
      onClick: () => this.menuFromPause()
    })

    this.pauseOverlay = this.add.container(CX, CY, [backdrop, panel, title])
    this.pauseOverlay.setDepth(900)
    this.pauseOverlay.setVisible(false)

    this.pauseResumeButton.setDepth(910)
    this.pauseReplayButton.setDepth(910)
    this.pauseMenuButton.setDepth(910)
    this.pauseResumeButton.setVisible(false)
    this.pauseReplayButton.setVisible(false)
    this.pauseMenuButton.setVisible(false)
  }

  private togglePause(): void {
    if (this.isFinished || this.phase !== 'cleaning') return
    if (this.isPaused) {
      this.resumeGame()
      return
    }
    this.pauseGame()
  }

  private pauseGame(): void {
    if (this.isPaused || this.isFinished || this.phase !== 'cleaning') return
    this.isPaused = true
    this.stopSprayLoop()
    PokiBridge.gameplayStop('pause')
    this.pauseOverlay?.setVisible(true)
    this.pauseResumeButton?.setVisible(true)
    this.pauseReplayButton?.setVisible(true)
    this.pauseMenuButton?.setVisible(true)
    this.pauseButton?.setText('>')
  }

  private resumeGame(): void {
    if (!this.isPaused || this.isFinished || this.phase !== 'cleaning') return
    this.isPaused = false
    PokiBridge.gameplayStart('resume')
    this.pauseOverlay?.setVisible(false)
    this.pauseResumeButton?.setVisible(false)
    this.pauseReplayButton?.setVisible(false)
    this.pauseMenuButton?.setVisible(false)
    this.pauseButton?.setText('II')
  }

  private replayFromPause(): void {
    const levelId = this.level.id
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('GameScene', { levelId })
    )
  }

  private menuFromPause(): void {
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('MenuScene')
    )
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

    const text = this.add.text(-82, -24, this.getCustomerLine(), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#20313a',
      fontStyle: 'bold',
      wordWrap: { width: 210 },
      resolution: 2
    }).setOrigin(0, 0)

    const hint = this.add.text(-82, 16, this.getArrivalCoachLine(), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#527080',
      resolution: 2
    }).setOrigin(0, 0)

    this.customerBubble = this.add.container(CX, 118, [bubble, avatar, face, text, hint])
    this.customerBubble.setDepth(240).setAlpha(0).setScale(0.92)
  }

  private startArrivalFlow(): void {
    const entryOffset = 560
    this.arrivalTargets = this.arrivalObjects.map((obj) => ({
      obj,
      y: (obj as unknown as Phaser.GameObjects.Components.Transform).y
    }))

    for (const { obj, y } of this.arrivalTargets) {
      const target = obj as unknown as Phaser.GameObjects.Components.Transform
      target.y = y + entryOffset
    }
    this.vehicleShadow.setAlpha(0.18).setScale(0.82, 0.94)

    this.tweens.add({
      targets: this.arrivalObjects,
      y: '-=578',
      duration: 760,
      ease: 'Cubic.Out',
      onComplete: () => {
        if (this.phase !== 'arrival') return
        this.tweens.add({
          targets: this.arrivalObjects,
          y: '+=18',
          duration: 190,
          ease: 'Back.Out',
          onComplete: () => {
            if (this.phase === 'arrival') this.cameras.main.shake(120, 0.0025)
          }
        })
        this.tweens.add({
          targets: this.customerBubble,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          y: 126,
          duration: 220,
          ease: 'Sine.Out'
        })
        this.tweens.add({
          targets: this.vehicleShadow,
          alpha: 0.4,
          scaleX: 1,
          scaleY: 1,
          duration: 240,
          ease: 'Sine.Out'
        })
        this.time.delayedCall(1600, () => this.startCleaningPhase())
      }
    })
  }

  private startCleaningPhase(): void {
    if (this.phase !== 'arrival') return
    this.finishArrivalAtTarget()
    this.phase = 'cleaning'
    this.hasPlayerStarted = true
    PokiBridge.gameplayStart('cleaning_phase_entered')
    this.setCoachBaseMessage(this.getActiveCoachInstruction())
    this.updateTargetPartOverlay()

    if (this.customerBubble) {
      this.tweens.add({
        targets: this.customerBubble,
        alpha: 0,
        y: this.customerBubble.y - 18,
        duration: 220,
        ease: 'Quad.In'
      })
    }

    this.updateToolHighlight()
  }

  private finishArrivalAtTarget(): void {
    if (this.arrivalTargets.length === 0) return
    this.arrivalSkipped = this.timeElapsedMs === 0 && this.customerBubble?.alpha === 0
    this.tweens.killTweensOf(this.arrivalObjects)
    for (const { obj, y } of this.arrivalTargets) {
      const target = obj as unknown as Phaser.GameObjects.Components.Transform
      target.y = y
    }
    this.vehicleShadow.setAlpha(0.4).setScale(1, 1)
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

  private createCoachMessage(): void {
    const layout = this.getSceneLayout()
    this.coachMessageBg = this.add.graphics().setDepth(210)
    this.coachMessageText = this.add.text(CX, layout.coachY, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      stroke: '#1a2530',
      strokeThickness: 6,
      align: 'center',
      resolution: 2
    }).setOrigin(0.5).setDepth(215)
    this.layoutCoachMessage()
  }

  private layoutCoachMessage(): void {
    if (!this.coachMessageText || !this.coachMessageBg) return
    const layout = this.getSceneLayout()
    this.coachMessageBg.clear()
    if (!this.coachMessageText.text) return
    this.coachMessageText.setY(layout.coachY)
    this.fitTextToWidth(this.coachMessageText, layout.coachMaxWidth - 32, 22, 15)
    const bounds = this.coachMessageText.getBounds()
    this.coachMessageBg.fillStyle(0x16213e, 0.82)
    this.coachMessageBg.fillRoundedRect(bounds.x - 16, bounds.y - 8, bounds.width + 32, bounds.height + 16, 16)
    this.coachMessageBg.lineStyle(2, 0x4a90d9, 0.35)
    this.coachMessageBg.strokeRoundedRect(bounds.x - 16, bounds.y - 8, bounds.width + 32, bounds.height + 16, 16)
  }

  private getArrivalCoachLine(): string {
    return this.level.dirtType === 'dust'
      ? 'Use FAN.'
      : `Use ${this.getRecommendedToolName()}.`
  }

  private updateTopHint(): void {
    if (!this.topHintText) return
    const part = this.getPriorityDirtyPartLabel()
    const suffix = part ? ` / ${part.toUpperCase()}` : ''
    this.topHintText.setText(`${this.getRecommendedToolName()} ${this.level.dirtType.toUpperCase()}${suffix}`)
  }

  private getActiveCoachInstruction(): string {
    const targetPart = this.getPriorityDirtyPartLabel()
    const recommended = this.getRecommendedToolName()
    const step = this.getCurrentSequenceStep()
    const targetSuffix = targetPart ? ` ON ${targetPart.toUpperCase()}` : ''

    if (step === 'fan') {
      return `FAN DUST${targetSuffix}`
    }

    if (step === 'jet') {
      return this.requiresPrep()
        ? `RINSE FOAM${targetSuffix}`
        : `JET DUST${targetSuffix}`
    }

    if (step === 'hot') {
      return `HOT ${this.level.dirtType.toUpperCase()}${targetSuffix}`
    }

    return `${recommended} ${this.level.dirtType.toUpperCase()}${targetSuffix}`
  }

  private setCoachBaseMessage(message: string): void {
    this.coachBaseMessage = message
    if (this.coachToastActive) return
    this.feedbackMessage = message
    this.coachMessageText.setText(message.toUpperCase())
    this.layoutCoachMessage()
    this.updateTopHint()
  }

  private showCoachTemporary(message: string, duration = 1100): void {
    this.coachToastQueue.push(message)
    this.playNextCoachToast(duration)
  }

  private playNextCoachToast(duration = 1100): void {
    if (this.coachToastActive || this.coachToastQueue.length === 0) return
    const next = this.coachToastQueue.shift()!
    this.coachToastActive = true
    this.coachOverrideTimer?.remove(false)
    this.feedbackMessage = next
    this.coachMessageText.setText(next.toUpperCase())
    this.coachMessageText.setScale(0.92)
    this.layoutCoachMessage()
    this.tweens.add({
      targets: this.coachMessageText,
      scaleX: 1,
      scaleY: 1,
      duration: 140,
      ease: 'Back.Out'
    })
    this.coachOverrideTimer = this.time.delayedCall(duration, () => {
      this.coachToastActive = false
      this.feedbackMessage = this.coachBaseMessage
      this.coachMessageText.setText(this.coachBaseMessage.toUpperCase())
      this.layoutCoachMessage()
      if (this.coachToastQueue.length > 0) {
        this.playNextCoachToast(duration)
      }
    })
  }

  // ─── Tools UI ─────────────────────────────────────────────────────────────

  private createToolsUI(): void {
    // Only show tools the player has unlocked
    const layout = this.getSceneLayout()
    const unlockedTools = SaveManager.load<string[]>(SAVE_KEYS.unlockedTools, ['fan'])
    const allKeys = Object.keys(BALANCING.tools)
    const toolKeys = allKeys.filter(k => unlockedTools.includes(k))
    const spacing = toolKeys.length <= 2 ? 118 : toolKeys.length === 3 ? 102 : 84
    const startX = CX - ((toolKeys.length - 1) * spacing) / 2

    toolKeys.forEach((key, idx) => {
      const x = startX + idx * spacing
      const y = layout.toolY

      const bg = this.add.circle(x, y, 36, 0x16213e).setInteractive()
      const icon = this.add.image(x, y, 'tool_' + key).setScale(1.2)
      const label = this.add.text(x, y + 38, BALANCING.tools[key].name, {
        fontSize: toolKeys.length >= 4 ? '9px' : '10px',
        color: '#d7e2ef',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      this.toolBacks[key] = bg
      this.toolIcons[key] = icon
      this.toolLabels[key] = label
      this.toolPositions[key] = { x, y }

      bg.on('pointerdown', () => {
        this.activeTool = key
        this.animateToolSelection(key)
        this.updateToolHighlight()
        this.updateBrush()
        AudioManager.playSfx(this, 'sfx_switch', 0.5)
        Analytics.track('tool_selected', { levelId: this.level.id, tool: key })
      })
    })

    this.toolHand = this.add.text(CX, layout.toolY - 70, '👇', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '34px',
      resolution: 2
    }).setOrigin(0.5).setDepth(260).setAlpha(0)

    if (this.requiresPrep()) {
      this.toolSequenceText = this.add.text(CX, layout.sequenceY, 'FOAM  ->  JET', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#8fd3ff',
        fontStyle: 'bold'
      }).setOrigin(0.5)
    }

    this.updateToolHighlight()
  }

  private updateToolHighlight(): void {
    const recommended = this.getRecommendedToolKey()
    const sequence = this.getRequiredSequence()
    const requiredIndex = sequence.indexOf(recommended)
    for (const key of Object.keys(this.toolIcons)) {
      const active = key === this.activeTool
      const preferred = key === recommended
      const keyIndex = sequence.indexOf(key)
      const weakForStep = keyIndex === -1 || keyIndex > requiredIndex

      this.toolIcons[key].setScale(active ? 1.34 : preferred ? 1.18 : 1.0)
      this.toolIcons[key].setAlpha(active ? 1 : weakForStep ? 0.32 : preferred ? 1 : 0.62)
      this.toolBacks[key]?.setFillStyle(preferred ? 0x244d62 : 0x16213e, preferred ? 1 : 0.92)
      this.toolBacks[key]?.setStrokeStyle(active ? 3 : preferred ? 2 : 0, preferred ? 0x8fd3ff : 0x4a90d9, active ? 1 : 0.55)
      this.toolLabels[key]?.setAlpha(preferred || active ? 1 : 0.58)
    }

    if (this.toolSequenceText) {
      this.toolSequenceText.setText(this.getRequiredSequence().map((toolKey) => BALANCING.tools[toolKey].name).join('  ->  '))
      this.toolSequenceText.setAlpha(this.requiresPrep() ? 0.95 : 0.42)
    }
    this.updateToolHand(recommended)
  }

  private updateTargetPartOverlay(): void {
    if (this.phase !== 'cleaning' || this.isFinished) {
      this.targetPartOverlay?.setVisible(false)
      this.targetPartLabel?.setVisible(false)
      return
    }

    const part = this.getPriorityDirtyPart()
    if (!part) {
      this.targetPartOverlay?.setVisible(false)
      this.targetPartLabel?.setVisible(false)
      return
    }

    if (!this.targetPartOverlay) {
      this.targetPartOverlay = this.add.graphics().setDepth(18)
      this.targetPartLabel = this.add.text(0, 0, '', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '12px',
        color: '#ffffff',
        stroke: '#10233a',
        strokeThickness: 4,
        resolution: 2
      }).setOrigin(0.5).setDepth(220)
    }

    this.targetPartOverlay.clear()
    this.targetPartOverlay.setVisible(true).setAlpha(0.7)
    this.targetPartLabel?.setVisible(true)
    this.targetPartOverlay.lineStyle(3, 0x8fd3ff, 0.78)
    this.targetPartOverlay.fillStyle(0x8fd3ff, 0.08)

    for (const rect of part.rects) {
      this.targetPartOverlay.fillRoundedRect(this.maskLeft + rect.x, this.maskTop + rect.y, rect.width, rect.height, 10)
      this.targetPartOverlay.strokeRoundedRect(this.maskLeft + rect.x, this.maskTop + rect.y, rect.width, rect.height, 10)
    }

    this.targetPartLabel?.setText(part.label.toUpperCase())
    this.targetPartLabel?.setPosition(part.centerX, Math.max(72, part.centerY - 36))

    if (this.currentTargetPartKey !== part.key) {
      this.currentTargetPartKey = part.key
      this.targetPartTween?.stop()
      this.tweens.killTweensOf(this.targetPartOverlay)
      this.targetPartOverlay.setAlpha(0.25)
      this.targetPartLabel?.setScale(0.88)
      this.targetPartTween = this.tweens.add({
        targets: this.targetPartLabel,
        alpha: 1,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 540,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      })
      this.tweens.add({
        targets: this.targetPartOverlay,
        alpha: 0.95,
        duration: 540,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      })
    }
  }

  private animateToolSelection(key: string): void {
    const icon = this.toolIcons[key]
    const back = this.toolBacks[key]
    const pos = this.toolPositions[key]
    if (!icon || !back || !pos) return

    this.tweens.killTweensOf([icon, back])
    icon.setScale(1.0)
    back.setScale(1)
    this.tweens.add({
      targets: icon,
      scaleX: 1.45,
      scaleY: 1.45,
      duration: 120,
      ease: 'Back.Out',
      yoyo: true,
      onComplete: () => this.updateToolHighlight()
    })
    this.tweens.add({
      targets: back,
      scaleX: 1.18,
      scaleY: 1.18,
      angle: back.angle + 18,
      duration: 280,
      ease: 'Sine.Out',
      yoyo: true
    })
    this.sparkleEmitter.explode(8, pos.x, pos.y - 6)
  }

  private updateToolHand(recommended: string): void {
    if (!this.toolHand) return
    const pos = this.toolPositions[recommended]
    const shouldShow = this.phase !== 'complete' && !!pos && (this.phase === 'arrival' || !this.hasTrackedFirstWipe || this.activeTool !== recommended)

    if (!shouldShow || !pos) {
      this.toolHand.setAlpha(0)
      this.handPointerTarget = ''
      return
    }

    const targetChanged = this.handPointerTarget !== recommended
    this.handPointerTarget = recommended
    this.toolHand.setPosition(pos.x, pos.y - 66).setAlpha(1)

    if (targetChanged || !this.toolHandTween?.isPlaying()) {
      this.toolHandTween?.stop()
      this.toolHand.setScale(0.92)
      this.toolHandTween = this.tweens.add({
        targets: this.toolHand,
        y: pos.y - 74,
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      })
    }
  }

  private updateBrush(): void {
    const tool = this.getActiveToolConfig()
    const { radius, strength } = tool

    this.brush.clear()
    this.brush.fillStyle(0xffffff, strength)
    this.brush.fillCircle(radius, radius, radius)

    const foamTint = this.level.dirtType === 'oil'
      ? 0xd8dde0
      : this.level.dirtType === 'rust'
        ? 0xf1d6bb
        : this.level.dirtType === 'mud'
          ? 0xe6dccf
          : 0xeaf8ff

    this.foamBrush.clear()
    this.foamBrush.fillStyle(foamTint, 0.72)
    this.foamBrush.fillCircle(radius, radius, radius)
    this.foamBrush.fillStyle(0xffffff, 0.55)
    for (let i = 0; i < 14; i++) {
      this.foamBrush.fillCircle(
        radius + Phaser.Math.Between(-Math.floor(radius * 0.75), Math.floor(radius * 0.75)),
        radius + Phaser.Math.Between(-Math.floor(radius * 0.75), Math.floor(radius * 0.75)),
        Phaser.Math.Between(3, 10)
      )
    }

    // Weak brush for wrong-tool passes: same radius, 20% alpha
    this.weakBrush.clear()
    this.weakBrush.lineStyle(2, 0xffffff, Math.max(0.08, strength * BALANCING.wrongToolStrengthFactor))
    for (let i = 0; i < 4; i++) {
      const y = radius + Phaser.Math.Between(-Math.floor(radius * 0.4), Math.floor(radius * 0.4))
      this.weakBrush.beginPath()
      this.weakBrush.moveTo(radius - radius * 0.35, y)
      this.weakBrush.lineTo(radius + radius * 0.35, y + Phaser.Math.Between(-5, 5))
      this.weakBrush.strokePath()
    }
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.escKey?.on('down', () => this.togglePause(), this)

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (ptr: Phaser.Input.Pointer) => {
      if (this.isFinished || this.isPaused) return
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
      if (!ptr.isDown || this.isFinished || this.isPaused || this.phase !== 'cleaning') return

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

    if (!this.hasTrackedFirstWipe && this.isWithinMask(localX, localY)) {
      this.hasTrackedFirstWipe = true
      Analytics.track('first_wipe_started', {
        levelId: this.level.id,
        world: this.level.world,
        tool: this.activeTool
      })
    }

    const requiredStep = this.getCurrentSequenceStep()
    const isRecommendedTool = this.activeTool === requiredStep

    // Logical grid update (layerGrid drives cell completion)
    let cellsCleanedNow = 0
    let stagedNow = 0
    let touchedDirty = 0
    let blockedByOrder = 0
    let canCleanTouched = 0
    const startCol = Math.max(0, Math.floor((localX - radius) / this.CELL_SIZE))
    const gridCols = this.grid[0] ? this.grid[0].length - 1 : 0
    const endCol   = Math.min(gridCols, Math.floor((localX + radius) / this.CELL_SIZE))
    const startRow = Math.max(0, Math.floor((localY - radius) / this.CELL_SIZE))
    const endRow   = Math.min(this.grid.length - 1, Math.floor((localY + radius) / this.CELL_SIZE))

    let usedFoamThisWipe = false
    let usedHotThisWipe = false
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (this.grid[r][c]) continue

        const cx = c * this.CELL_SIZE + this.CELL_SIZE / 2
        const cy = r * this.CELL_SIZE + this.CELL_SIZE / 2
        if (Phaser.Math.Distance.Between(cx, cy, localX, localY) > radius) continue

        touchedDirty++
        const state = this.cellStateGrid[r][c] ?? 'raw'
        const nextState = this.getToolAdvanceState(this.activeTool, state)
        const canClean = this.canToolCleanState(this.activeTool, state)

        if (nextState && nextState !== state) {
          this.cellStateGrid[r][c] = nextState
          stagedNow++
          if (this.isReadyToCleanState(nextState)) {
            this.setPrepCellState(r, c, true)
          }
          if (this.activeTool === 'foam') {
            usedFoamThisWipe = true
          }
          if (this.activeTool === 'hot') {
            usedHotThisWipe = true
          }
          continue
        }

        if (!canClean) {
          blockedByOrder++
          continue
        }

        canCleanTouched++
        const cleanStrength = this.getCleanStrengthForState(this.activeTool, state, isRecommendedTool)
        this.layerGrid[r][c] = Math.max(0, this.layerGrid[r][c] - cleanStrength)
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

    if (usedFoamThisWipe) {
      this.foamRT.draw(this.foamBrush, localX - radius, localY - radius)
    }
    if (usedHotThisWipe) {
      this.emitHotSteamEffect(this.maskLeft + localX, this.maskTop + localY)
    }
    if (canCleanTouched > 0) {
      this.dirtRT.erase(this.brush, localX - radius, localY - radius)
      this.foamRT.erase(this.brush, localX - radius, localY - radius)
    }

    this.totalWipeCalls++
    const wipeResult: WipeResult = cellsCleanedNow > 0
      ? 'cleaned'
      : stagedNow > 0
        ? 'advanced'
        : blockedByOrder > 0 && touchedDirty > 0
          ? 'blocked_wrong_order'
          : touchedDirty > 0
            ? 'wrong_tool'
            : 'empty'
    if (wipeResult !== 'cleaned' && wipeResult !== 'advanced') this.wasteWipeCalls++
    if (cellsCleanedNow > 0 && this.time.now - this.lastClearSfxMs >= BALANCING.clearSfxCooldownMs) {
      AudioManager.playSfx(this, 'sfx_clear', 0.35)
      this.lastClearSfxMs = this.time.now
    }

    if (wipeResult === 'cleaned') {
      this.emitSuccessfulWipeFeedback(localX, localY, cellsCleanedNow)
      this.showGoodToolFeedback()
      this.streakCells += cellsCleanedNow
      this.checkStreakMilestone()
    } else if (wipeResult === 'advanced') {
      this.emitAdvancedWipeFeedback(localX, localY)
      this.showPrepFeedback()
    } else if (wipeResult === 'blocked_wrong_order') {
      this.streakCells = 0
      this.lastStreakMilestone = 0
      this.showPrepWarning()
    } else if (wipeResult === 'wrong_tool' && !isRecommendedTool) {
      this.streakCells = 0
      this.lastStreakMilestone = 0
      this.showWrongToolWarning()
    }

    if ((wipeResult === 'blocked_wrong_order' || wipeResult === 'wrong_tool') && touchedDirty > 0) {
      this.emitWeakScratchEffect(this.maskLeft + localX, this.maskTop + localY)
    }

    this.setCoachBaseMessage(this.getActiveCoachInstruction())
    this.updateTargetPartOverlay()
    this.updateToolHighlight()
    this.updateTopHint()
    this.updateProgress()
  }

  // ─── Progress & Completion ────────────────────────────────────────────────

  private emitSuccessfulWipeFeedback(localX: number, localY: number, cellsCleaned: number): void {
    const sceneX = this.maskLeft + localX
    const sceneY = this.maskTop + localY
    this.emitToolTrailEffect(sceneX, sceneY)
    this.sparkleEmitter.emitParticleAt(sceneX, sceneY, Math.min(8, Math.max(2, Math.floor(cellsCleaned / 2))))

    const shine = this.add.graphics().setDepth(19)
    shine.lineStyle(3, 0xffffff, 0.42)
    shine.beginPath()
    shine.moveTo(sceneX - 14, sceneY + 8)
    shine.lineTo(sceneX + 16, sceneY - 10)
    shine.strokePath()
    this.tweens.add({
      targets: shine,
      alpha: 0,
      y: shine.y - 14,
      duration: 340,
      ease: 'Sine.Out',
      onComplete: () => shine.destroy()
    })
  }

  private emitAdvancedWipeFeedback(localX: number, localY: number): void {
    const sceneX = this.maskLeft + localX
    const sceneY = this.maskTop + localY
    this.emitToolTrailEffect(sceneX, sceneY)

    const ring = this.add.circle(sceneX, sceneY, 10, 0x8fd3ff, 0.18).setDepth(22)
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: 2.4,
      scaleY: 2.4,
      duration: 260,
      ease: 'Sine.Out',
      onComplete: () => ring.destroy()
    })
  }

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
    this.isPaused = false
    this.phase = 'complete'
    PokiBridge.gameplayStop('level_complete')
    this.stopSprayLoop()
    this.targetPartOverlay?.setVisible(false)
    this.targetPartLabel?.setVisible(false)

    // Camera punch: celebratory shake
    this.cameras.main.shake(380, 0.01)

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
    void toolKey
  }

  // ─── Wrong-Tool Warning ───────────────────────────────────────────────────

  private showWrongToolWarning(): void {
    if (this.wrongToolWarningTimer > 0) return
    this.wrongToolWarningTimer = BALANCING.wrongToolWarningCooldown

    const betterTool = this.getRecommendedToolName()
    this.feedbackMessage = `${this.level.dirtType.toUpperCase()} needs ${betterTool}`
    this.showCoachTemporary(`Try ${betterTool}`, 1000)
  }

  private showGoodToolFeedback(): void {
    if (this.hasShownGoodToolFeedback) return
    this.hasShownGoodToolFeedback = true
    this.setCoachBaseMessage(this.getActiveCoachInstruction())
  }

  private showPrepFeedback(): void {
    this.setCoachBaseMessage(this.getActiveCoachInstruction())
  }

  private showPrepWarning(): void {
    if (this.wrongToolWarningTimer > 0) return
    this.wrongToolWarningTimer = BALANCING.wrongToolWarningCooldown
    const required = this.getRecommendedToolName()
    this.feedbackMessage = `${this.level.dirtType.toUpperCase()} needs ${required} first`

    // Brief red flash to signal wrong order (stronger than the text alone)
    this.cameras.main.flash(160, 200, 50, 50, true)
    this.showCoachTemporary(`${required} first`, 1100)
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

  private checkStreakMilestone(): void {
    const milestones: Array<[number, string]> = [
      [25, 'STREAK! 🔥'],
      [65, 'HOT STREAK! 🔥'],
      [130, 'ON FIRE! 🔥🔥']
    ]
    for (const [threshold, label] of milestones) {
      if (this.streakCells >= threshold && this.lastStreakMilestone < threshold) {
        this.lastStreakMilestone = threshold
        this.showStreakFeedback(label)
        break
      }
    }
  }

  private showStreakFeedback(label: string): void {
    this.showCoachTemporary(label.replace(/[^A-Z ]/gi, '').trim() || 'Streak', 950)
  }

  private getRecommendedToolName(): string {
    return BALANCING.tools[this.getRecommendedToolKey()].name
  }

  private getRecommendedToolKey(): string {
    const sequence = this.getRequiredSequence()
    const unlocked = SaveManager.load<string[]>(SAVE_KEYS.unlockedTools, ['fan'])
    const stage = this.getPrimaryDirtyStage()
    const clampedStage = Math.max(0, Math.min(stage, sequence.length - 1))
    const preferred = sequence[clampedStage] ?? sequence[0]
    if (unlocked.includes(preferred)) return preferred
    const fallback = sequence.find((toolKey) => unlocked.includes(toolKey))
    return fallback ?? 'fan'
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


  private getRequiredSequence(): string[] {
    return BALANCING.dirtSequences[this.level.dirtType] ?? ['fan']
  }

  private getCurrentSequenceStep(): string {
    const state = this.getPrimaryDirtyState()
    if (this.level.dirtType === 'dust') return 'fan'
    if (this.level.dirtType === 'mud') return state === 'foamed' || state === 'ready' ? 'jet' : 'foam'
    if (this.level.dirtType === 'oil') {
      if (state === 'raw') return 'hot'
      if (state === 'softened') return 'foam'
      return 'jet'
    }
    if (this.level.dirtType === 'rust') return state === 'foamed' ? 'jet' : 'foam'
    return 'fan'
  }

  private getPrimaryDirtyStage(): number {
    const sequence = this.getRequiredSequence()
    const step = this.getCurrentSequenceStep()
    return Math.max(0, sequence.indexOf(step))
  }

  private getPrimaryDirtyState(): DirtCellState {
    const stateCounts = new Map<DirtCellState, number>()
    let dirtyCells = 0
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < (this.grid[r]?.length ?? 0); c++) {
        if (this.grid[r][c]) continue
        const state = this.cellStateGrid[r]?.[c] ?? 'raw'
        stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1)
        dirtyCells++
      }
    }

    if (dirtyCells <= 0) return 'ready'

    if (this.level.dirtType === 'oil') {
      if ((stateCounts.get('foamed') ?? 0) / dirtyCells >= 0.28) return 'foamed'
      if ((stateCounts.get('softened') ?? 0) / dirtyCells >= 0.28) return 'softened'
      return 'raw'
    }

    if (this.level.dirtType === 'mud') {
      const cleanable = (stateCounts.get('foamed') ?? 0) + (stateCounts.get('ready') ?? 0)
      if (cleanable / dirtyCells >= 0.28) return (stateCounts.get('foamed') ?? 0) >= (stateCounts.get('ready') ?? 0) ? 'foamed' : 'ready'
      return 'raw'
    }

    if (this.level.dirtType === 'rust') {
      if ((stateCounts.get('foamed') ?? 0) / dirtyCells >= 0.28) return 'foamed'
      return 'raw'
    }

    return 'raw'
  }

  private getToolAdvanceState(toolKey: string, state: DirtCellState): DirtCellState | null {
    if (toolKey === 'foam') {
      if ((this.level.dirtType === 'mud' || this.level.dirtType === 'rust') && state === 'raw') return 'foamed'
      if (this.level.dirtType === 'oil' && state === 'softened') return 'foamed'
      return null
    }

    if (toolKey === 'hot') {
      if (this.level.dirtType === 'oil' && state === 'raw') return 'softened'
      if (this.level.dirtType === 'mud' && state === 'raw') return 'ready'
      return null
    }

    return null
  }

  private canToolCleanState(toolKey: string, state: DirtCellState): boolean {
    if (toolKey === 'fan') return this.level.dirtType === 'dust' && state === 'raw'
    if (toolKey !== 'jet') return false
    if (this.level.dirtType === 'dust') return state === 'raw'
    if (this.level.dirtType === 'mud') return state === 'foamed' || state === 'ready'
    if (this.level.dirtType === 'oil') return state === 'foamed'
    if (this.level.dirtType === 'rust') return state === 'foamed'
    return false
  }

  private isReadyToCleanState(state: DirtCellState): boolean {
    if (this.level.dirtType === 'dust') return state === 'raw'
    if (this.level.dirtType === 'mud') return state === 'foamed' || state === 'ready'
    if (this.level.dirtType === 'oil') return state === 'foamed'
    if (this.level.dirtType === 'rust') return state === 'foamed'
    return false
  }

  private getCleanStrengthForState(toolKey: string, state: DirtCellState, isRecommendedTool: boolean): number {
    const tool = this.getActiveToolConfig()
    if (this.canToolCleanState(toolKey, state)) {
      if (this.level.dirtType === 'dust' && toolKey === 'jet') return tool.strength * 0.35
      if (this.level.dirtType === 'mud' && state === 'ready') return tool.strength * 0.72
      return tool.strength
    }
    const baseTool = BALANCING.tools[toolKey]
    const wrongFactor = baseTool?.wrongStateStrengthFactor ?? BALANCING.wrongToolStrengthFactor
    return tool.strength * (isRecommendedTool ? BALANCING.unpreppedStrengthFactor : wrongFactor)
  }

  private setPrepCellState(row: number, col: number, prepped: boolean): void {
    if (this.prepGrid[row][col] === prepped) return
    this.prepGrid[row][col] = prepped
    this.preppedCells += prepped ? 1 : -1
    if (this.preppedCells < 0) this.preppedCells = 0
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
        .setVisible(false)

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
    // Bonus HUD is hidden during the cohesion pass.
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
    this.setCoachBaseMessage(this.getActiveCoachInstruction())
    this.updatePartsHud()

    this.sparkleEmitter.explode(18, part.centerX, part.centerY)
    if (this.targetPartOverlay && this.targetPartLabel) {
      this.targetPartOverlay.setAlpha(1)
      this.targetPartLabel.setScale(1.16)
      this.tweens.add({
        targets: this.targetPartLabel,
        scaleX: 1,
        scaleY: 1,
        duration: 180,
        ease: 'Back.Out'
      })
    }
    AudioManager.playSfx(this, 'sfx_clear', 0.45)
    this.showCoachTemporary(`${part.label} clean +$${BALANCING.cash.partCompleteCash}`)
    this.updateTargetPartOverlay()
  }

  private updatePartsHud(): void {
    // Part summary is result/debug-only during the cohesion pass.
  }

  private getCompletedPartCount(): number {
    return this.vehicleParts.filter((part) => part.completed).length
  }

  private getPriorityDirtyPartLabel(): string | null {
    const nextPart = this.getPriorityDirtyPart()
    return nextPart ? nextPart.label : null
  }

  private getPriorityDirtyPart(): PartState | null {
    let candidate: PartState | null = null
    let highestDirtyRatio = -1

    for (const part of this.vehicleParts) {
      if (part.completed || part.totalCells <= 0) continue
      const dirtyRatio = part.remainingCells / part.totalCells
      if (dirtyRatio > highestDirtyRatio) {
        highestDirtyRatio = dirtyRatio
        candidate = part
      }
    }

    return candidate
  }

  private getCurrentPartHint(): string {
    const targetPart = this.getPriorityDirtyPartLabel()
    return targetPart ? `${targetPart} dirty` : 'All parts clean'
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

  public getWorldProgressLabel(): string {
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
    // Progression info is intentionally removed from active gameplay HUD.
  }

  private emitToolTrailEffect(sceneX: number, sceneY: number): void {
    const tool = this.activeTool
    if (tool === 'foam') {
      this.foamEmitter.emitParticleAt(sceneX, sceneY, 7)
      this.sparkleEmitter.emitParticleAt(sceneX + Phaser.Math.Between(-8, 8), sceneY + Phaser.Math.Between(-8, 8), 1)
      return
    }

    if (tool === 'jet') {
      this.jetEmitter.emitParticleAt(sceneX, sceneY, 5)
      return
    }

    if (tool === 'hot') {
      this.emitHotSteamEffect(sceneX, sceneY)
      return
    }

    this.dustEmitter.emitParticleAt(sceneX, sceneY, 8)
  }

  private emitHotSteamEffect(sceneX: number, sceneY: number): void {
    this.steamEmitter.emitParticleAt(sceneX + Phaser.Math.Between(-8, 8), sceneY + Phaser.Math.Between(-8, 8), 5)
    this.sparkleEmitter.emitParticleAt(sceneX + Phaser.Math.Between(-6, 6), sceneY + Phaser.Math.Between(-6, 6), 1)
  }

  private emitWeakScratchEffect(sceneX: number, sceneY: number): void {
    this.scratchEmitter.emitParticleAt(sceneX, sceneY, 4)
  }

  private getToolEffectivenessState(): 'correct_step' | 'useful_shortcut' | 'wrong_order' | 'wrong_dirt' | 'final_clean' {
    const required = this.getCurrentSequenceStep()
    const state = this.getPrimaryDirtyState()
    if (this.canToolCleanState(this.activeTool, state)) return 'final_clean'
    if (this.activeTool === required) return 'correct_step'
    if (this.getToolAdvanceState(this.activeTool, state)) return 'useful_shortcut'
    const sequence = this.getRequiredSequence()
    const activeStepIndex = sequence.indexOf(this.activeTool)
    const requiredIndex = sequence.indexOf(required)
    if (activeStepIndex < 0) return 'wrong_dirt'
    return activeStepIndex > requiredIndex ? 'wrong_order' : 'wrong_dirt'
  }

  private getCellStateSummary(): Record<string, number> {
    const summary: Record<string, number> = {
      raw: 0,
      softened: 0,
      foamed: 0,
      ready: 0,
      clean: this.cleanCells
    }
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < (this.grid[r]?.length ?? 0); c++) {
        if (this.grid[r][c]) continue
        const state = this.cellStateGrid[r]?.[c] ?? 'raw'
        summary[state] = (summary[state] ?? 0) + 1
      }
    }
    return summary
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
      arrivalSkipped: this.arrivalSkipped,
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
      guidedTool: this.getRecommendedToolKey(),
      requiredSequence: this.getRequiredSequence(),
      currentSequenceStep: this.getCurrentSequenceStep(),
      readyToCleanPercent: Math.floor(this.getPrepRatio() * 100),
      toolEffectiveness: this.getToolEffectivenessState(),
      handPointerVisible: !!this.toolHand && this.toolHand.alpha > 0,
      handPointerTarget: this.handPointerTarget,
      prep: {
        required: this.requiresPrep(),
        percent: Math.floor(this.getPrepRatio() * 100),
        preppedCells: this.preppedCells,
        totalCells: this.totalCells
      },
      cellStateSummary: this.getCellStateSummary(),
      feedbackMessage: this.feedbackMessage,
      customerBubbleVisible: !!this.customerBubble?.active && this.customerBubble.alpha > 0,
      cash: EconomySystem.getCash(),
      ownedUpgrades: UpgradeSystem.loadLevels(),
      tutorialVisible: false,
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
        currentHint: this.getCurrentPartHint(),
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
