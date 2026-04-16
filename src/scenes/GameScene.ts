/**
 * GameScene.ts
 * Core gameplay scene — placeholder loop with all systems wired up.
 *
 * Poki: PokiPlugin automatically fires gameplayStart when this scene
 * starts and gameplayStop when it stops. No manual SDK calls needed
 * for those events.
 *
 * ── What's implemented (placeholder) ────────────────────────────────────────
 *   • Player sprite controlled by touch/mouse drag or keyboard arrows
 *   • Enemies spawn from the top, fall downward
 *   • Collision with enemy → lose a life → game over
 *   • Coins spawn periodically → collect for points
 *   • Score and lives HUD
 *   • Pause on Escape key
 *
 * ── What to replace for your specific game ──────────────────────────────────
 *   • Player movement logic
 *   • SpawnSystem callbacks (create your actual game objects)
 *   • Collision handlers
 *   • Win/lose conditions
 */

import { ScoreSystem } from '../systems/ScoreSystem'
import { DifficultySystem } from '../systems/DifficultySystem'
import { SpawnSystem } from '../systems/SpawnSystem'
import { AudioManager } from '../core/AudioManager'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { formatScore } from '../utils/helpers'

const CX = GAME_CONFIG.width / 2

export class GameScene extends Phaser.Scene {
  // ── Systems ────────────────────────────────────────────────────────────────
  private scoreSystem!: ScoreSystem
  private difficultySystem!: DifficultySystem
  private spawnSystem!: SpawnSystem

  // ── Game Objects ──────────────────────────────────────────────────────────
  private player!: Phaser.Physics.Arcade.Sprite
  private enemies!: Phaser.Physics.Arcade.Group
  private coins!: Phaser.Physics.Arcade.Group

  // ── HUD ───────────────────────────────────────────────────────────────────
  private scoreText!: Phaser.GameObjects.Text
  private livesText!: Phaser.GameObjects.Text
  private pauseOverlay!: Phaser.GameObjects.Container

  // ── State ─────────────────────────────────────────────────────────────────
  private lives: number = BALANCING.startingLives
  private isPaused: boolean = false
  private isGameOver: boolean = false

  // ── Input ─────────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: {
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
  }
  private escapeKey!: Phaser.Input.Keyboard.Key
  private pointerX: number = CX
  private pointerDown: boolean = false

  // ── Spawn Entries (kept to update interval dynamically) ───────────────────
  private enemySpawnEntry!: ReturnType<SpawnSystem['schedule']>
  private coinSpawnEntry!: ReturnType<SpawnSystem['schedule']>

  constructor() {
    super({ key: 'GameScene' })
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    this.cameras.main.setBackgroundColor(config.game.backgroundColor)
    this.cameras.main.fadeIn(BALANCING.sceneFadeDuration, 0, 0, 0)

    // Reset state
    this.lives = BALANCING.startingLives
    this.isPaused = false
    this.isGameOver = false

    // Init systems
    this.scoreSystem = new ScoreSystem()
    this.difficultySystem = new DifficultySystem()
    this.spawnSystem = new SpawnSystem()

    this.createWorld()
    this.createPlayer()
    this.createGroups()
    this.createHUD()
    this.createPauseOverlay()
    this.setupPhysics()
    this.setupInput()
    this.setupSpawning()

    // TODO: analytics hook — gameplay_started
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return

    this.difficultySystem.update(delta)

    // Dynamically update spawn intervals based on current difficulty
    this.enemySpawnEntry.intervalMs = this.difficultySystem.getCurrentSpawnInterval()
    this.coinSpawnEntry.intervalMs = this.difficultySystem.getCurrentSpawnInterval() * 1.5

    this.spawnSystem.tick(delta)
    this.updatePlayerMovement()
    this.cleanupOffscreenObjects()
  }

  // ─── World ────────────────────────────────────────────────────────────────

  private createWorld(): void {
    // Gradient background (replace with tilemaps / parallax layers)
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1)
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)
    bg.setDepth(0)
  }

  // ─── Player ───────────────────────────────────────────────────────────────

  private createPlayer(): void {
    const spawnX = CX
    const spawnY = GAME_CONFIG.height - 120

    this.player = this.physics.add.sprite(spawnX, spawnY, 'player')
    this.player.setCollideWorldBounds(true)
    this.player.setDepth(10)

    // Constrain player to bottom third of screen vertically
    this.player.setMaxVelocity(BALANCING.playerSpeed, 0)
  }

  private updatePlayerMovement(): void {
    const speed = BALANCING.playerSpeed
    let vx = 0

    // ── Keyboard ────────────────────────────────────────────────────────────
    const leftDown =
      this.cursors.left.isDown || this.wasdKeys.left.isDown
    const rightDown =
      this.cursors.right.isDown || this.wasdKeys.right.isDown

    if (leftDown) vx = -speed
    else if (rightDown) vx = speed

    // ── Touch / Pointer ──────────────────────────────────────────────────────
    if (this.pointerDown && !leftDown && !rightDown) {
      const diff = this.pointerX - this.player.x
      if (Math.abs(diff) > 8) {
        vx = Math.sign(diff) * speed
      }
    }

    this.player.setVelocityX(vx)
  }

  // ─── Groups ───────────────────────────────────────────────────────────────

  private createGroups(): void {
    this.enemies = this.physics.add.group({
      maxSize: 30,
      runChildUpdate: false
    })

    this.coins = this.physics.add.group({
      maxSize: 10,
      runChildUpdate: false
    })
  }

  // ─── Physics / Collisions ─────────────────────────────────────────────────

  private setupPhysics(): void {
    // Player ↔ Enemy
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.handlePlayerHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    )

    // Player ↔ Coin
    this.physics.add.overlap(
      this.player,
      this.coins,
      this.handlePlayerCollectCoin as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    )
  }

  private handlePlayerHitEnemy(
    _player: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject
  ): void {
    enemy.destroy()
    this.lives--
    this.updateHUD()

    // Flash the player red
    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 80,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.player.setAlpha(1)
    })

    AudioManager.playSfx(this, 'sfx_hurt')

    if (this.lives <= 0) {
      this.triggerGameOver()
    }
  }

  private handlePlayerCollectCoin(
    _player: Phaser.GameObjects.GameObject,
    coin: Phaser.GameObjects.GameObject
  ): void {
    coin.destroy()
    this.scoreSystem.add(BALANCING.pointsPerEvent)
    this.updateHUD()

    AudioManager.playSfx(this, 'sfx_score')

    // TODO: analytics hook — coin_collected, score: this.scoreSystem.getScore()
  }

  // ─── Spawning ─────────────────────────────────────────────────────────────

  private setupSpawning(): void {
    // Enemy spawner
    this.enemySpawnEntry = this.spawnSystem.schedule(
      () => this.spawnEnemy(),
      BALANCING.initialSpawnInterval
    )

    // Coin spawner (less frequent than enemies)
    this.coinSpawnEntry = this.spawnSystem.schedule(
      () => this.spawnCoin(),
      BALANCING.initialSpawnInterval * 1.5
    )
  }

  private spawnEnemy(): void {
    const x = Phaser.Math.Between(30, GAME_CONFIG.width - 30)
    const enemy = this.enemies.get(x, -20, 'enemy') as Phaser.Physics.Arcade.Sprite | null
    if (!enemy) return

    enemy.setActive(true)
    enemy.setVisible(true)
    enemy.setPosition(x, -20)
    enemy.setDepth(5)

    const speed = 150 + this.difficultySystem.getDifficultyMultiplier() * 50
    enemy.setVelocityY(speed)
    enemy.setVelocityX(Phaser.Math.Between(-40, 40))
  }

  private spawnCoin(): void {
    const x = Phaser.Math.Between(30, GAME_CONFIG.width - 30)
    const coin = this.coins.get(x, -20, 'coin') as Phaser.Physics.Arcade.Sprite | null
    if (!coin) return

    coin.setActive(true)
    coin.setVisible(true)
    coin.setPosition(x, -20)
    coin.setDepth(5)
    coin.setVelocityY(120)
  }

  private cleanupOffscreenObjects(): void {
    const bottom = GAME_CONFIG.height + 60

    this.enemies.getChildren().forEach((obj) => {
      const sprite = obj as Phaser.Physics.Arcade.Sprite
      if (sprite.active && sprite.y > bottom) {
        sprite.destroy()
      }
    })

    this.coins.getChildren().forEach((obj) => {
      const sprite = obj as Phaser.Physics.Arcade.Sprite
      if (sprite.active && sprite.y > bottom) {
        sprite.destroy()
      }
    })
  }

  // ─── HUD ──────────────────────────────────────────────────────────────────

  private createHUD(): void {
    // Score
    this.scoreText = this.add
      .text(CX, 30, 'Score: 0', {
        fontSize: '22px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        fontStyle: 'bold',
        resolution: 2
      })
      .setOrigin(0.5, 0)
      .setDepth(20)

    // Lives
    this.livesText = this.add
      .text(GAME_CONFIG.width - 16, 16, `❤️ ${this.lives}`, {
        fontSize: '20px',
        fontFamily: 'Arial, sans-serif',
        color: '#e74c3c',
        resolution: 2
      })
      .setOrigin(1, 0)
      .setDepth(20)

    // Mute indicator (top left)
    const muteIndicator = this.add
      .text(16, 16, AudioManager.muted ? '🔇' : '🔊', {
        fontSize: '24px',
        resolution: 2
      })
      .setDepth(20)
      .setInteractive({ useHandCursor: true })

    muteIndicator.on('pointerdown', () => {
      AudioManager.toggleMute()
      muteIndicator.setText(AudioManager.muted ? '🔇' : '🔊')
    })
  }

  private updateHUD(): void {
    this.scoreText.setText(`Score: ${formatScore(this.scoreSystem.getScore())}`)
    this.livesText.setText(`❤️ ${this.lives}`)
  }

  // ─── Pause ────────────────────────────────────────────────────────────────

  private createPauseOverlay(): void {
    this.pauseOverlay = this.add.container(0, 0)
    this.pauseOverlay.setDepth(50)
    this.pauseOverlay.setVisible(false)

    // Dimmer
    const dim = this.add.rectangle(
      CX,
      GAME_CONFIG.height / 2,
      GAME_CONFIG.width,
      GAME_CONFIG.height,
      0x000000,
      0.6
    )
    const pauseText = this.add
      .text(CX, GAME_CONFIG.height / 2 - 40, 'PAUSED', {
        fontSize: '40px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        fontStyle: 'bold',
        resolution: 2
      })
      .setOrigin(0.5)

    const resumeHint = this.add
      .text(CX, GAME_CONFIG.height / 2 + 20, 'Press Escape to resume', {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#aaaacc',
        resolution: 2
      })
      .setOrigin(0.5)

    this.pauseOverlay.add([dim, pauseText, resumeHint])
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused
    this.pauseOverlay.setVisible(this.isPaused)
    this.spawnSystem.isPaused ? this.spawnSystem.resume() : this.spawnSystem.pause()
    this.physics.world.isPaused ? this.physics.resume() : this.physics.pause()
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasdKeys = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    }
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.escapeKey.on('down', this.togglePause, this)

    // Touch / pointer movement
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (ptr: Phaser.Input.Pointer) => {
      this.pointerDown = true
      this.pointerX = ptr.x
    })
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (ptr: Phaser.Input.Pointer) => {
      if (ptr.isDown) this.pointerX = ptr.x
    })
    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.pointerDown = false
    })
  }

  // ─── Game Over ────────────────────────────────────────────────────────────

  private triggerGameOver(): void {
    this.isGameOver = true
    this.spawnSystem.clear()
    this.physics.pause()

    // TODO: analytics hook — game_over, score: this.scoreSystem.getScore()

    this.cameras.main.shake(300, 0.012)
    this.time.delayedCall(600, () => {
      this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
      this.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => {
          this.scene.start('ResultScene', {
            score: this.scoreSystem.getScore(),
            highScore: this.scoreSystem.getHighScore(),
            isNewHighScore: this.scoreSystem.isNewHighScore()
          })
        }
      )
    })
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  shutdown(): void {
    this.spawnSystem.clear()
    this.escapeKey?.destroy()
    this.input.off(Phaser.Input.Events.POINTER_DOWN)
    this.input.off(Phaser.Input.Events.POINTER_MOVE)
    this.input.off(Phaser.Input.Events.POINTER_UP)
  }
}
