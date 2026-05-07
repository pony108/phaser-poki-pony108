/**
 * ResultScene.ts
 * End-of-level screen with a compact CTA hierarchy and modal shop.
 */

import { UIButton } from '../components/UIButton'
import { Analytics } from '../core/Analytics'
import { config } from '../core/Config'
import { SaveManager, SAVE_KEYS } from '../core/SaveManager'
import { BALANCING } from '../data/balancing'
import { GAME_CONFIG } from '../data/gameConfig'
import { levelIndexInWorld, levelsInWorld, worldForLevel, worldName } from '../data/levels'
import { PokiBridge } from '../lib/poki/PokiBridge'
import { UpgradeOffer, UpgradeSystem } from '../systems/UpgradeSystem'
import { formatScore } from '../utils/helpers'

interface ResultData {
  score: number
  highScore: number
  isNewHighScore: boolean
  stars: number
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
const STAR_ON = '*'
const STAR_OFF = '.'

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
  private rewardButton?: UIButton
  private rewardStatusText!: Phaser.GameObjects.Text
  private scoreValueText!: Phaser.GameObjects.Text
  private highScoreText?: Phaser.GameObjects.Text
  private cashText!: Phaser.GameObjects.Text
  private upgradeStatusText!: Phaser.GameObjects.Text
  private shopModal!: Phaser.GameObjects.Container
  private shopModalCards!: Phaser.GameObjects.Container
  private shopModalStatusText!: Phaser.GameObjects.Text
  private isShopOpen = false

  constructor() {
    super({ key: 'ResultScene' })
  }

  init(data: ResultData): void {
    this.resultData = {
      score: data?.score ?? 0,
      highScore: data?.highScore ?? 0,
      isNewHighScore: data?.isNewHighScore ?? false,
      stars: data?.stars ?? 1,
      levelId: data?.levelId ?? 1,
      levelName: data?.levelName ?? '',
      isLastLevel: data?.isLastLevel ?? false,
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
    this.createButtons()
    this.createShopModal()
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

  private createBackground(): void {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1)
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)
  }

  private fitTextToWidth(text: Phaser.GameObjects.Text, maxWidth: number, maxFontSize: number, minFontSize: number): void {
    let fontSize = maxFontSize
    text.setFontSize(fontSize)
    while (fontSize > minFontSize && text.getBounds().width > maxWidth) {
      fontSize -= 1
      text.setFontSize(fontSize)
    }
  }

  private createHeader(): void {
    const { isLastLevel, levelId, levelName } = this.resultData

    this.add.image(CX, CY - 346, 'game_logo')
      .setOrigin(0.5)
      .setScale(0.24)

    this.add.text(CX, CY - 300, 'ALL CLEAN!', {
      fontSize: '44px',
      fontFamily: 'Arial, sans-serif',
      color: '#4a90d9',
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0.5)

    const subtitle = isLastLevel ? 'You finished all levels!' : `Level ${levelId} - ${levelName}`
    this.add.text(CX, CY - 248, subtitle, {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaacc',
      resolution: 2
    }).setOrigin(0.5)
  }

  private createStars(): void {
    const { stars } = this.resultData
    const starStr = STAR_ON.repeat(stars) + STAR_OFF.repeat(3 - stars)

    const starText = this.add.text(CX, CY - 194, starStr, {
      fontSize: '52px',
      fontFamily: 'Arial, sans-serif',
      color: '#f1c40f',
      resolution: 2
    }).setOrigin(0.5)

    starText.setScale(0)
    this.tweens.add({
      targets: starText,
      scaleX: 1,
      scaleY: 1,
      duration: 380,
      ease: 'Back.easeOut',
      delay: 160
    })
  }

  private createScoreCard(): void {
    const { highScore, isNewHighScore, cashEarned, cashTotal } = this.resultData
    const cardTop = CY - 116

    const card = this.add.graphics()
    card.fillStyle(0x16213e, 0.82)
    card.fillRoundedRect(CX - 170, cardTop, 340, 194, 18)
    card.lineStyle(2, 0x4a90d9, 0.4)
    card.strokeRoundedRect(CX - 170, cardTop, 340, 194, 18)

    this.add.text(CX, cardTop + 24, 'EARNED', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaacc',
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0.5)

    this.scoreValueText = this.add.text(CX, cardTop + 78, `+$${cashEarned}`, {
      fontSize: '58px',
      fontFamily: 'Arial, sans-serif',
      color: '#7dff9a',
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0.5)
    this.fitTextToWidth(this.scoreValueText, 300, 58, 40)

    this.cashText = this.add.text(CX, cardTop + 124, `Total Cash  $${cashTotal}`, {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#b7c7df',
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0.5)

    if (isNewHighScore || highScore > 0) {
      const bestText = isNewHighScore ? `BEST ${formatScore(this.resultData.score)}` : `BEST ${formatScore(highScore)}`
      this.highScoreText = this.add.text(CX, cardTop + 156, bestText, {
        fontSize: '13px',
        fontFamily: 'Arial, sans-serif',
        color: isNewHighScore ? '#f1c40f' : '#8ea4c8',
        fontStyle: isNewHighScore ? 'bold' : 'normal',
        resolution: 2
      }).setOrigin(0.5)

      if (isNewHighScore) {
        this.tweens.add({
          targets: this.highScoreText,
          alpha: 0.65,
          duration: 650,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        })
      }
    }
  }

  private createButtons(): void {
    const { isLastLevel, levelId } = this.resultData
    const primaryY = CY + 204
    const secondaryY = primaryY + 62
    const menuY = GAME_CONFIG.height - 28

    if (!isLastLevel) {
      new UIButton({
        scene: this,
        x: CX,
        y: primaryY,
        width: 248,
        height: 56,
        label: '✨ NEXT',
        fontSize: 24,
        color: 0x27ae60,
        hoverColor: 0x2ecc71,
        pressColor: 0x1e8449,
        onClick: () => this.goToLevel(levelId + 1)
      })
    } else {
      new UIButton({
        scene: this,
        x: CX,
        y: primaryY,
        width: 248,
        height: 56,
        label: 'SHOP',
        fontSize: 24,
        color: 0x315c3d,
        hoverColor: 0x3b704a,
        pressColor: 0x274a31,
        onClick: () => this.openShopModal()
      })
    }

    new UIButton({
      scene: this,
      x: CX,
      y: secondaryY,
      width: 180,
      height: 44,
      label: '🛒 SHOP',
      fontSize: 16,
      color: 0x315c3d,
      hoverColor: 0x3b704a,
      pressColor: 0x274a31,
      onClick: () => this.openShopModal()
    })

    new UIButton({
      scene: this,
      x: CX,
      y: menuY,
      width: 112,
      height: 36,
      label: 'MENU',
      fontSize: 13,
      color: 0x2c3e50,
      hoverColor: 0x3d5166,
      pressColor: 0x1a252f,
      onClick: () => this.goToMenu()
    })
  }

  private createShopModal(): void {
    const blocker = this.add.rectangle(CX, CY, GAME_CONFIG.width, GAME_CONFIG.height, 0x000000, 0.62).setInteractive()

    const panelBg = this.add.graphics()
    panelBg.fillStyle(0x131e37, 0.98)
    panelBg.fillRoundedRect(CX - 176, CY - 212, 352, 424, 18)
    panelBg.lineStyle(2, 0x4a90d9, 0.36)
    panelBg.strokeRoundedRect(CX - 176, CY - 212, 352, 424, 18)

    const title = this.add.text(CX, CY - 176, 'Garage Shop', {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0.5)

    this.shopModalCards = this.add.container(CX, CY - 16)
    this.shopModalStatusText = this.add.text(CX, CY + 128, '', {
      fontSize: '13px',
      fontFamily: 'Arial, sans-serif',
      color: '#8fd3ff',
      resolution: 2
    }).setOrigin(0.5)
    this.upgradeStatusText = this.shopModalStatusText

    const backButton = new UIButton({
      scene: this,
      x: CX,
      y: CY + 168,
      width: 140,
      height: 42,
      label: 'Back',
      fontSize: 16,
      color: 0x2c3e50,
      hoverColor: 0x3d5166,
      pressColor: 0x1a252f,
      onClick: () => this.closeShopModal()
    })

    this.shopModal = this.add.container(0, 0, [blocker, panelBg, title, this.shopModalCards, this.shopModalStatusText, backButton])
      .setDepth(100)
      .setVisible(false)
      .setAlpha(0)
      .setScale(0.98)
  }

  private openShopModal(): void {
    if (this.isShopOpen) return
    this.isShopOpen = true
    this.refreshShopModalOffers()
    this.shopModal.setVisible(true)
    this.shopModal.setAlpha(0)
    this.shopModal.setScale(0.98)

    this.tweens.add({
      targets: this.shopModal,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: 'Sine.easeOut'
    })
  }

  private closeShopModal(): void {
    if (!this.isShopOpen) return
    this.isShopOpen = false

    this.tweens.add({
      targets: this.shopModal,
      alpha: 0,
      scaleX: 0.98,
      scaleY: 0.98,
      duration: 140,
      ease: 'Sine.easeIn',
      onComplete: () => this.shopModal.setVisible(false)
    })
  }

  private updateShopStatus(message: string): void {
    this.upgradeStatusText.setText(message)
  }

  private refreshShopModalOffers(): void {
    this.shopModalCards.removeAll(true)
    const offers = UpgradeSystem.buildOffers(this.resultData.cashTotal, 3)

    if (offers.length === 0) {
      const allOwnedText = this.add.text(0, 0, 'All upgrades owned', {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#b7c7df',
        fontStyle: 'bold',
        resolution: 2
      }).setOrigin(0.5)
      this.shopModalCards.add(allOwnedText)
      this.updateShopStatus('')
      return
    }

    offers.forEach((offer, index) => {
      const cardY = -92 + index * 94
      const card = this.add.graphics()
      card.fillStyle(0x0f1b31, 0.95)
      card.fillRoundedRect(-154, cardY - 38, 308, 82, 14)
      card.lineStyle(2, 0x4a90d9, 0.22)
      card.strokeRoundedRect(-154, cardY - 38, 308, 82, 14)

      const nameText = this.add.text(-136, cardY - 16, `${offer.name}  L${offer.level} -> L${offer.level + 1}`, {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        fontStyle: 'bold',
        resolution: 2
      }).setOrigin(0, 0.5)

      const descText = this.add.text(-136, cardY + 10, offer.description, {
        fontSize: '11px',
        fontFamily: 'Arial, sans-serif',
        color: '#9eb2d1',
        resolution: 2
      }).setOrigin(0, 0.5)
      this.fitTextToWidth(descText, 200, 11, 9)

      const buyButton = new UIButton({
        scene: this,
        x: 103,
        y: cardY,
        width: 90,
        height: 36,
        label: `$${offer.price}`,
        fontSize: 13,
        color: 0x315c3d,
        hoverColor: 0x3b704a,
        pressColor: 0x274a31,
        disabledColor: 0x3a3a46,
        onClick: () => this.buyUpgrade(offer.key)
      })
      buyButton.setEnabled(offer.canBuy)

      this.shopModalCards.add([card, nameText, descText, buyButton])
    })
  }

  private buyUpgrade(key: UpgradeOffer['key']): void {
    const result = UpgradeSystem.buy(key)
    if (!result.success) {
      this.updateShopStatus('Need more cash')
      return
    }

    this.resultData.cashTotal = result.cash
    this.cashText.setText(`Total Cash  $${this.resultData.cashTotal}`)
    this.updateShopStatus(`${BALANCING.upgrades[key].name} upgraded to L${result.level}`)
    this.refreshShopModalOffers()

    Analytics.track('upgrade_bought', {
      levelId: this.resultData.levelId,
      upgrade: key,
      upgradeLevel: result.level,
      cashRemaining: result.cash
    })
  }

  private setupKeyboard(): void {
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)

    const { isLastLevel, levelId } = this.resultData
    if (!isLastLevel) {
      this.enterKey.on('down', () => this.goToLevel(levelId + 1), this)
    } else {
      this.enterKey.on('down', () => this.goToMenu(), this)
    }
  }

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
      rewarded = await PokiBridge.rewardedBreak('result_reward_offer')
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
        this.highScoreText?.setText('NEW BEST!')
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

  shutdown(): void {
    this.enterKey?.destroy()
  }

  public getDebugState(): Record<string, string | number | boolean | string[]> {
    const availableActions = this.resultData.isLastLevel
      ? ['shop', 'menu']
      : ['next_level', 'shop', 'menu']

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
      upgradeOffers: UpgradeSystem.buildOffers(this.resultData.cashTotal, 3).map((offer) => `${offer.key}:${offer.level}->${offer.level + 1}:$${offer.price}:${offer.canBuy}`).join(','),
      world: currentWorld,
      worldName: worldName(currentWorld),
      levelInWorld: levelIndexInWorld(this.resultData.levelId),
      worldProgress: `${worldLevels.filter((id) => completedLevels[id]).length}/${worldLevels.length}`,
      unlockedTools: unlockedTools.join(','),
      availableActions,
      shopOpen: this.isShopOpen
    }
  }
}
