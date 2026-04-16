/**
 * Type declarations for @poki/phaser-3
 * The package ships a JS bundle without bundled typings.
 * These minimal declarations expose the API used in this project.
 * Replace with the official types if/when Poki publishes them.
 */

declare module '@poki/phaser-3' {
  /** Poki SDK instance passed to runWhenInitialized callbacks */
  export interface PokiSDK {
    gameplayStart(): void
    gameplayStop(): void
    gameLoadingFinished(): void
    rewardedBreak(): Promise<boolean>
    commercialBreak(): Promise<void>
  }

  /** Configuration passed to the plugin via Phaser plugin data */
  export interface PokiPluginData {
    /** Key of the loading scene — plugin fires gameLoadingFinished when it completes */
    loadingSceneKey: string
    /** Key of the gameplay scene — plugin fires gameplayStart/Stop automatically */
    gameplaySceneKey: string
    /** If true the plugin fires a commercial break between gameplay sessions */
    autoCommercialBreak?: boolean
  }

  /** Phaser 3 global plugin providing Poki SDK integration */
  export class PokiPlugin extends Phaser.Plugins.BasePlugin {
    /**
     * Queue a callback to run once the Poki SDK has initialised.
     * Safe to call at any time — callback fires immediately if SDK is already ready.
     */
    runWhenInitialized(callback: (sdk: PokiSDK) => void): void

    /**
     * Request a rewarded ad break.
     * Resolves with `true` if the player completed the ad and should receive their reward.
     */
    rewardedBreak(): Promise<boolean>

    /**
     * Request a commercial (interstitial) ad break.
     */
    commercialBreak(): Promise<void>
  }
}
