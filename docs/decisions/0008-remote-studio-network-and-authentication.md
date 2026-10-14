# ADR 0008: Remote studio network and authentication boundary

## Status

Accepted

## Context

The remote studio needs to control the installation from trusted devices while
the artwork remains available independently of the control service. The M2
control API is loopback-only; remote access is not enabled by this decision.

The presentation laptop is intended to be lightweight and locally operated.
The owner prefers wireless access from devices on the same trusted Wi-Fi, but
does not want extra interface or firewall complexity solely to exclude wired
devices. The owner also prefers to authorize a browser once rather than
re-enter credentials on every visit.

The prototype is not intended for public-internet access. Plain HTTP on a
private network does not protect credentials from a device able to observe
that network.

## Decision

- Remote access is limited to a trusted private network. Wi-Fi is the normal
  access path; private-network Ethernet clients are also allowed if rejecting
  them would require special interface or firewall configuration.
- Remote access must be explicitly enabled and bound only to a private
  interface/address. The host firewall should limit access to the trusted
  local network. Do not configure router port forwarding or expose the
  control API to the public internet. Keep the existing loopback-only mode
  available for local use.
- In remote mode, the Node service serves the built browser bundle and control
  API from the same origin. The presentation display and remote studio reuse
  this bundle; each browser renders artwork locally.
- When remote access is enabled, require one installation-wide bearer token
  for control and archive routes, including Presence events. Keep it in
  machine-local configuration outside source control and provide a way to
  replace it. Replacing the token revokes existing browser access and
  requires each browser to be paired again.
- Pairing is initiated by a remote browser requesting access. The installation
  display then shows a six-digit PIN for five minutes; a successful exchange
  consumes it and returns the installation token to that browser. Five
  incorrect PIN attempts invalidate the code and impose a one-minute lockout.
  The PIN is never returned to remote clients or written to logs.
- The installation display is identified by a connection originating from the
  bound host address. It can read the pending PIN and use the API without
  pairing. Remote pairing status exposes the PIN only to that local display.
- A paired browser stores the bearer token in `localStorage` and sends it in
  the `Authorization: Bearer` header; it must never appear in a URL. Use
  authenticated `fetch` streaming for Presence events because native
  `EventSource` cannot set an Authorization header.
- Keep Host and Origin checks as defense in depth; they do not replace token
  authentication. Store the bind address in a git-ignored `.env.local` file.
  Provider credentials remain on the laptop and are never sent to the
  dashboard.
- The baseline remote connection uses HTTP on the trusted private network.
  Anyone able to observe that network could capture and reuse a browser
  credential.
  Therefore, do not use guest, public, or otherwise untrusted Wi-Fi. If access
  across an untrusted network or from off-site is needed, require a private
  VPN or add transport encryption before enabling that use.
- The M2 loopback-only service remains unauthenticated for local development.
  In remote mode, only the local installation display and the pairing
  bootstrap/status routes bypass bearer-token authentication.

## Consequences

- A phone requests a PIN, reads it from the installation display, and enters
  it once. The browser credential survives refreshes and browser restarts
  until local storage is cleared or the installation token is rotated.
- Browser storage is accessible to same-origin JavaScript, so the dashboard
  must avoid unsafe script/content practices; this token does not protect
  against a dashboard cross-site scripting flaw.
- A single shared token is simple to provision, but does not identify
  individual users or devices. Rotation revokes every paired browser at once.
- The implementation must authenticate event streams without placing
  credentials in URLs, rate-limit PIN guesses, and keep remote access opt-in.
- An API or network interruption does not stop artwork already rendering in
  an open browser tab. A fresh page load still requires the Node service to
  serve the bundle.
- This boundary depends on a trusted private network and host firewall rather
  than providing confidentiality against other clients on that network.
- Authentication, firewall configuration, and remote binding are follow-up
  implementation work; this ADR does not enable network access.

## Alternatives considered

- **No authentication on a private network:** rejected because any reachable
  device could read or change the active Presence and archive.
- **Repeated login or short-lived browser sessions:** rejected for the
  prototype because it adds user friction without changing the trusted-network
  threat assumption.
- **Per-user accounts:** deferred because the installation has no user or
  identity service and does not need individual authorization yet.
- **HTTPS as a baseline requirement:** deferred because the initial deployment
  is restricted to a trusted private network. Use a VPN or add TLS if the
  network trust assumption changes.
