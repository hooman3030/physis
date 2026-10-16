import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { ArtworkGeneValues } from '../seeds/types'
import type { ThreeSeed, ThreeSeedContext } from '../seeds/three/types'
import type { AuraId } from '../auras/types'
import type { ToneMappingId } from '../auras/toneMapping'
import { DEFAULT_PLAYBACK_SPEED, PlaybackClock, type PlaybackClockOptions } from '../playbackClock'
import { reportApplicationError } from '../errorNotifications'
import { createThreeAuraPipeline } from './threeAuraPipeline'

export function mountThreeRuntime(
  container: HTMLDivElement,
  seed: ThreeSeed,
  getGenes: () => ArtworkGeneValues,
  onFpsChange?: (fps: number) => void,
  initialPlayback: PlaybackClockOptions = {},
  initialAuraId: AuraId | null = null,
  initialToneMappingId: ToneMappingId | null = null,
) {
  const renderer = new THREE.WebGPURenderer({ antialias: true })
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  let viewportWidth = Math.max(1, container.clientWidth)
  let viewportHeight = Math.max(1, container.clientHeight)
  let pointer: { x: number; y: number; pressed: boolean } | null = null
  const seedCleanupHandlers: Array<() => void> = []
  const seedContext: ThreeSeedContext = {
    renderer,
    getViewportSize: () => ({ width: viewportWidth, height: viewportHeight }),
    getPointer: () => pointer,
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
  const auraPipeline = createThreeAuraPipeline(renderer, scene, camera)
  auraPipeline.setAura(initialAuraId ?? 'off')
  auraPipeline.setToneMapping(initialToneMappingId ?? 'none')

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.append(renderer.domElement)

  const resize = () => {
    viewportWidth = Math.max(1, container.clientWidth)
    viewportHeight = Math.max(1, container.clientHeight)
    renderer.setSize(viewportWidth, viewportHeight)
    auraPipeline.setSize(viewportWidth, viewportHeight)
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
    auraPipeline.render()
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

  const trackPointer = (event: PointerEvent) => {
    const bounds = renderer.domElement.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return
    pointer = {
      x: (event.clientX - bounds.left) / bounds.width,
      y: 1 - (event.clientY - bounds.top) / bounds.height,
      pressed: event.buttons > 0,
    }
  }
  const clearPointer = () => {
    pointer = null
  }
  renderer.domElement.addEventListener('pointermove', trackPointer)
  renderer.domElement.addEventListener('pointerdown', trackPointer)
  renderer.domElement.addEventListener('pointerleave', clearPointer)
  const releaseTouchPointer = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') trackPointer(event)
    else clearPointer()
  }
  renderer.domElement.addEventListener('pointerup', releaseTouchPointer)

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
    setAura(auraId: AuraId) {
      if (disposed) return
      auraPipeline.setAura(auraId)
      if (currentPaused) scheduleRender()
    },
    setToneMapping(toneMappingId: ToneMappingId) {
      if (disposed) return
      auraPipeline.setToneMapping(toneMappingId)
      if (currentPaused) scheduleRender()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(frameRequest)
      resizeObserver.disconnect()
      controls.removeEventListener('change', renderOnControlChange)
      renderer.domElement.removeEventListener('pointermove', trackPointer)
      renderer.domElement.removeEventListener('pointerdown', trackPointer)
      renderer.domElement.removeEventListener('pointerleave', clearPointer)
      renderer.domElement.removeEventListener('pointerup', releaseTouchPointer)
      controls.dispose()
      for (const cleanup of seedCleanupHandlers.reverse()) cleanup()
      auraPipeline.dispose()
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
