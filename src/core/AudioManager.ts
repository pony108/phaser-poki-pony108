/**
 * AudioManager.ts
 * Singleton audio controller.
 * - Global mute/unmute with persisted state
 * - Separate SFX and music volume controls
 * - Browser audio context unlock on first user interaction
 * - Integrates with Phaser's sound system via scene reference
 *
 * Usage:
 *   AudioManager.init(scene)   // call once in BootScene
 *   AudioManager.playSfx(scene, 'jump')
 *   AudioManager.playMusic(scene, 'bgm')
 *   AudioManager.toggleMute()
 */

import { SaveManager, SAVE_KEYS } from './SaveManager'

export class AudioManager {
  private static _muted: boolean = false
  private static _sfxVolume: number = 1.0
  private static _musicVolume: number = 0.6
  private static _audioUnlocked: boolean = false
  private static _currentMusic: Phaser.Sound.BaseSound | null = null

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Load persisted settings and wire up browser audio unlock.
   * Call once from BootScene.create().
   */
  static init(_scene: Phaser.Scene): void {
    AudioManager._muted = SaveManager.load<boolean>(SAVE_KEYS.muted, false)
    AudioManager._sfxVolume = SaveManager.load<number>(SAVE_KEYS.sfxVolume, 1.0)
    AudioManager._musicVolume = SaveManager.load<number>(SAVE_KEYS.musicVolume, 0.6)

    AudioManager.setupAudioUnlock()
  }

  // ─── Playback ──────────────────────────────────────────────────────────────

  /**
   * Play a one-shot sound effect. Safe to call even if key doesn't exist.
   */
  static playSfx(scene: Phaser.Scene, key: string, volume?: number): void {
    if (AudioManager._muted) return
    if (!scene.cache.audio.has(key)) return

    try {
      scene.sound.play(key, {
        volume: (volume ?? 1.0) * AudioManager._sfxVolume
      })
    } catch {
      // Audio context may not be ready yet
    }
  }

  /**
   * Play a looping background music track.
   * Stops any currently playing music first.
   */
  static playMusic(scene: Phaser.Scene, key: string, volume?: number): void {
    AudioManager.stopMusic()
    if (!scene.cache.audio.has(key)) return

    try {
      AudioManager._currentMusic = scene.sound.add(key, {
        loop: true,
        volume: (volume ?? 1.0) * AudioManager._musicVolume * (AudioManager._muted ? 0 : 1)
      })
      AudioManager._currentMusic.play()
    } catch {
      // Audio context may not be ready yet
    }
  }

  /**
   * Stop and destroy the current background music track.
   */
  static stopMusic(): void {
    if (AudioManager._currentMusic) {
      try {
        AudioManager._currentMusic.stop()
        AudioManager._currentMusic.destroy()
      } catch {
        // Ignore
      }
      AudioManager._currentMusic = null
    }
  }

  // ─── Mute Control ─────────────────────────────────────────────────────────

  /**
   * Toggle global mute. Persists the new state.
   * Returns the new muted state.
   */
  static toggleMute(): boolean {
    AudioManager._muted = !AudioManager._muted
    SaveManager.save(SAVE_KEYS.muted, AudioManager._muted)
    AudioManager.applyMuteState()
    return AudioManager._muted
  }

  /**
   * Set mute state explicitly.
   */
  static setMuted(muted: boolean): void {
    AudioManager._muted = muted
    SaveManager.save(SAVE_KEYS.muted, muted)
    AudioManager.applyMuteState()
  }

  static get muted(): boolean {
    return AudioManager._muted
  }

  // ─── Volume Control ────────────────────────────────────────────────────────

  static setSfxVolume(volume: number): void {
    AudioManager._sfxVolume = Math.max(0, Math.min(1, volume))
    SaveManager.save(SAVE_KEYS.sfxVolume, AudioManager._sfxVolume)
  }

  static setMusicVolume(volume: number): void {
    AudioManager._musicVolume = Math.max(0, Math.min(1, volume))
    SaveManager.save(SAVE_KEYS.musicVolume, AudioManager._musicVolume)
    AudioManager.applyMuteState()
  }

  static get sfxVolume(): number {
    return AudioManager._sfxVolume
  }

  static get musicVolume(): number {
    return AudioManager._musicVolume
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private static applyMuteState(): void {
    if (!AudioManager._currentMusic) return
    try {
      const sound = AudioManager._currentMusic as Phaser.Sound.WebAudioSound
      if ('setVolume' in sound) {
        sound.setVolume(AudioManager._muted ? 0 : AudioManager._musicVolume)
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Mobile browsers require a user gesture before the AudioContext can start.
   * This adds a one-time listener to resume the context on first touch/click.
   */
  private static setupAudioUnlock(): void {
    if (AudioManager._audioUnlocked) return

    const unlock = (): void => {
      if (AudioManager._audioUnlocked) return
      AudioManager._audioUnlocked = true

      // Resume any suspended AudioContext (works in all modern browsers)
      try {
        const AudioContextClass =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioContextClass) {
          const ctx = new AudioContextClass()
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {/* ignore */})
          }
        }
      } catch {
        // Audio context unavailable — ignore
      }

      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('touchend', unlock)
      document.removeEventListener('mousedown', unlock)
      document.removeEventListener('keydown', unlock)
    }

    document.addEventListener('touchstart', unlock, { passive: true })
    document.addEventListener('touchend', unlock, { passive: true })
    document.addEventListener('mousedown', unlock)
    document.addEventListener('keydown', unlock)
  }
}
