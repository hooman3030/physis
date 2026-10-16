import { color, mix, sin, uniform, uv } from 'three/tsl'
import {
  Color,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three/webgpu'
import type { ThreeSeed } from '../types'

function createNodeMaterial<T extends object>(colorNode: T) {
  const material = new MeshBasicNodeMaterial()
  // The DefinitelyTyped node-material setter still exposes the legacy color type.
  Object.assign(material, { colorNode })
  return material
}

export const firstOrbitSeed: ThreeSeed = {
  id: 'first-orbit',
  label: 'First orbit',
  runtime: 'three',
  genes: [
    { id: 'hue', label: 'Hue', defaultValue: 0.58, min: 0, max: 1, step: 0.01 },
    { id: 'accent', label: 'Accent', defaultValue: 0.18, min: 0.08, max: 0.5, step: 0.01 },
    { id: 'saturation', label: 'Saturation', defaultValue: 0.62, min: 0.3, max: 1, step: 0.05 },
    { id: 'lightness', label: 'Lightness', defaultValue: 0.62, min: 0.4, max: 0.8, step: 0.02 },
    { id: 'frequency', label: 'Bands', defaultValue: 8, min: 4, max: 20, step: 1 },
    { id: 'warp', label: 'Warp', defaultValue: 0.8, min: 0, max: 2, step: 0.1 },
    { id: 'flow', label: 'Flow', defaultValue: 0.6, min: 0.1, max: 2, step: 0.1 },
    { id: 'layering', label: 'Interference', defaultValue: 0.55, min: 0, max: 1, step: 0.05 },
    { id: 'pulse', label: 'Pulse', defaultValue: 0.35, min: 0, max: 1, step: 0.01 },
    { id: 'contrast', label: 'Contrast', defaultValue: 1, min: 0.6, max: 1.8, step: 0.05 },
    { id: 'orbitSpeed', label: 'Orbit speed', defaultValue: 0.8, min: 0.25, max: 1.8, step: 0.05 },
    {
      id: 'orbitSpread',
      label: 'Orbit spread',
      defaultValue: 0.9,
      min: 0.75,
      max: 1.05,
      step: 0.05,
    },
    { id: 'planetSize', label: 'Planet size', defaultValue: 1, min: 0.65, max: 1.5, step: 0.05 },
  ],
  createScene: (scene, camera, getGenes) => {
    const hueColor = uniform(color('#77c8d8'))
    const accentColor = uniform(color('#f2cc8f'))
    const frequency = uniform(8)
    const warp = uniform(0.8)
    const flow = uniform(0.6)
    const layering = uniform(0.55)
    const pulse = uniform(0.35)
    const contrast = uniform(1)
    const orbitSpeed = uniform(0.8)
    const orbitSpread = uniform(0.9)
    const planetSize = uniform(1)
    const time = uniform(0)
    const coordinates = uv()
    const drift = time.mul(flow)
    const warpWave = sin(coordinates.y.mul(frequency.mul(0.5)).add(drift)).mul(warp)
    const horizontalWave = sin(coordinates.x.mul(frequency).add(warpWave).add(drift))
    const verticalWave = sin(
      coordinates.y.mul(frequency.mul(0.85)).sub(warpWave).sub(drift.mul(orbitSpeed)),
    )
    const bands = horizontalWave.mul(0.5).add(0.5)
    const interference = horizontalWave.mul(verticalWave).mul(0.5).add(0.5)
    const pattern = mix(bands, interference, layering)
    const pulsePattern = sin(pattern.mul(frequency).add(time.mul(orbitSpeed)))
      .mul(0.5)
      .add(0.5)
    const contrastPattern = mix(pattern, pulsePattern, pulse)
      .sub(0.5)
      .mul(contrast)
      .add(0.5)
      .clamp(0, 1)
    const spreadPattern = contrastPattern
      .mul(orbitSpread)
      .add(orbitSpread.sub(1).mul(-0.5))
      .clamp(0, 1)
    const material = createNodeMaterial(
      mix(hueColor, accentColor, spreadPattern).mul(planetSize.mul(0.12).add(0.88)),
    )
    const sphere = new Mesh(new SphereGeometry(1.1, 64, 48), material)
    scene.background = new Color('#0d1117')
    scene.add(sphere)
    camera.position.set(0, 0, 9)
    camera.lookAt(0, 0, 0)

    const orbits = [1.8, 2.55, 3.3].map((radius, index) => {
      const orbit = new Group()
      const colors = ['#f2cc8f', '#a9d5c0', '#b9a2ff']
      const planetColor = uniform(color(colors[index] ?? '#a9d5c0'))
      const planetMaterial = createNodeMaterial(planetColor.mul(planetSize))
      const planet = new Mesh(new SphereGeometry(0.16 + index * 0.055, 24, 16), planetMaterial)
      const track = new Mesh(
        new TorusGeometry(radius, 0.008, 6, 128),
        createNodeMaterial(planetColor.mul(0.42).mul(orbitSpread)),
      )
      scene.add(orbit, track)
      orbit.add(planet)
      return {
        orbit,
        planet,
        planetColor,
        track,
        radius,
        speed: 0.3 + index * 0.12,
        phase: index * 2.1,
      }
    })

    return (frame) => {
      const genes = getGenes()
      hueColor.value.setHSL(genes.hue, genes.saturation, genes.lightness)
      accentColor.value.setHSL((genes.hue + genes.accent) % 1, genes.saturation, genes.lightness)
      frequency.value = genes.frequency
      warp.value = genes.warp
      flow.value = genes.flow
      layering.value = genes.layering
      pulse.value = genes.pulse
      contrast.value = genes.contrast
      orbitSpeed.value = genes.orbitSpeed
      orbitSpread.value = genes.orbitSpread
      planetSize.value = genes.planetSize
      time.value = frame.elapsedSeconds
      sphere.rotation.y = frame.elapsedSeconds * 0.18
      sphere.rotation.x = Math.sin(frame.elapsedSeconds * 0.12) * 0.1
      for (const { orbit, planet, planetColor, track, radius, speed, phase } of orbits) {
        const angle = frame.elapsedSeconds * speed * genes.orbitSpeed + phase
        orbit.rotation.z = angle
        orbit.scale.setScalar(genes.orbitSpread)
        track.scale.setScalar(genes.orbitSpread)
        planet.scale.setScalar(genes.planetSize)
        planet.position.set(radius, 0, Math.sin(angle) * 0.16)
        planetColor.value.setHSL(
          (genes.hue + genes.accent + phase / 8) % 1,
          genes.saturation,
          genes.lightness,
        )
      }
    }
  },
}
