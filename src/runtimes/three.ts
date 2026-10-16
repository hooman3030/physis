import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { ArtworkGeneValues } from '../seeds/types'
import type { ThreeSeed } from '../seeds/three/types'
import { DEFAULT_PLAYBACK_SPEED, PlaybackClock, type PlaybackClockOptions } from '../playbackClock'
import { reportApplicationError } from '../errorNotifications'

export function mountThreeRuntime(
  container: HTMLDivElement,
  seed: ThreeSeed,
  getGenes: () => ArtworkGeneValues,
  onFpsChange?: (fps: number) => void,
  initialPlayback: PlaybackClockOptions = {},
) {
  const renderer = new THREE.WebGPURenderer({ antialias: true })
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const update = seed.createScene(scene, camera, getGenes)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0)
  controls.enableDamping = true
  const clock = new PlaybackClock({
    paused: initialPlayback.paused,
    speed: initialPlayback.speed ?? DEFAULT_PLAYBACK_SPEED,
  })
  let disposed = false
  let frameRequest = 0
  let previousSampleTime = performance.now()
  let frameCount = 0
  let currentPaused = initialPlayback.paused ?? false

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.append(renderer.domElement)

  const resize = () => {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()

  const render = (timestamp: number) => {
    frameRequest = 0
    if (disposed) return
    const playbackFrame = clock.advance()
    update(playbackFrame)
    controls.update()
    renderer.render(scene, camera)
    frameCount += 1
    if (timestamp - previousSampleTime >= 1000) {
      onFpsChange?.(Math.round((frameCount * 1000) / (timestamp - previousSampleTime)))
      previousSampleTime = timestamp
      frameCount = 0
    }
    if (!playbackFrame.paused || !currentPaused) frameRequest = requestAnimationFrame(render)
  }
  const scheduleRender = () => {
    if (!disposed && frameRequest === 0) frameRequest = requestAnimationFrame(render)
  }
  const renderOnControlChange = () => {
    if (currentPaused) scheduleRender()
  }
  controls.addEventListener('change', renderOnControlChange)

  void renderer
    .init()
    .then(() => {
      if (!disposed) frameRequest = requestAnimationFrame(render)
    })
    .catch((error: unknown) => {
      if (!disposed) reportApplicationError(`Could not initialize Three.js: ${String(error)}`)
    })

  return {
    setPaused(paused: boolean) {
      if (disposed || currentPaused === paused) return
      currentPaused = paused
      clock.setPaused(paused)
      if (!paused) scheduleRender()
    },
    setSpeed(speed: number) {
      if (!disposed) clock.setSpeed(speed)
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(frameRequest)
      resizeObserver.disconnect()
      controls.removeEventListener('change', renderOnControlChange)
      controls.dispose()
      renderer.dispose()
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry)
          const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
          meshMaterials.forEach((material) => materials.add(material))
        }
      })
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      scene.clear()
      renderer.domElement.remove()
    },
  }
}
