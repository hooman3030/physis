import type { ArtworkSeed } from './types'

export const firstLightSeed: ArtworkSeed = {
  id: 'first-light',
  label: 'First light',
  parameters: [],
  createSketch: (instance) => {
    instance.setup = () => {
      instance.createCanvas(instance.windowWidth, instance.windowHeight)
      instance.pixelDensity(Math.min(instance.pixelDensity(), 2))
    }

    instance.draw = () => {
      instance.background(13, 17, 23)
      instance.noStroke()

      for (let index = 0; index < 90; index += 1) {
        const x = instance.random(instance.width)
        const y = instance.random(instance.height)
        const radius = instance.random(8, Math.min(instance.width, instance.height) / 5)
        const hue = instance.random(160, 260)
        instance.fill(hue, 80, 80, 18)
        instance.ellipse(x, y, radius, radius)
      }

      instance.noLoop()
    }

    instance.windowResized = () => {
      instance.resizeCanvas(instance.windowWidth, instance.windowHeight)
      instance.redraw()
    }
  },
}
