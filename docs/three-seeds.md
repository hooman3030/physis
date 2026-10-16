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

## Seed and playback contract

`ThreeSeed.createScene(scene, camera, getGenes)` builds the scene and returns
an update function. The Three runtime owns the renderer, resize observation,
animation frame loop, OrbitControls, playback clock, and disposal of scene
geometries and materials. Seed updates
receive a `PlaybackFrame`; use its scaled elapsed or delta time for all
animation. Do not create a Seed-local pause state or speed multiplier.

Presence already supplies `paused` and `speed`. The shared clock eases pause
and resume and keeps the user-facing controls consistent across p5 and Three.
Changing either control must update the mounted runtime rather than remounting
the Seed.

The bundled `first-orbit` Seed is the small reference scene: its Gene controls
feed TSL uniforms, its central body is centered at the origin, and its planets
orbit using playback time.
