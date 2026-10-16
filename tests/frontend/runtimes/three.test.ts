import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportApplicationError } from '../../../src/errorNotifications'
import { mountThreeRuntime } from '../../../src/runtimes/three'
import type { ThreeSeed, ThreeSeedContext } from '../../../src/seeds/three/types'

const controlsState = vi.hoisted(() => ({
  changeListener: undefined as (() => void) | undefined,
}))
const rendererState = vi.hoisted(() => ({ isWebGPUBackend: true }))

vi.mock('../../../src/errorNotifications', () => ({
  reportApplicationError: vi.fn(),
}))

vi.mock('three/webgpu', () => ({
  WebGPURenderer: class MockRenderer {
    domElement = { remove: vi.fn() } as HTMLCanvasElement
    backend = {
      get isWebGPUBackend() {
        return rendererState.isWebGPUBackend
      },
    }
    init = vi.fn().mockResolvedValue(undefined)
    render = vi.fn()
    setPixelRatio = vi.fn()
    setSize = vi.fn()
    dispose = vi.fn()
  },
  Scene: class MockScene {
    traverse() {}
    clear() {}
  },
  PerspectiveCamera: class MockCamera {
    aspect = 1
    position = { set: vi.fn() }
    updateProjectionMatrix = vi.fn()
  },
  Mesh: class MockMesh {},
}))

vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: class MockOrbitControls {
    target = { set: vi.fn() }
    enableDamping = false

    addEventListener(_event: string, listener: () => void) {
      controlsState.changeListener = listener
    }

    removeEventListener() {}

    update() {
      controlsState.changeListener?.()
    }

    dispose() {}
  },
}))

afterEach(() => {
  controlsState.changeListener = undefined
  rendererState.isWebGPUBackend = true
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Three runtime rendering', () => {
  it('keeps one frame loop and exposes renderer, viewport, and cleanup context', async () => {
    let nextFrameId = 0
    const pendingFrames = new Map<number, FrameRequestCallback>()
    let resizeObserverCallback: ResizeObserverCallback | undefined
    let containerWidth = 800
    let containerHeight = 600
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++nextFrameId
      pendingFrames.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => pendingFrames.delete(id))
    vi.stubGlobal('window', { devicePixelRatio: 1 })
    vi.stubGlobal(
      'ResizeObserver',
      class MockResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resizeObserverCallback = callback
        }

        observe() {}
        disconnect() {}
      },
    )

    let seedContext: ThreeSeedContext | undefined
    const seed: ThreeSeed = {
      id: 'test-three-seed',
      label: 'Test Three Seed',
      runtime: 'three',
      genes: [],
      createScene: (_scene, _camera, _getGenes, context) => {
        seedContext = context
        return () => {}
      },
    }
    const container = {
      get clientWidth() {
        return containerWidth
      },
      get clientHeight() {
        return containerHeight
      },
      append: vi.fn(),
    } as HTMLDivElement
    const runtime = mountThreeRuntime(container, seed, () => ({}))
    await Promise.resolve()

    expect(seedContext?.getViewportSize()).toEqual({ width: 800, height: 600 })
    const cleanup = vi.fn()
    seedContext?.registerCleanup(cleanup)

    expect(pendingFrames.size).toBe(1)
    const frame = [...pendingFrames.values()][0]
    pendingFrames.clear()
    frame?.(16)

    expect(pendingFrames.size).toBe(1)

    containerWidth = 1024
    containerHeight = 768
    resizeObserverCallback?.([], {} as ResizeObserver)
    expect(seedContext?.getViewportSize()).toEqual({ width: 1024, height: 768 })

    runtime.dispose()
    expect(pendingFrames.size).toBe(0)
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('reports when a compute-only Seed resolves to the WebGL 2 fallback', async () => {
    rendererState.isWebGPUBackend = false
    const requestFrame = vi.fn(() => 1)
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('window', { devicePixelRatio: 1 })
    vi.stubGlobal(
      'ResizeObserver',
      class MockResizeObserver {
        constructor(_callback: ResizeObserverCallback) {}
        observe() {}
        disconnect() {}
      },
    )

    const seed: ThreeSeed = {
      id: 'compute-only-seed',
      label: 'Compute-only Seed',
      runtime: 'three',
      requiresWebGPUCompute: true,
      genes: [],
      createScene: () => () => {},
    }
    const container = {
      clientWidth: 800,
      clientHeight: 600,
      append: vi.fn(),
    } as unknown as HTMLDivElement
    const runtime = mountThreeRuntime(container, seed, () => ({}))
    await Promise.resolve()

    expect(reportApplicationError).toHaveBeenCalledWith(
      'Compute-only Seed requires WebGPU compute; the WebGL 2 fallback cannot run this Seed.',
    )
    expect(requestFrame).not.toHaveBeenCalled()
    runtime.dispose()
  })
})
