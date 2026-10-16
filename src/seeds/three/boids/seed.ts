import { PerspectiveCamera } from 'three/webgpu'
import { createBoidSimulation } from './simulation'
import type { ThreeSeed } from '../types'

export const boidsThreeSeed: ThreeSeed = {
  id: 'boids-three',
  label: 'Boids (Three.js)',
  runtime: 'three',
  requiresWebGPUCompute: true,
  genes: [
    { id: 'boidCount', label: 'Boid count', defaultValue: 128, min: 16, max: 8192, step: 16 },
    {
      id: 'separationRadius',
      label: 'Separation radius',
      defaultValue: 0.025,
      min: 0.005,
      max: 0.1,
      step: 0.005,
    },
    {
      id: 'alignmentRadius',
      label: 'Alignment radius',
      defaultValue: 0.14,
      min: 0.04,
      max: 0.3,
      step: 0.01,
    },
    {
      id: 'cohesionRadius',
      label: 'Cohesion radius',
      defaultValue: 0.2,
      min: 0.05,
      max: 0.4,
      step: 0.01,
    },
    {
      id: 'separationWeight',
      label: 'Separation',
      defaultValue: 1.2,
      min: 0,
      max: 3,
      step: 0.05,
    },
    {
      id: 'alignmentWeight',
      label: 'Alignment',
      defaultValue: 1,
      min: 0,
      max: 3,
      step: 0.05,
    },
    {
      id: 'cohesionWeight',
      label: 'Cohesion',
      defaultValue: 1.1,
      min: 0,
      max: 3,
      step: 0.05,
    },
    {
      id: 'maximumSpeed',
      label: 'Maximum speed',
      defaultValue: 0.18,
      min: 0.05,
      max: 0.5,
      step: 0.01,
    },
    {
      id: 'maxForce',
      label: 'Maximum steering force',
      defaultValue: 0.35,
      min: 0.05,
      max: 2,
      step: 0.05,
    },
    { id: 'boidSize', label: 'Boid size', defaultValue: 8, min: 3, max: 18, step: 1 },
    { id: 'hue', label: 'Hue', defaultValue: 190, min: 0, max: 360, step: 1 },
    { id: 'hueSpread', label: 'Hue spread', defaultValue: 35, min: 0, max: 180, step: 1 },
    { id: 'saturation', label: 'Saturation', defaultValue: 72, min: 0, max: 100, step: 1 },
    { id: 'brightness', label: 'Brightness', defaultValue: 85, min: 0, max: 100, step: 1 },
    { id: 'backgroundHue', label: 'Background hue', defaultValue: 220, min: 0, max: 360, step: 1 },
    {
      id: 'backgroundSaturation',
      label: 'Background saturation',
      defaultValue: 45,
      min: 0,
      max: 100,
      step: 1,
    },
    {
      id: 'backgroundBrightness',
      label: 'Background brightness',
      defaultValue: 7,
      min: 0,
      max: 25,
      step: 1,
    },
  ],
  createScene: (scene, camera, getGenes, context) => {
    if (!(camera instanceof PerspectiveCamera)) {
      throw new Error('Boids (Three.js) requires a perspective camera.')
    }

    const updateSimulation = createBoidSimulation(context, camera, scene)
    return (frame) => updateSimulation(frame, getGenes())
  },
}
