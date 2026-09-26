# Microphone hardware acceptance

The automated microphone contract uses fake streams and the reusable
`frontend/e2e/support/audioFlow.ts` probe. That proves the captured stream is
connected to the application audio graph; it does not grant or validate a
physical microphone on a user's device.

The following owner-run checklist remains open and is not satisfied by CI:

1. On Chrome for macOS, use a published or local HTTPS route, allow the site
   microphone permission, enable Sound and Live mic, speak, and confirm the
   expected piece audio remains audible. Disable Live mic and confirm the
   microphone track stops without stopping authored sound.
2. On Safari iOS, repeat in a user gesture after a fresh permission grant;
   rotate/background the device and confirm audio-session recovery, then
   disable the mic and confirm the track is released.
3. On Chrome Android, repeat the gesture, permission, background/foreground,
   and disable checks.
4. Repeat with camera and steering active in both orders: Sound → Mic →
   Camera → Steer and Sound → Camera → Steer → Mic. Confirm camera frames and
   steering continue while the microphone is toggled.

Expected result: microphone audio reaches the shared output only while Live
mic is active; denied, missing-device, insecure-context, and unsupported
states show their categorized recovery message; no microphone permission or
stream is persisted.

Owner action boundary: macOS TCC permissions and physical hardware are not
available to unattended CI. This checklist is therefore an explicit owner
acceptance item, not a claim made by the automated suite.
