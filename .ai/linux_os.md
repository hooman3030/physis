Loading older messages…
only f2 gets me into bios menu. but is locked by passsword. im the only owner but cannot remember nor want to deal with acer service.

if i try booting normally, acer logo stays, then small text top left says: failed to open uefi/boot ... - not found and other small texts

Worked for 12s
The error is a useful clue. Your Switch Alpha 12 appears to be reaching its UEFI firmware, but it cannot find a bootable operating system. That's consistent with Windows having been erased.

The BIOS password is a separate problem: we need a way to select the USB installer without changing password-protected settings. Since you own the device and don't want to deal with Acer service, let's try the options that don't require clearing or bypassing the firmware password.

Try this first: use the UEFI hardware-button shortcut
On the Switch Alpha 12, try the following with the tablet fully powered off:

Connect the Mint USB using your adapter.

Attach the keyboard.

Hold Volume Up (+).

Press and release Power while continuing to hold Volume Up.

Check whether a boot menu or UEFI screen appears.

If you get the same password-locked BIOS, don't spend time repeating this method. It won't unlock the firmware.

Step 2 — Give the USB one proper chance
The Switch Alpha 12 has a documented quirk: F12 boot selection may be disabled in BIOS, and USB boot configuration may need to be enabled manually.

lug-kr.de
+1

With the USB inserted before powering on, try F12 again. If it still goes straight to the error, don't keep repeating it.

You can also recreate the USB using Rufus on your MacBook or another computer, if available, but keep it in standard UEFI mode for now. Changing the USB format won't solve a firmware setting that prevents USB boot.

Step 3 — The honest limitation
If the USB won't boot and the BIOS remains password-locked, there may be no practical software-only route to install Mint. The remaining options are a legitimate firmware-password recovery/reset procedure for this exact model, or hardware service. I don't want to send you down a rabbit hole of random password-reset tricks that may not work on this tablet.

Before deciding, tell me one thing:

When you insert the Mint USB and power on, does the error text change at all, or is it exactly the same as when the USB is disconnected?

That will help distinguish a USB detection problem from the firmware simply ignoring external boot devices.

volume up does nothing. step 2 as well. I once was in the usb mint, but needed to reboot as mint installation wasnt succeeding
That changes the diagnosis. Since you successfully booted into the Mint USB once, we know the Switch Alpha 12 can boot the installer under at least some conditions. The current problem may be boot selection or USB detection, rather than an absolute hardware limitation.

Don't erase or rewrite anything else yet. Let's focus on reproducing the boot that worked before.

Try these recovery steps
Shut the tablet down completely by holding Power for about 10–15 seconds.

Disconnect the USB, then reconnect it directly through the adapter you used when Mint booted successfully.

Attach the keyboard and power the tablet on while repeatedly tapping F12.

If it fails again, shut down and try the same USB port and adapter you used previously. Avoid changing multiple variables at once.

The likely issue: the installation USB or UEFI boot entry
The Switch Alpha 12 has a documented Linux quirk: some configurations require changes to Secure Boot and trusted EFI boot files before Linux will start reliably.

ArchWiki
+1

Because you cannot access the BIOS settings without the password, I'd try one low-risk test before anything more complicated.

Test whether the USB still boots on another computer
If you can, boot the Mint USB on your MacBook is not a useful test on newer Apple Silicon Macs, so ideally use another ordinary PC. Confirm that the USB reaches the Mint live desktop.

If it works: the installer USB is probably fine, and the Acer's firmware settings are the more likely obstacle.

If it fails: recreate the USB before troubleshooting the Acer further.

One detail I need
When you previously reached the Mint live desktop, did you use this exact same USB stick and adapter, and did the installation fail with an error message?

If you remember the installation error, even approximately, tell me that too. We may be dealing with two separate problems: getting the USB to boot consistently and getting Mint installed successfully.

without usb i get 'no bootable device' screen. the time i booted into usb was via windows recovery mode selection screen thing
That explains it. Windows Recovery gave you an alternative route to the USB installer, bypassing the normal boot-selection process. Now that Windows is gone, that route is gone too.

The good news: “No bootable device” is expected when Windows has been erased and Mint isn't installed yet. It doesn't, by itself, indicate a hardware failure.

Best next attempt: recreate the Windows Recovery route
We need to get the firmware to launch the Mint USB without changing the password-protected BIOS settings.

On your MacBook, prepare the Mint USB again using
balenaEtcher
.

Connect it to the Switch Alpha 12 using the same adapter and port that worked before.

Power on and try F12 once more.

If it still fails, stop there rather than repeatedly rewriting the USB.

One important question
When you previously selected the USB through Windows Recovery, do you remember which option you chose?

Use a device → USB drive or EFI USB device

Troubleshoot → another recovery menu

Something else

If it was Use a device, that confirms Windows was handing control to the USB's UEFI bootloader. We can then focus on alternative ways to invoke that bootloader, rather than wasting time on the Mint installation itself.

now im on macos, elenabatcher still the best option?
Yes, but on macOS I'd actually recommend balenaEtcher for your situation. It's straightforward and writes the Mint ISO directly to the USB without requiring you to configure partitions manually.

Create your Mint USB on macOS
How to turn a Mac into a Steam machine with Bazzite

1. Download Etcher

Get it from the official website:
balenaEtcher
.

Download the macOS version and open it.

Linux Mint 21.1 - BetaWiki 2. Download Mint XFCE

Use the
official Linux Mint download page
. Choose the stable XFCE edition.

Bootable USB stick create failure - balenaEtcher 2.1.4, Ubuntu 24.04.3 LTS iso, Win 10 - Support and Help - Ubuntu Community Hub 3. Flash the USB

Select the Mint .iso file.

Select your USB stick.

Click Flash.

Wait for verification to finish.

Important: Select the USB stick carefully. Etcher will erase it, but it won't erase your Mac's internal drive unless you explicitly select the wrong target.

One detail for your Acer
Because the Switch Alpha 12 previously booted Mint through Windows Recovery, recreating the USB is worth trying. However, if the same USB already worked, the password-protected UEFI boot settings may still be the real obstacle.

After flashing, connect the USB to the Acer and try F12 again. If it still won't boot, tell me whether your MacBook uses Apple Silicon (M1/M2/M3/M4) or Intel—that affects which alternative USB-creation methods are practical.

i ignored this error in balenaetcher before

Something went wrong while opening /Users/leonschilling/Downloads/Linux Mint 22.3 Zena 64-bit.iso.

Error: (0 , h.requestMetadata) is not a function
That error is coming from balenaEtcher itself, not necessarily from the Linux Mint ISO. h.requestMetadata is not a function suggests Etcher is hitting an internal application error while opening the image.

Don't ignore it this time. Since we're troubleshooting a machine with a locked BIOS, we want to know the USB was created correctly before blaming the Acer.

Try this first
Quit balenaEtcher completely.

Download the latest stable version again from
the official Etcher website
.

Reopen it and select your existing ISO:
Linux Mint 22.3 Zena 64-bit.iso

If the error persists, use another USB-writing tool rather than repeatedly trying Etcher.

Better options
The error is a known Etcher bug, and recent reports specifically mention macOS and Etcher 2.1.7.

balenaForums
+1

I'd choose one of these:

Download and Setup OctoPrint for Orange Pi | Obico
Option A — Raspberry Pi Imager

Try first
It supports writing a custom image, not just Raspberry Pi operating systems.

Download:
raspberrypi.com/software

Choose Use custom and select your Mint ISO.

Aplikace Terminál pro začátečníky I. | Tipy, novinky a návody | iSTYLE blog
– iSTYLE.cz
Option B — macOS Terminal

No additional software required, but you must identify the USB disk correctly. One wrong disk identifier can erase your Mac's data.

I'd use this only if Raspberry Pi Imager also fails.

One more important check
Your filename says Linux Mint 22.3 Zena. That's a valid release, but verify the download came from the
official Mint site
.

Linux Mint
+1

Use Raspberry Pi Imager first. Once it finishes, eject the USB cleanly and try it in the Acer again. We need a verified installer before tackling the locked boot settings.
