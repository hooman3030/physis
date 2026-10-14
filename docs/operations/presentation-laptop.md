# Presentation laptop operations

## Intended operating mode

The old laptop is intended to become a dedicated display running Linux. At
runtime it should eventually start the artwork and open it in a fullscreen
browser, while keeping a lightweight local control API available to trusted
devices.

In remote mode, the Node service serves the built presentation bundle and
control API from one private-network origin. The fullscreen display and
remote devices use the same responsive browser app; artwork continues
rendering in already-open tabs if the API or network becomes unavailable.

This document records the operational context, not an installation procedure.
The exact Linux setup remains a prerequisite task.

## Current hardware and boot context

The laptop is an Acer Switch Alpha 12 with the hardware recorded in
`docs/development-environment.md`. Previous notes report:

- Windows was removed and the machine currently shows “No bootable device”
  without installation media.
- A Linux Mint USB was previously reached through Windows Recovery's device
  selection route.
- Normal boot selection and the UEFI setup are affected by a forgotten
  firmware password.
- A balenaEtcher error occurred while opening a Linux Mint ISO, so image
  creation should be verified rather than ignored.

These observations are historical troubleshooting notes, not confirmed
resolution steps.

## Operational requirements

When implementation starts, the installation should eventually provide:

- automatic startup after boot;
- fullscreen/kiosk display mode;
- recovery to the last stable artwork after a process failure;
- local persistence for Seeds, Mutations, and Imprints;
- an opt-in control surface on the trusted private network (Wi-Fi preferred;
  wired clients allowed if excluding them adds operational complexity);
- a way to pause evolution before maintenance;
- visible logs or diagnostics for failures.

The remote control API must require a persistent installation token, remain
behind the host firewall, and never be exposed directly to the public
internet. Do not use guest, public, or untrusted Wi-Fi because the baseline
HTTP connection does not encrypt the token. If off-site access becomes
necessary, use a private VPN or add transport encryption first. See
[ADR 0008](../decisions/0008-remote-studio-network-and-authentication.md).

When a phone requests access, show a short-lived pairing PIN on the
installation display and enter it on the phone. The browser remembers its
credential; the installation secret itself stays on the laptop.

## Safety notes

Any future operating-system or boot-media work must verify the selected disk
before writing or erasing it. Firmware-password recovery should use a
legitimate model-specific procedure or service; random bypass instructions are
not part of this project setup.
