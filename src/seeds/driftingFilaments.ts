import { seedToNumber } from '../seed-id'
import type { ArtworkSeed } from './types'

const FILAMENT_COUNT = 160
const NOISE_SCALE = 0.0014
const STEP_LENGTH = 1.4

type Filament = { x: number; y: number; hue: number }

export const driftingFilamentsSeed: ArtworkSeed = {
  id: 'drifting-filaments',
  label: 'Drifting filaments',
  createSketch: (instance) => {
    const numericSeed = seedToNumber('drifting-filaments')
    let filaments: Filament[] = []

    const reset = () => {
      instance.randomSeed(numericSeed)
      instance.noiseSeed(numericSeed)
      instance.background(8, 10, 16)
      filaments = Array.from({ length: FILAMENT_COUNT }, () => ({
        x: instance.random(instance.width),
        y: instance.random(instance.height),
        hue: instance.random(150, 330),
      }))
    }

    instance.setup = () => {
      instance.createCanvas(instance.windowWidth, instance.windowHeight)
      instance.pixelDensity(1)
      instance.colorMode(instance.HSB, 360, 100, 100, 100)
      reset()
    }

    instance.draw = () => {
      // A translucent veil fades old trails so the field keeps evolving.
      instance.noStroke()
      instance.fill(230, 60, 6, 6)
      instance.rect(0, 0, instance.width, instance.height)

      for (const filament of filaments) {
        const angle =
          instance.noise(
            filament.x * NOISE_SCALE,
            filament.y * NOISE_SCALE,
            instance.frameCount * 0.0006,
          ) *
          instance.TWO_PI *
          2
        const nextX = filament.x + Math.cos(angle) * STEP_LENGTH
        const nextY = filament.y + Math.sin(angle) * STEP_LENGTH

        instance.stroke(filament.hue, 55, 95, 40)
        instance.strokeWeight(1.2)
        instance.line(filament.x, filament.y, nextX, nextY)

        filament.x = nextX
        filament.y = nextY

        const outside = nextX < 0 || nextX > instance.width || nextY < 0 || nextY > instance.height
        if (outside) {
          filament.x = instance.random(instance.width)
          filament.y = instance.random(instance.height)
        }
      }
    }

    instance.windowResized = () => {
      instance.resizeCanvas(instance.windowWidth, instance.windowHeight)
      reset()
    }
  },
}
