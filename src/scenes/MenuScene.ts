/**
 * MenuScene.ts
 * Title screen with:
 * - Game title and tagline
 * - Play button → starts GameScene
 * - Mute toggle button (state persisted via AudioManager / SaveManager)
 * - Mobile-friendly layout (all touch targets ≥ 44px)
 * - Keyboard: Enter/Space → play, Escape → toggle mute
 */

import { UIButton } from '../components/UIButton'
import { AudioManager } from '../core/AudioManager'
import { SaveManager, SAVE_KEYS } from '../core/SaveManager'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { TOTAL_LEVELS } from '../data/levels'

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

    // TODO: analytics hook — menu_viewed
  }

  // ─── UI Construction ───────────────────────────────────────────────────────

  private createBackground(): void {
    const bg = this.add.graphics()

    // Gradient background
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1)
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)

    // Decorative circles (replace with real art)
    bg.fillStyle(0x4a90d9, 0.06)
    bg.fillCircle(CX - 120, 160, 190)
    bg.fillStyle(0xe74c3c, 0.05)
    bg.fillCircle(CX + 100, GAME_CONFIG.height - 180, 230)
  }

  private createTitle(): void {
    // Main title
    this.add
      .text(CX, CY - 165, config.game.title, {
        fontSize: '52px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        fontStyle: 'bold',
        resolution: 2,
        stroke: '#4a90d9',
        strokeThickness: 3
      })
      .setOrigin(0.5)

    // Tagline — replace with your game's actual tagline
    this.add
      .text(CX, CY - 100, 'Grab a sponge!', {
        fontSize: '20px',
        fontFamily: 'Arial, sans-serif',
        color: '#aaaacc',
        resolution: 2
      })
      .setOrigin(0.5)
  }

  private createButtons(): void {
    const savedLevel = SaveManager.load<number>(SAVE_KEYS.currentLevel, 1)
    const hasProgress = savedLevel > 1

    // ── Continue (only if the player has started at least level 2) ───────────
    if (hasProgress) {
      new UIButton({
        scene: this,
        x: CX,
        y: CY - 5,
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
        y: CY + 75,
        width: 200,
        height: 52,
        label: 'NEW GAME',
        fontSize: 20,
        color: 0x4a90d9,
        hoverColor: 0x5ba3f5,
        pressColor: 0x357abd,
        onClick: () => this.startGame(1)
      })
    } else {
      // ── Play Button (fresh start) ─────────────────────────────────────────
      new UIButton({
        scene: this,
        x: CX,
        y: CY + 10,
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

    // ── Mute Toggle ──────────────────────────────────────────────────────────
    const muteY = hasProgress ? CY + 155 : CY + 90
    const muteLabel = AudioManager.muted ? '🔇 Muted' : '🔊 Sound On'
    this.muteButton = new UIButton({
      scene: this,
      x: CX,
      y: muteY,
      width: 180,
      height: 48,
      label: muteLabel,
      fontSize: 18,
      color: 0x2c3e50,
      hoverColor: 0x3d5166,
      pressColor: 0x1a252f,
      onClick: () => this.toggleMute()
    })

    // ── Progress indicator ────────────────────────────────────────────────────
    if (hasProgress) {
      const progressY = muteY + 60
      this.add.text(CX, progressY, `Progress: ${savedLevel - 1} / ${TOTAL_LEVELS} levels`, {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#666688',
        resolution: 2
      }).setOrigin(0.5)
    }
  }

  private createFooter(): void {
    // High score display
    const hs = SaveManager.load<number>(SAVE_KEYS.highScore, 0)
    if (hs > 0) {
      this.add
        .text(CX, CY + 165, `Best: ${hs.toLocaleString()}`, {
          fontSize: '18px',
          fontFamily: 'Arial, sans-serif',
          color: '#f1c40f',
          resolution: 2
        })
        .setOrigin(0.5)
    }

    // Version stamp
    this.add
      .text(CX, GAME_CONFIG.height - 20, `v${config.game.version}`, {
        fontSize: '12px',
        fontFamily: 'Arial, sans-serif',
        color: '#444466',
        resolution: 2
      })
      .setOrigin(0.5)
  }

  // ─── Keyboard Input ───────────────────────────────────────────────────────

  private setupKeyboard(): void {
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

    const savedLevel = SaveManager.load<number>(SAVE_KEYS.currentLevel, 1)
    this.enterKey.on('down', () => this.startGame(savedLevel), this)
    this.spaceKey.on('down', () => this.startGame(savedLevel), this)
    this.escapeKey.on('down', this.toggleMute, this)
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  private startGame(levelId: number = 1): void {
    // TODO: analytics hook — game_started
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('GameScene', { levelId })
    )
  }

  private toggleMute(): void {
    const nowMuted = AudioManager.toggleMute()
    this.muteButton.setText(nowMuted ? '🔇 Muted' : '🔊 Sound On')
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

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
      muted: AudioManager.muted
    }
  }
}
