# ADR 0011: Three.js WebGPU runtime and TSL shading

## Status

Accepted

## Context

Three.js is needed for 3D Seeds while existing p5 Seeds and the renderer-neutral
Presence playback controls must continue to work. The runtime should prefer
WebGPU without making supported artwork depend on WebGPU availability.

## Decision

- Add Three.js as a separate runtime adapter; do not replace the p5 runtime.
- Use `WebGPURenderer` from `three/webgpu`. Its WebGL 2 backend is the only
  fallback; do not create a separate `WebGLRenderer` path.
- Use TSL nodes imported from `three/tsl` for all custom shading. Do not use
  raw GLSL or `ShaderMaterial`.
- Bind adjustable Seed Genes to TSL `uniform()` nodes and update their values
  from the runtime's current Gene snapshot.
- Let Seeds access the renderer, live viewport dimensions, and a cleanup
  registry through `ThreeSeedContext`.
- Keep WebGL 2 fallback support as the default for Three Seeds. Seeds that
  require WebGPU compute declare `requiresWebGPUCompute`; the runtime checks
  the selected backend after initialization and reports an application error
  instead of starting an unsupported Seed.
- Use TSL compute passes with ping-pong storage buffers for Seeds that
  explicitly require WebGPU compute. Keep per-frame simulation and shading on
  the GPU, with CPU work limited to resource setup and initial state.
- Keep pairwise simulations population-bounded because neighbor evaluation
  scales quadratically.
- Use the existing Presence `paused` and `speed` state and `PlaybackClock`.
  Renderer adapters map scaled playback time to their own frame or uniform
  updates without remounting the artwork.
- Keep Three-specific Seed types beside Three Seed implementations and the
  renderer adapter in `src/runtimes/`.

## Consequences

- WebGPU is preferred, and most TSL materials can run through Three's WebGL 2
  fallback. Compute-only Seeds are explicitly unsupported on that fallback.
- Playback remains shared and renderer-neutral.
- GPU simulations that need WebGL 2 fallback support use render-target
  passes. The Boids Seed uses WebGPU compute and ping-pong storage buffers,
  with an explicit population bound for predictable quadratic cost.
- Three and TSL increase the browser bundle; splitting can be considered if
  measured startup or memory costs warrant it.

## Alternatives considered

- **Replace p5 with Three.js:** rejected because existing p5 Seeds should
  remain usable.
- **Use a separate `WebGLRenderer` fallback:** rejected in favor of the
  built-in backend selection in `WebGPURenderer`.
- **Use raw GLSL or `ShaderMaterial`:** rejected to keep shading portable
  across WebGPU and WebGL 2.
