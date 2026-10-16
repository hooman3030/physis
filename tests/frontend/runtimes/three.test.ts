import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountThreeRuntime } from '../../../src/runtimes/three'
import type { ThreeSeed } from '../../../src/seeds/three/types'

const controlsState = vi.hoisted(() => ({
  changeListener: undefined as (() => void) | undefined,
}))

vi.mock('three/webgpu', () => ({
  WebGPURenderer: class MockRenderer {
    domElement = { remove: vi.fn() } as HTMLCanvasElement
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
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Three runtime rendering', () => {
  it('keeps a single animation frame loop while controls change during playback', async () => {
    let nextFrameId = 0
    const pendingFrames = new Map<number, FrameRequestCallback>()
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
        observe() {}
        disconnect() {}
      },
    )

    const seed: ThreeSeed = {
      id: 'test-three-seed',
      label: 'Test Three Seed',
      runtime: 'three',
      genes: [],
      createScene: () => () => {},
    }
    const container = {
      clientWidth: 800,
      clientHeight: 600,
      append: vi.fn(),
    } as HTMLDivElement
    const runtime = mountThreeRuntime(container, seed, () => ({}))
    await Promise.resolve()

    expect(pendingFrames.size).toBe(1)
    const frame = [...pendingFrames.values()][0]
    pendingFrames.clear()
    frame?.(16)

    expect(pendingFrames.size).toBe(1)

    runtime.dispose()
    expect(pendingFrames.size).toBe(0)
  })
})
