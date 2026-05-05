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
import { Analytics } from '../core/Analytics'
import { config } from '../core/Config'
import { SaveManager, SAVE_KEYS } from '../core/SaveManager'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { getLevel, levelIndexInWorld, levelsInWorld, worldForLevel, worldName } from '../data/levels'
import { UpgradeSystem, UpgradeOffer } from '../systems/UpgradeSystem'
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
  bonusZonesTotal: number
  bonusZonesCompleted: number
  bonusScore: number
  partsTotal: number
  partsCompleted: number
  partCashBonus: number
  cashEarned: number
  cashTotal: number
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
    isLastLevel: false,
    bonusZonesTotal: 0,
    bonusZonesCompleted: 0,
    bonusScore: 0,
    partsTotal: 0,
    partsCompleted: 0,
    partCashBonus: 0,
    cashEarned: 0,
    cashTotal: 0
  }

  private enterKey!: Phaser.Input.Keyboard.Key
  private rKey!: Phaser.Input.Keyboard.Key
  private rewardButton?: UIButton
  private rewardStatusText!: Phaser.GameObjects.Text
  private scoreValueText!: Phaser.GameObjects.Text
  private highScoreText?: Phaser.GameObjects.Text
  private cashText!: Phaser.GameObjects.Text
  private upgradeStatusText!: Phaser.GameObjects.Text

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
      isLastLevel:   data?.isLastLevel   ?? false,
      bonusZonesTotal: data?.bonusZonesTotal ?? 0,
      bonusZonesCompleted: data?.bonusZonesCompleted ?? 0,
      bonusScore: data?.bonusScore ?? 0,
      partsTotal: data?.partsTotal ?? 0,
      partsCompleted: data?.partsCompleted ?? 0,
      partCashBonus: data?.partCashBonus ?? 0,
      cashEarned: data?.cashEarned ?? 0,
      cashTotal: data?.cashTotal ?? SaveManager.load<number>(SAVE_KEYS.cash, 0)
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(config.game.backgroundColor)
    this.cameras.main.fadeIn(BALANCING.sceneFadeDuration, 0, 0, 0)

    this.createBackground()
    this.createHeader()
    this.createStars()
    this.createScoreCard()
    this.createProgressPreview()
    this.createUpgradeShop()
    this.createButtons()
    this.createHiddenRewardFallback()
    this.setupKeyboard()
    Analytics.track('result_screen_shown', {
      levelId: this.resultData.levelId,
      stars: this.resultData.stars,
      score: this.resultData.score,
      bonusZonesCompleted: this.resultData.bonusZonesCompleted,
      cashEarned: this.resultData.cashEarned
    })
  }

  private createHiddenRewardFallback(): void {
    this.rewardStatusText = this.add.text(-1000, -1000, '', {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      resolution: 2
    }).setVisible(false)

    this.rewardButton = new UIButton({
      scene: this,
      x: -1000,
      y: -1000,
      width: 44,
      height: 44,
      label: 'AD',
      fontSize: 10,
      onClick: () => void this.requestRewardedOffer()
    }).setVisible(false)
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
    const {
      score,
      highScore,
      isNewHighScore,
      partsTotal,
      partsCompleted,
      partCashBonus,
      cashEarned,
      cashTotal
    } = this.resultData
    const hasPartSummary = partsTotal > 0
    const cardHeight = hasPartSummary ? 164 : 142

    // Card background
    const card = this.add.graphics()
    card.fillStyle(0x16213e, 0.8)
    card.fillRoundedRect(CX - 160, CY - 145, 320, cardHeight, 16)
    card.lineStyle(2, 0x4a90d9, 0.4)
    card.strokeRoundedRect(CX - 160, CY - 145, 320, cardHeight, 16)

    this.add.text(CX, CY - 120, 'Score', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaacc',
      resolution: 2
    }).setOrigin(0.5)

    // Animated score counter
    const scoreColor = isNewHighScore ? '#f1c40f' : '#ffffff'
    this.scoreValueText = this.add.text(CX, CY - 85, formatScore(score), {
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
          this.scoreValueText.setText(formatScore(displayed))
          if (displayed >= score) counter.remove()
        }
      })
    }

    // High-score annotation
    if (isNewHighScore) {
      this.highScoreText = this.add.text(CX, CY - 25, '🏆 NEW BEST!', {
        fontSize: '20px',
        fontFamily: 'Arial, sans-serif',
        color: '#f1c40f',
        fontStyle: 'bold',
        resolution: 2
      }).setOrigin(0.5)

      this.tweens.add({
        targets: this.highScoreText,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    } else if (highScore > 0) {
      this.highScoreText = this.add.text(CX, CY - 25, `Best: ${formatScore(highScore)}`, {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#aaaacc',
        resolution: 2
      }).setOrigin(0.5)
    }

    let detailY = CY - 2

    if (hasPartSummary) {
      this.add.text(CX, detailY, `Parts cleaned: ${partsCompleted}/${partsTotal}  +$${partCashBonus}`, {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#7dff9a',
        fontStyle: 'bold',
        resolution: 2
      }).setOrigin(0.5)
      detailY += 22
    }

    this.cashText = this.add.text(CX, detailY + 8, `Cash +$${cashEarned}  Total $${cashTotal}`, {
      fontSize: '17px',
      fontFamily: 'Arial, sans-serif',
      color: '#7dff9a',
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0.5)
  }

  private createProgressPreview(): void {
    const currentWorld = worldForLevel(this.resultData.levelId)
    const nextLevelData = this.resultData.isLastLevel ? null : getLevel(this.resultData.levelId + 1)

    const cardTop = CY + 54
    const cardHeight = 82
    const card = this.add.graphics()
    card.fillStyle(0x10182c, 0.88)
    card.fillRoundedRect(CX - 180, cardTop, 360, cardHeight, 18)
    card.lineStyle(2, 0x4a90d9, 0.22)
    card.strokeRoundedRect(CX - 180, cardTop, 360, cardHeight, 18)

    const nextLevelText = nextLevelData
      ? `Next job: ${nextLevelData.name}`
      : 'All jobs cleared'

    this.add.text(CX - 156, cardTop + 14, nextLevelText, {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0, 0)

    this.add.text(CX - 156, cardTop + 40, nextLevelData
      ? `${worldName(nextLevelData.world)}  /  ${nextLevelData.dirtType.toUpperCase()}`
      : `${worldName(currentWorld)} complete`, {
      fontSize: '13px',
      fontFamily: 'Arial, sans-serif',
      color: '#b7c7df',
      resolution: 2
    }).setOrigin(0, 0)
  }

  // ─── Buttons ──────────────────────────────────────────────────────────────

  private createUpgradeShop(): void {
    const offers = UpgradeSystem.buildOffers(this.resultData.cashTotal, 2)
    const primaryOffer = offers[0]
    const secondaryOffer = offers[1]
    const y = CY + 172

    this.add.text(CX, y - 40, 'RECOMMENDED UPGRADE', {
      fontSize: '13px',
      fontFamily: 'Arial, sans-serif',
      color: '#f5d06f',
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0.5)

    this.upgradeStatusText = this.add.text(CX, y + 40, '', {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#8fd3ff',
      resolution: 2
    }).setOrigin(0.5)

    if (!primaryOffer) {
      this.add.text(CX, y - 4, 'All upgrades owned', {
        fontSize: '15px',
        fontFamily: 'Arial, sans-serif',
        color: '#aaaacc',
        resolution: 2
      }).setOrigin(0.5)
      return
    }

    this.createUpgradeButton(primaryOffer, CX, y)
    if (secondaryOffer) {
      this.add.text(CX, y + 56, `Alt: ${secondaryOffer.name} $${secondaryOffer.price}`, {
        fontSize: '12px',
        fontFamily: 'Arial, sans-serif',
        color: '#8fd3ff',
        resolution: 2
      }).setOrigin(0.5)
    }
  }

  private createUpgradeButton(offer: UpgradeOffer, x: number, y: number): void {
    const button = new UIButton({
      scene: this,
      x,
      y,
      width: 228,
      height: 52,
      label: `${offer.name} L${offer.level + 1}  $${offer.price}`,
      fontSize: 13,
      color: 0x315c3d,
      hoverColor: 0x3b704a,
      pressColor: 0x274a31,
      disabledColor: 0x3a3a46,
      onClick: () => this.buyUpgrade(offer.key, button)
    })
    button.setEnabled(offer.canBuy)
  }

  private buyUpgrade(key: UpgradeOffer['key'], button: UIButton): void {
    const result = UpgradeSystem.buy(key)
    if (!result.success) {
      this.upgradeStatusText.setText('Need more cash')
      return
    }

    this.resultData.cashTotal = result.cash
    this.cashText.setText(`Cash +$${this.resultData.cashEarned}  Total $${this.resultData.cashTotal}`)
    this.upgradeStatusText.setText(`${BALANCING.upgrades[key].name} upgraded to L${result.level}`)
    button.setText('BOUGHT').setEnabled(false)
    Analytics.track('upgrade_bought', {
      levelId: this.resultData.levelId,
      upgrade: key,
      upgradeLevel: result.level,
      cashRemaining: result.cash
    })
  }

  private createButtons(): void {
    const { isLastLevel, levelId } = this.resultData
    let yOffset = CY + 272

    // NEXT LEVEL — only if there is a next level
    if (!isLastLevel) {
      new UIButton({
        scene: this,
        x: CX,
        y: yOffset,
        width: 248,
        height: 56,
        label: 'NEXT LEVEL',
        fontSize: 24,
        color: 0x27ae60,
        hoverColor: 0x2ecc71,
        pressColor: 0x1e8449,
        onClick: () => this.goToLevel(levelId + 1)
      })
      yOffset += 68
    }

    // PLAY AGAIN
    new UIButton({
      scene: this,
      x: CX,
      y: yOffset,
      width: 236,
      height: 52,
      label: 'PLAY AGAIN',
      fontSize: 24,
      color: 0x4a90d9,
      hoverColor: 0x5ba3f5,
      pressColor: 0x357abd,
      onClick: () => this.replayLevel(levelId)
    })
    yOffset += 58

    // MENU
    new UIButton({
      scene: this,
      x: CX,
      y: yOffset,
      width: 188,
      height: 42,
      label: 'MENU',
      fontSize: 18,
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
    Analytics.track('next_level_selected', {
      fromLevelId: this.resultData.levelId,
      toLevelId: levelId
    })
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('GameScene', { levelId })
    )
  }

  private replayLevel(levelId: number): void {
    Analytics.track('replay_selected', {
      levelId
    })
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('GameScene', { levelId })
    )
  }

  private goToMenu(): void {
    Analytics.track('menu_selected_from_result', {
      levelId: this.resultData.levelId
    })
    this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('MenuScene')
    )
  }

  private getRewardOffer(): { type: 'tool'; toolKey: string } | { type: 'score' } {
    const unlockedTools = SaveManager.load<string[]>(SAVE_KEYS.unlockedTools, ['fan'])
    const lockedTool = Object.entries(BALANCING.toolUnlockAtLevel)
      .sort((a, b) => a[1] - b[1])
      .find(([toolKey]) => !unlockedTools.includes(toolKey))

    if (lockedTool) {
      return { type: 'tool', toolKey: lockedTool[0] }
    }

    return { type: 'score' }
  }

  private async requestRewardedOffer(): Promise<void> {
    if (!this.rewardButton || this.rewardButton.isDisabled) return

    const rewardOffer = this.getRewardOffer()
    this.rewardButton.setEnabled(false)
    this.rewardStatusText.setText('Loading reward...')

    let rewarded = false
    try {
      const poki = this.plugins.get('poki') as import('@poki/phaser-3').PokiPlugin | undefined
      if (poki?.rewardedBreak) {
        rewarded = await poki.rewardedBreak()
      }
    } catch {
      rewarded = false
    }

    if (!rewarded) {
      this.rewardButton.setEnabled(true)
      this.rewardStatusText.setText('Reward skipped')
      Analytics.track('reward_offer_declined', {
        levelId: this.resultData.levelId,
        rewardType: rewardOffer.type
      })
      return
    }

    if (rewardOffer.type === 'tool') {
      const unlockedTools = SaveManager.load<string[]>(SAVE_KEYS.unlockedTools, ['fan'])
      if (!unlockedTools.includes(rewardOffer.toolKey)) {
        unlockedTools.push(rewardOffer.toolKey)
        SaveManager.save(SAVE_KEYS.unlockedTools, unlockedTools)
      }
      this.rewardStatusText.setText(`${rewardOffer.toolKey.toUpperCase()} unlocked for the next run`)
    } else {
      this.resultData.score += BALANCING.rewardedScoreBonus
      this.scoreValueText.setText(formatScore(this.resultData.score))
      if (this.resultData.score > this.resultData.highScore) {
        this.resultData.highScore = this.resultData.score
        this.resultData.isNewHighScore = true
        SaveManager.save(SAVE_KEYS.highScore, this.resultData.highScore)
        this.highScoreText?.setText('🏆 NEW BEST!')
      }
      this.rewardStatusText.setText(`+${formatScore(BALANCING.rewardedScoreBonus)} score applied`)
    }

    this.rewardButton.setText('REWARD CLAIMED')
    Analytics.track('reward_offer_claimed', {
      levelId: this.resultData.levelId,
      rewardType: rewardOffer.type,
      rewardValue: rewardOffer.type === 'tool' ? rewardOffer.toolKey : BALANCING.rewardedScoreBonus
    })
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  shutdown(): void {
    this.enterKey?.destroy()
    this.rKey?.destroy()
  }

  public getDebugState(): Record<string, string | number | boolean | string[]> {
    const availableActions = this.resultData.isLastLevel
      ? ['play_again', 'menu']
      : ['next_level', 'play_again', 'menu']
    const currentWorld = worldForLevel(this.resultData.levelId)
    const worldLevels = levelsInWorld(currentWorld)
    const completedLevels = SaveManager.load<Record<number, boolean>>(SAVE_KEYS.levelCompleted, {})
    const unlockedTools = SaveManager.load<string[]>(SAVE_KEYS.unlockedTools, ['fan'])

    return {
      mode: 'result',
      sceneKey: this.scene.key,
      coordinateSystem: 'Origin is top-left. X increases right, Y increases down.',
      score: this.resultData.score,
      highScore: this.resultData.highScore,
      isNewHighScore: this.resultData.isNewHighScore,
      stars: this.resultData.stars,
      levelId: this.resultData.levelId,
      levelName: this.resultData.levelName,
      isLastLevel: this.resultData.isLastLevel,
      bonusZonesTotal: this.resultData.bonusZonesTotal,
      bonusZonesCompleted: this.resultData.bonusZonesCompleted,
      bonusScore: this.resultData.bonusScore,
      partsTotal: this.resultData.partsTotal,
      partsCompleted: this.resultData.partsCompleted,
      partCashBonus: this.resultData.partCashBonus,
      cashEarned: this.resultData.cashEarned,
      cashTotal: this.resultData.cashTotal,
      upgradeOffers: UpgradeSystem.buildOffers(this.resultData.cashTotal, 2).map((offer) => `${offer.key}:${offer.level}->${offer.level + 1}:$${offer.price}:${offer.canBuy}`).join(','),
      world: currentWorld,
      worldName: worldName(currentWorld),
      levelInWorld: levelIndexInWorld(this.resultData.levelId),
      worldProgress: `${worldLevels.filter((id) => completedLevels[id]).length}/${worldLevels.length}`,
      unlockedTools: unlockedTools.join(','),
      availableActions
    }
  }
}
