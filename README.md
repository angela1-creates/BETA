# BETA

**Climbing is better together.**

BETA is a mobile-first social climbing prototype built around **Climb → Capture → Share → Connect → Climb again**. It works for people who arrive with friends, families, partners, or alone. Optional adult partner discovery is available when someone needs a belayer or climbing buddy.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173/BETA/`). Demo state and original route-learning attempts persist in browser `localStorage`.

## Check and build

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

The Vite base remains `/BETA/` and the existing GitHub Pages workflow remains unchanged.

## Demo mode

The current build is a frontend-only interactive demo. Fictional requests are visibly labeled, uploads stay in the current browser session, and no request, invitation, report, block, or share link reaches another person. It does not provide production authentication, server authorization, gym verification, moderation, durable media storage, or true private sharing.

The three home actions are independent:

- **Share a Climb:** upload without a crew, session, or route annotation, then create a private-by-default share card.
- **Climb With My Crew:** use a small friends/family group, copy a demo invite, open a recap, and plan another session.
- **Find a Partner:** create availability, discover fictional adult requests, invite, simulate acceptance, confirm, block, and arrange another session.

Clear site data for the local origin to reset the prototype. Product events are stored only in local demo state and are never sent as analytics.

The interface uses draft-first publishing: selecting media or starting a challenge does not create content until the user previews and confirms it. Crew invitations, RSVP proposals, repeat-session requests, and matching transitions are interactive locally and visibly labeled as demo behavior when Supabase is not configured.

## Preserved BETA features

The original Route Lab remains available from **My Climbs → Open Route Lab**:

- 23 sample studies using six real indoor-climbing photos. Credits live in `public/routes/PHOTO_CREDITS.md`; V1–V6 are BETA study levels, not verified gym grades.
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

Manual annotation is never required for social sharing.

## Architecture

- `src/SocialApp.tsx`: four-area product shell and connected local flows
- `src/social.ts`: domain types, request expiry, invitation transitions, share-token generation, and event instrumentation
- `src/demo.ts`: fictional seed data and demo persistence adapter
- `src/App.tsx`: preserved original route-learning experience
- `supabase/migrations/0001_beta_social.sql`: reference schema and Row Level Security starting point for a real backend
- `supabase/migrations/0002_security_and_sharing.sql`: private Storage, invitation/RSVP data, revocable share links, and expanded RLS policies
- `supabase/functions/resolve-share/index.ts`: trusted share-token resolver that issues short-lived media URLs
- `src/services/supabase.ts`: credential-aware Supabase client and private-media helpers
- `src/platform.ts`: platform-independent media, sharing, and preference interfaces
- `src/i18n.ts`: English and Simplified Chinese resources with persisted device preference

Production should replace the demo adapter with Supabase Auth, Postgres, and a private Storage bucket. Apply the migration through the Supabase CLI only after review. Then add policies for membership writes, token exchange through an Edge Function, rate limiting, moderation, deletion/export, and guardian consent. Store only token hashes, issue short-lived signed media URLs after server-side authorization, and never put a service-role key in Vite client variables.

## Supabase setup

No backend is connected by default. Without credentials, the application remains in clearly marked local demo mode and does not display backend-dependent success messages.

1. Create a Supabase project and review both files in `supabase/migrations/`.
2. Apply the migrations in order with the Supabase CLI.
3. Deploy `supabase/functions/resolve-share` and set its server-only `SUPABASE_SERVICE_ROLE_KEY` secret.
4. Copy `.env.example` to `.env.local` and add only the project URL and public anon key.
5. Confirm that `climbing-media` is private before inviting real users.

Verify that User A cannot read or change User B's private data or media, revoked and expired tokens return no content, valid tokens return only the permitted resource with a short-lived URL, and anonymous browsers cannot list object paths or token hashes.

The schema and browser client are prepared, but a production project, authentication delivery, moderation operations, and deployment are not configured in this repository.

## Languages

BETA detects the device language and supports English (`en`) and Simplified Chinese (`zh-CN`). Use the **中文 / EN** header control to switch. The choice persists without resetting product state, and user-generated captions remain in their original language.

Safety terminology distinguishes 保护搭档 (belay partner), 本人陈述的保护资质 (self-reported qualification), 岩馆安全检查 (gym safety check), and 搭档安全互检 (partner safety check). A future `zh-TW` resource can be added without changing component state.

## PWA and Capacitor readiness

The PWA build generates an installable manifest and an offline app-shell cache while preserving the `/BETA/` GitHub Pages base. Shared content remains accessible through ordinary web links without installing an app.

Capacitor configuration lives in `capacitor.config.ts`. Native projects are deliberately not generated or published yet.

```bash
npm run cap:add:ios
npm run cap:add:android
npm run cap:sync
```

Before TestFlight or Play testing, add reviewed Capacitor Camera, Share, Preferences, Notifications, and Filesystem adapters; configure universal/app links; add native privacy manifests and permission copy; and test on physical devices. Never include a Supabase service-role key in a web or native bundle.

## Implementation status

Completed locally:

- Preview, confirm, and discard before saving climb media or challenges
- Validated matching transitions and duplicate-session guards
- Focus-trapped dialogs, Escape/backdrop dismissal, larger touch targets, and mobile safe areas
- Existing-friend invitation links, session proposals, RSVP confirmation, and repeat-session guards in demo mode
- English/Simplified Chinese architecture and persistent toggle
- PWA output, Capacitor configuration, Supabase client boundary, private Storage policies, and revocable link resolver

Demo-only until a Supabase project is configured:

- Fictional partner discovery and simulated acceptance
- Invitation delivery, guest responses, RSVP delivery, blocks, reports, and analytics
- Local object-URL media and links, which are not private cross-device sharing

Blocked on external configuration:

- Real accounts and authentication delivery
- Durable media upload and cross-device access
- Production moderation, rate limits, deletion/export, and guardian consent
- TestFlight, App Store, and Play Store packages

## Demo journeys

1. **Solo climber:** Find Crew → create availability → invite Maya → simulate acceptance → My Crew → plan another session.
2. **Friends:** My Climbs → upload (optional) → Share → Beta Challenge → lock response → reveal → create link.
3. **Family:** My Crew → Sunday Senders → copy private invite → open private recap. Guardian/minor protections are labeled but are not server-enforced in demo mode.
4. **Returning climber:** My Crew → Jordan → Plan another session.

## Safety and privacy limitations

This is not a production safety system. Adult confirmation, self-reported qualifications, blocking, reporting language, share revocation, and privacy controls are prototype interactions stored locally. A static GitHub Pages URL cannot make client-side media private, so the demo does not upload user media or claim its generated links are secure cross-device shares.

Before real users: implement authenticated server-enforced authorization, content moderation, rate limits, encrypted private storage, audited signed-link access, revocation, consent records for everyone shown in media, and guardian-managed minor accounts that cannot access adult matching.

## Product metrics

The local demo instruments: `availability_created`, `partner_invite_sent`, `invite_accepted`, `session_confirmed`, `session_completed`, `repeat_session_requested`, `climb_uploaded`, `share_card_created`, `challenge_shared`, `challenge_joined`, and `crew_created`. No adoption data is fabricated or transmitted.

## Next experiment

Recruit 20–40 recreational climbers across bouldering, ropes, existing friend groups, parents, and people who sometimes need partners. Give each person one real weekend task: share a climb, coordinate their normal crew, or find a partner. Measure time to first useful outcome, link participation, confirmed/completed sessions, and whether they plan another climb. Interview drop-offs within 24 hours, especially anyone who avoids uploading or partner discovery because of privacy or trust.

## Live site

The app deploys to [GitHub Pages](https://angela1-creates.github.io/BETA/) whenever `main` is updated. GitHub Actions runs the tests and production build first.

## Route Lab interaction notes

Select a marker tool and tap the route image. For an arrow, tap once to set its start and again to set its end. Use the Before/After switch to move between prediction and actual beta. Notes and confidence values save automatically.

## Stack

React, Vite, TypeScript, and Tailwind CSS. Route Lab uses locally stored Pexels photography so annotation works offline and no third-party request is made at runtime.
