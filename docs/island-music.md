# Garden Breeze / 庄园微风

Original instrumental arranged for AIPRO: 72 BPM, 32 bars, 106.67 seconds, stereo AAC (~1 MB). Warm sustained chords, soft bell melody, bass and restrained percussion replace the old short oscillator loop. The track starts only after a visitor clicks the music button, pauses/resumes at the same position and loops. The button reports loading and offers retry on a playback failure.

Reference inspection of YieldFields `/play` identified “Wishing Well” as the public radio entry `dream-pop`, 241.1 seconds. Its audio was inspected locally for broad tempo cues; no source recording, samples or melody are included in the shipped asset. Envelope analysis has multiple plausible beat subdivisions and is not a definitive BPM measurement. Garden Breeze intentionally uses a relaxed 72 BPM pulse, not a claim of an exact tempo match.

The reproducible score is `scripts/render-island-music.cjs`. Render with Playwright/Chromium to WAV and encode with macOS `afconvert -f m4af -d aac -b 96000`. Rendering validation: 22,050 Hz stereo, peak below 0.404, no clipping. Fade-in/out smooth the loop boundary. The source WAV and reference recording are not deployed.
