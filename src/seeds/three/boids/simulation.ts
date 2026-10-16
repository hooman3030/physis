import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  Vector4,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  Scene,
} from 'three/webgpu'
import {
  Fn,
  If,
  Loop,
  color,
  cos,
  exp,
  float,
  floor,
  fract,
  instanceIndex,
  instancedArray,
  int,
  mix,
  positionLocal,
  select,
  sin,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import type { PlaybackFrame } from '../../../playbackClock'
import type { ArtworkGeneValues } from '../../types'
import type { ThreeSeedContext } from '../types'
import type StorageBufferNode from 'three/src/nodes/accessors/StorageBufferNode.js'
import type UniformNode from 'three/src/nodes/core/UniformNode.js'

export const MAX_BOID_COUNT = 8192
const CLICK_BOOST = 3
// Speeds up to this share of the maximum are untouched; above it they taper exponentially.
const SPEED_TAPER_START = 0.6
const MINIMUM_SPEED = 0.04
const SEPARATION_STRENGTH_MULTIPLIER = 2.5
const SEPARATION_DISTANCE_MULTIPLIER = 1.5
const SEPARATION_PRIORITY_RADIUS_MULTIPLIER = 2
const BOID_TRIANGLE = [0.9, 0, 0, -0.65, 0.52, 0, -0.65, -0.52, 0]

function random01(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
  return value - Math.floor(value)
}

function createInitialState(aspect: number): Float32Array {
  const state = new Float32Array(MAX_BOID_COUNT * 4)
  for (let index = 0; index < MAX_BOID_COUNT; index += 1) {
    const offset = index * 4
    const angle = random01(index, 1) * Math.PI * 2
    const speed = 0.08 + random01(index, 2) * 0.04
    state[offset] = random01(index, 3) * aspect
    state[offset + 1] = random01(index, 4)
    state[offset + 2] = Math.cos(angle) * speed
    state[offset + 3] = Math.sin(angle) * speed
  }
  return state
}

function createBoidGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(BOID_TRIANGLE), 3))
  return geometry
}

function createUpdatePass(
  input: StorageBufferNode<'vec4'>,
  output: StorageBufferNode<'vec4'>,
  count: UniformNode<'int', number>,
  bounds: UniformNode<'vec2', import('three/webgpu').Vector2>,
  separationRadius: UniformNode<'float', number>,
  alignmentRadius: UniformNode<'float', number>,
  cohesionRadius: UniformNode<'float', number>,
  separationWeight: UniformNode<'float', number>,
  alignmentWeight: UniformNode<'float', number>,
  cohesionWeight: UniformNode<'float', number>,
  maximumSpeed: UniformNode<'float', number>,
  maximumForce: UniformNode<'float', number>,
  deltaSeconds: UniformNode<'float', number>,
  cursor: UniformNode<'vec4', import('three/webgpu').Vector4>,
  burst: UniformNode<'float', number>,
) {
  return Fn(() => {
    const index = instanceIndex
    const state = input.element(index)
    const position = state.xy
    const velocity = state.zw
    const nearestSeparation = vec2(0).toVar()
    const nearestSeparationDistance = float(1e6).toVar()
    const alignmentSum = vec2(0).toVar()
    const alignmentCount = float(0).toVar()
    const cohesionSum = vec2(0).toVar()
    const cohesionCount = float(0).toVar()

    Loop({ start: int(0), end: count, type: 'int', condition: '<' }, ({ i }) => {
      If(i.lessThan(count), () => {
        If(i.notEqual(index), () => {
          const other = input.element(i)
          const difference = position.sub(other.xy)
          const wrappedDifference = vec2(
            difference.x.sub(floor(difference.x.div(bounds.x).add(0.5)).mul(bounds.x)),
            difference.y.sub(floor(difference.y.add(0.5))),
          )
          const distance = wrappedDifference.length()

          If(distance.lessThan(separationRadius.mul(SEPARATION_DISTANCE_MULTIPLIER)), () => {
            If(distance.lessThan(nearestSeparationDistance), () => {
              nearestSeparation.assign(wrappedDifference)
              nearestSeparationDistance.assign(distance)
            })
          })

          If(distance.lessThan(alignmentRadius), () => {
            alignmentSum.addAssign(other.zw)
            alignmentCount.addAssign(1)
          })

          If(distance.lessThan(cohesionRadius), () => {
            cohesionSum.addAssign(wrappedDifference.mul(-1))
            cohesionCount.addAssign(1)
          })
        })
      })
    })

    const separationSteering = vec2(0).toVar()
    const socialSteering = vec2(0).toVar()
    const separationDistance = separationRadius.mul(SEPARATION_DISTANCE_MULTIPLIER)
    const separationPriorityRadius = separationRadius.mul(SEPARATION_PRIORITY_RADIUS_MULTIPLIER)
    const separationPressure = float(1)
      .sub(
        nearestSeparationDistance
          .sub(separationDistance)
          .div(separationPriorityRadius.sub(separationDistance)),
      )
      .max(0)
      .min(1)
    If(
      nearestSeparationDistance.lessThan(separationRadius.mul(SEPARATION_DISTANCE_MULTIPLIER)),
      () => {
        const fallbackAngle = float(index).mul(12.9898)
        const fallback = vec2(sin(fallbackAngle), cos(fallbackAngle))
        const separationDirection = select(
          nearestSeparationDistance.greaterThan(0.0001),
          nearestSeparation.div(nearestSeparationDistance.max(0.0001)),
          fallback,
        )
        const desiredVelocity = separationDirection.mul(maximumSpeed).sub(velocity)
        separationSteering.addAssign(
          desiredVelocity.mul(separationWeight.mul(SEPARATION_STRENGTH_MULTIPLIER)),
        )
      },
    )

    If(alignmentCount.greaterThan(0), () => {
      const averageVelocity = alignmentSum.div(alignmentCount)
      If(averageVelocity.length().greaterThan(0.0001), () => {
        const desiredVelocity = averageVelocity
          .div(averageVelocity.length())
          .mul(maximumSpeed)
          .sub(velocity)
        socialSteering.addAssign(desiredVelocity.mul(alignmentWeight))
      })
    })

    If(cohesionCount.greaterThan(0), () => {
      const averageOffset = cohesionSum.div(cohesionCount)
      If(averageOffset.length().greaterThan(0.0001), () => {
        const desiredVelocity = averageOffset
          .div(averageOffset.length())
          .mul(maximumSpeed)
          .sub(velocity)
        socialSteering.addAssign(desiredVelocity.mul(cohesionWeight))
      })
    })

    // cursor = (x, y, radius, strength); positive attracts, negative repels, 0 is off or no pointer.
    // Its force bypasses the steering-force limit, and a held click (burst = 1) lifts the speed
    // ceiling for boids in reach so the push reads as an explosion.
    const cursorSteering = vec2(0).toVar()
    const speedCeiling = maximumSpeed.toVar()
    const cursorOffset = cursor.xy.sub(position)
    const cursorDistance = cursorOffset.length()
    If(cursor.w.notEqual(0).and(cursorDistance.lessThan(cursor.z)), () => {
      const falloff = float(1).sub(cursorDistance.div(cursor.z))
      speedCeiling.assign(maximumSpeed.mul(float(1).add(burst.mul(falloff).mul(CLICK_BOOST - 1))))
      const desiredVelocity = cursorOffset
        .div(cursorDistance.max(0.0001))
        .mul(select(cursor.w.greaterThan(0), float(1), float(-1)))
        .mul(speedCeiling)
        .sub(velocity)
      cursorSteering.assign(desiredVelocity.mul(cursor.w.abs().mul(falloff)))
    })

    const steering = separationSteering.add(socialSteering.mul(float(1).sub(separationPressure)))
    const limitedSteering = steering.mul(maximumForce.div(steering.length().max(maximumForce)))
    const candidateVelocity = velocity.add(limitedSteering.add(cursorSteering).mul(deltaSeconds))
    const candidateSpeed = candidateVelocity.length()
    const fallbackAngle = float(index).mul(12.9898)
    const fallbackDirection = vec2(sin(fallbackAngle), cos(fallbackAngle))
    const direction = select(
      candidateSpeed.greaterThan(0.0001),
      candidateVelocity.div(candidateSpeed.max(0.0001)),
      fallbackDirection,
    )
    const taperStart = speedCeiling.mul(SPEED_TAPER_START)
    const taperRange = speedCeiling.sub(taperStart)
    const unclampedSpeed = candidateSpeed.max(MINIMUM_SPEED)
    const speed = select(
      unclampedSpeed.greaterThan(taperStart),
      taperStart.add(
        taperRange.mul(float(1).sub(exp(unclampedSpeed.sub(taperStart).div(taperRange).negate()))),
      ),
      unclampedSpeed,
    )
    const nextVelocity = direction.mul(speed)
    const nextPosition = position.add(nextVelocity.mul(deltaSeconds))
    const wrappedPosition = vec2(
      fract(nextPosition.x.div(bounds.x)).mul(bounds.x),
      fract(nextPosition.y),
    )
    const nextState = vec4(wrappedPosition, nextVelocity)

    If(index.lessThan(count), () => {
      output.element(index).assign(nextState)
    }).Else(() => {
      output.element(index).assign(state)
    })
  })().compute(MAX_BOID_COUNT)
}

export function createBoidSimulation(
  context: ThreeSeedContext,
  camera: PerspectiveCamera,
  scene: Scene,
): (frame: PlaybackFrame, genes: ArtworkGeneValues) => void {
  const initialState = createInitialState(camera.aspect)
  const stateA = instancedArray(initialState, 'vec4')
  const stateB = instancedArray(new Float32Array(initialState), 'vec4')
  const count = uniform(128, 'int')
  const bounds = uniform(vec2(camera.aspect, 1))
  const separationRadius = uniform(0.025)
  const alignmentRadius = uniform(0.14)
  const cohesionRadius = uniform(0.2)
  const separationWeight = uniform(1.2)
  const alignmentWeight = uniform(1)
  const cohesionWeight = uniform(1.1)
  const maximumSpeed = uniform(0.18)
  const maximumForce = uniform(0.35)
  const deltaSeconds = uniform(0)
  const cursor = uniform(new Vector4(0, 0, 0.3, 0))
  const burst = uniform(0)
  const viewHeight = uniform(2 * Math.tan((camera.fov * Math.PI) / 360))
  const size = uniform(8)
  const viewportSize = uniform(vec2(1, 1))
  const activeStateIsA = uniform(1)
  const updateAtoB = createUpdatePass(
    stateA,
    stateB,
    count,
    bounds,
    separationRadius,
    alignmentRadius,
    cohesionRadius,
    separationWeight,
    alignmentWeight,
    cohesionWeight,
    maximumSpeed,
    maximumForce,
    deltaSeconds,
    cursor,
    burst,
  )
  const updateBtoA = createUpdatePass(
    stateB,
    stateA,
    count,
    bounds,
    separationRadius,
    alignmentRadius,
    cohesionRadius,
    separationWeight,
    alignmentWeight,
    cohesionWeight,
    maximumSpeed,
    maximumForce,
    deltaSeconds,
    cursor,
    burst,
  )

  const index = instanceIndex
  const stateFromA = stateA.element(index)
  const stateFromB = stateB.element(index)
  const currentState = select(activeStateIsA.greaterThan(0.5), stateFromA, stateFromB)
  const velocity = currentState.zw
  const direction = velocity.div(velocity.length().max(0.0001))
  const pixelScale = size.mul(viewHeight).div(viewportSize.y)
  const localShape = positionLocal.xy.mul(pixelScale)
  const orientedShape = vec2(
    localShape.x.mul(direction.x).sub(localShape.y.mul(direction.y)),
    localShape.x.mul(direction.y).add(localShape.y.mul(direction.x)),
  )
  const position = vec3(
    currentState.x.sub(bounds.x.mul(0.5)).mul(viewHeight).add(orientedShape.x),
    currentState.y.sub(0.5).mul(viewHeight).add(orientedShape.y),
    float(0),
  )
  const colorPrimary = uniform(color('#71c7ec'))
  const colorAccent = uniform(color('#f4a261'))
  const colorMix = fract(float(instanceIndex).mul(0.618))
  const material = new MeshBasicNodeMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
  Object.assign(material, {
    positionNode: position,
    colorNode: mix(colorPrimary, colorAccent, colorMix),
  })
  const boids = new InstancedMesh(createBoidGeometry(), material, MAX_BOID_COUNT)
  boids.count = 128
  boids.frustumCulled = false
  boids.position.z = -1
  camera.position.set(0, 0, 1)
  camera.lookAt(0, 0, 0)
  camera.add(boids)
  scene.add(camera)

  const backgroundColor = uniform(color('#101820'))
  let stateIsA = true
  let disposed = false
  let seededAspect: number | null = null

  const update = (frame: PlaybackFrame, genes: ArtworkGeneValues): void => {
    if (disposed) return
    const renderer = context.renderer

    const viewport = context.getViewportSize()
    const aspect = camera.aspect
    // The camera aspect is only final after the runtime's first resize, so seed positions here.
    if (seededAspect === null) {
      seededAspect = aspect
      for (const buffer of [stateA.value, stateB.value]) {
        buffer.array.set(createInitialState(aspect))
        buffer.needsUpdate = true
      }
    }
    count.value = genes.boidCount
    bounds.value.set(aspect, 1)
    separationRadius.value = genes.separationRadius
    alignmentRadius.value = genes.alignmentRadius
    cohesionRadius.value = genes.cohesionRadius
    separationWeight.value = genes.separationWeight
    alignmentWeight.value = genes.alignmentWeight
    cohesionWeight.value = genes.cohesionWeight
    maximumSpeed.value = genes.maximumSpeed
    maximumForce.value = genes.maxForce
    deltaSeconds.value = Math.min(frame.deltaSeconds, 0.05)
    const pointer = context.getPointer()
    cursor.value.set(
      (pointer?.x ?? 0) * aspect,
      pointer?.y ?? 0,
      genes.cursorRadius,
      pointer === null ? 0 : genes.cursorAttraction * (pointer.pressed ? CLICK_BOOST : 1),
    )
    burst.value = pointer?.pressed === true ? 1 : 0
    viewHeight.value = 2 * Math.tan((camera.fov * Math.PI) / 360)
    size.value = genes.boidSize
    viewportSize.value.set(viewport.width, viewport.height)
    colorPrimary.value.setHSL(genes.hue / 360, genes.saturation / 100, genes.brightness / 100)
    colorAccent.value.setHSL(
      ((genes.hue + genes.hueSpread) % 360) / 360,
      genes.saturation / 100,
      genes.brightness / 100,
    )
    backgroundColor.value.setHSL(
      genes.backgroundHue / 360,
      genes.backgroundSaturation / 100,
      genes.backgroundBrightness / 100,
    )
    scene.background = backgroundColor.value

    renderer.compute(stateIsA ? updateAtoB : updateBtoA, genes.boidCount)
    stateIsA = !stateIsA
    activeStateIsA.value = stateIsA ? 1 : 0
    boids.count = genes.boidCount
  }

  context.registerCleanup(() => {
    disposed = true
    stateA.value.dispose()
    stateB.value.dispose()
    boids.geometry.dispose()
    boids.material.dispose()
    camera.remove(boids)
  })

  return update
}
