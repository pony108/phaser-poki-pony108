/**
 * ResultScene.ts
 * End-of-level screen showing:
 * - Level name + star rating (1–3)
 * - Final score (count-up animation)
 * - High-score badge when applicable
 * - NEXT LEVEL → advances to the next level (hidden on the last level)
 * - PLAY AGAIN  → replays the same level
 * - MENU        → back to title
 *
 * Receives data from GameScene via scene.start('ResultScene', { ... })
 */

import { UIButton } from '../components/UIButton'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { formatScore } from '../utils/helpers'

interface ResultData {
  score: number
  highScore: number
  isNewHighScore: boolean
  /** 1–3 star rating earned this run */
  stars: number
  /** 1-based level id just completed */
  levelId: number
  levelName: string
  isLastLevel: boolean
}

const CX = GAME_CONFIG.width / 2
const CY = GAME_CONFIG.height / 2

// Star characters
const STAR_ON  = '★'
const STAR_OFF = '☆'

export class ResultScene extends Phaser.Scene {
  private resultData: ResultData = {
    score: 0,
    highScore: 0,
    isNewHighScore: false,
    stars: 1,
    levelId: 1,
    levelName: '',
    isLastLevel: false
  }

  private enterKey!: Phaser.Input.Keyboard.Key
  private rKey!: Phaser.Input.Keyboard.Key

  constructor() {
    super({ key: 'ResultScene' })
  }

  init(data: ResultData): void {
    this.resultData = {
      score:         data?.score         ?? 0,
      highScore:     data?.highScore     ?? 0,
      isNewHighScore: data?.isNewHighScore ?? false,
      stars:         data?.stars         ?? 1,
      levelId:       data?.levelId       ?? 1,
      levelName:     data?.levelName     ?? '',
      isLastLevel:   data?.isLastLevel   ?? false
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(config.game.backgroundColor)
    this.cameras.main.fadeIn(BALANCING.sceneFadeDuration, 0, 0, 0)

    this.createBackground()
    this.createHeader()
    this.createStars()
    this.createScoreCard()
    this.createButtons()
    this.setupKeyboard()

    // TODO: rewarded break hook
    // this.time.delayedCall(500, () => {
    //   const poki = this.plugins.get('poki') as PokiPlugin
    //   poki.rewardedBreak().then((rewarded) => { if (rewarded) { ... } })
    // })

    // TODO: analytics hook — result_screen_shown
  }

  // ─── Background ───────────────────────────────────────────────────────────

  private createBackground(): void {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1)
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)
  }

  // ─── Header ───────────────────────────────────────────────────────────────

  private createHeader(): void {
    const { isLastLevel, levelId, levelName } = this.resultData

    this.add.text(CX, CY - 300, 'ALL CLEAN!', {
      fontSize: '44px',
      fontFamily: 'Arial, sans-serif',
      color: '#4a90d9',
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0.5)

    const subtitle = isLastLevel
      ? 'You finished all levels! 🎉'
      : `Level ${levelId} — ${levelName}`
    this.add.text(CX, CY - 248, subtitle, {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaacc',
      resolution: 2
    }).setOrigin(0.5)
  }

  // ─── Star Rating ──────────────────────────────────────────────────────────

  private createStars(): void {
    const { stars } = this.resultData
    const starStr = STAR_ON.repeat(stars) + STAR_OFF.repeat(3 - stars)

    const starText = this.add.text(CX, CY - 195, starStr, {
      fontSize: '52px',
      fontFamily: 'Arial, sans-serif',
      color: '#f1c40f',
      resolution: 2
    }).setOrigin(0.5)

    // Pop-in tween
    starText.setScale(0)
    this.tweens.add({
      targets: starText,
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      ease: 'Back.easeOut',
      delay: 200
    })
  }

  // ─── Score Card ───────────────────────────────────────────────────────────

  private createScoreCard(): void {
    const { score, highScore, isNewHighScore } = this.resultData

    // Card background
    const card = this.add.graphics()
    card.fillStyle(0x16213e, 0.8)
    card.fillRoundedRect(CX - 160, CY - 145, 320, 130, 16)
    card.lineStyle(2, 0x4a90d9, 0.4)
    card.strokeRoundedRect(CX - 160, CY - 145, 320, 130, 16)

    this.add.text(CX, CY - 120, 'Score', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaacc',
      resolution: 2
    }).setOrigin(0.5)

    // Animated score counter
    const scoreColor = isNewHighScore ? '#f1c40f' : '#ffffff'
    const scoreDisplay = this.add.text(CX, CY - 85, formatScore(score), {
      fontSize: '52px',
      fontFamily: 'Arial, sans-serif',
      color: scoreColor,
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0.5)

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

    // High-score annotation
    if (isNewHighScore) {
      const banner = this.add.text(CX, CY - 25, '🏆 NEW BEST!', {
        fontSize: '20px',
        fontFamily: 'Arial, sans-serif',
        color: '#f1c40f',
        fontStyle: 'bold',
        resolution: 2
      }).setOrigin(0.5)

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
      this.add.text(CX, CY - 25, `Best: ${formatScore(highScore)}`, {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#aaaacc',
        resolution: 2
      }).setOrigin(0.5)
    }
  }

  // ─── Buttons ──────────────────────────────────────────────────────────────

  private createButtons(): void {
    const { isLastLevel, levelId } = this.resultData
    let yOffset = CY + 30

    // NEXT LEVEL — only if there is a next level
    if (!isLastLevel) {
      new UIButton({
        scene: this,
        x: CX,
        y: yOffset,
        width: 240,
        height: 64,
        label: 'NEXT LEVEL',
        fontSize: 24,
        color: 0x27ae60,
        hoverColor: 0x2ecc71,
        pressColor: 0x1e8449,
        onClick: () => this.goToLevel(levelId + 1)
      })
      yOffset += 80
    }

    // PLAY AGAIN
    new UIButton({
      scene: this,
      x: CX,
      y: yOffset,
      width: 240,
      height: 64,
      label: 'PLAY AGAIN',
      fontSize: 24,
      color: 0x4a90d9,
      hoverColor: 0x5ba3f5,
      pressColor: 0x357abd,
      onClick: () => this.replayLevel(levelId)
    })
    yOffset += 75

    // MENU
    new UIButton({
      scene: this,
      x: CX,
      y: yOffset,
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
    this.rKey     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)

    const { isLastLevel, levelId } = this.resultData
    if (!isLastLevel) {
      // Enter → next level when available
      this.enterKey.on('down', () => this.goToLevel(levelId + 1), this)
    } else {
      this.enterKey.on('down', () => this.replayLevel(levelId), this)
    }
    this.rKey.on('down', () => this.replayLevel(levelId), this)
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  private goToLevel(levelId: number): void {
    // TODO: analytics hook — next_level
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('GameScene', { levelId })
    )
  }

  private replayLevel(levelId: number): void {
    // TODO: analytics hook — game_restarted
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('GameScene', { levelId })
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
