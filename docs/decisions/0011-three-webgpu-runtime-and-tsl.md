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
- Use the existing Presence `paused` and `speed` state and `PlaybackClock`.
  Renderer adapters map scaled playback time to their own frame or uniform
  updates without remounting the artwork.
- Keep Three-specific Seed types beside Three Seed implementations and the
  renderer adapter in `src/runtimes/`.

## Consequences

- WebGPU is preferred while the same TSL materials can run through Three's
  WebGL 2 fallback.
- Playback remains shared and renderer-neutral.
- Three and TSL increase the browser bundle; splitting can be considered if
  measured startup or memory costs warrant it.

## Alternatives considered

- **Replace p5 with Three.js:** rejected because existing p5 Seeds should
  remain usable.
- **Use a separate `WebGLRenderer` fallback:** rejected in favor of the
  built-in backend selection in `WebGPURenderer`.
- **Use raw GLSL or `ShaderMaterial`:** rejected to keep shading portable
  across WebGPU and WebGL 2.
