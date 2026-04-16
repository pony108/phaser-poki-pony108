import { AudioManager } from '../core/AudioManager'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { formatScore } from '../utils/helpers'
import { SaveManager, SAVE_KEYS } from '../core/SaveManager'

const CX = GAME_CONFIG.width / 2
const CY = GAME_CONFIG.height / 2

export class GameScene extends Phaser.Scene {
  private dirtRT!: Phaser.GameObjects.RenderTexture
  private brush!: Phaser.GameObjects.Graphics

  // UI
  private progressText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text
  private toolIcons: Record<string, Phaser.GameObjects.Image> = {}
  
  // Particles
  private effectEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private sparkleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter

  // Game State
  private activeTool: keyof typeof BALANCING.tools = 'widesponge'
  private grid: boolean[][] = []
  private CELL_SIZE = 10
  private totalCells = 0
  private cleanCells = 0
  private timeElapsedMs = 0
  private dragTimeMs = 0
  private wasteTimeMs = 0
  private isFinished = false
  private maskLeft = 0
  private maskTop = 0
  private prevPointerX = 0
  private prevPointerY = 0

  private vehicleType = 0

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.cameras.main.setBackgroundColor(config.game.backgroundColor)
    this.cameras.main.fadeIn(BALANCING.sceneFadeDuration, 0, 0, 0)

    // Select vehicle based on completed cleans
    const completed = SaveManager.load(SAVE_KEYS.completedCleans, 0)
    if (completed >= 10) this.vehicleType = Phaser.Math.Between(0, 4)
    else if (completed >= 5) this.vehicleType = Phaser.Math.Between(0, 3)
    else if (completed >= 3) this.vehicleType = Phaser.Math.Between(0, 2)
    else if (completed >= 1) this.vehicleType = Phaser.Math.Between(0, 1)
    else this.vehicleType = 0

    this.isFinished = false
    this.timeElapsedMs = 0
    this.dragTimeMs = 0
    this.wasteTimeMs = 0
    this.activeTool = 'widesponge'

    this.createWorld()
    this.createVehicleAndDirt()
    this.createParticles()
    this.createHUD()
    this.createToolsUI()
    this.setupInput()

    this.brush = this.make.graphics()
    this.updateBrush()
  }

  update(time: number, delta: number): void {
    if (this.isFinished) return
    this.timeElapsedMs += delta
    this.timerText.setText(`${Math.floor(this.timeElapsedMs / 1000)}s`)
  }

  private createWorld(): void {
    // A nice concrete/driveway background
    const bg = this.add.graphics()
    bg.fillStyle(0x34495e, 1)
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)
    
    // Add some driveway stripes / water drains
    bg.lineStyle(4, 0x2c3e50, 0.5)
    bg.beginPath()
    bg.moveTo(CX - 150, 0)
    bg.lineTo(CX - 150, GAME_CONFIG.height)
    bg.moveTo(CX + 150, 0)
    bg.lineTo(CX + 150, GAME_CONFIG.height)
    bg.strokePath()
  }

  private createVehicleAndDirt(): void {
    const vKey = `vehicle_${this.vehicleType}`
    
    // Calculate size
    let vw = 180
    let vh = 340
    if (this.vehicleType === 1) { vw += 20; vh += 40 } // SUV
    if (this.vehicleType === 3) { vw += 30; vh += 60 } // Truck
    
    this.maskLeft = CX - vw / 2
    this.maskTop = CY - 80 - vh / 2

    // Shadow
    const shadow = this.add.graphics()
    shadow.fillStyle(0x000000, 0.4)
    shadow.fillRoundedRect(this.maskLeft + 10, this.maskTop + 10, vw, vh, 20)

    // Vehicle Base
    const vehicle = this.add.sprite(CX, CY - 80, vKey)
    
    // Dirt mask: Render texture sizes exactly over vehicle
    this.dirtRT = this.add.renderTexture(this.maskLeft, this.maskTop, vw, vh)
    
    // Fill dirt
    const dirtGen = this.make.graphics()
    
    let dirtColor1 = 0x8c7b70
    let dirtColor2 = 0x5e524a
    
    if (this.vehicleType === 0) {
      // Even dust
      dirtGen.fillStyle(0x999999, 0.9)
      dirtGen.fillRect(0, 0, vw, vh)
    } else {
      // Blobs and mud
      dirtGen.fillStyle(dirtColor1, 0.9)
      dirtGen.fillRect(0, 0, vw, vh)
      
      dirtGen.fillStyle(dirtColor2, 0.95)
      for (let i = 0; i < 60; i++) {
        const x = Phaser.Math.Between(0, vw)
        const y = Phaser.Math.Between(0, vh)
        const r = Phaser.Math.Between(10, 40)
        dirtGen.fillCircle(x, y, r)
      }
    }
    
    this.dirtRT.draw(dirtGen, 0, 0)
    dirtGen.destroy()

    // Initialize tracking grid
    this.grid = []
    this.totalCells = 0
    this.cleanCells = 0
    
    const cols = Math.ceil(vw / this.CELL_SIZE)
    const rows = Math.ceil(vh / this.CELL_SIZE)
    
    for (let r = 0; r < rows; r++) {
      this.grid[r] = []
      for (let c = 0; c < cols; c++) {
        this.grid[r][c] = false // not clean
        this.totalCells++
      }
    }
  }

  private createParticles(): void {
    this.effectEmitter = this.add.particles(0, 0, 'particle', {
      speed: { min: 20, max: 60 },
      alpha: { start: 1, end: 0 },
      scale: { start: 1, end: 0.5 },
      lifespan: 400,
      frequency: -1 // Manual emit
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

  private createHUD(): void {
    const barW = GAME_CONFIG.width - 40
    
    // Progress Bar Track
    this.add.rectangle(CX, 30, barW, 20, 0x16213e).setOrigin(0.5)
    
    // Progress Label
    this.progressText = this.add.text(CX, 30, '0%', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    // Timer
    this.timerText = this.add.text(20, 50, '0s', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0)
  }

  private createToolsUI(): void {
    const toolKeys = Object.keys(BALANCING.tools) as Array<keyof typeof BALANCING.tools>
    const spacing = 100
    const startX = CX - ((toolKeys.length - 1) * spacing) / 2
    
    toolKeys.forEach((key, idx) => {
      const x = startX + (idx * spacing)
      const y = GAME_CONFIG.height - 70
      
      const conf = BALANCING.tools[key]
      
      const bg = this.add.circle(x, y, 36, 0x16213e).setInteractive()
      
      const icon = this.add.image(x, y, 'tool_' + key).setScale(1.2)
      this.toolIcons[key] = icon
      
      this.add.text(x, y + 40, conf.name, {
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
    Object.keys(this.toolIcons).forEach(key => {
      if (key === this.activeTool) {
        this.toolIcons[key].setScale(1.4)
        this.toolIcons[key].setAlpha(1.0)
      } else {
        this.toolIcons[key].setScale(1.0)
        this.toolIcons[key].setAlpha(0.5)
      }
    })
  }

  private updateBrush(): void {
    this.brush.clear()
    const radius = BALANCING.tools[this.activeTool].radius
    this.brush.fillStyle(0xffffff, BALANCING.tools[this.activeTool].strength) // Alpha acts as strength in erase blend mode if we used partial opacity, but Phaser RT erase is binary unless using specialized shaders, so we'll just do a hard circle and rely on manual speed tracking for "strength".
    this.brush.fillCircle(radius, radius, radius)
  }

  private setupInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (ptr: Phaser.Input.Pointer) => {
      if (this.isFinished) return
      this.prevPointerX = ptr.x
      this.prevPointerY = ptr.y
      this.handleWipe(ptr.x, ptr.y)
    })

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || this.isFinished) return
      
      // Interpolate line between previous and current pointer for continuous brushing
      const dist = Phaser.Math.Distance.Between(this.prevPointerX, this.prevPointerY, ptr.x, ptr.y)
      const steps = Math.max(1, Math.floor(dist / 10))
      
      for (let i = 0; i <= steps; i++) {
        const tx = Phaser.Math.Interpolation.Linear([this.prevPointerX, ptr.x], i / steps)
        const ty = Phaser.Math.Interpolation.Linear([this.prevPointerY, ptr.y], i / steps)
        this.handleWipe(tx, ty)
      }

      this.prevPointerX = ptr.x
      this.prevPointerY = ptr.y
      
      // Emit particles
      const rad = BALANCING.tools[this.activeTool].radius
      this.effectEmitter.emitParticleAt(ptr.x + Phaser.Math.Between(-rad/2, rad/2), ptr.y + Phaser.Math.Between(-rad/2, rad/2))
    })
  }

  private handleWipe(x: number, y: number): void {
    // Record dragging time for efficiency calc
    this.dragTimeMs += this.game.loop.delta
    
    // Relative coordinates to the render texture
    const localX = x - this.maskLeft
    const localY = y - this.maskTop

    const radius = BALANCING.tools[this.activeTool].radius

    // Erase from visual mask
    this.dirtRT.erase(this.brush, localX - radius, localY - radius)

    // Update logical grid
    let cellsCleanedNow = 0
    
    const startCol = Math.max(0, Math.floor((localX - radius) / this.CELL_SIZE))
    const endCol = Math.min(this.grid[0].length - 1, Math.floor((localX + radius) / this.CELL_SIZE))
    const startRow = Math.max(0, Math.floor((localY - radius) / this.CELL_SIZE))
    const endRow = Math.min(this.grid.length - 1, Math.floor((localY + radius) / this.CELL_SIZE))

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (!this.grid[r][c]) {
          // Check circular distance roughly
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

    if (cellsCleanedNow === 0) {
      // Wiping an already clean area
      this.wasteTimeMs += this.game.loop.delta
    }

    this.updateProgress()
  }

  private updateProgress(): void {
    const pct = Math.min(100, Math.floor((this.cleanCells / this.totalCells) * 100))
    this.progressText.setText(`${pct}%`)

    // Simple milestone floating text can go here

    if (pct >= 98 && !this.isFinished) {
      this.triggerComplete()
    }
  }

  private triggerComplete(): void {
    this.isFinished = true
    
    // Wipe remaining mask instantly
    this.dirtRT.clear()
    
    // Sparkle explosion
    this.sparkleEmitter.explode(100, CX, CY - 80)
    AudioManager.playSfx(this, 'sfx_score') // Triumphant

    // Update save state
    const currentCompleted = SaveManager.load(SAVE_KEYS.completedCleans, 0)
    SaveManager.save(SAVE_KEYS.completedCleans, currentCompleted + 1)

    // Calculate score
    const seconds = this.timeElapsedMs / 1000
    const timeBonus = Math.max(0.5, 2.0 - (seconds / 60))
    const wasteFactor = this.dragTimeMs > 0 ? (this.wasteTimeMs / this.dragTimeMs) : 0
    const toolEfficiency = 1.0 - (wasteFactor * 0.3)
    
    const finalScore = Math.floor(BALANCING.baseScore * timeBonus * toolEfficiency)

    // Transition out
    this.time.delayedCall(2000, () => {
      this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 255, 255, 255)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        
        let hs = SaveManager.load(SAVE_KEYS.highScore, 0)
        let isNewHS = false
        if (finalScore > hs) {
          hs = finalScore
          isNewHS = true
          SaveManager.save(SAVE_KEYS.highScore, hs)
        }

        this.scene.start('ResultScene', {
          score: finalScore,
          highScore: hs,
          isNewHighScore: isNewHS
        })
      })
    })
  }
}
