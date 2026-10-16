# Three.js Seeds

Three Seeds are small, renderer-independent scene descriptions mounted by the
Three adapter in `src/runtimes/three.ts`. Put each Seed in
`src/seeds/three/<seed-id>/seed.ts` and keep its runtime-specific types in
`src/seeds/three/types.ts`.

## Imports and renderer

Import the renderer and core scene objects from the WebGPU entry point:

```ts
import * as THREE from 'three/webgpu'
```

Create `THREE.WebGPURenderer`. It selects WebGPU when supported and otherwise
uses its WebGL 2 backend. Do not import or construct `WebGLRenderer` as another
fallback. Initialize the renderer before drawing, size it from the host
element, and dispose it when the Seed is unmounted.

Import camera controls from the addon entry point:

```ts
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
```

Update controls in the runtime render loop and dispose them with the renderer.
Set the camera and controls target explicitly so the origin remains the scene
focus. While playback is running, rely on the continuous render loop; control
change events should request frames only when playback is paused.

## TSL shading and Gene uniforms

Import shader nodes from the dedicated TSL entry point:

```ts
import { color, mix, uniform, uv } from 'three/tsl'
```

Use a node material such as `MeshBasicNodeMaterial` and assign TSL node
expressions to its node properties. Do not use `ShaderMaterial`, handwritten
GLSL/WGSL, or import TSL symbols from `three/webgpu`.

Declare each adjustable Gene in the Seed metadata and create a corresponding
TSL uniform with `uniform()`. Read the latest Gene values in the Seed update
function and assign them to each uniform's `.value`. This keeps changes in the
existing Gene controls live without rebuilding materials. Time-dependent
shading should use a TSL time uniform updated from `PlaybackFrame.elapsedSeconds`.

## GPU simulation and TSL rendering

Custom shading and GPU simulation passes use TSL node materials. Do not use
`ShaderMaterial`, handwritten GLSL/WGSL, or CPU pixel/particle simulation.
Use render-target passes when the Seed must also work with Three's WebGL 2
fallback. A Seed that requires WebGPU compute must set
`requiresWebGPUCompute: true`; the runtime checks the selected backend after
initialization and reports an application error rather than starting a blank
or unsupported Seed.

The `boids-three` Seed stores each boid's position and velocity in a `vec4`
storage buffer and uses two TSL compute passes that alternate input and output
buffers. Each invocation scans the bounded active population and independently
applies separation, alignment, and cohesion within their configured radii.
Steering is limited by the maximum-force Gene; speed is capped by the
maximum-speed Gene, and positions wrap around the simulation domain. The
deterministic initial state and every simulation step remain on the GPU after
resource setup. An instanced TSL material reads the active buffer to position
and orient the boids. The population is capped because pairwise neighbor
evaluation scales quadratically. Separation steers away from the closest
neighbor within a personal-space radius and takes priority over alignment and
cohesion while that spacing is threatened.

The Seed context provides the initialized `WebGPURenderer`, live viewport
dimensions, and a cleanup-registration function. Use it to size viewport
dependent work and release render targets or other resources not owned by the
main scene. Keep adjustable values in `uniform()` nodes and drive simulation
delta from the shared `PlaybackFrame`.

## Seed and playback contract

`ThreeSeed.createScene(scene, camera, getGenes, context)` builds the scene and
returns an update function. The Three runtime owns the renderer, resize
observation, animation frame loop, OrbitControls, playback clock, and disposal
of scene geometries and materials. Seeds can register cleanup for resources
outside the main scene, such as render targets. Seed updates receive a
`PlaybackFrame`; use its scaled elapsed or delta time for all animation. Do
not create a Seed-local pause state or speed multiplier.

Presence already supplies `paused` and `speed`. The shared clock eases pause
and resume and keeps the user-facing controls consistent across p5 and Three.
Changing either control must update the mounted runtime rather than remounting
the Seed.

## Aura post-processing

The Three runtime owns a TSL `RenderPipeline` that applies the active Aura
after the Seed scene pass. Aura presets are registered presentation settings,
not Genes: they can be reused across compatible Three Seeds without changing
the Seed's scene or parameters. A Three Seed may declare a default Aura;
otherwise it starts with Aura Off. Selecting an Imprint restores its captured
Aura, while legacy Imprints without one fall back to the Seed default or Off.
The presets combine bloom, color grading, vignette, film grain, chromatic
aberration, scanlines, signal warp, dot-screen, and pixelation. The runtime
keeps this pipeline inside the existing WebGPU/WebGL 2 renderer path and
disposes it when the Seed unmounts. p5 Seeds do not use Aura.

Tone mapping is configured separately from Aura and uses Three's registered
TSL output transforms: None, Linear, Reinhard, Cineon, ACES Filmic, AgX, or
Neutral. It is shared Presence state, defaults to None, updates the mounted
renderer without remounting the Seed, and is captured and restored with
Imprints. Legacy Imprints restore with None; non-Three Presences have no
tone-mapping selection.

### Future Aura customization

The longer-term direction is to let artists customize effects beyond choosing
a preset, with grouped and orderable effect controls as one possibility and a
node editor as another. This is an aspiration, not a settled implementation
decision; the current reusable presets remain the contract until that
interaction is designed.

The bundled `first-orbit` Seed is the small reference scene: its Gene controls
feed TSL uniforms, its central body is centered at the origin, and its planets
orbit using playback time.
