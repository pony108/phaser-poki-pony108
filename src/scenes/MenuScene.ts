import { UIButton } from '../components/UIButton'
import { AudioManager } from '../core/AudioManager'
import { Analytics } from '../core/Analytics'
import { SaveManager, SAVE_KEYS } from '../core/SaveManager'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { TOTAL_LEVELS, levelIndexInWorld, levelsInWorld, worldForLevel, worldName } from '../data/levels'

const CX = GAME_CONFIG.width / 2
const CY = GAME_CONFIG.height / 2

export class MenuScene extends Phaser.Scene {
  private muteButton!: UIButton
  private enterKey!: Phaser.Input.Keyboard.Key
  private spaceKey!: Phaser.Input.Keyboard.Key
  private escapeKey!: Phaser.Input.Keyboard.Key

  constructor() {
    super({ key: 'MenuScene' })
  }

  create(): void {
    this.cameras.main.setBackgroundColor(config.game.backgroundColor)
    this.cameras.main.fadeIn(BALANCING.sceneFadeDuration, 0, 0, 0)

    this.createBackground()
    this.createTitle()
    this.createButtons()
    this.createFooter()
    this.setupKeyboard()

    Analytics.track('menu_viewed', {
      currentLevel: SaveManager.load<number>(SAVE_KEYS.currentLevel, 1)
    })
  }

  private createBackground(): void {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1)
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)

    bg.fillStyle(0x4a90d9, 0.06)
    bg.fillCircle(CX - 120, 160, 190)
    bg.fillStyle(0xe74c3c, 0.05)
    bg.fillCircle(CX + 100, GAME_CONFIG.height - 180, 230)
  }

  private createTitle(): void {
    this.add.image(CX, CY - 165, 'game_logo')
      .setOrigin(0.5)
      .setScale(0.42)

    this.add.text(CX, CY - 100, 'Grab a sponge!', {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaacc',
      resolution: 2
    }).setOrigin(0.5)
  }

  private createButtons(): void {
    const savedLevel = SaveManager.load<number>(SAVE_KEYS.currentLevel, 1)
    const hasProgress = savedLevel > 1
    const primaryY = hasProgress ? CY - 8 : CY + 6

    if (hasProgress) {
      new UIButton({
        scene: this,
        x: CX,
        y: primaryY,
        width: 240,
        height: 64,
        label: `CONTINUE  Lv${savedLevel}`,
        fontSize: 22,
        color: 0x27ae60,
        hoverColor: 0x2ecc71,
        pressColor: 0x1e8449,
        onClick: () => this.startGame(savedLevel)
      })

      new UIButton({
        scene: this,
        x: CX,
        y: primaryY + 90,
        width: 200,
        height: 52,
        label: 'NEW GAME',
        fontSize: 20,
        color: 0x4a90d9,
        hoverColor: 0x5ba3f5,
        pressColor: 0x357abd,
        onClick: () => this.startNewGame()
      })
    } else {
      new UIButton({
        scene: this,
        x: CX,
        y: primaryY,
        width: 240,
        height: 64,
        label: 'PLAY',
        fontSize: 26,
        color: 0x4a90d9,
        hoverColor: 0x5ba3f5,
        pressColor: 0x357abd,
        onClick: () => this.startGame(1)
      })
    }

    this.muteButton = new UIButton({
      scene: this,
      x: 34,
      y: 34,
      width: 48,
      height: 48,
      label: AudioManager.muted ? '🔇' : '🔊',
      fontSize: 22,
      color: 0x2c3e50,
      hoverColor: 0x3d5166,
      pressColor: 0x1a252f,
      onClick: () => this.toggleMute()
    })
  }

  private createFooter(): void {
    const currentLevel = SaveManager.load<number>(SAVE_KEYS.currentLevel, 1)
    const currentWorld = worldForLevel(currentLevel)
    const unlockedTools = SaveManager.load<string[]>(SAVE_KEYS.unlockedTools, ['fan'])
    const completedLevels = SaveManager.load<Record<number, boolean>>(SAVE_KEYS.levelCompleted, {})
    const worldLevels = levelsInWorld(currentWorld)
    const completedInWorld = worldLevels.filter((levelId) => completedLevels[levelId]).length

    const hs = SaveManager.load<number>(SAVE_KEYS.highScore, 0)
    if (hs > 0) {
      this.add.text(CX, CY + 188, `Best: ${hs.toLocaleString()}`, {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#f1c40f',
        resolution: 2
      }).setOrigin(0.5)
    }

    this.add.text(
      CX,
      CY + 228,
      `${worldName(currentWorld)}  W${currentWorld}-${levelIndexInWorld(currentLevel)}  •  ${completedInWorld}/${worldLevels.length} cleared  •  ${unlockedTools.length}/${Object.keys(BALANCING.tools).length} tools`,
      {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#9eb8d8',
        resolution: 2
      }
    ).setOrigin(0.5)

    this.add.text(CX, CY + 250, `Progress: ${Math.max(0, currentLevel - 1)} / ${TOTAL_LEVELS} levels`, {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#666688',
      resolution: 2
    }).setOrigin(0.5)
  }

  private setupKeyboard(): void {
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

    const savedLevel = SaveManager.load<number>(SAVE_KEYS.currentLevel, 1)
    this.enterKey.on('down', () => this.startGame(savedLevel), this)
    this.spaceKey.on('down', () => this.startGame(savedLevel), this)
    this.escapeKey.on('down', this.toggleMute, this)
  }

  private startGame(levelId: number = 1): void {
    Analytics.track('game_started', {
      levelId,
      world: worldForLevel(levelId)
    })
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('GameScene', { levelId })
    )
  }

  private startNewGame(): void {
    const fromLevel = SaveManager.load<number>(SAVE_KEYS.currentLevel, 1)
    SaveManager.remove(SAVE_KEYS.highScore)
    SaveManager.remove(SAVE_KEYS.completedCleans)
    SaveManager.remove(SAVE_KEYS.currentLevel)
    SaveManager.remove(SAVE_KEYS.levelStars)
    SaveManager.remove(SAVE_KEYS.unlockedTools)
    SaveManager.remove(SAVE_KEYS.levelCompleted)
    SaveManager.remove(SAVE_KEYS.cash)
    SaveManager.remove(SAVE_KEYS.ownedUpgrades)
    SaveManager.remove(SAVE_KEYS.garageLevel)
    SaveManager.remove(SAVE_KEYS.completedJobs)

    Analytics.track('new_game_started', { fromLevel })
    this.startGame(1)
  }

  private toggleMute(): void {
    const nowMuted = AudioManager.toggleMute()
    this.muteButton.setText(nowMuted ? '🔇' : '🔊')
  }

  shutdown(): void {
    this.enterKey?.destroy()
    this.spaceKey?.destroy()
    this.escapeKey?.destroy()
  }

  public getDebugState(): Record<string, string | number | boolean> {
    const savedLevel = SaveManager.load<number>(SAVE_KEYS.currentLevel, 1)
    const highScore = SaveManager.load<number>(SAVE_KEYS.highScore, 0)

    return {
      mode: 'menu',
      sceneKey: this.scene.key,
      coordinateSystem: 'Origin is top-left. X increases right, Y increases down.',
      currentLevel: savedLevel,
      highScore,
      muted: AudioManager.muted,
      world: worldForLevel(savedLevel),
      worldName: worldName(worldForLevel(savedLevel)),
      levelInWorld: levelIndexInWorld(savedLevel),
      unlockedTools: SaveManager.load<string[]>(SAVE_KEYS.unlockedTools, ['fan']).join(',')
    }
  }
}
