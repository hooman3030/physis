import * as THREE from 'three/webgpu'
import type { Node } from 'three/webgpu'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js'
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js'
import { film } from 'three/addons/tsl/display/FilmNode.js'
import {
  color,
  convertToTexture,
  float,
  luminance,
  mix,
  pass,
  screenSize,
  smoothstep,
  sin,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import type { AuraId } from '../auras/types'
import { getAuraPreset } from '../auras/registry'
import type { ToneMappingId } from '../auras/toneMapping'

const toneMappingValues: Record<ToneMappingId, THREE.WebGPURenderer['toneMapping']> = {
  none: THREE.NoToneMapping,
  linear: THREE.LinearToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  cineon: THREE.CineonToneMapping,
  'aces-filmic': THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping,
}

function applySignalWarp(
  input: Node<'vec4'>,
  effect: NonNullable<ReturnType<typeof getAuraPreset>['effects']['signalWarp']>,
) {
  const phase = uv()
    .y.mul(screenSize.y)
    .div(effect.frequency)
    .mul(Math.PI * 2)
  const offset = sin(phase).mul(effect.amplitude).div(screenSize.x)
  return convertToTexture(input).sample(uv().add(vec2(offset, 0)))
}

function applyScanlines(
  input: Node<'vec4'>,
  effect: NonNullable<ReturnType<typeof getAuraPreset>['effects']['scanlines']>,
) {
  const line = sin(
    uv()
      .y.mul(screenSize.y)
      .div(effect.spacing)
      .mul(Math.PI * 2),
  )
    .mul(0.5)
    .add(0.5)
  const brightness = line.mul(-effect.strength).add(1)
  return vec4(input.rgb.mul(brightness), input.a)
}

function applyPixelation(input: Node, pixelSize: number) {
  const pixelUv = uv()
    .mul(screenSize)
    .div(pixelSize)
    .floor()
    .add(0.5)
    .mul(pixelSize)
    .div(screenSize)
  return convertToTexture(input).sample(pixelUv)
}

export function createThreeAuraPipeline(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
) {
  const renderPipeline = new THREE.RenderPipeline(renderer)
  const scenePass = pass(scene, camera)
  const sceneColor = scenePass.getTextureNode('output')
  const aspect = uniform(1)
  let bloomNode: ReturnType<typeof bloom> | null = null

  const setAura = (auraId: AuraId) => {
    bloomNode?.dispose()
    bloomNode = null

    const { effects } = getAuraPreset(auraId)
    if (auraId === 'off') {
      renderPipeline.outputNode = scenePass
    } else {
      let effectOutput: Node<'vec4'> = scenePass

      if (effects.bloom !== undefined) {
        const effect = effects.bloom
        bloomNode = bloom(sceneColor, effect.strength, effect.radius, effect.threshold)
        effectOutput = effectOutput.add(bloomNode)
      }

      if (effects.colorGrade !== undefined) {
        const effect = effects.colorGrade
        const saturation = mix(
          vec3(luminance(effectOutput.rgb)),
          effectOutput.rgb,
          effect.saturation,
        )
        const gradedColor = saturation
          .sub(0.5)
          .mul(effect.contrast)
          .add(0.5)
          .mul(color(effect.tint))
        effectOutput = vec4(gradedColor, effectOutput.a)
      }

      if (effects.vignette !== undefined) {
        const effect = effects.vignette
        const coordinates = uv().sub(vec2(0.5)).mul(vec2(aspect, 1))
        const edge = smoothstep(effect.radius * 0.6, effect.radius, coordinates.length())
        const brightness = edge.mul(-effect.strength).add(1)
        effectOutput = vec4(effectOutput.rgb.mul(brightness), effectOutput.a)
      }

      if (effects.signalWarp !== undefined) {
        effectOutput = applySignalWarp(effectOutput, effects.signalWarp)
      }

      if (effects.scanlines !== undefined) {
        effectOutput = applyScanlines(effectOutput, effects.scanlines)
      }

      let outputNode: Node = effectOutput
      if (effects.dotScreen !== undefined) {
        outputNode = dotScreen(outputNode, effects.dotScreen.angle, effects.dotScreen.scale)
      }

      if (effects.chromaticAberration !== undefined) {
        const effect = effects.chromaticAberration
        outputNode = chromaticAberration(
          outputNode,
          float(effect.strength),
          vec2(0.5),
          float(effect.scale),
        )
      }

      if (effects.filmGrain !== undefined) {
        outputNode = film(outputNode, float(effects.filmGrain.intensity))
      }

      if (effects.pixelation !== undefined) {
        outputNode = applyPixelation(outputNode, effects.pixelation.pixelSize)
      }

      renderPipeline.outputNode = outputNode
    }

    renderPipeline.needsUpdate = true
  }

  return {
    render: () => renderPipeline.render(),
    setAura,
    setToneMapping(toneMappingId: ToneMappingId) {
      renderer.toneMapping = toneMappingValues[toneMappingId]
    },
    setSize(width: number, height: number) {
      aspect.value = width / height
    },
    dispose() {
      bloomNode?.dispose()
      bloomNode = null
      renderPipeline.dispose()
    },
  }
}
