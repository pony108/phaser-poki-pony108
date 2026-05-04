import { SAVE_KEYS, SaveManager } from '../core/SaveManager'
import { BALANCING } from '../data/balancing'

export interface CashRewardInput {
  stars: number
  wasteFraction: number
  bonusZonesCompleted: number
  partsCompleted: number
}

export class EconomySystem {
  static getCash(): number {
    return SaveManager.load<number>(SAVE_KEYS.cash, 0)
  }

  static addCash(amount: number): number {
    const next = EconomySystem.getCash() + Math.max(0, Math.floor(amount))
    SaveManager.save(SAVE_KEYS.cash, next)
    return next
  }

  static calculateCashReward(input: CashRewardInput): number {
    const efficiencyCash = Math.round((1 - Math.min(1, input.wasteFraction)) * BALANCING.cash.efficiencyBonus)
    return (
      BALANCING.cash.basePay +
      input.stars * BALANCING.cash.starBonus +
      efficiencyCash +
      input.bonusZonesCompleted * BALANCING.cash.bonusZoneCash +
      input.partsCompleted * BALANCING.cash.partCompleteCash
    )
  }
}
