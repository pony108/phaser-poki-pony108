/**
 * helpers.ts
 * Shared utility functions used across scenes and systems.
 * All functions are pure and have no Phaser dependencies.
 */

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Returns a random float between min (inclusive) and max (exclusive).
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

/**
 * Clamps a value between a minimum and maximum.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Linearly interpolates between a and b by t (0..1).
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1)
}

/**
 * Maps a value from one range to another.
 * e.g. mapRange(0.5, 0, 1, 0, 100) → 50
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1)
  return lerp(outMin, outMax, t)
}

/**
 * Formats a number as a zero-padded string of the given length.
 * e.g. zeroPad(5, 3) → "005"
 */
export function zeroPad(value: number, length: number): string {
  return String(Math.floor(value)).padStart(length, '0')
}

/**
 * Formats milliseconds as MM:SS.
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${zeroPad(minutes, 2)}:${zeroPad(seconds, 2)}`
}

/**
 * Formats a score number with comma separators.
 * e.g. formatScore(12345) → "12,345"
 */
export function formatScore(score: number): string {
  return score.toLocaleString()
}

/**
 * Returns true if the current device reports a touch-capable screen.
 * Use for layout adjustments — don't gate gameplay on this.
 */
export function isTouchDevice(): boolean {
  return navigator.maxTouchPoints > 0
}

/**
 * Picks a random element from an array.
 */
export function randomPick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]
}

/**
 * Shuffles an array in-place using Fisher-Yates and returns it.
 */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Converts degrees to radians.
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Returns the distance between two points.
 */
export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}
