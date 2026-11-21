# Changelog

All notable changes to BETA are documented here.

## [Unreleased]

### Changed

- Make calendar downloads the MVP reminder path for confirmed partner sessions.
- Keep SMS enrollment out of the product until a registered sender, verification service, and operating budget are ready.

## [0.2.0.0] - 2026-11-20

### Added

- Let adult climbers post flexible one-to-three-hour availability windows and express interest without hiding the request from other potential partners.
- Manage confirmed partner sessions with calendar downloads, cancellation, reconfirmation, and mutually reported completion outcomes.
- Offer explicit opt-in SMS verification and server-delivered notifications for partner interest, confirmations, reminders, cancellations, and at-risk sessions.
- Document the focused belay-partner pilot, its safety boundaries, notification strategy, success metrics, and retention loop.

### Changed

- Keep competing partner interests open until the request owner accepts one, then close alternatives and create the session atomically.
- Use the session's actual end time in calendar events instead of assuming every climb lasts two hours.

### Fixed

- Serialize overlapping match acceptance and simultaneous session responses so concurrent actions cannot create conflicting plans or leave sessions in the wrong state.
- Claim notification jobs atomically and preserve fast delivery callbacks to prevent duplicate SMS messages or lost delivery status.

## [0.1.1.0] - 2026-09-09

### Changed

- Replaced the repeated wall photo with eight original, movement-specific climbing route images.
- Made route difficulty and hold color explicit with labels such as `V3 · Coral`.
- Added distinct visual studies for the three featured research routes and V1–V5 library routes.
- Optimized route photography for a fast static-site experience.

## [0.1.0.0] - 2026-09-09

### Added

- Read and annotate 23 sample climbing routes or a photo from your own device.
- Build predicted and actual movement sequences with hand, foot, and arrow annotations.
- Compare both sequences with calm, non-judgmental observations.
- Reveal four progressively stronger hint levels, with deliberate gating for explicit beta.
- Save confidence, hints, annotations, and post-climb reflections locally.
- Explore a concise research dashboard and portfolio experiment page.
- Test and deploy the static app through GitHub Actions and GitHub Pages.
