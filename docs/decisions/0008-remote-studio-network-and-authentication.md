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
private network does not protect a bearer token from a device able to observe
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
- When remote access is enabled, require one installation-wide bearer token
  for every API route, including archive reads and Presence events. Generate
  the token with a cryptographically secure random generator, keep it in
  machine-local configuration outside source control, and provide a way to
  replace it. Replacing the token revokes existing browser access and
  requires each browser to be paired again.
- A user enters the token once per browser. The browser stores it in
  `localStorage` and sends it in the `Authorization: Bearer` header; it must
  never appear in a URL. Use authenticated `fetch` streaming for Presence
  events because native `EventSource` cannot set an Authorization header.
- Keep Host and Origin checks as defense in depth; they do not replace token
  authentication. Provider credentials remain on the laptop and are never
  sent to the dashboard.
- The baseline remote connection uses HTTP on the trusted private network.
  Anyone able to observe that network could capture and reuse the token.
  Therefore, do not use guest, public, or otherwise untrusted Wi-Fi. If access
  across an untrusted network or from off-site is needed, require a private
  VPN or add transport encryption before enabling that use.
- The M2 loopback-only service remains unauthenticated for local development.
  The remote-enabled M3 configuration must enforce authentication before
  accepting remote API requests.

## Consequences

- A browser needs a one-time token entry, after which authorization survives
  refreshes and browser restarts until its local storage is cleared or the
  installation token is rotated.
- Browser storage is accessible to same-origin JavaScript, so the dashboard
  must avoid unsafe script/content practices; this token does not protect
  against a dashboard cross-site scripting flaw.
- A single shared token is simple to provision, but does not identify
  individual users or devices. Rotation revokes every paired browser at once.
- The implementation must authenticate event streams without placing
  credentials in URLs and must keep remote access opt-in.
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
