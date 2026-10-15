# Queue display controls and audio

Select a branch and date on display.html. The URL preserves a fixed date; Today restores automatic Cairo-day rollover. Historical and future views are labelled as recorded bookings and never announce patients as entering now. Branch/date switches discard stale responses and reset audio announcement history.

The screen fills the viewport. Cards and eight next tickets resize with the available space, including portrait and short landscape screens and expanded audio controls. Fullscreen toggles entry/exit.

Background music is unchanged. The original clear notification is a mono PCM WAV, 44.1 kHz, 2.7 seconds: two ascending three-note phrases with attack/release envelopes and peak below full scale. Default notification volume is 85%; music remains 18%. Existing saved preferences are preserved. A user click enables audio; new active numbers ring once, duck background music, then restore it. Reload, date/branch switch and historical views remain silent.

Validation: syntax checks, 82 unit tests, actual browser media playback and duck/restore checks, and 11 viewport sizes (320x568 through 3840x2160), with all eight next numbers and expanded audio settings. Local checks use synthetic responses and do not alter clinic records.
