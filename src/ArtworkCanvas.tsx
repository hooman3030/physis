import { useEffect, useRef } from 'react'
import p5 from 'p5'
import { seedToNumber } from './seed'

type ArtworkCanvasProps = {
  seed: string
}

export function ArtworkCanvas({ seed }: ArtworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const sketch = (instance: p5) => {
      const numericSeed = seedToNumber(seed)

      instance.setup = () => {
        instance.createCanvas(instance.windowWidth, instance.windowHeight)
        instance.pixelDensity(Math.min(instance.pixelDensity(), 2))
        instance.randomSeed(numericSeed)
        instance.noiseSeed(numericSeed)
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
    }

    const artwork = new p5(sketch, containerRef.current)
    return () => artwork.remove()
  }, [seed])

  return (
    <div ref={containerRef} className="artwork-canvas" aria-label={`Artwork seeded by ${seed}`} />
  )
}
