import p5 from 'p5'
import type { ArtworkGeneValues } from '../seeds/types'
import type { P5Seed } from '../seeds/p5/types'
import {
  DEFAULT_PLAYBACK_SPEED,
  PlaybackClock,
  type PlaybackClockOptions,
  type PlaybackFrame,
} from '../playbackClock'

export function mountP5Runtime(
  container: HTMLDivElement,
  seed: P5Seed,
  getGenes: () => ArtworkGeneValues,
  onFpsChange?: (fps: number) => void,
  initialPlayback: PlaybackClockOptions = {},
) {
  let disposed = false
  const paused = initialPlayback.paused ?? false
  const speed = initialPlayback.speed ?? DEFAULT_PLAYBACK_SPEED
  const clock = new PlaybackClock({ paused, speed })
  let playbackFrame: PlaybackFrame = { elapsedSeconds: 0, deltaSeconds: 0, paused: false }
  // p5 may reach setup after its host component has already unmounted.
  const artwork = new p5((instance) => {
    seed.createSketch(instance, getGenes, () => playbackFrame)
    const draw = instance.draw
    instance.draw = () => {
      playbackFrame = clock.advance()
      draw?.call(instance)
      if (playbackFrame.paused) instance.noLoop()
    }

    const { setup } = instance
    instance.setup = async () => {
      if (disposed) {
        await instance.remove()
        return
      }
      await setup?.call(instance)
    }
  }, container)
  if (paused) artwork.noLoop()
  let currentPaused = paused
  let previousFrameCount = artwork.frameCount
  let previousSampleTime = performance.now()
  const fpsInterval =
    onFpsChange === undefined
      ? undefined
      : window.setInterval(() => {
          if (disposed) return

          const sampleTime = performance.now()
          const elapsed = sampleTime - previousSampleTime
          const frameCount = artwork.frameCount
          if (elapsed > 0) {
            onFpsChange(Math.round(((frameCount - previousFrameCount) * 1000) / elapsed))
          }
          previousFrameCount = frameCount
          previousSampleTime = sampleTime
        }, 1000)

  return {
    setPaused(nextPaused: boolean) {
      if (disposed || currentPaused === nextPaused) return
      clock.setPaused(nextPaused)
      currentPaused = nextPaused
      if (!nextPaused) artwork.loop()
    },
    setSpeed(nextSpeed: number) {
      if (disposed) return
      clock.setSpeed(nextSpeed)
    },
    dispose() {
      disposed = true
      if (fpsInterval !== undefined) window.clearInterval(fpsInterval)
      artwork.remove()
    },
  }
}
