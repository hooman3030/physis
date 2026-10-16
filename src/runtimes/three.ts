import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { ArtworkGeneValues } from '../seeds/types'
import type { ThreeSeed, ThreeSeedContext } from '../seeds/three/types'
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
  let viewportWidth = Math.max(1, container.clientWidth)
  let viewportHeight = Math.max(1, container.clientHeight)
  const seedCleanupHandlers: Array<() => void> = []
  const seedContext: ThreeSeedContext = {
    renderer,
    getViewportSize: () => ({ width: viewportWidth, height: viewportHeight }),
    registerCleanup: (cleanup) => seedCleanupHandlers.push(cleanup),
  }
  const update = seed.createScene(scene, camera, getGenes, seedContext)
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
    viewportWidth = Math.max(1, container.clientWidth)
    viewportHeight = Math.max(1, container.clientHeight)
    renderer.setSize(viewportWidth, viewportHeight)
    camera.aspect = viewportWidth / viewportHeight
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
      if (disposed) return
      if (
        seed.requiresWebGPUCompute &&
        !('isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend === true)
      ) {
        reportApplicationError(
          `${seed.label} requires WebGPU compute; the WebGL 2 fallback cannot run this Seed.`,
        )
        return
      }
      frameRequest = requestAnimationFrame(render)
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
      for (const cleanup of seedCleanupHandlers.reverse()) cleanup()
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
