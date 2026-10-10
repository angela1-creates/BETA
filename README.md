# BETA

BETA is a local-first route-reading prototype for rock climbers. It helps climbers predict movement, record what they actually did, compare the two without judgment, and request progressively stronger hints.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## What works

- 23 local sample routes using eight original route photographs, including unique images for Feet First, Weight Shift, and Multiple Betas
- Clear difficulty and hold-color labels, such as `V3 · Coral`
- Tap-based LH, RH, LF, and RF placement
- Two-tap movement arrows
- Editable notes, step reordering, delete, reset, undo, and redo
- Separate predicted and actual beta sequences
- Visual comparison with neutral movement observations
- Four deliberately gated hint levels
- Confidence and reflection prompts
- Local browser persistence
- Small demo research dashboard and portfolio-style experiment page

No account, backend, database, external AI API, or analytics service is used. Data stays in the browser's `localStorage`.

## Live site

The app deploys to [GitHub Pages](https://angela1-creates.github.io/BETA/) whenever `main` is updated. GitHub Actions runs the tests and production build first.

## Interaction notes

Select a marker tool and tap the route image. For an arrow, tap once to set its start and again to set its end. Use the Before/After switch to move between prediction and actual beta. Notes and confidence values save automatically.

## Stack

React, Vite, TypeScript, and Tailwind CSS. Original generated route photography is stored locally in `public/routes/` and optimized as WebP assets.
