import type { P5Seed } from '../types'

type Filament = { x: number; y: number; hueOffset: number; age: number; lifetime: number }
type LineSegment = readonly [number, number, number, number]

export function getTrailFadeAlpha(trailLength: number): number {
  return 100 * (1 - Math.pow(1 / 1024, 1 / (trailLength * 2)))
}

export function getFilamentLifetimeFrames(
  lifetime: number,
  variation: number,
  randomValue: number,
): number {
  const variationRange = (lifetime * variation) / 100
  return Math.max(1, Math.round(lifetime - variationRange + variationRange * 2 * randomValue))
}

export function getWrappedLineSegments(
  x: number,
  y: number,
  nextX: number,
  nextY: number,
  width: number,
  height: number,
): LineSegment[] {
  const xOffsets = nextX < 0 ? [0, width] : nextX > width ? [0, -width] : [0]
  const yOffsets = nextY < 0 ? [0, height] : nextY > height ? [0, -height] : [0]

  return xOffsets.flatMap((xOffset) =>
    yOffsets.map(
      (yOffset) => [x + xOffset, y + yOffset, nextX + xOffset, nextY + yOffset] as const,
    ),
  )
}

export const driftingFilamentsSeed: P5Seed = {
  id: 'drifting-filaments',
  label: 'Drifting filaments',
  runtime: 'p5',
  genes: [
    {
      id: 'filamentCount',
      label: 'Filament count',
      defaultValue: 240,
      min: 20,
      max: 5000,
      step: 20,
    },
    {
      id: 'noiseScale',
      label: 'Flow scale',
      defaultValue: 0.0014,
      min: 0.0002,
      max: 0.004,
      step: 0.0001,
    },
    {
      id: 'flowSpeed',
      label: 'Flow speed',
      defaultValue: 0.0006,
      min: 0.0001,
      max: 0.004,
      step: 0.0001,
    },
    { id: 'stepLength', label: 'Step length', defaultValue: 1.4, min: 0.2, max: 8, step: 0.1 },
    {
      id: 'trailLength',
      label: 'Trail length (frames)',
      defaultValue: 24,
      min: 2,
      max: 300,
      step: 2,
    },
    {
      id: 'lifetime',
      label: 'Lifetime (frames)',
      defaultValue: 600,
      min: 60,
      max: 1800,
      step: 30,
    },
    {
      id: 'lifetimeVariation',
      label: 'Lifetime variation (%)',
      defaultValue: 25,
      min: 0,
      max: 100,
      step: 1,
    },
    { id: 'hue', label: 'Hue', defaultValue: 240, min: 0, max: 360, step: 1 },
    { id: 'hueSpread', label: 'Hue variation', defaultValue: 90, min: 0, max: 180, step: 1 },
    { id: 'saturation', label: 'Saturation', defaultValue: 55, min: 0, max: 100, step: 1 },
    { id: 'brightness', label: 'Brightness', defaultValue: 95, min: 0, max: 100, step: 1 },
    { id: 'opacity', label: 'Opacity', defaultValue: 40, min: 1, max: 100, step: 1 },
    { id: 'strokeWeight', label: 'Stroke width', defaultValue: 1.2, min: 0.2, max: 6, step: 0.1 },
    { id: 'backgroundHue', label: 'Background hue', defaultValue: 230, min: 0, max: 360, step: 1 },
    {
      id: 'backgroundSaturation',
      label: 'Background saturation',
      defaultValue: 60,
      min: 0,
      max: 100,
      step: 1,
    },
    {
      id: 'backgroundBrightness',
      label: 'Background brightness',
      defaultValue: 6,
      min: 0,
      max: 100,
      step: 1,
    },
  ],
  createSketch: (instance, getGenes) => {
    let filaments: Filament[] = []

    const spawn = (): Filament => {
      const { lifetime, lifetimeVariation } = getGenes()
      return {
        x: instance.random(instance.width),
        y: instance.random(instance.height),
        hueOffset: instance.random(-1, 1),
        age: 0,
        lifetime: getFilamentLifetimeFrames(lifetime, lifetimeVariation, instance.random()),
      }
    }

    const reset = () => {
      const { backgroundHue, backgroundSaturation, backgroundBrightness } = getGenes()
      instance.background(backgroundHue, backgroundSaturation, backgroundBrightness)
      filaments = Array.from({ length: getGenes().filamentCount }, spawn)
    }

    const wrap = (value: number, size: number) => ((value % size) + size) % size

    instance.setup = () => {
      instance.createCanvas(instance.windowWidth, instance.windowHeight)
      instance.pixelDensity(1)
      instance.colorMode(instance.HSB, 360, 100, 100, 100)
      reset()
    }

    instance.draw = () => {
      const {
        filamentCount,
        noiseScale,
        flowSpeed,
        stepLength,
        trailLength,
        hue,
        hueSpread,
        saturation,
        brightness,
        opacity,
        strokeWeight,
        backgroundHue,
        backgroundSaturation,
        backgroundBrightness,
      } = getGenes()

      if (filaments.length > filamentCount) filaments.length = filamentCount
      while (filaments.length < filamentCount) filaments.push(spawn())

      instance.noStroke()
      instance.fill(
        backgroundHue,
        backgroundSaturation,
        backgroundBrightness,
        getTrailFadeAlpha(trailLength),
      )
      instance.rect(0, 0, instance.width, instance.height)

      for (let index = 0; index < filaments.length; index += 1) {
        let filament = filaments[index]
        if (filament.age >= filament.lifetime) {
          filament = spawn()
          filaments[index] = filament
        }

        const angle =
          instance.noise(
            filament.x * noiseScale,
            filament.y * noiseScale,
            instance.frameCount * flowSpeed,
          ) *
          instance.TWO_PI *
          2
        const nextX = filament.x + Math.cos(angle) * stepLength
        const nextY = filament.y + Math.sin(angle) * stepLength

        instance.stroke(
          wrap(hue + filament.hueOffset * hueSpread, 360),
          saturation,
          brightness,
          opacity,
        )
        instance.strokeWeight(strokeWeight)
        for (const [x1, y1, x2, y2] of getWrappedLineSegments(
          filament.x,
          filament.y,
          nextX,
          nextY,
          instance.width,
          instance.height,
        )) {
          instance.line(x1, y1, x2, y2)
        }

        filament.x = wrap(nextX, instance.width)
        filament.y = wrap(nextY, instance.height)
        filament.age += 1
      }
    }

    instance.windowResized = () => {
      instance.resizeCanvas(instance.windowWidth, instance.windowHeight)
      reset()
    }
  },
}
