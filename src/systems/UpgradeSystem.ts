import { SAVE_KEYS, SaveManager } from '../core/SaveManager'
import { BALANCING, ToolConfig } from '../data/balancing'
import type { DirtType } from '../data/levels'

export type UpgradeKey = keyof typeof BALANCING.upgrades
export type UpgradeLevels = Record<string, number>

export interface UpgradeOffer {
  key: UpgradeKey
  name: string
  description: string
  price: number
  level: number
  maxLevel: number
  canBuy: boolean
}

export class UpgradeSystem {
  static loadLevels(): UpgradeLevels {
    return SaveManager.load<UpgradeLevels>(SAVE_KEYS.ownedUpgrades, {})
  }

  static saveLevels(levels: UpgradeLevels): void {
    SaveManager.save(SAVE_KEYS.ownedUpgrades, levels)
  }

  static getLevel(key: UpgradeKey, levels = UpgradeSystem.loadLevels()): number {
    return Math.max(0, Math.floor(levels[key] ?? 0))
  }

  static getPrice(key: UpgradeKey, level = UpgradeSystem.getLevel(key)): number {
    const upgrade = BALANCING.upgrades[key]
    return upgrade.basePrice + upgrade.priceStep * level
  }

  static buildOffers(cash: number, limit = 3): UpgradeOffer[] {
    const levels = UpgradeSystem.loadLevels()
    return (Object.keys(BALANCING.upgrades) as UpgradeKey[])
      .map((key) => {
        const upgrade = BALANCING.upgrades[key]
        const level = UpgradeSystem.getLevel(key, levels)
        const price = UpgradeSystem.getPrice(key, level)
        return {
          key,
          name: upgrade.name,
          description: upgrade.description,
          price,
          level,
          maxLevel: upgrade.maxLevel,
          canBuy: level < upgrade.maxLevel && cash >= price
        }
      })
      .filter((offer) => offer.level < offer.maxLevel)
      .sort((a, b) => a.price - b.price)
      .slice(0, limit)
  }

  static buy(key: UpgradeKey): { success: boolean; cash: number; level: number } {
    const cash = SaveManager.load<number>(SAVE_KEYS.cash, 0)
    const levels = UpgradeSystem.loadLevels()
    const currentLevel = UpgradeSystem.getLevel(key, levels)
    const upgrade = BALANCING.upgrades[key]
    const price = UpgradeSystem.getPrice(key, currentLevel)

    if (currentLevel >= upgrade.maxLevel || cash < price) {
      return { success: false, cash, level: currentLevel }
    }

    const nextLevel = currentLevel + 1
    levels[key] = nextLevel
    SaveManager.save(SAVE_KEYS.cash, cash - price)
    UpgradeSystem.saveLevels(levels)
    return { success: true, cash: cash - price, level: nextLevel }
  }

  static applyToTool(key: string, tool: ToolConfig, dirtType: DirtType): ToolConfig {
    const levels = UpgradeSystem.loadLevels()
    const pressure = UpgradeSystem.getLevel('pressure', levels)
    const sprayWidth = UpgradeSystem.getLevel('sprayWidth', levels)
    const soapQuality = UpgradeSystem.getLevel('soapQuality', levels)

    const next: ToolConfig = {
      ...tool,
      primaryDirt: [...tool.primaryDirt]
    }

    next.strength += pressure * BALANCING.upgrades.pressure.strengthBonusPerLevel

    if (key === 'fan') {
      next.radius += sprayWidth * BALANCING.upgrades.sprayWidth.fanRadiusBonusPerLevel
    }

    if (key === 'hot' && dirtType === 'mud') {
      next.strength += soapQuality * BALANCING.upgrades.soapQuality.hotMudStrengthBonusPerLevel
    }

    return next
  }
}
