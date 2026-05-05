# AGENTS.md - AI Agent Reference for phaser-poki-pony108

> This file is written for AI coding agents, not human developers.
> Treat the codebase as source of truth. README.md is a design document and may describe future intent.

---

## 1. Project Overview

**What it is:** A Phaser 3 + TypeScript + Vite browser game named `Sparkle Wash`. The player wipes procedural and real-art dirt from vehicles using selectable tools, earns cash and a star rating, buys upgrades, and advances through 20 levels across 4 themed worlds.

**Target platform:** Browser with Poki SDK integration via `@poki/phaser-3`. Portrait-oriented at `480x854`.

**Entry point:** `index.html` -> `src/main.ts`

**Package scripts:**

| Command | Notes |
|---|---|
| `npm run dev` | Vite dev server on port 3000, auto-opens browser |
| `npm run build` | `tsc && vite build` → output in `dist/` |
| `npm run preview` | Preview built output |
| `npm run typecheck` | TypeScript-only check, no emit |

**Dependency versions:**

| Package | Resolved |
|---|---|
| `phaser` | `3.90.0` |
| `@poki/phaser-3` | `0.0.5` |
| `typescript` | `5.9.3` |
| `vite` | `5.4.21` |

---

## 2. Architecture Map

### 2.1 Repository Files

```text
index.html
  HTML shell; mobile viewport meta; CSS disables page scrolling/touch; mounts #game-container; loads /src/main.ts.

vite.config.ts
  base='./'; build outDir='dist'; assetsDir='assets'; manual phaser chunk; dev server host=true, port=3000, open=true.

tsconfig.json
  Strict TypeScript; target ES2020; module ESNext; moduleResolution=bundler; noUnusedLocals/Parameters=true; include=['src'].

public/assets/vehicles/
  vehicle_0.png .. vehicle_4.png, vehicle_9.png — real PNG art loaded by PreloadScene.
  vehicle_5..8 are still generated procedurally at runtime.

public/assets/audio/
  spray_loop.wav, sfx_clear.wav, sfx_switch.wav, sfx_score.wav
```

### 2.2 Source File Index

```text
src/main.ts
  Builds Phaser.GameConfig: CANVAS renderer when navigator.webdriver (dev automation), AUTO otherwise.
  Registers PokiPlugin (loadingSceneKey='PreloadScene', gameplaySceneKey='GameScene', autoCommercialBreak=true).
  Scene order: [BootScene, PreloadScene, MenuScene, GameScene, ResultScene].
  Calls registerSparkleWashTestBridge(game) — dev-only test hook, no-ops in production.

src/scenes/BootScene.ts
  key: 'BootScene'. Calls ScaleManager.init() and AudioManager.init(this). Fades in, then starts PreloadScene.

src/scenes/PreloadScene.ts
  key: 'PreloadScene'.
  preload(): loads real PNGs (vehicle_0..4, vehicle_9), audio (spray_loop, sfx_clear, sfx_switch, sfx_score),
             then generates procedural textures at runtime: vehicle_5..8, tool_fan, tool_foam, tool_jet, tool_hot,
             particle, sparkle, bubble.
  create(): fades out directly to 'GameScene' — MenuScene is NOT in the normal boot path.

src/scenes/MenuScene.ts
  key: 'MenuScene'. Reachable only from ResultScene or directly. Shows title, progress summary, world/tool info.
  Starts GameScene with { levelId }.

src/scenes/GameScene.ts
  key: 'GameScene'. Main gameplay scene.
  Phase lifecycle: 'arrival' -> 'cleaning' -> 'complete'.
  Arrival: vehicle and dirt slide in from below, customer bubble appears, click/tap skips to cleaning.
  Cleaning: pointer wipes dirt from dirtRT; foam overlay tracks prepGrid on foamRT.
  Systems used: EconomySystem, UpgradeSystem, getVehicleParts, bonus zones, coach card, hand pointer, streak.
  Completion: triggers at >= BALANCING.completionPercent (98%) of cells cleaned; transitions to ResultScene.

src/scenes/ResultScene.ts
  key: 'ResultScene'. Shows score, stars, cash earned, part summary, upgrade shop, rewarded-break button.
  Uses UpgradeSystem.buildOffers() for the shop. Uses PokiPlugin.rewardedBreak() for optional ad reward.
  Buttons: NEXT LEVEL / PLAY AGAIN / MENU.

src/core/Analytics.ts
  Static Analytics class. track(event, payload) pushes to window.__sparkleWashAnalytics[] and dispatches
  'sparklewash:analytics' CustomEvent. No remote calls — Playwright / external listeners consume the queue.

src/core/AudioManager.ts
  Static singleton. Manages mute, SFX, music, persisted volumes, browser audio unlock.
  API: init(scene), playSfx(scene,key,volume?), playMusic(scene,key,volume?), stopMusic(),
       toggleMute(), setMuted(bool), setSfxVolume(number), setMusicVolume(number).
  playSfx/playMusic are safe no-ops when keys are not loaded.

src/core/Config.ts
  Exports RuntimeConfig and config singleton merging GAME_CONFIG + BALANCING + isDev + isMobile.
  isDev: localhost or 127.0.0.1. isMobile: navigator.maxTouchPoints > 0.

src/core/SaveManager.ts
  Static localStorage wrapper with PREFIX='pg_'. API: save<T>, load<T>, remove, clearAll, isAvailable.
  SAVE_KEYS (see §5.3).

src/core/ScaleManager.ts
  Static responsive scaling helper. getPhaserScaleConfig(): Scale.FIT at 480x854.
  Creates/removes #orientation-warning DOM overlay when landscape and width < 900.

src/data/balancing.ts
  All tunable gameplay numbers: baseScore, completionPercent, rewardedScoreBonus, unpreppedStrengthFactor,
  cash (basePay/starBonus/efficiencyBonus/bonusZoneCash/partCompleteCash),
  upgrades (pressure/sprayWidth/soapQuality — each with basePrice/priceStep/maxLevel/bonusPerLevel),
  tools (fan/foam/jet/hot — each with radius/strength/name/primaryDirt; foam has prepOnly=true),
  wrongToolStrengthFactor, wrongToolWarningCooldown,
  toolUnlockAtLevel (fan=1, foam=6, jet=6, hot=12),
  worldLevelRanges ([[1,5],[6,10],[11,15],[16,20]]),
  sceneFadeDuration, bootDelay.

src/data/gameConfig.ts
  GAME_CONFIG: title, width=480, height=854, backgroundColor, debug, version, targetFps.

src/data/levels.ts
  20 levels across 4 worlds. DirtType = 'dust'|'mud'|'oil'|'rust'.
  LevelConfig: id, world, name, vehicleType (0–9), dirtType, dirtLayers (1–4), parTimeSeconds, bonusZones?.
  bonusZones: optional array of [localX, localY, w, h] rects relative to vehicle top-left.
  World 1 (Farm, dust, levels 1–5), World 2 (Ranch, mud, 6–10), World 3 (Garage, oil, 11–15),
  World 4 (Junkyard, rust, 16–20; some levels have bonusZones).
  Exports: ALL_LEVELS, TOTAL_LEVELS, WORLD_NAMES, getLevel, isLastLevel, worldForLevel, worldName,
           levelsInWorld, levelIndexInWorld, calcStars.

src/data/vehicleParts.ts
  Defines named rectangular regions (VehiclePartDefinition) for each vehicle type.
  getVehicleParts(vehicleType, width, height): VehiclePartDefinition[]
  Layouts: carParts (hood/windows/doors/trunk/wheels) for types 0,1,4,7,8;
           truckParts (cab/bed/tailgate/wheels) for types 2,3,5,6;
           engineParts (block/hoses/manifold) for type 9.
  Parts are rectangular approximations — they do not follow PNG silhouettes exactly.

src/systems/EconomySystem.ts
  Static class. getCash(), addCash(amount), calculateCashReward(CashRewardInput).
  CashRewardInput: { stars, wasteFraction, bonusZonesCompleted, partsCompleted }.
  Reward = basePay + stars*starBonus + efficiencyBonus*(1-waste) + bonusZones*bonusZoneCash + parts*partCompleteCash.

src/systems/UpgradeSystem.ts
  Static class. loadLevels(), saveLevels(levels), getLevel(key), getPrice(key, level),
  buildOffers(cash, limit?): UpgradeOffer[], buy(key): { success, cash, level },
  applyToTool(toolKey, toolConfig, dirtType): ToolConfig (applies pressure/sprayWidth/soapQuality bonuses).
  Types: UpgradeKey, UpgradeLevels, UpgradeOffer.

src/systems/ScoreSystem.ts
  Exists but is NOT wired into any scene. GameScene implements its own score/high-score logic.

src/systems/SpawnSystem.ts
  Exists but is NOT wired into any scene.

src/components/ProgressBar.ts
  Phaser Container with Graphics track/fill. setValue(value), getter value. Auto-adds to scene.

src/components/UIButton.ts
  Phaser Container with Graphics + Text + invisible hit rect. Min 44x44 touch target.
  setText(text), setEnabled(bool), isDisabled getter. Emits 'click' or calls onClick callback.

src/utils/helpers.ts
  Pure utilities: randomInt, randomFloat, clamp, lerp, mapRange, zeroPad, formatTime, formatScore,
  isTouchDevice, randomPick, shuffle, degToRad, distance. No Phaser imports.

src/types/poki.d.ts
  Ambient declarations for '@poki/phaser-3': PokiSDK, PokiPluginData, PokiPlugin with
  runWhenInitialized(), rewardedBreak(), commercialBreak().

src/dev/testBridge.ts
  registerSparkleWashTestBridge(game): void — called from main.ts.
  Only active when isDev && navigator.webdriver. Exposes window.__sparkleWashTest with:
    resetProgress(), startLevel(id), render_game_to_text(), advanceTime(ms).
  Verified absent from production bundle (dist/assets/index-*.js).
```

### 2.3 Scene Flow

```text
Phaser.Game boots from src/main.ts
  -> BootScene
       init core services
       delayed start('PreloadScene')
  -> PreloadScene
       load real PNGs + audio + generate procedural textures
       fade out -> start('GameScene')   ← direct to game, no menu
  -> GameScene
       arrival phase: vehicle slides in, customer bubble
       cleaning phase: wipe dirt, prep+clean loop
       complete at >= 98% -> ResultScene with full result data
  -> ResultScene
       NEXT LEVEL -> GameScene(levelId+1)
       PLAY AGAIN  -> GameScene(same levelId)
       MENU        -> MenuScene

MenuScene (reachable from ResultScene or directly):
  -> GameScene(levelId)
```

### 2.4 Active Dependency Graph

```text
main.ts
  -> ScaleManager, GAME_CONFIG, PokiPlugin
  -> BootScene, PreloadScene, MenuScene, GameScene, ResultScene
  -> registerSparkleWashTestBridge

GameScene
  -> AudioManager, Analytics, config, GAME_CONFIG, BALANCING
  -> SaveManager/SAVE_KEYS
  -> getLevel, calcStars, isLastLevel, levelIndexInWorld, levelsInWorld, worldName, LevelConfig
  -> getVehicleParts, VehiclePartDefinition
  -> EconomySystem, UpgradeSystem

ResultScene
  -> UIButton, Analytics, config, GAME_CONFIG, BALANCING
  -> SaveManager/SAVE_KEYS
  -> getLevel, levelIndexInWorld, levelsInWorld, worldForLevel, worldName
  -> UpgradeSystem, UpgradeOffer
  -> formatScore

EconomySystem -> SaveManager/SAVE_KEYS, BALANCING
UpgradeSystem -> SaveManager/SAVE_KEYS, BALANCING
AudioManager  -> SaveManager
ScaleManager  -> window/document orientation overlay
Config        -> GAME_CONFIG + BALANCING + browser globals
```

---

## 3. Fragile Constraints

### 3.1 Poki Scene Keys Must Match

`src/main.ts` passes to PokiPlugin:
```ts
loadingSceneKey: 'PreloadScene'
gameplaySceneKey: 'GameScene'
```
If either scene key changes, update both the scene constructor and plugin data.

### 3.2 Scene Order and Boot Path

```ts
scene: [BootScene, PreloadScene, MenuScene, GameScene, ResultScene]
```
BootScene starts first. PreloadScene goes **directly to GameScene** — not MenuScene. MenuScene is only reached from ResultScene or by explicit `scene.start('MenuScene')`.

### 3.3 Scale Config Is Consumed at Phaser Construction

`ScaleManager.getPhaserScaleConfig()` is used as `config.scale` before `new Phaser.Game(config)`. Do not move this into a scene.

### 3.4 Save Keys Are Prefix-Scoped

All SaveManager keys are stored as `'pg_' + key`. Always use `SaveManager.save/load/remove` and `SAVE_KEYS`. Do not bypass with direct localStorage writes.

### 3.5 AudioManager Is a Static Singleton

Do not instantiate AudioManager. `AudioManager.init(this)` is called once from `BootScene.init()`.

### 3.6 Tool Keys Must Stay in Sync

`GameScene.activeTool` is typed as `keyof typeof BALANCING.tools`. The current tool keys are:
```text
fan   foam   jet   hot
```
`createToolsUI()` builds icons with `'tool_' + key`. `BALANCING.toolUnlockAtLevel` controls when each tool becomes available. Adding or removing tools requires coordinated edits to: `BALANCING.tools`, `BALANCING.toolUnlockAtLevel`, `PreloadScene.loadAssets()` texture generation, `GameScene.createToolsUI()`.

### 3.7 Texture Keys Are Runtime Contracts

GameScene and UI expect these texture keys to be present after PreloadScene:
```text
Real PNGs:          vehicle_0  vehicle_1  vehicle_2  vehicle_3  vehicle_4  vehicle_9
Procedural:         vehicle_5  vehicle_6  vehicle_7  vehicle_8
Tool icons:         tool_fan   tool_foam  tool_jet   tool_hot
Particles/FX:       particle   sparkle    bubble
```
Replacing procedural textures with real assets: preserve the key or update all GameScene references.

### 3.8 Audio Keys

Loaded in PreloadScene; AudioManager.playSfx is a safe no-op if the key is absent:
```text
spray_loop   sfx_clear   sfx_switch   sfx_score
```

### 3.9 Vehicle Dimensions Are Hard-Coded by Type

`GameScene.createVehicleAndDirt()` sets vehicle/mask dimensions based on vehicleType:
- types 3, 6: larger dimensions
- all others: default 180×340

If adding vehicleType values, update sizing logic and ensure a matching texture key exists.

### 3.10 Part Maps Are Rectangular Approximations

`getVehicleParts()` returns axis-aligned rectangles. They do not follow PNG silhouettes. Part completion fires based on grid cells within those rectangles. Do not document part maps as pixel-exact silhouettes.

### 3.11 Foam Prep System

Cells requiring prep (mud/oil/rust levels) must be marked by FOAM before JET/HOT cleans them efficiently. Using JET before FOAM applies only `BALANCING.unpreppedStrengthFactor (0.08)` of normal strength. HOT bypasses prep for mud only (`hotBypassesPrep` guard). Oil and rust always require foam prep.

### 3.12 dirtLayers Is Now Active

`LevelConfig.dirtLayers` (1=dust, 2=mud, 3=oil, 4=rust) is used by GameScene's wipe logic. Each cell requires multiple passes based on this value. This is not a placeholder.

### 3.13 Bonus Zones Are Level-Specific

Only World 4 levels have `bonusZones`. Zones are tracked as `BonusZoneState[]` in GameScene. Each zone awards `BONUS_ZONE_SCORE = 250` points once per run when all its cells are cleaned. Bonus zone data flows through to ResultScene.

### 3.14 Test Bridge Is Dev-Only

`registerSparkleWashTestBridge` checks `isDev && navigator.webdriver` before installing any global. The production bundle contains no test bridge symbols — verified by CI checks.

### 3.15 Keep High-Frequency Paths Lean

`GameScene.update()` only increments elapsed time and updates timer text. Pointer move handling interpolates and wipes while pointer is down. Avoid allocations or expensive readbacks in `update()` and pointer-move paths.

---

## 4. Modification Guide

### 4.1 Files to Replace or Heavily Rework for Gameplay

| File | Safe replacement zone |
|---|---|
| `src/scenes/GameScene.ts` | World creation, vehicle/dirt rendering, particles, HUD, tools UI, input, wipe logic, phase transitions, coach card, parts, bonus zones. Preserve scene key and ResultScene data contract. |
| `src/scenes/PreloadScene.ts` | `loadAssets()` only. Replace generated textures with real `this.load.image` calls. Preserve keys or update consumers. |
| `src/data/levels.ts` | Add/update levels. Keep exported function signatures. |

### 4.2 Files to Tune

| File | What to tune |
|---|---|
| `src/data/balancing.ts` | All gameplay numbers: scores, tool stats, cash rewards, upgrade prices and bonuses, unlock thresholds. |
| `src/data/gameConfig.ts` | Title, dimensions, background color, debug flag, version, FPS. |
| `src/data/vehicleParts.ts` | Part rectangle ratios per vehicle layout. |

### 4.3 Files to Extend

| File | Extension pattern |
|---|---|
| `src/core/SaveManager.ts` | Add new key to `SAVE_KEYS`, then use `SaveManager.save/load`. |
| `src/systems/EconomySystem.ts` | Extend `calculateCashReward` for new bonus types. |
| `src/systems/UpgradeSystem.ts` | Add new upgrade key to `BALANCING.upgrades` then extend `applyToTool`. |
| `src/utils/helpers.ts` | Add pure utilities only — no Phaser imports. |

### 4.4 Files to Avoid Unless Necessary

| File | Reason |
|---|---|
| `src/main.ts` | Poki plugin registration, scene order, scale config. |
| `src/core/ScaleManager.ts` | Coupled to Phaser construction scale config and orientation DOM overlay. |
| `src/core/AudioManager.ts` | Static singleton with persisted state and browser unlock listeners. |
| `src/core/SaveManager.ts` | Prefix and key behavior affect existing saves. |
| `index.html` | Mobile viewport and touch-action settings are part of browser-game behavior. |

---

## 5. Public Contracts

### 5.1 GameScene → ResultScene Data

`GameScene.triggerComplete()` starts ResultScene with:

```ts
{
  score: number
  highScore: number
  isNewHighScore: boolean
  stars: number              // 1–3
  levelId: number
  levelName: string
  isLastLevel: boolean
  bonusZonesTotal: number
  bonusZonesCompleted: number
  bonusScore: number
  partsTotal: number
  partsCompleted: number
  partCashBonus: number
  cashEarned: number
  cashTotal: number
}
```

If changing this shape, update `ResultScene.init()` and its default values.

### 5.2 GameScene Debug State

`render_game_to_text()` (dev bridge) returns a `GameDebugState` object:

```ts
{
  mode: 'game'
  sceneKey: string
  phase: 'arrival' | 'cleaning' | 'complete'
  arrivalSkipped: boolean
  level: { id, name, dirtType, dirtLayers }
  progress: { percent, cleanCells, totalCells }
  timerSeconds: number
  activeTool: string
  availableTools: string[]
  effectiveTool: boolean
  recommendedTool: string
  guidedTool: string
  handPointerVisible: boolean
  handPointerTarget: string
  prep: { required, percent, preppedCells, totalCells }
  feedbackMessage: string
  customerBubbleVisible: boolean
  cash: number
  ownedUpgrades: Record<string, number>
  tutorialVisible: boolean
  maskBounds: { left, top, width, height }
  completion: { finished, wasteRatio }
  bonusZones: { total, completed, score, zones: Array<{x,y,width,height,completed}> }
  parts: { total, completed, cashBonus, currentHint, items: Array<{key,label,completed,progress}> }
  progression: { world, worldName, levelInWorld, worldCompleted, worldTotal,
                 unlockedTools, totalTools, nextUnlock }
}
```

### 5.3 SaveManager Keys

```ts
export const SAVE_KEYS = {
  highScore:       'high_score',
  muted:           'muted',
  sfxVolume:       'sfx_volume',
  musicVolume:     'music_volume',
  completedCleans: 'completed_cleans',
  currentLevel:    'current_level',   // 1-based id of next unplayed level
  levelStars:      'level_stars',     // Record<levelId, stars>
  unlockedTools:   'unlocked_tools',  // string[] e.g. ['fan','foam','jet']
  levelCompleted:  'level_completed', // Record<levelId, true>
  cash:            'cash',
  ownedUpgrades:   'owned_upgrades',  // Record<upgradeKey, level>
  garageLevel:     'garage_level',
  completedJobs:   'completed_jobs'   // Record<jobId, true>
} as const
```

### 5.4 Level Data

```ts
type DirtType = 'dust' | 'mud' | 'oil' | 'rust'

interface LevelConfig {
  id: number                                       // 1-based, 1–20
  world: number                                    // 1–4
  name: string
  vehicleType: number                              // 0–9
  dirtType: DirtType
  dirtLayers: number                               // 1–4; used by wipe logic
  parTimeSeconds: number
  bonusZones?: [number, number, number, number][]  // [localX, localY, w, h]
}

getLevel(levelId: number): LevelConfig            // clamps to valid range
isLastLevel(levelId: number): boolean
worldForLevel(levelId: number): number
worldName(world: number): string
levelsInWorld(world: number): number[]
levelIndexInWorld(levelId: number): number        // 1-based position within world
calcStars(elapsed, par): 1 | 2 | 3
```

### 5.5 EconomySystem

```ts
EconomySystem.getCash(): number
EconomySystem.addCash(amount: number): number
EconomySystem.calculateCashReward(input: CashRewardInput): number

interface CashRewardInput {
  stars: number
  wasteFraction: number          // 0–1, fraction of wipes that were off-vehicle or wrong-tool
  bonusZonesCompleted: number
  partsCompleted: number
}
```

### 5.6 UpgradeSystem

```ts
type UpgradeKey = 'pressure' | 'sprayWidth' | 'soapQuality'

interface UpgradeOffer {
  key: UpgradeKey
  name: string
  description: string
  price: number
  level: number
  maxLevel: number
  canBuy: boolean
}

UpgradeSystem.loadLevels(): Record<string, number>
UpgradeSystem.getLevel(key: UpgradeKey): number
UpgradeSystem.getPrice(key: UpgradeKey, level?: number): number
UpgradeSystem.buildOffers(cash: number, limit?: number): UpgradeOffer[]
UpgradeSystem.buy(key: UpgradeKey): { success: boolean; cash: number; level: number }
UpgradeSystem.applyToTool(toolKey: string, tool: ToolConfig, dirtType: DirtType): ToolConfig
```

### 5.7 VehicleParts

```ts
interface VehiclePartRect { x: number; y: number; width: number; height: number }
interface VehiclePartDefinition { key: string; label: string; rects: VehiclePartRect[] }

getVehicleParts(vehicleType: number, width: number, height: number): VehiclePartDefinition[]
```

Vehicle type mapping:
- `0, 1, 4, 7, 8` → carParts (hood, windows, doors, trunk, wheels)
- `2, 3, 5, 6` → truckParts (cab, bed, tailgate, wheels)
- `9` → engineParts (block, hoses, manifold)

### 5.8 Analytics

```ts
Analytics.track(event: string, payload?: Record<string, string|number|boolean|null|undefined>): void
```

Events emitted by scenes: `menu_viewed`, `game_started`, `level_shown`, `first_wipe_started`,
`tool_selected`, `tool_unlocked`, `level_completed`, `result_screen_shown`,
`next_level_selected`, `replay_selected`, `menu_selected_from_result`,
`reward_offer_claimed`, `reward_offer_declined`.

All events are buffered in `window.__sparkleWashAnalytics[]` and dispatched as `'sparklewash:analytics'` CustomEvent. No network calls.

### 5.9 AudioManager

```ts
AudioManager.init(scene: Phaser.Scene): void
AudioManager.playSfx(scene: Phaser.Scene, key: string, volume?: number): void
AudioManager.playMusic(scene: Phaser.Scene, key: string, volume?: number): void
AudioManager.stopMusic(): void
AudioManager.toggleMute(): boolean
AudioManager.setMuted(muted: boolean): void
AudioManager.setSfxVolume(volume: number): void
AudioManager.setMusicVolume(volume: number): void
// Getters: muted, sfxVolume, musicVolume
```

### 5.10 UIButton

```ts
new UIButton({ scene, x, y, width?, height?, label, fontSize?, color?,
               hoverColor?, pressColor?, disabledColor?, textColor?, radius?, onClick? })
button.setText(text): this
button.setEnabled(enabled): this
button.isDisabled: boolean
```

### 5.11 ProgressBar

```ts
new ProgressBar({ scene, x, y, width?, height?, trackColor?,
                  fillColor?, highlightColor?, radius?, initialValue? })
progressBar.setValue(value: number): void  // clamped to [0, 1]
progressBar.value: number
```

---

## 6. Common Tasks

### Add a Real Vehicle Asset

1. Place PNG in `public/assets/vehicles/vehicle_N.png`.
2. In `PreloadScene.loadAssets()` replace the `this.make.graphics(...).generateTexture('vehicle_N', ...)` block with `this.load.image('vehicle_N', 'assets/vehicles/vehicle_N.png')`.
3. Add a `LevelConfig` entry in `src/data/levels.ts` with `vehicleType: N`.
4. If the vehicle dimensions differ from 180×340, update `GameScene.createVehicleAndDirt()` sizing logic.
5. Add a part layout to `src/data/vehicleParts.ts` if the new type needs distinct part names.

### Add Audio

1. Place file in `public/assets/audio/`.
2. Load in `PreloadScene.loadAssets()`: `this.load.audio('my_sfx', 'assets/audio/my_sfx.wav')`.
3. Play with `AudioManager.playSfx(this, 'my_sfx')` from any scene. Safe no-op if key is absent.

### Add Levels

1. Add `LevelConfig` entries in `src/data/levels.ts`.
2. Ensure `vehicleType` has a matching texture key in PreloadScene.
3. Tune `dirtLayers` (1=light, 4=heavy) and `parTimeSeconds`.
4. Add `bonusZones` for World 4 levels if desired.
5. `TOTAL_LEVELS` updates automatically.

### Add a Tool

1. Add entry to `BALANCING.tools` with `radius`, `strength`, `name`, `primaryDirt` (and `prepOnly` if applicable).
2. Add entry to `BALANCING.toolUnlockAtLevel`.
3. Generate or load texture key `tool_<toolKey>` in `PreloadScene.loadAssets()`.
4. Verify `GameScene.createToolsUI()` spacing still fits all tools.
5. Update `UpgradeSystem.applyToTool()` if the tool interacts with upgrades.

### Add an Upgrade

1. Add entry to `BALANCING.upgrades` with `name`, `description`, `basePrice`, `priceStep`, `maxLevel`, and a bonus field.
2. Apply the bonus in `UpgradeSystem.applyToTool()`.
3. `UpgradeSystem.buildOffers()` will surface it automatically in the ResultScene shop.

### Add a Saved Value

1. Add suffix to `SAVE_KEYS` in `src/core/SaveManager.ts`.
2. Read/write only via `SaveManager.save/load`.

### Add a New Scene

1. Create `src/scenes/MyScene.ts` with `super({ key: 'MyScene' })`.
2. Import in `src/main.ts` and add to the scene array after BootScene.
3. Navigate with `this.scene.start('MyScene')`.

---

## 7. Known Placeholders and TODOs

| Placeholder/TODO | Location | Reality |
|---|---|---|
| Procedural vehicles 5–8 | `PreloadScene.loadAssets()` | Graphics-generated; no PNG files |
| Part masks as rectangles | `src/data/vehicleParts.ts` | Rect approximations only — not silhouette-exact |
| Foam/part masks | `GameScene` | No authored overlay masks; uses grid cells within part rects |
| Wrong-order visual feedback | `GameScene.showPrepWarning()` | Camera flash + shake present; stronger sprite feedback deferred |
| HOT for oil | `BALANCING.tools.hot` | Hot only bypasses prep for mud; oil still needs FOAM first |
| Legacy rewarded-result fallback | `ResultScene` | Old fallback exists alongside the new cash shop; clean-up deferred |
| COOP browser warning | Dev automation | Console warning from Poki boot in dev; non-blocking |
| `ScoreSystem`, `SpawnSystem` | `src/systems/` | Exist but not wired into any scene |
| `startingLives` | `BALANCING` | Retained for interface compatibility; unused |

---

## 8. Current Test Checklist

### Static Checks

```bash
npm run typecheck   # must exit 0
npm run build       # must exit 0; writes to dist/
```

### Scene Flow

- BootScene → PreloadScene → **GameScene** (direct, no MenuScene)
- Garage arrival: vehicle slides in from below, customer bubble appears
- Click/tap during arrival skips to cleaning phase immediately
- Cleaning: pointer wipes dirt; foam overlay appears when FOAM tool is used
- Correct tool cleans at full strength; wrong tool at 20%
- Unprepped non-dust dirt cleans at 8% strength (unpreppedStrengthFactor)
- Completion triggers at ≥ 98% clean cells
- ResultScene shows score, stars, cash earned, part summary, upgrade shop

### Gameplay

- World 1 (dust): FAN available only; single-layer cleaning
- World 2 (mud): FOAM + JET unlock at level 6; prep required before full cleaning
- World 3 (oil): HOT unlocks at level 12; FOAM still required for oil
- World 4 (rust): bonus zones visible as gold overlays; flash green on completion
- Vehicle parts track independently; completing a part triggers coach toast and +$20
- Upgrade shop in ResultScene deducts cash and persists the upgrade
- Purchased upgrades affect tool stats in subsequent jobs

### Result and Persistence

- ResultScene receives full data contract (§5.1)
- Cash is persisted via `pg_cash`; upgrades via `pg_owned_upgrades`
- Star and level progress persisted via `pg_level_stars` and `pg_current_level`
- Analytics events emitted and available in `window.__sparkleWashAnalytics`

### Poki Integration

- `loadingSceneKey` = `'PreloadScene'`
- `gameplaySceneKey` = `'GameScene'`
- `autoCommercialBreak` = `true`
- Rewarded break via `poki.rewardedBreak()` in ResultScene

### Responsive/Mobile

- Canvas scales via Phaser Scale.FIT into `#game-container`
- Portrait 480×854 layout; orientation warning when landscape and width < 900
- Touch gestures blocked from scrolling/zooming

---

## 9. Drift Notes for Future Agents

- Do not reintroduce enemy/coin/lives/pause systems unless created in code.
- Do not document `DifficultySystem` unless `src/systems/DifficultySystem.ts` exists.
- Do not claim part masks are silhouette-exact — they are rectangular approximations.
- Do not claim HOT bypasses prep for oil or rust — it only bypasses mud.
- Do not claim the test bridge exists in production — verify by checking the built bundle.
- Keep this file synchronized when: scene keys, save keys, loader asset keys, level data, result data contract, or system APIs change.
- The legacy widesponge/foambrush/focusspray tool names no longer exist. The current tool keys are fan/foam/jet/hot.
