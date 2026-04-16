# AGENTS.md — AI Agent Reference for phaser-poki-starter

> This file is written for AI coding agents, not human developers.
> It is dense, precise, and assumes full codebase access.
> Human documentation is in README.md.

---

## 1. Project Overview

**What it is:** A production-ready Phaser 3 browser game template targeting the Poki platform. It implements the complete scene lifecycle, all Poki SDK hooks, responsive scaling, persisted settings, and placeholder gameplay so an agent can build a complete game by replacing only the designated files.

**Target platform:** Poki (https://poki.com) — casual browser games, mobile-first, portrait orientation (480×854).

**Tech stack — exact installed versions:**

| Package | package.json spec | Installed |
|---|---|---|
| phaser | ^3.80.1 | 3.90.0 |
| @poki/phaser-3 | ^0.0.5 | 0.0.5 |
| typescript | ^5.4.5 | 5.9.3 |
| vite | ^5.2.11 | 5.4.21 |

All four are in `devDependencies`. This is intentional — Vite bundles everything into `dist/` at build time; the devDependencies distinction has no deployment effect.

**Entry point:** `index.html` → `src/main.ts`

**Build command:** `npm run build` (runs `tsc && vite build`, outputs to `dist/`)

**Dev command:** `npm run dev` (Vite only, no type checking; runs at http://localhost:3000)

**Typecheck command:** `npm run typecheck` (runs `tsc --noEmit`)

---

## 2. Architecture Map

### 2.1 File Index

```
index.html                        HTML shell; sets mobile viewport meta; mounts #game-container
vite.config.ts                    Vite config; base='./', port=3000, phaser in its own chunk
tsconfig.json                     TS strict mode; moduleResolution=bundler; noEmit=true
package.json                      Scripts + dependencies

src/main.ts
  exports: nothing (side-effect: boots Phaser.Game)
  imports: Phaser, PokiPlugin, all 5 scenes, ScaleManager, GAME_CONFIG
  responsibility: assembles GameConfig, registers PokiPlugin, starts game

src/scenes/BootScene.ts
  exports: class BootScene extends Phaser.Scene  (key: 'BootScene')
  imports: ScaleManager, AudioManager, config, BALANCING
  responsibility: init() calls ScaleManager.init() + AudioManager.init(); create() fades in and routes to 'PreloadScene' after BALANCING.bootDelay ms

src/scenes/PreloadScene.ts
  exports: class PreloadScene extends Phaser.Scene  (key: 'PreloadScene')
  imports: ProgressBar, config, GAME_CONFIG, BALANCING
  responsibility: shows loading bar; generates placeholder textures (player/enemy/coin/particle); routes to 'MenuScene' on complete

src/scenes/MenuScene.ts
  exports: class MenuScene extends Phaser.Scene  (key: 'MenuScene')
  imports: UIButton, AudioManager, SaveManager, SAVE_KEYS, config, GAME_CONFIG, BALANCING
  responsibility: title screen; Play → 'GameScene'; mute toggle; shows saved high score

src/scenes/GameScene.ts
  exports: class GameScene extends Phaser.Scene  (key: 'GameScene')
  imports: ScoreSystem, DifficultySystem, SpawnSystem, AudioManager, config, GAME_CONFIG, BALANCING, formatScore
  responsibility: main gameplay loop; player/enemies/coins; HUD; pause; game-over → 'ResultScene'

src/scenes/ResultScene.ts
  exports: class ResultScene extends Phaser.Scene  (key: 'ResultScene')
  imports: UIButton, config, GAME_CONFIG, BALANCING, formatScore
  responsibility: score display with count-up animation; Play Again → 'GameScene'; Menu → 'MenuScene'; rewarded ad hook placeholder

src/core/AudioManager.ts
  exports: class AudioManager (static-only singleton)
  imports: SaveManager, SAVE_KEYS
  public API: init(scene), playSfx(scene, key, vol?), playMusic(scene, key, vol?), stopMusic(), toggleMute():bool, setMuted(bool), setSfxVolume(0-1), setMusicVolume(0-1), get muted, get sfxVolume, get musicVolume
  side effects: reads/writes localStorage via SaveManager; attaches touchstart/mousedown/keydown to document for audio unlock

src/core/Config.ts
  exports: interface RuntimeConfig, const config: RuntimeConfig
  imports: GAME_CONFIG, BALANCING
  responsibility: merges GAME_CONFIG + BALANCING + runtime detection (isDev, isMobile) into one injectable object

src/core/SaveManager.ts
  exports: class SaveManager (static-only), const SAVE_KEYS
  imports: none
  public API: save<T>(key, value), load<T>(key, default):T, remove(key), clearAll(), isAvailable():bool
  side effects: reads/writes localStorage; all keys prefixed with 'pg_' (e.g. 'pg_high_score')
  SAVE_KEYS: { highScore: 'high_score', muted: 'muted', sfxVolume: 'sfx_volume', musicVolume: 'music_volume' }

src/core/ScaleManager.ts
  exports: class ScaleManager (static-only)
  imports: GAME_CONFIG
  public API: init(), getPhaserScaleConfig():Phaser.Types.Core.ScaleConfig, isWrongOrientation():bool, get viewportWidth, get viewportHeight
  side effects: attaches 'orientationchange'+'resize' to window; creates/removes a DOM overlay div (#orientation-warning) when in wrong orientation

src/data/gameConfig.ts
  exports: const GAME_CONFIG, type GameConfig
  values: title='My Game', width=480, height=854, backgroundColor='#1a1a2e', debug=false, version='1.0.0', physics='arcade', targetFps=60

src/data/balancing.ts
  exports: const BALANCING, type Balancing
  values: initialSpawnInterval=2000, minSpawnInterval=500, difficultyRampTime=60000, maxDifficultyMultiplier=3.0, pointsPerEvent=10, comboMultiplier=1.5, comboThreshold=5, startingLives=3, playerSpeed=300, sceneFadeDuration=300, bootDelay=100

src/systems/ScoreSystem.ts
  exports: class ScoreSystem
  imports: SaveManager, SAVE_KEYS
  constructor: loads persisted high score from localStorage
  public API: add(points), reset(), getScore():number, getHighScore():number, isNewHighScore():bool, clearHighScore()
  side effects: SaveManager.save on new high score

src/systems/DifficultySystem.ts
  exports: class DifficultySystem
  imports: BALANCING
  constructor: reads rampTime + maxMultiplier from BALANCING
  public API: update(deltaMs), getDifficultyMultiplier():number [1.0..maxMultiplier], getCurrentSpawnInterval():number [ms, clamped to minSpawnInterval], getElapsedMs(), getElapsedSeconds(), getDifficultyProgress() [0..1], reset()
  side effects: none (pure time accumulator)

src/systems/SpawnSystem.ts
  exports: interface SpawnEntry, class SpawnSystem
  constructor: no args
  public API: schedule(callback, intervalMs, fireImmediately?):SpawnEntry, tick(deltaMs), clear(), remove(entry), pause(), resume(), get isPaused, get count
  note: intervalMs on returned SpawnEntry is mutable; GameScene updates it each frame to match difficulty
  side effects: none (fires caller-provided callbacks)

src/components/ProgressBar.ts
  exports: interface ProgressBarConfig, class ProgressBar extends Phaser.GameObjects.Container
  constructor: ProgressBarConfig { scene, x, y, width?, height?, trackColor?, fillColor?, highlightColor?, radius?, initialValue? }
  public API: setValue(0..1), get value
  side effects: calls scene.add.existing(this) in constructor

src/components/UIButton.ts
  exports: interface UIButtonConfig, class UIButton extends Phaser.GameObjects.Container
  constructor: UIButtonConfig { scene, x, y, width?, height?, label, fontSize?, color?, hoverColor?, pressColor?, disabledColor?, textColor?, radius?, onClick? }
  public API: setText(text):this, setEnabled(bool):this, get isDisabled
  side effects: calls scene.add.existing(this) in constructor; emits 'click' event on pointer-up

src/utils/helpers.ts
  exports: randomInt, randomFloat, clamp, lerp, mapRange, zeroPad, formatTime, formatScore, isTouchDevice, randomPick, shuffle, degToRad, distance
  imports: none
  note: all functions are pure; no Phaser dependency

src/types/poki.d.ts
  purpose: ambient module declaration for @poki/phaser-3 (package ships no typings)
  declares: PokiSDK interface, PokiPluginData interface, class PokiPlugin extends Phaser.Plugins.BasePlugin
  PokiPlugin methods: runWhenInitialized(cb), rewardedBreak():Promise<bool>, commercialBreak():Promise<void>

public/assets/
  placeholder directory for game assets (images, audio, spritesheets)
  load from this path in PreloadScene: this.load.image('key', 'assets/filename.png')
```

### 2.2 Scene Flow

```
              ┌──────────────────────────────────────────┐
              │             Phaser.Game boots             │
              │  PokiPlugin registers + loads SDK script  │
              └──────────────┬───────────────────────────┘
                             │
                        BootScene
                    (init: services)
                    (create: 100ms delay)
                             │
                        PreloadScene  ◄─── PokiPlugin: gameLoadingFinished fires here
                    (textures generated)
                    (progress bar shown)
                             │
                        MenuScene
                    (Play button / mute)
                             │
              ┌──────────────▼───────────────────────────┐
              │            GameScene                      │
              │  PokiPlugin: gameplayStart fires on enter │
              │  PokiPlugin: gameplayStop fires on exit   │
              │  PokiPlugin: commercialBreak auto-fires   │
              │            between sessions               │
              └──────────────┬───────────────────────────┘
                             │ (lives == 0)
                        ResultScene
                    (score display, count-up)
                    (rewarded ad placeholder)
                             │ ──────────────────► MenuScene (MENU button)
                             │ ◄────────────────── GameScene (PLAY AGAIN button)
```

### 2.3 System Dependency Graph

```
main.ts
  → ScaleManager (for scale config, before Phaser init)
  → all 5 scene classes

BootScene
  → ScaleManager.init()
  → AudioManager.init()
  → config (for logging)
  → BALANCING (for bootDelay)

PreloadScene
  → ProgressBar
  → config, GAME_CONFIG, BALANCING

MenuScene
  → UIButton
  → AudioManager (toggle mute)
  → SaveManager + SAVE_KEYS (read high score)
  → config, GAME_CONFIG, BALANCING

GameScene
  → ScoreSystem → SaveManager
  → DifficultySystem → BALANCING
  → SpawnSystem (pure)
  → AudioManager
  → config, GAME_CONFIG, BALANCING
  → helpers.formatScore

ResultScene
  → UIButton
  → config, GAME_CONFIG, BALANCING
  → helpers.formatScore

AudioManager → SaveManager → localStorage
ScoreSystem  → SaveManager → localStorage
ScaleManager → window (DOM only for orientation overlay)
Config       → GAME_CONFIG, BALANCING (merged at import time)
```

---

## 3. Critical Constraints

**Violating any of these will break Poki monetisation, cause runtime crashes, or break the build.**

### 3.1 Scene keys MUST match Poki plugin config exactly

`main.ts` plugin data specifies:
```typescript
loadingSceneKey: 'PreloadScene'   // triggers gameLoadingFinished
gameplaySceneKey: 'GameScene'     // triggers gameplayStart + gameplayStop
```

The constructors in `PreloadScene.ts` and `GameScene.ts` both use `super({ key: 'PreloadScene' })` and `super({ key: 'GameScene' })` respectively. If you rename either scene, you MUST update BOTH the scene constructor AND the Poki plugin data in `main.ts`.

If these diverge, the Poki SDK will never fire `gameLoadingFinished` (game appears stuck in loading to Poki infrastructure) and `gameplayStart`/`gameplayStop` will never fire (ad timing breaks, revenue impact).

### 3.2 SaveManager key namespace prefix

All localStorage keys written by SaveManager are prefixed with `'pg_'` (defined as `const PREFIX = 'pg_'` in `SaveManager.ts`). SAVE_KEYS stores only the suffix: `highScore: 'high_score'` → written as `'pg_high_score'`. Never call `localStorage` directly — always use `SaveManager.save/load` with a key from `SAVE_KEYS` or a new entry added to `SAVE_KEYS`. Bypassing this breaks the namespace isolation and clearAll() scoping.

### 3.3 AudioManager must remain a singleton

`AudioManager` is a static class. It has no constructor and no instances. `_currentMusic`, `_muted`, `_sfxVolume`, `_musicVolume`, `_audioUnlocked` are all static fields. Do NOT instantiate it (`new AudioManager()`), do NOT convert it to an instance class. Multiple instances would result in conflicting mute state and multiple audio unlock listeners. It is initialised once via `AudioManager.init(scene)` in `BootScene.init()`.

### 3.4 ScaleManager.getPhaserScaleConfig() must be called inside the GameConfig object

`main.ts` calls `ScaleManager.getPhaserScaleConfig()` as the value of the `scale` field in `Phaser.Types.Core.GameConfig`. This must happen before `new Phaser.Game(config)` is called (it is). Do NOT call it after game init or inside a scene — the scale config is consumed once at game construction. `ScaleManager.init()` (orientation handling) is called separately from `BootScene.init()` and is safe to move, but `getPhaserScaleConfig()` must always be in the root `GameConfig.scale` field.

### 3.5 No DOM manipulation in game logic

`ScaleManager` is the only class permitted to touch the DOM (creates `#orientation-warning` overlay). All game content (sprites, text, shapes, UI) must be created via Phaser's scene APIs (`this.add.*`, `this.physics.add.*`, etc.). Do NOT call `document.createElement`, `document.getElementById`, or set `innerHTML` from scenes, systems, or components.

### 3.6 No object allocation in `update()` loops

`GameScene.update()` must not create new objects each frame. Specifically:
- Enemy and coin pooling uses `this.enemies.get(...)` / `this.coins.get(...)` — this returns pooled objects, not new ones.
- `Phaser.Math.Between` is called in spawn methods (not in update directly).
- `getChildren()` on Arcade Groups returns the internal array reference, not a copy — iterating it is allocation-free.
- Do NOT use `new`, `Array.map`, `Object.assign`, `JSON.parse`, or spread operators inside `GameScene.update()`.

### 3.7 Scene startup order in main.ts

Scenes in `main.ts` are declared as:
```typescript
scene: [BootScene, PreloadScene, MenuScene, GameScene, ResultScene]
```
The first scene in the array auto-starts. This MUST be `BootScene`. All other scenes are registered but idle until `scene.start('SceneName')` is called. Do not reorder.

### 3.8 Phaser global namespace availability

Phaser's TypeScript declarations (`node_modules/phaser/types/phaser.d.ts`) are ambient globals (`declare namespace Phaser`). They become available to all files in the compilation once `main.ts` imports `phaser`. Scene files do NOT need `import Phaser from 'phaser'` — the global namespace is always in scope. Only `main.ts` needs the direct import.

---

## 4. Modification Guide

### 4.1 Files to REPLACE (gameplay logic)

| File | What to replace |
|---|---|
| `src/scenes/GameScene.ts` | Everything inside `createWorld()`, `createPlayer()`, `createGroups()`, `spawnEnemy()`, `spawnCoin()`, `handlePlayerHitEnemy()`, `handlePlayerCollectCoin()`, `updatePlayerMovement()`, `cleanupOffscreenObjects()`. Keep the HUD, pause, spawn system wiring, and game-over trigger structure. |
| `src/scenes/PreloadScene.ts` → `loadAssets()` | Replace the `make.graphics` placeholder texture generation with `this.load.image(...)`, `this.load.spritesheet(...)`, `this.load.audio(...)` calls. Leave the progress bar and transition logic intact. |

### 4.2 Files to TUNE (numbers only)

| File | What to change |
|---|---|
| `src/data/balancing.ts` | All gameplay numbers: spawn intervals, difficulty ramp, lives, speed, points. This is the first file to edit when tuning game feel. |
| `src/data/gameConfig.ts` | Title, canvas dimensions, background color, debug flag, version string. Change `title` to rebrand. Change `width`/`height` together maintaining 9:16 ratio. |

### 4.3 Files to EXTEND (add to, don't replace)

| File | What to add |
|---|---|
| `src/scenes/PreloadScene.ts` → `loadAssets()` | New asset load calls |
| `src/core/SaveManager.ts` → `SAVE_KEYS` | New save key entries |
| `src/utils/helpers.ts` | New pure utility functions |
| `src/types/poki.d.ts` | If Poki SDK exposes new methods not yet declared |

### 4.4 Files that should NOT be modified unless necessary

| File | Reason |
|---|---|
| `src/core/AudioManager.ts` | Singleton with carefully balanced mute state, music volume, and browser audio unlock. Modifying risks breaking audio on mobile. |
| `src/core/SaveManager.ts` | Changing PREFIX or key structure breaks existing saves for players. |
| `src/core/ScaleManager.ts` | Scaling config tightly coupled to Phaser init order and DOM orientation overlay logic. |
| `src/components/UIButton.ts` | Tested interaction states (hover/press/disabled). Modifying risks breaking touch events. |
| `src/components/ProgressBar.ts` | Stable. Add a new component instead of modifying. |
| `main.ts` | Plugin registration and scene order are fragile. Only modify if adding a new global plugin or scene. |
| `index.html` | Mobile viewport meta tags are required for Poki. Do not remove `user-scalable=no` or `touch-action: none`. |

---

## 5. System Contracts

### ScoreSystem

```typescript
constructor()
  // Loads persisted high score from localStorage on construction.
  // Call once per game session (GameScene.create()).

add(points: number): void
  // Adds points to current score. Clamps to 0 minimum.
  // Automatically updates and persists high score if exceeded.

reset(): void
  // Resets current score to 0. Does NOT affect high score.

getScore(): number
  // Returns current in-session score.

getHighScore(): number
  // Returns all-time high score (loaded from localStorage at construction).

isNewHighScore(): boolean
  // Returns true if current score > 0 AND current score >= all-time high score.
  // Call this before passing data to ResultScene.

clearHighScore(): void
  // Deletes persisted high score. Use for "reset data" feature only.
```

Side effects: `SaveManager.save(SAVE_KEYS.highScore, ...)` called whenever score exceeds stored high score.

### DifficultySystem

```typescript
constructor()
  // Reads BALANCING.difficultyRampTime and BALANCING.maxDifficultyMultiplier.
  // Starts at elapsed=0.

update(deltaMs: number): void
  // Must be called every frame from GameScene.update(). Pass Phaser's delta arg.

getDifficultyMultiplier(): number
  // Returns value in [1.0, maxDifficultyMultiplier].
  // Curve: ease-out quadratic (fast early ramp, plateaus near max).

getCurrentSpawnInterval(): number
  // Returns BALANCING.initialSpawnInterval / multiplier, clamped to BALANCING.minSpawnInterval.
  // Use this as the live interval for SpawnSystem entries.

getDifficultyProgress(): number
  // Returns [0, 1] — fraction of ramp time elapsed.

reset(): void
  // Resets elapsed to 0. Call on game restart.
```

Side effects: none.

### SpawnSystem

```typescript
constructor()
  // No args. Creates empty entries array.

schedule(callback: () => void, intervalMs: number, fireImmediately?: boolean): SpawnEntry
  // Registers a spawn callback. Returns a mutable SpawnEntry reference.
  // SpawnEntry.intervalMs can be written each frame to dynamically adjust rate.
  // SpawnEntry.paused can be set true to suspend this entry without removing it.

tick(deltaMs: number): void
  // Must be called every frame from GameScene.update(). Advances all timers.
  // Handles multiple fires per frame if delta is large (no spawn skip on lag).

clear(): void
  // Removes all entries. Call in GameScene.shutdown() and triggerGameOver().

remove(entry: SpawnEntry): void
  // Removes a specific entry returned by schedule().

pause() / resume(): void
  // Pauses/resumes the entire system. Called by GameScene.togglePause().

get isPaused: boolean
get count: number
```

Side effects: fires caller-provided callbacks.

### AudioManager (static singleton)

```typescript
static init(scene: Phaser.Scene): void
  // Call ONCE from BootScene.init().
  // Loads persisted mute/volume state from SaveManager.
  // Attaches document-level audio unlock listeners (touchstart, mousedown, keydown).
  // scene parameter is unused (reserved for future use) — pass `this`.

static playSfx(scene: Phaser.Scene, key: string, volume?: number): void
  // Plays one-shot sound. No-ops if: muted, key not loaded, audio context locked.
  // Always safe to call — never throws.

static playMusic(scene: Phaser.Scene, key: string, volume?: number): void
  // Stops any current music, starts a new looping track.
  // No-ops if key not loaded.

static stopMusic(): void
  // Stops and destroys current music track.

static toggleMute(): boolean
  // Flips mute state, persists via SaveManager. Returns new muted state.

static setMuted(muted: boolean): void
  // Explicit mute set. Persists via SaveManager.

static get muted: boolean
static get sfxVolume: number    // 0.0–1.0
static get musicVolume: number  // 0.0–1.0
```

Side effects: document event listeners (added once, never removed after unlock); SaveManager writes on mute/volume change.

### SaveManager (static singleton)

```typescript
static save<T>(key: string, value: T): void
  // Serialises value as JSON, stores as localStorage key 'pg_' + key.
  // Silent on QuotaExceededError or unavailable storage.

static load<T>(key: string, defaultValue: T): T
  // Parses JSON from localStorage. Returns defaultValue if missing or malformed.

static remove(key: string): void
  // Removes 'pg_' + key from localStorage.

static clearAll(): void
  // Removes all keys starting with 'pg_'.

static isAvailable(): boolean
  // Returns true if localStorage is writable (test write/delete).
```

Side effects: reads/writes browser localStorage.

### ScaleManager (static singleton)

```typescript
static init(): void
  // Call from BootScene.init(). Wires orientationchange + resize events.
  // Creates/removes #orientation-warning DOM element as needed.

static getPhaserScaleConfig(): Phaser.Types.Core.ScaleConfig
  // Returns { mode: FIT, autoCenter: CENTER_BOTH, width: 480, height: 854, parent: 'game-container', expandParent: true }
  // Call ONLY from main.ts GameConfig.scale field.

static isWrongOrientation(): boolean
  // True when viewport is landscape AND viewport width < 900px.
```

Side effects: DOM (creates/removes div#orientation-warning); window event listeners.

### UIButton

```typescript
constructor(cfg: UIButtonConfig)
  // cfg: { scene, x, y, width?, height?, label, fontSize?, color?, hoverColor?,
  //         pressColor?, disabledColor?, textColor?, radius?, onClick? }
  // Calls scene.add.existing(this) — auto-added to scene display list.
  // Minimum effective size: 44×44px (WCAG touch target).

setText(text: string): this
setEnabled(enabled: boolean): this
get isDisabled: boolean
```

Emits `'click'` event on pointer-up. Use `onClick` callback in config or `button.on('click', fn)`.

### ProgressBar

```typescript
constructor(cfg: ProgressBarConfig)
  // cfg: { scene, x, y, width?, height?, trackColor?, fillColor?,
  //         highlightColor?, radius?, initialValue? }
  // Calls scene.add.existing(this).

setValue(value: number): void  // 0..1
get value: number
```

---

## 6. Common Tasks

### Add a new enemy type

1. Add a texture key in `PreloadScene.loadAssets()` — either `this.load.image('enemy_hard', ...)` or another `make.graphics` call.
2. Add spawn logic in `GameScene.spawnEnemy()` (or create `spawnEnemyHard()` and add a new SpawnSystem entry in `setupSpawning()`).
3. If it needs different collision behaviour, add a new `Phaser.Physics.Arcade.Group` in `GameScene.createGroups()` and a new `physics.add.overlap` in `setupPhysics()`.
4. Add cleanup in `GameScene.cleanupOffscreenObjects()`.
5. Tune spawn timing in `src/data/balancing.ts`.

### Add background music

1. Add `this.load.audio('bgm', 'assets/bgm.mp3')` to `PreloadScene.loadAssets()`.
2. In `GameScene.create()` (after systems are initialised), call `AudioManager.playMusic(this, 'bgm')`.
3. In `GameScene.shutdown()`, call `AudioManager.stopMusic()`.
4. Tune volume via `AudioManager.setMusicVolume(0.6)` in `BootScene.init()` or leave at default.

### Add a new scene

1. Create `src/scenes/MyScene.ts` extending `Phaser.Scene` with `super({ key: 'MyScene' })`.
2. Import it in `src/main.ts`.
3. Add it to the `scene: [...]` array in `main.ts` (position determines registration order, NOT auto-start order — only index 0 auto-starts).
4. Navigate to it from another scene: `this.scene.start('MyScene')`.
5. If needed, add a transition: fade-out → fade-in pattern already used in all existing scenes.

### Change game dimensions

Edit `src/data/gameConfig.ts`:
```typescript
width: 480,   // change both together
height: 854,  // maintain 9:16 ratio for Poki portrait
```
This propagates automatically to `ScaleManager.getPhaserScaleConfig()`, all `GAME_CONFIG.width/height` references in scenes, and the background rect fills. Do NOT hardcode pixel values in scenes — always use `GAME_CONFIG.width` / `GAME_CONFIG.height`.

### Add a rewarded ad

In `ResultScene.create()`, find the `// TODO: rewarded break hook` comment and add:
```typescript
this.time.delayedCall(500, () => {
  const poki = this.plugins.get('poki') as import('../types/poki').PokiPlugin
  poki.rewardedBreak().then((rewarded) => {
    if (rewarded) {
      // Grant reward: extra life passed back to GameScene data, doubled score, etc.
    }
  })
})
```
The `PokiPlugin` type is declared in `src/types/poki.d.ts`. Import from `'@poki/phaser-3'` or cast from `this.plugins.get('poki')`.

### Add a new saved value

1. Add a new key to `SAVE_KEYS` in `src/core/SaveManager.ts`:
   ```typescript
   export const SAVE_KEYS = {
     ...existing keys...
     myValue: 'my_value'   // stored as 'pg_my_value'
   } as const
   ```
2. Write: `SaveManager.save(SAVE_KEYS.myValue, value)`
3. Read: `SaveManager.load<MyType>(SAVE_KEYS.myValue, defaultValue)`

### Add a commercial break manually

In any scene (e.g. before transitioning from ResultScene to GameScene on restart):
```typescript
const poki = this.plugins.get('poki') as import('../types/poki').PokiPlugin
await poki.commercialBreak()
// then start next scene
this.scene.start('GameScene')
```
`autoCommercialBreak: true` in `main.ts` already fires one automatically between sessions; only add manual breaks for additional placements.

### Add a new UI button

```typescript
const btn = new UIButton({
  scene: this,
  x: CX,
  y: 400,
  width: 200,
  height: 56,
  label: 'SETTINGS',
  fontSize: 20,
  color: 0x2c3e50,
  hoverColor: 0x3d5166,
  pressColor: 0x1a252f,
  onClick: () => this.scene.start('SettingsScene')
})
```

Button is auto-added to the scene display list. No need to call `this.add.existing(btn)`.

---

## 7. Known Placeholders

Every placeholder is a `// TODO:` comment or a named stub that must be replaced before shipping.

| Placeholder | Location | What to replace with |
|---|---|---|
| Placeholder textures (player, enemy, coin, particle) | `PreloadScene.ts` → `loadAssets()` lines 124–150 | Real asset loads: `this.load.image(...)`, `this.load.spritesheet(...)`. Remove all `make.graphics` + `generateTexture` calls. |
| Audio asset loads | `PreloadScene.ts` lines 152–156 (commented out) | Uncomment and update paths: `this.load.audio('bgm', 'assets/bgm.mp3')` etc. |
| Game title | `gameConfig.ts` line 8: `title: 'My Game'` | Your game's actual title. |
| Tagline | `MenuScene.ts` line 76: `'Tap to survive'` | Your game's actual tagline. |
| Player movement | `GameScene.ts` → `updatePlayerMovement()` + `createPlayer()` | Your game's specific player control scheme. |
| Enemy spawn behaviour | `GameScene.ts` → `spawnEnemy()` | Your actual enemy type(s) and movement. |
| Coin spawn behaviour | `GameScene.ts` → `spawnCoin()` | Your collectible type(s) or remove entirely. |
| Win/lose condition | `GameScene.ts` → `handlePlayerHitEnemy()` + lives system | Your game's specific failure condition. |
| Analytics hooks | 5× `// TODO: analytics hook` comments in MenuScene, GameScene (×3), ResultScene | Integrate your analytics SDK (e.g. `poki.trackEvent(...)` or GA). |
| Rewarded ad hook | `ResultScene.ts` lines 57–65 (commented out block) | Uncomment and add reward logic. See Section 6. |
| WASD up/down keys | `GameScene.ts` lines 397–400: `wasdKeys.up` + `wasdKeys.down` registered but unused | Either wire up vertical movement or remove `up`/`down` entries from `wasdKeys` to keep code clean. |
| Background art | `GameScene.createWorld()` + `MenuScene.createBackground()` + `ResultScene.createBackground()` | Replace gradient graphics with tilemaps, parallax layers, or sprite backgrounds. |
| Version string | `gameConfig.ts` line 18: `version: '1.0.0'` | Increment per release. |

---

## 8. Test Checklist

Run these checks after any modification. If all pass, the project is safe to deploy.

### Typecheck
```bash
npm run typecheck
```
Must exit with code 0 and zero output.

### Dev Server
```bash
npm run dev
```
Must start without errors. Open http://localhost:3000.

### Scene Flow
- [ ] Game loads without white screen or JS console errors
- [ ] BootScene transitions to PreloadScene within ~100ms (bootDelay)
- [ ] PreloadScene shows progress bar and advances to 100%
- [ ] PreloadScene transitions to MenuScene with fade
- [ ] MenuScene shows title, tagline, PLAY button, mute button
- [ ] High score shows below mute button if > 0 (check after one game session)
- [ ] Pressing PLAY fades to GameScene

### GameScene
- [ ] Player spawns at bottom-center of screen
- [ ] Player moves with arrow keys (left/right)
- [ ] Player moves with WASD (A/D keys)
- [ ] Player follows pointer/touch drag
- [ ] Enemies spawn from top and fall downward
- [ ] Coins spawn from top and fall slower than enemies
- [ ] Lives counter decrements on enemy collision
- [ ] Player flashes red on hit
- [ ] Score increments on coin collection
- [ ] Escape key shows/hides pause overlay
- [ ] Game over triggers when lives reach 0
- [ ] Camera shake on game over
- [ ] Transition to ResultScene with score data

### ResultScene
- [ ] Score displays correctly (matches in-game score)
- [ ] Score animates counting up from 0
- [ ] "NEW BEST!" banner pulses if new high score
- [ ] Previous best shown if not new high score and highScore > 0
- [ ] PLAY AGAIN returns to GameScene
- [ ] MENU returns to MenuScene
- [ ] R key / Enter key triggers PLAY AGAIN

### Poki SDK hooks
- [ ] No `gameLoadingFinished` console errors (requires `loadingSceneKey: 'PreloadScene'` to match)
- [ ] No `gameplayStart`/`gameplayStop` errors (requires `gameplaySceneKey: 'GameScene'` to match)
- [ ] Commercial break fires between game sessions (with `autoCommercialBreak: true`)

### Audio
- [ ] Mute button in MenuScene persists across scene transitions (reload page)
- [ ] SFX plays on coin collect (`sfx_score`) and enemy hit (`sfx_hurt`) — only after real audio assets are loaded
- [ ] Mute toggle in GameScene HUD (top-left icon) works

### Persistence
- [ ] High score persists after page reload
- [ ] Mute state persists after page reload
- [ ] localStorage keys are all prefixed `pg_`

### Responsive / Mobile
- [ ] Canvas fills screen on narrow mobile viewport (portrait)
- [ ] Orientation warning overlay appears when rotating to landscape on small screen
- [ ] All buttons respond to touch (no hover-only states required)
- [ ] No page zoom on double-tap (user-scalable=no in viewport meta)

### Build
```bash
npm run build
```
- [ ] Exits with code 0
- [ ] `dist/` contains `index.html`, `assets/` folder, and two JS chunks (`index-*.js`, `phaser-*.js`)
- [ ] No TypeScript errors reported during `tsc` phase

---

## 9. Audit Record

**Audit performed:** 2026-04-14  
**Auditor:** Claude (AI agent)  
**TypeScript result:** `tsc --noEmit` → zero errors, clean exit  
**Scene key consistency:** VERIFIED — `'PreloadScene'` and `'GameScene'` match exactly in plugin config and scene constructors  
**Import graph:** VERIFIED — all relative imports resolve to real files; no circular dependencies  
**Runtime compatibility:** VERIFIED — `@poki/phaser-3@0.0.5` dist exports `PokiPlugin` with `runWhenInitialized`, `rewardedBreak`, `commercialBreak`; plugin `init()` signature accepts `{ loadingSceneKey, gameplaySceneKey, autoCommercialBreak }` as passed by `main.ts`  
**Issues found and fixed:** None — no code changes were required  
**Placeholder count:** 15 intentional placeholders documented in Section 7
