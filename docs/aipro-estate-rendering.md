# AIPRO manor scene — 2026-11-05

## Reference inspection

Inspected https://yieldfields.fun/play HTML, publicly served application chunks, and browser runtime. The page is Next.js; browser runtime exposed three canvas elements. Public bundles reference separate terrain (`yf_terrain`) and crop seed/icon/growth PNGs, and contain Colyseus references. These observations support separating scene art, growth state, movement and UI. They do not establish a specific rendering engine, source license, or a complete backend implementation. No YieldFields code or art was copied into this repository.

## Implementation

Original generated landscape asset `public/town/aipro-estate-v2.webp`, packaged from the generated PNG as WebP. Fixed 1536 × 1024 world coordinates preserve geometry across screens. Camera supports pointer drag, zoom and overview reset. Mobile has a persistent facility dock and starts closer to the scene. Runtime crop and mine overlays remain driven by verified owner data. Artwork includes decorative gold and crops should not be interpreted as a balance.

The five detail views use native HTML `dialog.showModal()` (browser top layer), trapping focus and making the underlying scene inert. Escape closes the panel; background keyboard movement is paused. A visual regression check exercises all five dialogs, topmost hit testing, frozen movement, mobile controls and image decoding.

This is a layered 2D manor view, not a claim to reproduce YieldFields' entire game engine or multiplayer backend. Existing owner data constraints and latest-page trade coverage remain unchanged.
