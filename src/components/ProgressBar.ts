/**
 * ProgressBar.ts
 * Reusable loading/progress bar component.
 * Used in PreloadScene but can be used anywhere a progress indicator is needed.
 * Built with Phaser Graphics — no DOM.
 */

export interface ProgressBarConfig {
  scene: Phaser.Scene
  x: number
  y: number
  width?: number
  height?: number
  /** Background track color */
  trackColor?: number
  /** Fill color for completed portion */
  fillColor?: number
  /** Accent/highlight color drawn as a thin stripe on top of fill */
  highlightColor?: number
  /** Corner radius */
  radius?: number
  /** Initial progress value 0..1 */
  initialValue?: number
}

export class ProgressBar extends Phaser.GameObjects.Container {
  private track: Phaser.GameObjects.Graphics
  private fill: Phaser.GameObjects.Graphics

  private readonly barWidth: number
  private readonly barHeight: number
  private readonly trackColor: number
  private readonly fillColor: number
  private readonly highlightColor: number
  private readonly barRadius: number

  private _value: number = 0

  constructor(cfg: ProgressBarConfig) {
    super(cfg.scene, cfg.x, cfg.y)

    this.barWidth = cfg.width ?? 300
    this.barHeight = cfg.height ?? 20
    this.trackColor = cfg.trackColor ?? 0x333355
    this.fillColor = cfg.fillColor ?? 0x4a90d9
    this.highlightColor = cfg.highlightColor ?? 0x7ab8f5
    this.barRadius = cfg.radius ?? Math.floor((cfg.height ?? 20) / 2)

    // Track (empty bar background)
    this.track = cfg.scene.add.graphics()
    this.drawTrack()

    // Fill (progress portion)
    this.fill = cfg.scene.add.graphics()

    this.add([this.track, this.fill])

    cfg.scene.add.existing(this)

    // Apply initial value
    this.setValue(cfg.initialValue ?? 0)
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Set progress. value must be in range 0..1.
   */
  setValue(value: number): void {
    this._value = Math.max(0, Math.min(1, value))
    this.drawFill()
  }

  /**
   * Returns current progress value (0..1).
   */
  get value(): number {
    return this._value
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────

  private drawTrack(): void {
    this.track.clear()
    // Outer border
    this.track.lineStyle(2, 0xffffff, 0.2)
    this.track.strokeRoundedRect(
      -this.barWidth / 2 - 1,
      -this.barHeight / 2 - 1,
      this.barWidth + 2,
      this.barHeight + 2,
      this.barRadius + 1
    )
    // Fill with track color
    this.track.fillStyle(this.trackColor, 1)
    this.track.fillRoundedRect(
      -this.barWidth / 2,
      -this.barHeight / 2,
      this.barWidth,
      this.barHeight,
      this.barRadius
    )
  }

  private drawFill(): void {
    this.fill.clear()
    if (this._value <= 0) return

    const filledWidth = Math.max(this.barRadius * 2, this.barWidth * this._value)

    // Main fill
    this.fill.fillStyle(this.fillColor, 1)
    this.fill.fillRoundedRect(
      -this.barWidth / 2,
      -this.barHeight / 2,
      filledWidth,
      this.barHeight,
      this.barRadius
    )

    // Highlight stripe (top edge)
    const highlightH = Math.max(2, Math.floor(this.barHeight * 0.25))
    this.fill.fillStyle(this.highlightColor, 0.5)
    this.fill.fillRoundedRect(
      -this.barWidth / 2 + 4,
      -this.barHeight / 2 + 3,
      Math.max(0, filledWidth - 8),
      highlightH,
      highlightH / 2
    )
  }
}
