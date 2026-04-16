/**
 * UIButton.ts
 * Reusable Phaser button component.
 * - Hover, press, and disabled visual states
 * - Minimum 44×44px touch target (WCAG / Apple HIG)
 * - Built entirely with Phaser Graphics and Text — no DOM
 * - Emits 'click' event on pointer-up activation
 */

export interface UIButtonConfig {
  scene: Phaser.Scene
  x: number
  y: number
  width?: number
  height?: number
  label: string
  fontSize?: number
  /** Normal background color as hex number, e.g. 0x4a90d9 */
  color?: number
  /** Hover background color */
  hoverColor?: number
  /** Pressed background color */
  pressColor?: number
  /** Disabled background color */
  disabledColor?: number
  /** Text color as CSS string */
  textColor?: string
  /** Corner radius for rounded rectangle */
  radius?: number
  /** Called when the button is clicked/tapped */
  onClick?: () => void
}

export class UIButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics
  private labelText: Phaser.GameObjects.Text
  private hitArea: Phaser.GameObjects.Rectangle

  private readonly btnWidth: number
  private readonly btnHeight: number
  private readonly colorNormal: number
  private readonly colorHover: number
  private readonly colorPress: number
  private readonly colorDisabled: number
  private readonly btnRadius: number

  private _disabled: boolean = false
  private _hovered: boolean = false
  private _pressed: boolean = false

  constructor(cfg: UIButtonConfig) {
    super(cfg.scene, cfg.x, cfg.y)

    this.btnWidth = Math.max(cfg.width ?? 200, 44)
    this.btnHeight = Math.max(cfg.height ?? 56, 44)
    this.colorNormal = cfg.color ?? 0x4a90d9
    this.colorHover = cfg.hoverColor ?? 0x5ba3f5
    this.colorPress = cfg.pressColor ?? 0x357abd
    this.colorDisabled = cfg.disabledColor ?? 0x555555
    this.btnRadius = cfg.radius ?? 12

    // ── Background ──────────────────────────────────────────────────────────
    this.bg = cfg.scene.add.graphics()
    this.drawBg(this.colorNormal)

    // ── Label ───────────────────────────────────────────────────────────────
    this.labelText = cfg.scene.add.text(0, 0, cfg.label, {
      fontSize: `${cfg.fontSize ?? 22}px`,
      fontFamily: 'Arial, sans-serif',
      color: cfg.textColor ?? '#ffffff',
      fontStyle: 'bold',
      resolution: 2
    })
    this.labelText.setOrigin(0.5, 0.5)

    // ── Hit Area (ensures minimum 44×44 touch target) ────────────────────────
    const hitW = Math.max(this.btnWidth, 44)
    const hitH = Math.max(this.btnHeight, 44)
    this.hitArea = cfg.scene.add.rectangle(0, 0, hitW, hitH)
    this.hitArea.setAlpha(0.001) // Invisible but present for pointer events

    this.add([this.bg, this.labelText, this.hitArea])

    this.hitArea.setInteractive({ useHandCursor: true })
    this.hitArea.on(Phaser.Input.Events.POINTER_OVER, this.onOver, this)
    this.hitArea.on(Phaser.Input.Events.POINTER_OUT, this.onOut, this)
    this.hitArea.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this)
    this.hitArea.on(Phaser.Input.Events.POINTER_UP, this.onUp, this)

    if (cfg.onClick) {
      this.on('click', cfg.onClick)
    }

    cfg.scene.add.existing(this)
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  setText(text: string): this {
    this.labelText.setText(text)
    return this
  }

  setEnabled(enabled: boolean): this {
    this._disabled = !enabled
    if (enabled) {
      this.hitArea.setInteractive({ useHandCursor: true })
    } else {
      this.hitArea.disableInteractive()
    }
    this.drawBg(enabled ? this.colorNormal : this.colorDisabled)
    this.labelText.setAlpha(enabled ? 1 : 0.5)
    return this
  }

  get isDisabled(): boolean {
    return this._disabled
  }

  // ─── State Transitions ────────────────────────────────────────────────────

  private onOver(): void {
    if (this._disabled) return
    this._hovered = true
    if (!this._pressed) {
      this.drawBg(this.colorHover)
      this.setScale(1.03)
    }
  }

  private onOut(): void {
    if (this._disabled) return
    this._hovered = false
    this._pressed = false
    this.drawBg(this.colorNormal)
    this.setScale(1.0)
  }

  private onDown(): void {
    if (this._disabled) return
    this._pressed = true
    this.drawBg(this.colorPress)
    this.setScale(0.97)
  }

  private onUp(): void {
    if (this._disabled) return
    this._pressed = false
    this.drawBg(this._hovered ? this.colorHover : this.colorNormal)
    this.setScale(this._hovered ? 1.03 : 1.0)
    this.emit('click')
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────

  private drawBg(color: number): void {
    this.bg.clear()
    this.bg.fillStyle(color, 1)
    this.bg.fillRoundedRect(
      -this.btnWidth / 2,
      -this.btnHeight / 2,
      this.btnWidth,
      this.btnHeight,
      this.btnRadius
    )
    // Subtle stroke
    this.bg.lineStyle(2, 0xffffff, 0.15)
    this.bg.strokeRoundedRect(
      -this.btnWidth / 2,
      -this.btnHeight / 2,
      this.btnWidth,
      this.btnHeight,
      this.btnRadius
    )
  }
}
