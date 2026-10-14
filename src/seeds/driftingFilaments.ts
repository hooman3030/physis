import type { P5Seed } from './p5'

type Filament = { x: number; y: number; hue: number }

export const driftingFilamentsSeed: P5Seed = {
  id: 'drifting-filaments',
  label: 'Drifting filaments',
  runtime: 'p5',
  parameters: [
    {
      id: 'filamentCount',
      label: 'Filament count',
      defaultValue: 160,
      min: 20,
      max: 10000,
      step: 20,
    },
    {
      id: 'noiseScale',
      label: 'Noise scale',
      defaultValue: 0.0014,
      min: 0.0002,
      max: 0.004,
      step: 0.0001,
    },
    { id: 'stepLength', label: 'Step length', defaultValue: 1.4, min: 0.2, max: 4, step: 0.1 },
  ],
  createSketch: (instance, getParameters) => {
    let filaments: Filament[] = []

    const spawn = (): Filament => ({
      x: instance.random(instance.width),
      y: instance.random(instance.height),
      hue: instance.random(150, 330),
    })

    const reset = () => {
      instance.background(8, 10, 16)
      filaments = Array.from({ length: getParameters().filamentCount }, spawn)
    }

    instance.setup = () => {
      instance.createCanvas(instance.windowWidth, instance.windowHeight)
      instance.pixelDensity(1)
      instance.colorMode(instance.HSB, 360, 100, 100, 100)
      reset()
    }

    instance.draw = () => {
      const { filamentCount, noiseScale, stepLength } = getParameters()

      if (filaments.length > filamentCount) filaments.length = filamentCount
      while (filaments.length < filamentCount) filaments.push(spawn())

      // A translucent veil fades old trails so the field keeps evolving.
      instance.noStroke()
      instance.fill(230, 60, 6, 6)
      instance.rect(0, 0, instance.width, instance.height)

      for (const filament of filaments) {
        const angle =
          instance.noise(
            filament.x * noiseScale,
            filament.y * noiseScale,
            instance.frameCount * 0.0006,
          ) *
          instance.TWO_PI *
          2
        const nextX = filament.x + Math.cos(angle) * stepLength
        const nextY = filament.y + Math.sin(angle) * stepLength

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
