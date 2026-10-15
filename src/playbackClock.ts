export const MIN_PLAYBACK_SPEED = 0.1
export const MAX_PLAYBACK_SPEED = 4
export const DEFAULT_PLAYBACK_SPEED = 1
export const PLAYBACK_TRANSITION_MS = 750

export type PlaybackFrame = {
  elapsedSeconds: number
  deltaSeconds: number
  paused: boolean
}

export type PlaybackClockOptions = {
  paused?: boolean
  speed?: number
}

type RateTransition = {
  from: number
  to: number
  startTimestamp: number
}

export function isPlaybackSpeed(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_PLAYBACK_SPEED &&
    value <= MAX_PLAYBACK_SPEED
  )
}

export class PlaybackClock {
  readonly #now: () => number
  #elapsedSeconds = 0
  #lastTimestamp: number
  #targetPaused: boolean
  #currentRate: number
  #speed: number
  #transition: RateTransition | null = null

  constructor(
    { paused = false, speed = DEFAULT_PLAYBACK_SPEED }: PlaybackClockOptions = {},
    now: () => number = () => performance.now(),
  ) {
    if (!isPlaybackSpeed(speed)) {
      throw new RangeError(
        `Playback speed must be between ${MIN_PLAYBACK_SPEED} and ${MAX_PLAYBACK_SPEED}`,
      )
    }
    this.#now = now
    this.#lastTimestamp = now()
    this.#targetPaused = paused
    this.#currentRate = paused ? 0 : 1
    this.#speed = speed
  }

  advance(): PlaybackFrame {
    return this.#advanceTo(this.#now())
  }

  setPaused(paused: boolean): void {
    this.#advanceTo(this.#now())
    if (this.#targetPaused === paused) return
    this.#targetPaused = paused
    const targetRate = paused ? 0 : 1
    if (this.#currentRate === targetRate) {
      this.#transition = null
      return
    }
    this.#transition = {
      from: this.#currentRate,
      to: targetRate,
      startTimestamp: this.#lastTimestamp,
    }
  }

  setSpeed(speed: number): void {
    if (!isPlaybackSpeed(speed)) {
      throw new RangeError(
        `Playback speed must be between ${MIN_PLAYBACK_SPEED} and ${MAX_PLAYBACK_SPEED}`,
      )
    }
    this.#advanceTo(this.#now())
    this.#speed = speed
  }

  #advanceTo(timestamp: number): PlaybackFrame {
    const startTimestamp = this.#lastTimestamp
    const endTimestamp = Math.max(startTimestamp, timestamp)
    const rateMilliseconds = this.#integratedRate(startTimestamp, endTimestamp)
    this.#lastTimestamp = endTimestamp
    this.#currentRate = this.#rateAt(endTimestamp)
    if (
      this.#transition !== null &&
      endTimestamp >= this.#transition.startTimestamp + PLAYBACK_TRANSITION_MS
    ) {
      this.#currentRate = this.#transition.to
      this.#transition = null
    }
    const deltaSeconds = (rateMilliseconds / 1000) * this.#speed
    this.#elapsedSeconds += deltaSeconds
    return {
      elapsedSeconds: this.#elapsedSeconds,
      deltaSeconds,
      paused: this.#targetPaused && this.#transition === null && this.#currentRate === 0,
    }
  }

  #integratedRate(startTimestamp: number, endTimestamp: number): number {
    const transition = this.#transition
    if (transition === null) return this.#currentRate * (endTimestamp - startTimestamp)

    const transitionEnd = transition.startTimestamp + PLAYBACK_TRANSITION_MS
    const rampStart = Math.max(startTimestamp, transition.startTimestamp)
    const rampEnd = Math.min(endTimestamp, transitionEnd)
    let rateMilliseconds = 0

    if (rampEnd > rampStart) {
      const startProgress = (rampStart - transition.startTimestamp) / PLAYBACK_TRANSITION_MS
      const endProgress = (rampEnd - transition.startTimestamp) / PLAYBACK_TRANSITION_MS
      rateMilliseconds +=
        transition.from * (rampEnd - rampStart) +
        (transition.to - transition.from) *
          PLAYBACK_TRANSITION_MS *
          (smoothstepIntegral(endProgress) - smoothstepIntegral(startProgress))
    }

    const afterRampStart = Math.max(startTimestamp, transitionEnd)
    if (endTimestamp > afterRampStart) {
      rateMilliseconds += transition.to * (endTimestamp - afterRampStart)
    }
    return rateMilliseconds
  }

  #rateAt(timestamp: number): number {
    const transition = this.#transition
    if (transition === null) return this.#currentRate
    const progress = Math.min(
      1,
      Math.max(0, (timestamp - transition.startTimestamp) / PLAYBACK_TRANSITION_MS),
    )
    return transition.from + (transition.to - transition.from) * smoothstep(progress)
  }
}

function smoothstep(progress: number): number {
  return progress * progress * (3 - 2 * progress)
}

function smoothstepIntegral(progress: number): number {
  return progress * progress * progress - 0.5 * progress * progress * progress * progress
}
