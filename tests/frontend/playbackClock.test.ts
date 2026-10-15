import { describe, expect, it } from 'vitest'
import { PLAYBACK_TRANSITION_MS, PlaybackClock, isPlaybackSpeed } from '../../src/playbackClock'

describe('PlaybackClock', () => {
  it('scales elapsed and delta time as speed changes', () => {
    let now = 0
    const clock = new PlaybackClock({}, () => now)

    expect(clock.advance()).toEqual({ elapsedSeconds: 0, deltaSeconds: 0, paused: false })
    now = 1000
    expect(clock.advance()).toEqual({ elapsedSeconds: 1, deltaSeconds: 1, paused: false })

    clock.setSpeed(2)
    now = 1500
    expect(clock.advance()).toEqual({ elapsedSeconds: 2, deltaSeconds: 1, paused: false })
  })

  it('eases to zero over 750 ms when pausing and eases back when resuming', () => {
    let now = 0
    const clock = new PlaybackClock({}, () => now)
    now = 1000
    clock.advance()
    clock.setPaused(true)

    now += PLAYBACK_TRANSITION_MS / 2
    const pausing = clock.advance()
    expect(pausing.paused).toBe(false)
    expect(pausing.deltaSeconds).toBeCloseTo(0.3046875)

    now += PLAYBACK_TRANSITION_MS / 2
    const paused = clock.advance()
    expect(paused.paused).toBe(true)
    expect(paused.deltaSeconds).toBeCloseTo(0.0703125)

    now += 3000
    expect(clock.advance()).toMatchObject({ paused: true, deltaSeconds: 0 })
    clock.setPaused(false)

    now += PLAYBACK_TRANSITION_MS / 2
    const resuming = clock.advance()
    expect(resuming.paused).toBe(false)
    expect(resuming.deltaSeconds).toBeCloseTo(0.0703125)

    now += PLAYBACK_TRANSITION_MS / 2
    expect(clock.advance().deltaSeconds).toBeCloseTo(0.3046875)
  })

  it('reverses an in-progress transition from its current playback rate', () => {
    let now = 0
    const clock = new PlaybackClock({}, () => now)
    clock.setPaused(true)
    now = PLAYBACK_TRANSITION_MS / 2
    expect(clock.advance().deltaSeconds).toBeCloseTo(0.3046875)

    clock.setPaused(false)
    now += PLAYBACK_TRANSITION_MS / 2
    const resumed = clock.advance()
    expect(resumed.paused).toBe(false)
    expect(resumed.deltaSeconds).toBeCloseTo(0.22265625)
  })

  it('accepts only finite speeds in the supported range', () => {
    expect(isPlaybackSpeed(0.1)).toBe(true)
    expect(isPlaybackSpeed(4)).toBe(true)
    expect(isPlaybackSpeed(0)).toBe(false)
    expect(isPlaybackSpeed(4.1)).toBe(false)
    expect(isPlaybackSpeed(Number.NaN)).toBe(false)
  })
})
