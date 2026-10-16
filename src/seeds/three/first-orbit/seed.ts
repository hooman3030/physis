import { color, mix, sin, uniform, uv, vec3 } from 'three/tsl'
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
    { id: 'pulse', label: 'Pulse', defaultValue: 0.35, min: 0, max: 1, step: 0.01 },
  ],
  createScene: (scene, camera, getGenes) => {
    const hue = uniform(color('#77c8d8'))
    const pulse = uniform(0.35)
    const time = uniform(0)
    const material = createNodeMaterial(
      mix(hue, vec3(1, 0.74, 0.48), sin(uv().y.mul(8).add(time.mul(0.6))).mul(pulse)),
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
      const planetMaterial = createNodeMaterial(planetColor)
      const planet = new Mesh(new SphereGeometry(0.16 + index * 0.055, 24, 16), planetMaterial)
      const track = new Mesh(
        new TorusGeometry(radius, 0.008, 6, 128),
        createNodeMaterial(planetColor.mul(0.42)),
      )
      scene.add(orbit, track)
      orbit.add(planet)
      return { orbit, planet, planetColor, radius, speed: 0.3 + index * 0.12, phase: index * 2.1 }
    })

    return (frame) => {
      const genes = getGenes()
      hue.value.setHSL(genes.hue, 0.62, 0.62)
      pulse.value = genes.pulse
      time.value = frame.elapsedSeconds
      sphere.rotation.y = frame.elapsedSeconds * 0.18
      sphere.rotation.x = Math.sin(frame.elapsedSeconds * 0.12) * 0.1
      for (const { orbit, planet, planetColor, radius, speed, phase } of orbits) {
        const angle = frame.elapsedSeconds * speed + phase
        orbit.rotation.z = angle
        planet.position.set(radius, 0, Math.sin(angle) * 0.16)
        planetColor.value.setHSL((genes.hue + phase / 8) % 1, 0.68, 0.66)
      }
    }
  },
}
