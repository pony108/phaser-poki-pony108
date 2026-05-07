import Phaser from 'phaser'
import { config } from '../../core/Config'

type PokiPluginLike = {
  runWhenInitialized?: (callback: (sdk: unknown) => void) => void
  gameLoadingFinished?: () => void
  gameplayStart?: () => void
  gameplayStop?: () => void
  commercialBreak?: () => Promise<boolean | void>
  rewardedBreak?: () => Promise<boolean>
}

export class PokiBridge {
  private static game: Phaser.Game | null = null
  private static plugin: PokiPluginLike | null = null
  private static initialized = false
  private static loadingFinishedSent = false
  private static gameplayActive = false
  private static devLoggingEnabled = false

  static init(game: Phaser.Game): void {
    PokiBridge.game = game
    PokiBridge.devLoggingEnabled = config.isDev

    const plugin = game.plugins.get('poki') as PokiPluginLike | undefined
    PokiBridge.plugin = plugin ?? null

    if (!plugin) {
      PokiBridge.log('init_missing_plugin', 'poki plugin not found')
      return
    }

    if (plugin.runWhenInitialized) {
      plugin.runWhenInitialized(() => {
        PokiBridge.initialized = true
        PokiBridge.log('init_ready', 'sdk_initialized')
      })
      return
    }

    PokiBridge.initialized = true
    PokiBridge.log('init_ready', 'no_runWhenInitialized')
  }

  static gameLoadingFinished(reason = 'manual'): void {
    if (!PokiBridge.game) return
    if (PokiBridge.loadingFinishedSent) return
    PokiBridge.loadingFinishedSent = true
    PokiBridge.log('gameLoadingFinished', reason)
    PokiBridge.plugin?.gameLoadingFinished?.()
  }

  static gameplayStart(reason: string): void {
    if (!PokiBridge.isReady()) return
    if (PokiBridge.gameplayActive) return
    PokiBridge.gameplayActive = true
    PokiBridge.log('gameplayStart', reason)
    PokiBridge.plugin?.gameplayStart?.()
  }

  static gameplayStop(reason: string): void {
    if (!PokiBridge.isReady()) return
    if (!PokiBridge.gameplayActive) return
    PokiBridge.gameplayActive = false
    PokiBridge.log('gameplayStop', reason)
    PokiBridge.plugin?.gameplayStop?.()
  }

  static async commercialBreak(reason: string): Promise<boolean> {
    if (!PokiBridge.isReady()) return false
    PokiBridge.log('commercialBreak', reason)
    const response = await PokiBridge.plugin?.commercialBreak?.()
    return response === true
  }

  static async rewardedBreak(reason: string): Promise<boolean> {
    if (!PokiBridge.isReady()) return false
    PokiBridge.log('rewardedBreak', reason)
    const rewarded = await PokiBridge.plugin?.rewardedBreak?.()
    return rewarded === true
  }

  static get isGameplayActive(): boolean {
    return PokiBridge.gameplayActive
  }

  private static log(eventName: string, reason: string): void {
    if (!PokiBridge.devLoggingEnabled) return
    console.info('[PokiSDK]', eventName, reason, Date.now())
  }

  private static isReady(): boolean {
    return PokiBridge.initialized && !!PokiBridge.game
  }
}
