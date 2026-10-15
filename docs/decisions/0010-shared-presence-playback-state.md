# ADR 0010: Shared Presence playback state

## Status

Accepted

## Context

The artwork renders independently in each browser, while the local control
service is authoritative for the active Presence. Playback controls must
behave consistently on the installation display and paired remote-studio
clients. Pausing or changing speed must not reset or remount the artwork, and
the animation must continue to render from its last locally known state when
the control API is unavailable. Playback timing also needs a renderer-neutral
contract that can serve future Three.js and raw-shader runtimes.

## Decision

- Keep transient `paused` and `speed` values in the local control service's
  active Presence state. `speed` is a multiplier in the range 0.1×–4× and
  defaults to 1×. Return both values from Presence reads and publish them with
  Presence events so connected clients stay synchronized.
- Expose pause/resume and speed changes through the authenticated playback
  control API. Do not persist these values in the archive; the service starts
  unpaused at 1× after a restart.
- Selecting a Seed, Mutation, or Imprint starts its Presence unpaused at 1×.
- Pause and resume the existing browser runtime instance without remounting it
  or resetting its artwork state.
- Present shared playback controls on a dedicated bottom-triggered surface,
  separate from Seed and Gene controls. Integrate a round play/pause icon
  button at the bottom of a padded circular speed dial with a blurred surface
  background, and animate icon changes while respecting reduced-motion
  preferences. Keep pointer and keyboard access to the 0.1×–4× range;
  double-clicking the dial resets it to 1×.
- Provide a runtime-neutral playback clock with scaled elapsed and delta time.
  Runtime adapters advance the clock; renderer-specific code maps its values
  to animation steps or shader time uniforms. The current p5 Seed uses this
  clock, while future Three.js and raw-shader adapters can consume the same
  contract.
- Ease pause and resume using a 750 ms smoothstep ramp on the clock's effective
  playback rate. Keep rendering during the ramp down, then stop the p5 loop
  once the rate reaches zero; restart the loop at zero on resume.
- Scale frame-based artwork movement by playback delta time so speeds below
  1× slow movement as well as time-based noise, lifetime, and trail fade.
- Each browser advances its own clock from its local monotonic timer. The
  shared speed multiplier is synchronized; simulation phase is not.
- When the API is unavailable, clients retain their last received playback
  state and keep rendering accordingly. Playback controls cannot modify the
  shared state until the API is available again.

## Consequences

- The installation display and remote studios observe the same pause and speed
  values through the existing Presence snapshot/event mechanism.
- Pausing is a control-plane operation; an API interruption does not
  implicitly resume or reset the local artwork.
- Pause and speed are intentionally volatile and are not part of an Imprint or
  archive backup. A speed of 1× preserves normal-time behavior; pause remains
  an independent control rather than a speed of zero.

## Alternatives considered

- **Independent pause state in every browser:** rejected because remote
  controls would not describe the installation's shared Presence.
- **Persist playback controls in the archive:** rejected because they are
  transient playback controls rather than artwork Gene state or Imprint
  provenance.
- **Use renderer-specific timers or shader uniforms as the shared contract:**
  rejected because it would couple playback controls to one runtime and make
  consistent behavior across future adapters harder.
