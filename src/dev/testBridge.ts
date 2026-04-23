import Phaser from 'phaser'

import { config } from '../core/Config'
import { SaveManager, SAVE_KEYS } from '../core/SaveManager'
import { TOTAL_LEVELS } from '../data/levels'
import { GameScene } from '../scenes/GameScene'
import { MenuScene } from '../scenes/MenuScene'
import { ResultScene } from '../scenes/ResultScene'

declare global {
  interface Window {
    render_game_to_text?: () => string
    advanceTime?: (ms: number) => Promise<void>
    __sparkleWashTest?: {
      resetProgress: () => void
      startLevel: (levelId: number) => void
      gotoMenu: () => void
      isDeterministic: () => boolean
    }
  }
}

function getActiveScene(game: Phaser.Game): Phaser.Scene | null {
  const scenes = game.scene.getScenes(true, true)
  return scenes[0] ?? null
}

function clampLevel(levelId: number): number {
  return Math.max(1, Math.min(Math.floor(levelId), TOTAL_LEVELS))
}

function startScene(game: Phaser.Game, levelId: number): void {
  const nextLevel = clampLevel(levelId)
  SaveManager.save(SAVE_KEYS.currentLevel, nextLevel)
  game.scene.start('GameScene', { levelId: nextLevel })
}

function buildSnapshot(game: Phaser.Game): unknown {
  const scene = getActiveScene(game)

  if (!scene) {
    return {
      mode: 'none',
      note: 'No active scene',
      coordinateSystem: 'Origin is top-left. X increases right, Y increases down.'
    }
  }

  if (scene instanceof GameScene) {
    return scene.getDebugState()
  }

  if (scene instanceof ResultScene) {
    return scene.getDebugState()
  }

  if (scene instanceof MenuScene) {
    return scene.getDebugState()
  }

  return {
    mode: scene.scene.key.replace('Scene', '').toLowerCase(),
    sceneKey: scene.scene.key,
    coordinateSystem: 'Origin is top-left. X increases right, Y increases down.'
  }
}

export function registerSparkleWashTestBridge(game: Phaser.Game): void {
  if (!config.isDev) {
    return
  }

  const automated = navigator.webdriver === true
  const fixedDeltaMs = 1000 / 60
  let deterministicMode = false
  let simulatedTime = 0

  window.render_game_to_text = () => JSON.stringify(buildSnapshot(game))

  window.advanceTime = async (ms: number) => {
    if (!automated) {
      await new Promise((resolve) => window.setTimeout(resolve, ms))
      return
    }

    if (!deterministicMode) {
      game.loop.sleep()
      simulatedTime = game.loop.now || performance.now()
      deterministicMode = true
    }

    const steps = Math.max(1, Math.round(ms / fixedDeltaMs))

    for (let i = 0; i < steps; i++) {
      simulatedTime += fixedDeltaMs
      game.step(simulatedTime, fixedDeltaMs)
    }
  }

  window.__sparkleWashTest = {
    resetProgress: () => {
      SaveManager.clearAll()
      startScene(game, 1)
    },
    startLevel: (levelId: number) => {
      startScene(game, levelId)
    },
    gotoMenu: () => {
      game.scene.start('MenuScene')
    },
    isDeterministic: () => deterministicMode
  }
}
