/**
 * SpawnSystem.ts
 * Timed spawn controller driven by DifficultySystem.
 * Designed to be ticked from GameScene's update() loop.
 *
 * No Phaser timer events are used — we accumulate delta time manually
 * so the interval can update dynamically with difficulty each frame.
 *
 * Usage:
 *   const spawner = new SpawnSystem()
 *   spawner.schedule(() => spawnEnemy(), 2000)
 *
 *   // In GameScene.update(time, delta):
 *   spawner.tick(delta)
 *
 *   // To stop:
 *   spawner.clear()
 */

export interface SpawnEntry {
  /** Callback to invoke when the interval fires */
  callback: () => void
  /** Time between spawns in milliseconds (can be updated dynamically) */
  intervalMs: number
  /** Accumulated time since last spawn */
  accumulated: number
  /** Optional: pause this entry without removing it */
  paused: boolean
}

export class SpawnSystem {
  private entries: SpawnEntry[] = []
  private _paused: boolean = false

  // ─── Registration ─────────────────────────────────────────────────────────

  /**
   * Register a spawn callback with an initial interval.
   * Returns the entry reference so the caller can update intervalMs dynamically.
   *
   * @param callback - function to call when interval fires
   * @param intervalMs - initial milliseconds between spawns
   * @param fireImmediately - if true, fires the callback once immediately on registration
   */
  schedule(
    callback: () => void,
    intervalMs: number,
    fireImmediately: boolean = false
  ): SpawnEntry {
    const entry: SpawnEntry = {
      callback,
      intervalMs,
      accumulated: fireImmediately ? intervalMs : 0,
      paused: false
    }
    this.entries.push(entry)
    return entry
  }

  /**
   * Remove all registered spawn entries.
   */
  clear(): void {
    this.entries = []
  }

  /**
   * Remove a specific spawn entry.
   */
  remove(entry: SpawnEntry): void {
    const idx = this.entries.indexOf(entry)
    if (idx !== -1) {
      this.entries.splice(idx, 1)
    }
  }

  // ─── Tick ─────────────────────────────────────────────────────────────────

  /**
   * Advance all spawn timers by deltaMs.
   * Call this every frame from GameScene.update(time, delta).
   *
   * @param deltaMs - milliseconds since last frame (Phaser's delta arg)
   */
  tick(deltaMs: number): void {
    if (this._paused) return

    for (const entry of this.entries) {
      if (entry.paused) continue

      entry.accumulated += deltaMs

      // Fire while enough time has accumulated (handles multiple fires if delta is large)
      while (entry.accumulated >= entry.intervalMs) {
        entry.accumulated -= entry.intervalMs
        entry.callback()
      }
    }
  }

  // ─── Pause / Resume ───────────────────────────────────────────────────────

  pause(): void {
    this._paused = true
  }

  resume(): void {
    this._paused = false
  }

  get isPaused(): boolean {
    return this._paused
  }

  /**
   * Returns how many entries are currently scheduled.
   */
  get count(): number {
    return this.entries.length
  }
}
