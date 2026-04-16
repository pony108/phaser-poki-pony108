/**
 * ResultScene.ts
 * End-of-game screen showing:
 * - Final score
 * - High score (highlighted if new record)
 * - Restart button → GameScene
 * - Menu button → MenuScene
 * - Rewarded ad hook placeholder (TODO)
 *
 * Receives data from GameScene via scene.start('ResultScene', { score, highScore, isNewHighScore })
 */

import { UIButton } from '../components/UIButton'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { formatScore } from '../utils/helpers'

// Data passed from GameScene
interface ResultData {
  score: number
  highScore: number
  isNewHighScore: boolean
}

const CX = GAME_CONFIG.width / 2
const CY = GAME_CONFIG.height / 2

export class ResultScene extends Phaser.Scene {
  private resultData: ResultData = { score: 0, highScore: 0, isNewHighScore: false }

  private enterKey!: Phaser.Input.Keyboard.Key
  private rKey!: Phaser.Input.Keyboard.Key

  constructor() {
    super({ key: 'ResultScene' })
  }

  init(data: ResultData): void {
    this.resultData = {
      score: data?.score ?? 0,
      highScore: data?.highScore ?? 0,
      isNewHighScore: data?.isNewHighScore ?? false
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(config.game.backgroundColor)
    this.cameras.main.fadeIn(BALANCING.sceneFadeDuration, 0, 0, 0)

    this.createBackground()
    this.createScoreDisplay()
    this.createButtons()
    this.setupKeyboard()

    // TODO: rewarded break hook
    // Uncomment to offer a rewarded ad after a short delay:
    //
    // this.time.delayedCall(500, () => {
    //   const poki = this.plugins.get('poki') as PokiPlugin
    //   poki.rewardedBreak().then((rewarded) => {
    //     if (rewarded) {
    //       // Give the player an extra life, double score, etc.
    //     }
    //   })
    // })

    // TODO: analytics hook — result_screen_shown, score: this.resultData.score
  }

  // ─── UI ───────────────────────────────────────────────────────────────────

  private createBackground(): void {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1)
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)
  }

  private createScoreDisplay(): void {
    const { score, highScore, isNewHighScore } = this.resultData

    // "Game Over" header
    this.add
      .text(CX, CY - 210, 'GAME OVER', {
        fontSize: '42px',
        fontFamily: 'Arial, sans-serif',
        color: '#e74c3c',
        fontStyle: 'bold',
        resolution: 2
      })
      .setOrigin(0.5)

    // Score card background
    const cardH = 160
    const card = this.add.graphics()
    card.fillStyle(0x16213e, 0.8)
    card.fillRoundedRect(CX - 160, CY - 165, 320, cardH, 16)
    card.lineStyle(2, 0x4a90d9, 0.4)
    card.strokeRoundedRect(CX - 160, CY - 165, 320, cardH, 16)

    // Score label
    this.add
      .text(CX, CY - 140, 'Score', {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#aaaacc',
        resolution: 2
      })
      .setOrigin(0.5)

    // Score value
    const scoreColor = isNewHighScore ? '#f1c40f' : '#ffffff'
    const scoreDisplay = this.add
      .text(CX, CY - 110, formatScore(score), {
        fontSize: '52px',
        fontFamily: 'Arial, sans-serif',
        color: scoreColor,
        fontStyle: 'bold',
        resolution: 2
      })
      .setOrigin(0.5)

    // Animate score counting up (optional but satisfying)
    if (score > 0) {
      let displayed = 0
      const increment = Math.ceil(score / 40)
      const counter = this.time.addEvent({
        delay: 30,
        repeat: 40,
        callback: () => {
          displayed = Math.min(score, displayed + increment)
          scoreDisplay.setText(formatScore(displayed))
          if (displayed >= score) counter.remove()
        }
      })
    }

    // New high score banner
    if (isNewHighScore) {
      const banner = this.add
        .text(CX, CY - 55, '🏆 NEW BEST!', {
          fontSize: '20px',
          fontFamily: 'Arial, sans-serif',
          color: '#f1c40f',
          fontStyle: 'bold',
          resolution: 2
        })
        .setOrigin(0.5)

      // Pulse animation
      this.tweens.add({
        targets: banner,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    } else if (highScore > 0) {
      this.add
        .text(CX, CY - 55, `Best: ${formatScore(highScore)}`, {
          fontSize: '16px',
          fontFamily: 'Arial, sans-serif',
          color: '#aaaacc',
          resolution: 2
        })
        .setOrigin(0.5)
    }
  }

  private createButtons(): void {
    // ── Play Again ───────────────────────────────────────────────────────────
    new UIButton({
      scene: this,
      x: CX,
      y: CY + 30,
      width: 240,
      height: 64,
      label: 'PLAY AGAIN',
      fontSize: 24,
      color: 0x4a90d9,
      hoverColor: 0x5ba3f5,
      pressColor: 0x357abd,
      onClick: () => this.restartGame()
    })

    // ── Main Menu ────────────────────────────────────────────────────────────
    new UIButton({
      scene: this,
      x: CX,
      y: CY + 110,
      width: 200,
      height: 52,
      label: 'MENU',
      fontSize: 20,
      color: 0x2c3e50,
      hoverColor: 0x3d5166,
      pressColor: 0x1a252f,
      onClick: () => this.goToMenu()
    })
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────

  private setupKeyboard(): void {
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)

    this.enterKey.on('down', this.restartGame, this)
    this.rKey.on('down', this.restartGame, this)
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  private restartGame(): void {
    // TODO: analytics hook — game_restarted
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('GameScene')
    )
  }

  private goToMenu(): void {
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('MenuScene')
    )
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  shutdown(): void {
    this.enterKey?.destroy()
    this.rKey?.destroy()
  }
}
