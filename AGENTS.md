# AGENTS.md - AI Agent Reference for phaser-poki-pony108

> This file is written for AI coding agents, not human developers.
> Treat the codebase as source of truth. README.md is a design document and may describe future intent.

---

## 1. Project Overview

**What it is:** A Phaser 3 + TypeScript + Vite browser game prototype named `Sparkle Wash` in code. The implemented game is a portrait cleaning game: the player wipes procedural dirt from a generated vehicle using selectable tools, earns a score and star rating, and advances through saved level progress.

**Target platform:** Browser with Poki SDK integration via `@poki/phaser-3`. The game is portrait-oriented at `480x854`.

**Current implementation vs README:** README.md describes the Pony108 GDD and future worlds/nozzles. The current code implements a smaller Sparkle Wash slice: five World 1 dust levels, procedural placeholder vehicles, three cleaning tools, saved progress, and result scoring. Do not assume README roadmap items are implemented unless present in `src/`.

**Entry point:** `index.html` -> `src/main.ts`

**Package scripts:**

| Command | package.json script | Notes |
|---|---|---|
| `npm run dev` | `vite` | Vite dev server. `vite.config.ts` sets `server.port = 3000` and `open = true`. |
| `npm run build` | `tsc && vite build` | TypeScript check, then Vite build to `dist/`. |
| `npm run preview` | `vite preview` | Preview built output. |
| `npm run typecheck` | `tsc --noEmit` | TypeScript-only check. |

**Dependency versions from package.json and package-lock.json:**

| Package | package.json spec | Lockfile resolved |
|---|---:|---:|
| `phaser` | `^3.80.1` | `3.90.0` |
| `@poki/phaser-3` | `^0.0.5` | `0.0.5` |
| `typescript` | `^5.4.5` | `5.9.3` |
| `vite` | `^5.2.11` | `5.4.21` |

**Install state caveat:** The lockfile records resolved versions. If `node_modules/` is absent, run `npm install` before expecting `npm run typecheck`, `npm run build`, or `npm run dev` to work.

---

## 2. Architecture Map

### 2.1 Repository Files

```text
index.html
  HTML shell; mobile viewport meta; CSS disables page scrolling/touch gestures; mounts #game-container; loads /src/main.ts.

vite.config.ts
  Vite config; base='./'; build outDir='dist'; assetsDir='assets'; manual phaser chunk; dev server host=true, port=3000, open=true.

tsconfig.json
  Strict TypeScript config; target ES2020; module ESNext; moduleResolution=bundler; noEmit=true; noUnusedLocals/Parameters=true; include=['src'].

package.json
  Scripts and devDependencies only.

README.md
  Game design document for Pony108. Use as intent only, not implementation truth.

.claude/settings.local.json
  Local Claude permissions config. Not part of runtime.
```

### 2.2 Source File Index

```text
src/main.ts
  Imports Phaser, PokiPlugin, BootScene, PreloadScene, MenuScene, GameScene, ResultScene, ScaleManager, GAME_CONFIG.
  Builds Phaser.Types.Core.GameConfig.
  Registers global PokiPlugin with key 'poki'.
  Scene order is [BootScene, PreloadScene, MenuScene, GameScene, ResultScene].
  Side effect: new Phaser.Game(config).

src/scenes/BootScene.ts
  Class: BootScene, key 'BootScene'.
  init(): ScaleManager.init(); AudioManager.init(this); optional dev logs.
  create(): background color, fade in, delayed transition to 'PreloadScene' after BALANCING.bootDelay.

src/scenes/PreloadScene.ts
  Class: PreloadScene, key 'PreloadScene'.
  preload(): loading UI, loader progress events, loadAssets().
  create(): fade out, then start 'MenuScene'.
  loadAssets(): generates procedural textures: vehicle_0..vehicle_4, tool_widesponge, tool_foambrush, tool_focusspray, particle, sparkle, bubble.
  No real image/audio files are loaded by default.

src/scenes/MenuScene.ts
  Class: MenuScene, key 'MenuScene'.
  Title/menu scene with gradient background, title, tagline 'Grab a sponge!', Play/Continue/New Game buttons, mute toggle, optional high score, version stamp.
  Reads SAVE_KEYS.currentLevel to show Continue and progress.
  Keyboard: Enter/Space starts saved level; Escape toggles mute.
  Starts GameScene with data { levelId }.

src/scenes/GameScene.ts
  Class: GameScene, key 'GameScene'.
  Main implemented gameplay.
  init(data): resolves level from data.levelId or SAVE_KEYS.currentLevel via getLevel().
  create(): sets background/fade; resets state; creates world, vehicle/dirt RenderTexture, particles, HUD, tools UI, pointer input, reusable brush Graphics.
  update(): increments timer text while not finished.
  Gameplay: pointer/touch wipes dirt from a RenderTexture; boolean grid tracks cleaned cells; completion triggers at >= 98%.
  Completion: clears dirt, emits sparkles, computes score/stars, persists highScore/levelStars/currentLevel/completedCleans, then starts ResultScene.
  There are no enemies, coins, lives, pause overlay, keyboard movement, or fail state in the current GameScene.

src/scenes/ResultScene.ts
  Class: ResultScene, key 'ResultScene'.
  Displays 'ALL CLEAN!', level subtitle, star rating, animated score, high-score annotation, NEXT LEVEL/PLAY AGAIN/MENU buttons.
  Keyboard: Enter goes to next level when available, otherwise replay; R replays current level.
  Contains TODO placeholders for rewarded break and analytics.

src/core/AudioManager.ts
  Static-only singleton for mute, SFX, music, persisted volumes, and browser audio unlock listeners.
  Public API: init(scene), playSfx(scene,key,volume?), playMusic(scene,key,volume?), stopMusic(), toggleMute(), setMuted(bool), setSfxVolume(number), setMusicVolume(number), getters muted/sfxVolume/musicVolume.
  Uses SaveManager keys muted/sfxVolume/musicVolume.
  playSfx/playMusic no-op if audio key is not loaded.

src/core/Config.ts
  Exports RuntimeConfig interface and config singleton.
  Merges GAME_CONFIG, BALANCING, detectIsDev(), detectIsMobile().
  detectIsDev(): localhost or 127.0.0.1.
  detectIsMobile(): navigator.maxTouchPoints > 0.

src/core/SaveManager.ts
  Static localStorage wrapper with PREFIX='pg_'.
  Public API: save<T>(), load<T>(), remove(), clearAll(), isAvailable().
  SAVE_KEYS: highScore, muted, sfxVolume, musicVolume, completedCleans, currentLevel, levelStars.

src/core/ScaleManager.ts
  Static responsive scaling/orientation helper.
  getPhaserScaleConfig(): Phaser Scale.FIT config with parent='game-container', width/height from GAME_CONFIG, autoCenter CENTER_BOTH, expandParent=true.
  init(): wires orientationchange and resize listeners.
  Creates/removes #orientation-warning DOM element when landscape and viewport width < 900.

src/data/gameConfig.ts
  Exports GAME_CONFIG and GameConfig type.
  Current values: title='Sparkle Wash', width=480, height=854, backgroundColor='#2b3036', debug=false, version='1.0.0', physics='arcade', targetFps=60.

src/data/balancing.ts
  Exports BALANCING and Balancing type.
  Current tunables: baseScore=1000; tools { widesponge, foambrush, focusspray }; startingLives=1 unused; sceneFadeDuration=300; bootDelay=100.

src/data/levels.ts
  Exports DirtType, LevelConfig, ALL_LEVELS, TOTAL_LEVELS, getLevel(), isLastLevel(), calcStars().
  Current levels: five World 1 dust levels.
  Comments mention Worlds 2-4 future work; those levels are not implemented.

src/systems/ScoreSystem.ts
  Exports ScoreSystem. Loads/saves high score through SaveManager.
  Current scenes do not import or use this class.

src/systems/SpawnSystem.ts
  Exports SpawnEntry and SpawnSystem. Generic delta-driven scheduler.
  Current scenes do not import or use this class.
  File comments mention DifficultySystem, but no DifficultySystem file exists in this repository.

src/components/ProgressBar.ts
  Exports ProgressBarConfig and ProgressBar.
  Phaser Container with Graphics track/fill; constructor calls scene.add.existing(this).
  Public API: setValue(value), getter value.

src/components/UIButton.ts
  Exports UIButtonConfig and UIButton.
  Phaser Container with Graphics, Text, invisible Rectangle hit area.
  Minimum 44x44 touch target; emits 'click' on pointer-up.
  Public API: setText(text), setEnabled(enabled), getter isDisabled.

src/utils/helpers.ts
  Exports pure utilities: randomInt, randomFloat, clamp, lerp, mapRange, zeroPad, formatTime, formatScore, isTouchDevice, randomPick, shuffle, degToRad, distance.
  No Phaser imports.

src/types/poki.d.ts
  Ambient declaration for '@poki/phaser-3'.
  Declares PokiSDK, PokiPluginData, PokiPlugin with runWhenInitialized(), rewardedBreak(), commercialBreak().
```

### 2.3 Scene Flow

```text
Phaser.Game boots from src/main.ts
  -> BootScene
       init core services
       delayed start('PreloadScene')
  -> PreloadScene
       loading UI + procedural texture generation
       fade out to start('MenuScene')
  -> MenuScene
       Play/New Game/Continue starts GameScene with { levelId }
       mute toggle persists through AudioManager
  -> GameScene
       dirt-cleaning gameplay
       completion at >= 98% clean
       saves score/progress/stars
       delayed fade to ResultScene with score data
  -> ResultScene
       Next Level -> GameScene with next levelId
       Play Again -> GameScene with same levelId
       Menu -> MenuScene
```

### 2.4 Active Dependency Graph

```text
main.ts
  -> ScaleManager
  -> GAME_CONFIG
  -> PokiPlugin
  -> BootScene, PreloadScene, MenuScene, GameScene, ResultScene

BootScene
  -> ScaleManager
  -> AudioManager
  -> config
  -> BALANCING

PreloadScene
  -> ProgressBar
  -> config
  -> GAME_CONFIG
  -> BALANCING

MenuScene
  -> UIButton
  -> AudioManager
  -> SaveManager/SAVE_KEYS
  -> config
  -> GAME_CONFIG
  -> BALANCING
  -> TOTAL_LEVELS

GameScene
  -> AudioManager
  -> config
  -> GAME_CONFIG
  -> BALANCING
  -> SaveManager/SAVE_KEYS
  -> getLevel/calcStars/isLastLevel/LevelConfig

ResultScene
  -> UIButton
  -> config
  -> GAME_CONFIG
  -> BALANCING
  -> formatScore

AudioManager -> SaveManager -> localStorage
ScaleManager -> window/document orientation overlay
Config -> GAME_CONFIG + BALANCING + browser globals
```

---

## 3. Fragile Constraints

### 3.1 Poki Scene Keys Must Match

`src/main.ts` passes these keys to `PokiPlugin`:

```ts
loadingSceneKey: 'PreloadScene'
gameplaySceneKey: 'GameScene'
autoCommercialBreak: true
```

The corresponding scene constructors use:

```ts
super({ key: 'PreloadScene' })
super({ key: 'GameScene' })
```

If either scene key changes, update both the scene constructor and plugin data in `src/main.ts`.

### 3.2 Scene Order Matters

`src/main.ts` uses:

```ts
scene: [BootScene, PreloadScene, MenuScene, GameScene, ResultScene]
```

The first scene auto-starts. Keep `BootScene` first unless deliberately changing boot flow.

### 3.3 Scale Config Is Consumed at Phaser Construction

`ScaleManager.getPhaserScaleConfig()` is used as `config.scale` before `new Phaser.Game(config)`. Keep it in the root Phaser GameConfig. Do not move this call into a scene.

### 3.4 Save Keys Are Prefix-Scoped

SaveManager writes all keys as `'pg_' + key`. Use `SaveManager.save/load/remove` and `SAVE_KEYS`; do not bypass with direct localStorage writes for game state. If adding a saved value, add a suffix to `SAVE_KEYS` first.

### 3.5 AudioManager Is a Static Singleton

Do not instantiate or convert `AudioManager`. It owns static mute/volume/music state and document-level audio unlock listeners. `AudioManager.init(this)` is called from `BootScene.init()`.

### 3.6 DOM Ownership Is Limited

Game UI and gameplay should be Phaser objects, not DOM elements. Current DOM access is limited to:

- `ScaleManager`: creates/removes `#orientation-warning`.
- `AudioManager`: attaches/removes audio unlock event listeners on `document`.
- `Config`/helpers: read browser environment values.

Do not add DOM UI from scenes/components unless there is a deliberate platform-level reason.

### 3.7 Procedural Texture Keys Are Runtime Contracts

`GameScene` expects these texture keys from `PreloadScene.loadAssets()`:

```text
vehicle_0
vehicle_1
vehicle_2
vehicle_3
vehicle_4
tool_widesponge
tool_foambrush
tool_focusspray
particle
sparkle
```

If replacing procedural graphics with real assets, preserve these keys or update every reference in GameScene and UI code.

### 3.8 Tool Keys Must Stay in Sync

`GameScene.activeTool` is typed as `keyof typeof BALANCING.tools`. `createToolsUI()` builds icons with `'tool_' + key`. Adding/removing tools requires coordinated edits:

- `BALANCING.tools`
- `PreloadScene.loadAssets()` texture keys
- any UI layout assumptions in `GameScene.createToolsUI()`

### 3.9 LevelConfig Vehicle Types Are Limited

`LevelConfig.vehicleType` currently assumes generated textures `vehicle_0` through `vehicle_4`. `GameScene.createVehicleAndDirt()` only special-cases vehicle types `1` and `3` for larger dimensions; all other types use the default `180x340`. If adding new vehicle types, update texture generation/loading and sizing logic.

### 3.10 Dirt Layers Are Declared But Not Implemented

`LevelConfig.dirtLayers` exists, but `GameScene.drawDirt()` currently uses only `dirtType` to choose colors/blobs. Multi-layer cleaning is not implemented. Do not document or tune layered dirt as active behavior until GameScene uses `dirtLayers`.

### 3.11 Keep High-Frequency Paths Lean

Current `GameScene.update()` only increments elapsed time and updates timer text. Pointer move handling performs interpolation and wipe checks while the pointer is down. Avoid unnecessary allocations or expensive readbacks in `update()` and pointer-move paths.

---

## 4. Modification Guide

### 4.1 Files to Replace or Heavily Rework for Gameplay

| File | Safe replacement zone |
|---|---|
| `src/scenes/GameScene.ts` | Main gameplay methods: world creation, vehicle/dirt rendering, particles, HUD, tools UI, input, wipe logic, completion/scoring. Preserve scene key and ResultScene data contract unless updating dependent scenes. |
| `src/scenes/PreloadScene.ts` | `loadAssets()` only. Replace generated placeholder textures with `this.load.image`, `this.load.spritesheet`, and `this.load.audio` calls. Preserve keys or update all consumers. |
| `src/data/levels.ts` | Add/update levels and star par times. Keep `getLevel()`, `isLastLevel()`, and `calcStars()` contracts unless updating callers. |

### 4.2 Files to Tune

| File | What to tune |
|---|---|
| `src/data/balancing.ts` | `baseScore`, tool radii/strength/names, scene fade duration, boot delay. `startingLives` is currently unused. |
| `src/data/gameConfig.ts` | Title, dimensions, background color, debug flag, version, target FPS. Width/height feed ScaleManager and scene layout constants. |

### 4.3 Files to Extend

| File | Extension pattern |
|---|---|
| `src/core/SaveManager.ts` | Add new entries to `SAVE_KEYS`, then use SaveManager APIs. |
| `src/utils/helpers.ts` | Add pure utilities only. Avoid Phaser dependencies here. |
| `src/types/poki.d.ts` | Extend only when code uses additional `@poki/phaser-3` API. |
| `src/components/UIButton.ts` | Extend cautiously for shared button behavior; existing scenes depend on pointer state and click emission. |
| `src/components/ProgressBar.ts` | Extend if multiple progress surfaces need shared behavior. |

### 4.4 Files to Avoid Unless Necessary

| File | Reason |
|---|---|
| `src/main.ts` | Poki plugin registration, scene keys, scene order, scale config, physics config. |
| `src/core/ScaleManager.ts` | Coupled to Phaser construction scale config and orientation DOM overlay. |
| `src/core/AudioManager.ts` | Static singleton with persisted audio state and browser unlock listeners. |
| `src/core/SaveManager.ts` | Prefix and key behavior affect existing saves. |
| `index.html` | Mobile viewport and touch-action settings are part of browser-game behavior. |

---

## 5. Public Contracts

### 5.1 GameScene Result Data Contract

`GameScene.triggerComplete()` starts ResultScene with:

```ts
{
  score: number,
  highScore: number,
  isNewHighScore: boolean,
  stars: number,
  levelId: number,
  levelName: string,
  isLastLevel: boolean
}
```

If changing scoring/progression, keep this shape or update `ResultScene.init()` and UI.

### 5.2 Level Data

```ts
type DirtType = 'dust' | 'mud' | 'oil' | 'rust'

interface LevelConfig {
  id: number
  world: number
  name: string
  vehicleType: number
  dirtType: DirtType
  dirtLayers: number
  parTimeSeconds: number
}

getLevel(levelId: number): LevelConfig
isLastLevel(levelId: number): boolean
calcStars(elapsedSeconds: number, parTimeSeconds: number): number
```

`getLevel()` clamps out-of-range IDs to the nearest valid level.

### 5.3 SaveManager

```ts
SaveManager.save<T>(key: string, value: T): void
SaveManager.load<T>(key: string, defaultValue: T): T
SaveManager.remove(key: string): void
SaveManager.clearAll(): void
SaveManager.isAvailable(): boolean
```

Current `SAVE_KEYS`:

```ts
{
  highScore: 'high_score',
  muted: 'muted',
  sfxVolume: 'sfx_volume',
  musicVolume: 'music_volume',
  completedCleans: 'completed_cleans',
  currentLevel: 'current_level',
  levelStars: 'level_stars'
}
```

### 5.4 AudioManager

```ts
AudioManager.init(scene: Phaser.Scene): void
AudioManager.playSfx(scene: Phaser.Scene, key: string, volume?: number): void
AudioManager.playMusic(scene: Phaser.Scene, key: string, volume?: number): void
AudioManager.stopMusic(): void
AudioManager.toggleMute(): boolean
AudioManager.setMuted(muted: boolean): void
AudioManager.setSfxVolume(volume: number): void
AudioManager.setMusicVolume(volume: number): void
AudioManager.muted: boolean
AudioManager.sfxVolume: number
AudioManager.musicVolume: number
```

Playback methods are safe no-ops when keys are not loaded.

### 5.5 ScaleManager

```ts
ScaleManager.init(): void
ScaleManager.getPhaserScaleConfig(): Phaser.Types.Core.ScaleConfig
ScaleManager.isWrongOrientation(): boolean
ScaleManager.viewportWidth: number
ScaleManager.viewportHeight: number
```

Wrong orientation means `window.innerWidth > window.innerHeight && window.innerWidth < 900`.

### 5.6 UIButton

```ts
new UIButton({
  scene,
  x,
  y,
  width?,
  height?,
  label,
  fontSize?,
  color?,
  hoverColor?,
  pressColor?,
  disabledColor?,
  textColor?,
  radius?,
  onClick?
})

button.setText(text): this
button.setEnabled(enabled): this
button.isDisabled: boolean
```

Constructor auto-adds the container to the scene. Listen to `'click'` or pass `onClick`.

### 5.7 ProgressBar

```ts
new ProgressBar({
  scene,
  x,
  y,
  width?,
  height?,
  trackColor?,
  fillColor?,
  highlightColor?,
  radius?,
  initialValue?
})

progressBar.setValue(value): void
progressBar.value: number
```

Values are clamped to `[0, 1]`. Constructor auto-adds the container to the scene.

### 5.8 ScoreSystem

`ScoreSystem` exists but is not currently wired into scenes.

```ts
new ScoreSystem()
score.add(points): void
score.reset(): void
score.getScore(): number
score.getHighScore(): number
score.isNewHighScore(): boolean
score.clearHighScore(): void
```

GameScene currently implements its own final-score/high-score save logic instead of using this class.

### 5.9 SpawnSystem

`SpawnSystem` exists but is not currently wired into scenes.

```ts
spawner.schedule(callback, intervalMs, fireImmediately?): SpawnEntry
spawner.tick(deltaMs): void
spawner.clear(): void
spawner.remove(entry): void
spawner.pause(): void
spawner.resume(): void
spawner.isPaused: boolean
spawner.count: number
```

No `DifficultySystem` exists in the current repository. Do not add documentation or code references to it unless creating the file.

---

## 6. Common Tasks

### Add Real Art Assets

1. Create an asset folder such as `public/assets/`.
2. Replace procedural texture generation in `PreloadScene.loadAssets()` with loader calls.
3. Preserve existing keys like `vehicle_0` and `tool_widesponge`, or update GameScene references.
4. Keep generated fallbacks only if useful for development.

Example:

```ts
this.load.image('vehicle_0', 'assets/vehicle_0.png')
this.load.image('tool_widesponge', 'assets/tool_widesponge.png')
this.load.image('particle', 'assets/particle.png')
this.load.image('sparkle', 'assets/sparkle.png')
```

### Add Audio

1. Load files in `PreloadScene.loadAssets()`:

```ts
this.load.audio('sfx_score', 'assets/sfx_score.mp3')
this.load.audio('bgm', 'assets/bgm.mp3')
```

2. Existing `AudioManager.playSfx(this, 'sfx_score')` in GameScene completion will start working once `sfx_score` is loaded.
3. Call `AudioManager.playMusic(this, 'bgm')` from a scene if background music is needed.
4. Stop music in the relevant scene shutdown/transition path if it should not continue.

### Add Levels

1. Add `LevelConfig` entries in `src/data/levels.ts`.
2. Ensure `vehicleType` has a matching `vehicle_N` texture.
3. If dimensions differ from current defaults, update `GameScene.createVehicleAndDirt()`.
4. Tune `parTimeSeconds` for star ratings.
5. `TOTAL_LEVELS` updates automatically from `ALL_LEVELS.length`.

### Add a Tool

1. Add the tool to `BALANCING.tools`.
2. Add/load texture key `tool_<toolKey>` in `PreloadScene.loadAssets()`.
3. Verify `GameScene.createToolsUI()` spacing still fits all tools.
4. Confirm `updateBrush()` handles the new radius/strength.

### Add a Saved Value

1. Add a suffix to `SAVE_KEYS`.
2. Read/write via SaveManager only.

```ts
export const SAVE_KEYS = {
  ...,
  myValue: 'my_value'
} as const
```

### Add a Rewarded Ad Hook

`ResultScene.create()` contains a TODO block for rewarded breaks. If implementing it, import/cast the plugin type accurately and grant a concrete reward.

```ts
const poki = this.plugins.get('poki') as import('@poki/phaser-3').PokiPlugin
poki.rewardedBreak().then((rewarded) => {
  if (rewarded) {
    // Grant reward here.
  }
})
```

### Add a New Scene

1. Create `src/scenes/MyScene.ts` with `super({ key: 'MyScene' })`.
2. Import it in `src/main.ts`.
3. Add it after `BootScene` in the scene array unless intentionally changing startup.
4. Navigate with `this.scene.start('MyScene')`.
5. Do not reuse `PreloadScene` or `GameScene` keys unless also updating Poki plugin data.

---

## 7. Known Placeholders and TODOs

| Placeholder/TODO | Current location | Reality |
|---|---|---|
| Procedural vehicle textures | `PreloadScene.loadAssets()` | Generated placeholders for `vehicle_0` through `vehicle_4`. |
| Procedural tool icons | `PreloadScene.loadAssets()` | Generated circle icons for current tool keys. |
| Procedural particle/sparkle/bubble textures | `PreloadScene.loadAssets()` | Generated runtime textures. `bubble` is generated but not currently used by scenes. |
| Real audio assets | `PreloadScene.loadAssets()` | Comment says audio omitted to prevent loading errors. |
| Analytics hooks | `MenuScene`, `ResultScene` | TODO comments for menu_viewed, game_started, result_screen_shown, next_level, game_restarted. |
| Rewarded ad hook | `ResultScene.create()` | Commented TODO block only. |
| Worlds 2-4 | `src/data/levels.ts` comments | Not implemented in `ALL_LEVELS`. |
| Multi-layer dirt | `LevelConfig.dirtLayers` | Data field exists; GameScene does not use it. |
| `startingLives` | `BALANCING.startingLives` | Present but explicitly unused. |
| Legacy systems | `ScoreSystem.ts`, `SpawnSystem.ts` | Existing utilities, not used by current scenes. |

---

## 8. Current Test Checklist

Run these after code changes once dependencies are installed.

### Static Checks

```bash
npm run typecheck
npm run build
```

Expected after a healthy install:

- `npm run typecheck` exits 0.
- `npm run build` exits 0 and writes Vite output to `dist/`.

### Dev Server

```bash
npm run dev
```

Expected:

- Vite starts on port 3000.
- Browser opens because `vite.config.ts` sets `open: true`.

### Scene Flow

- BootScene starts first.
- BootScene transitions to PreloadScene after `BALANCING.bootDelay`.
- PreloadScene shows loading UI and reaches Ready/100%.
- PreloadScene transitions to MenuScene.
- MenuScene shows Sparkle Wash title, 'Grab a sponge!' tagline, Play or Continue/New Game, mute toggle, version stamp.
- Play/Continue starts GameScene with a level id.
- GameScene completion transitions to ResultScene.
- ResultScene buttons navigate to next level, replay, or menu.

### Gameplay

- Vehicle appears centered above screen midpoint.
- Dirt overlay covers the vehicle.
- Pointer/touch down wipes dirt.
- Pointer/touch drag interpolates between positions and wipes continuously.
- Tool buttons at bottom switch active brush size/strength and update icon scale/alpha.
- Progress bar/text increases as grid cells are cleaned.
- Completion triggers at 98% or higher.
- Timer increments until completion.
- Completion clears dirt, emits sparkles, computes score/stars, and saves progress.

### Result and Persistence

- ResultScene receives score, highScore, isNewHighScore, stars, levelId, levelName, isLastLevel.
- Score count-up animation displays formatted score.
- New best banner appears when `isNewHighScore` is true.
- NEXT LEVEL is hidden on last level.
- Enter goes next level when available; otherwise replay.
- R replays current level.
- `pg_high_score`, `pg_current_level`, `pg_level_stars`, and `pg_completed_cleans` are written as applicable.
- Mute state persists via `pg_muted`.

### Poki Integration

- `loadingSceneKey` remains `PreloadScene`.
- `gameplaySceneKey` remains `GameScene`.
- `autoCommercialBreak` remains deliberate if changing ad flow.
- If adding manual Poki calls, use the declared plugin API from `@poki/phaser-3`.

### Responsive/Mobile

- Canvas scales using Phaser Scale.FIT into `#game-container`.
- Portrait 480x854 layout remains usable.
- Orientation warning appears when landscape and viewport width is below 900.
- Touch gestures do not scroll/zoom the page due to viewport meta and `touch-action: none`.

---

## 9. Drift Notes for Future Agents

- Do not reintroduce enemy/coin/lives/pause guidance unless those systems exist in code.
- Do not document `DifficultySystem` unless creating `src/systems/DifficultySystem.ts`.
- Do not claim Worlds 2-4, multi-layer dirt, rewarded ads, analytics, or real audio are implemented until the code supports them.
- Do not add line-number-specific documentation unless needed for a short-lived review.
- Keep this file synchronized with code changes that alter scene keys, save keys, loader asset keys, level data, or result data.
