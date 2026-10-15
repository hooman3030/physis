import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountP5Runtime } from '../../../src/runtimes/p5'
import type { P5Seed } from '../../../src/seeds/p5/types'
import { DEFAULT_PLAYBACK_SPEED } from '../../../src/playbackClock'

const p5Controls = vi.hoisted(() => ({
  loop: vi.fn(),
  noLoop: vi.fn(),
  remove: vi.fn(),
  runFrame: vi.fn(),
}))

vi.mock('p5', () => ({
  default: class MockP5 {
    frameCount = 0
    loop = p5Controls.loop
    noLoop = p5Controls.noLoop
    remove = p5Controls.remove
    draw?: () => void

    constructor(sketch: (instance: unknown) => void) {
      sketch(this)
      p5Controls.runFrame.mockImplementation(() => this.draw?.())
    }
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('p5 runtime playback', () => {
  it('eases pause and resume without resetting or remounting the sketch', () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const createSketch = vi.fn()
    const seed: P5Seed = {
      id: 'test-seed',
      label: 'Test seed',
      runtime: 'p5',
      genes: [],
      createSketch,
    }
    const runtime = mountP5Runtime({} as HTMLDivElement, seed, () => ({}), undefined, {
      paused: true,
      speed: DEFAULT_PLAYBACK_SPEED,
    })

    expect(createSketch).toHaveBeenCalledOnce()
    expect(p5Controls.noLoop).toHaveBeenCalledOnce()
    runtime.setPaused(true)
    expect(p5Controls.noLoop).toHaveBeenCalledOnce()

    runtime.setPaused(false)
    expect(p5Controls.loop).toHaveBeenCalledOnce()
    now += 375
    p5Controls.runFrame()
    expect(p5Controls.noLoop).toHaveBeenCalledOnce()

    runtime.setPaused(true)
    now += 375
    p5Controls.runFrame()
    expect(p5Controls.noLoop).toHaveBeenCalledOnce()
    now += 375
    p5Controls.runFrame()
    expect(p5Controls.noLoop).toHaveBeenCalledTimes(2)

    runtime.setSpeed(2)
    expect(createSketch).toHaveBeenCalledOnce()

    runtime.dispose()
    runtime.setPaused(false)
    expect(p5Controls.remove).toHaveBeenCalledOnce()
    expect(p5Controls.loop).toHaveBeenCalledOnce()
  })
})
