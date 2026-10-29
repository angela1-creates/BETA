# BETA

## Phase 2A research pilot

This branch adds a consent-based Supabase research path for Route Lab. Signed-in,
consented testers can keep private routes, predictions, attempts, reflections, and
climbing media across browsers. Public beta browsing and curated hints do not require
an account. When the backend is configured, recording an attempt or personal route
requires a signed-in, consented account; the unconfigured demo keeps drafts locally. Adult partner matching can also
run against Supabase after migration `0004_partner_matching.sql`. Migration
`0005_persistent_crews.sql` adds private, persistent crews and secure, revocable
invitation links. Challenges and social media sharing remain local demos in this release.

The implemented flow is:

1. A tester signs up with an email magic link while pilot signup is enabled, or a
   researcher sends an invitation from Supabase Auth.
2. The tester signs in with an email magic link (or Google when explicitly enabled).
3. The tester reviews the research notice and records consent plus minimal study
   characteristics. Height and wingspan are optional.
4. Route Lab saves predictions, actual attempts, and reflections to owner-scoped
   Postgres rows. Photos and videos use a private Storage bucket and short-lived
   signed playback URLs.
5. The tester can share their unique recruitment link. Referral reporting exposes
   counts only, never another participant's identity.
6. The tester can delete their account, database records, and uploaded media through
   the server-side deletion function.

### Supabase configuration

Create a non-production Supabase project for the pilot, install the Supabase CLI,
link the project, and review then apply all migrations in order:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy delete-account
supabase functions deploy request-research-invite --no-verify-jwt
```

`delete-account` must retain gateway JWT verification. The invitation function is
called before an invitee has an account, so it is deployed without gateway JWT
verification and instead enforces its exact origin allowlist, unpredictable referral
code, hashed email storage, and daily rate limit internally.

Set these Edge Function secrets. Use an exact comma-separated origin allowlist; do
not use `*` for the pilot.

```bash
supabase secrets set ALLOWED_ORIGINS=https://beta-climb.vercel.app,https://angela1-creates.github.io
supabase secrets set APP_REDIRECT_URL=https://beta-climb.vercel.app/
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. The service-role key must never be
placed in `.env`, Vercel variables whose names begin with `VITE_`, source code, or a
browser/native bundle.

In Supabase Authentication:

- add the exact Vercel and GitHub Pages callback URLs to the redirect allowlist;
- enable email signup while recruiting testers, with email confirmation retained;
  disable open signup and use dashboard invitations whenever recruitment is closed;
- configure SMTP before relying on magic links outside a tiny test group;
- enable Google only after its OAuth client, redirect URI, and invitation/allowlist
  enforcement have been tested. Then set `VITE_SUPABASE_GOOGLE_ENABLED=true`;
- keep the `climbing-media` bucket private.

### Vercel environment variables

Add these under Project Settings -> Environment Variables, then redeploy:

```text
VITE_BASE_PATH=/
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_SUPABASE_GOOGLE_ENABLED=false
```

For GitHub Pages, the workflow keeps the default `/BETA/` base path. Add these in
GitHub under **Settings -> Secrets and variables -> Actions**, then rerun the Pages
workflow:

- Repository variable `VITE_SUPABASE_URL`
- Actions secret `VITE_SUPABASE_ANON_KEY`
- Repository variable `VITE_SUPABASE_GOOGLE_ENABLED` (`true` or `false`)

The workflow now stops instead of silently publishing the fictional demo when the
URL or anon key is missing. The anon key is a browser-safe public key; privacy comes
from Row Level Security and Storage policies, not from hiding that key. It is stored
as an Actions secret here to avoid printing it in workflow configuration or logs.

### Two-account authorization verification

Create two disposable password-based test users in the pilot project. Do not use
real participant accounts. Supply their credentials only in the local shell, run
the test, then delete the users:

```bash
npm run test:security
```

The script reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`BETA_TEST_USER_A_EMAIL`, `BETA_TEST_USER_A_PASSWORD`,
`BETA_TEST_USER_B_EMAIL`, and `BETA_TEST_USER_B_PASSWORD`. It verifies
owner-only SELECT/INSERT/UPDATE/DELETE, private object access, denial of signed-URL
generation to anonymous and other users, signed-URL expiry, and reload from a second
client. A normal `npm test` performs static policy checks but is not a substitute
for this live test.

Maintainers may instead run `npm run test:security:disposable` with the same public
URL/key plus a server-only `SUPABASE_TEST_SERVICE_ROLE_KEY`. That wrapper creates two
random confirmed accounts, runs the user-level test, removes test media, and deletes
both accounts. Use it only from a trusted local or CI process; never expose the
service-role value through a `VITE_` variable or browser bundle.

### Phase 2A limitations

- A Supabase project, email provider, Google provider, Edge Function secrets, and
  Vercel variables are external configuration and are not activated by this repo.
- Signed media URLs currently last five minutes and are renewed on a Route Lab
  reload. Long-open tabs may need a refresh after a URL expires.
- Referral email delivery depends on the deployed invitation function and configured
  Supabase email service. The app does not claim an invite was sent when unavailable.
- Referral conversion metrics are aggregate study-recruitment counts, not product
  adoption data. Experience and climbing style are self-reported; body measurements
  are optional.
- Production launch still needs operational monitoring, abuse controls, retention
  policy review, a data export process, and an independent security review.

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

The Vite base remains `/BETA/`. The GitHub Pages workflow requires the configured
Supabase URL and public anon key so the public site cannot silently fall back to the
fictional demo.

## Demo mode

Without Supabase credentials, the social crew, matching, and challenge areas remain a frontend-only interactive demo. With credentials and migrations through `0005_persistent_crews.sql`, Find a Partner uses real consented adult accounts, server-side invitation transitions, confirmed sessions, blocks, and reports; My Crew stores private crew membership and supports secure, expiring, revocable invitations. Crew sessions and recaps, challenges, and explicit social share links remain local-only. Route Lab remains local-first without credentials and uses the authenticated private research backend when configured.

The three home actions remain independent, but the pilot puts **Climb With My Crew** first:

- **Share a Climb:** upload without a crew, session, or route annotation, then create a private-by-default share card.
- **Climb With My Crew:** in configured mode, create a persistent private crew and invite another consenting adult through an expiring, revocable link. In demo mode, create a local crew, open a recap, and plan another session.
- **Find a Partner:** in configured mode, sign in and consent, create availability at one of five Bay Area Movement gyms, invite another tester, accept or decline, and confirm a session. In unconfigured mode the same information architecture uses visibly fictional local data.

Clear site data for the local origin to reset the prototype. Product events are stored only in local demo state and are never sent as analytics.

The interface uses draft-first publishing: selecting media or starting a challenge does not create content until the user previews and confirms it. Crew invitations, RSVP proposals, repeat-session requests, and matching transitions are interactive locally and visibly labeled as demo behavior when Supabase is not configured.

## Preserved BETA features

The original Route Lab remains available from **My Climbs → Open Route Lab**:

- 23 sample studies using six real indoor-climbing photos. Credits live in `public/routes/PHOTO_CREDITS.md`; V1–V6 are BETA study levels, not verified gym grades.
- Public search and filtering by climb/movement, available grade, and verified gym source when source metadata exists
- Honest coverage messaging plus a local “Request this climb” research fallback when beta is unavailable
- Clear difficulty and hold-color labels, such as `V3 · Coral`
- Tap-based LH, RH, LF, and RF placement
- Two-tap movement arrows
- Editable notes, step reordering, delete, reset, undo, and redo
- Separate predicted and actual beta sequences
- Visual comparison with neutral movement observations
- Four deliberately gated hint levels
- Confidence and reflection prompts
- Local browser persistence in demo mode; configured pilots require an account for personal attempts
- Small demo research dashboard and portfolio-style experiment page

Manual annotation is never required for social sharing.

## Architecture

- `src/SocialApp.tsx`: four-area product shell and connected local flows
- `src/social.ts`: domain types, request expiry, invitation transitions, share-token generation, and event instrumentation
- `src/demo.ts`: fictional seed data and demo persistence adapter
- `src/App.tsx`: preserved original route-learning experience
- `supabase/migrations/0001_beta_social.sql`: reference schema and Row Level Security starting point for a real backend
- `supabase/migrations/0002_security_and_sharing.sql`: private Storage, invitation/RSVP data, revocable share links, and expanded RLS policies
- `supabase/migrations/0004_partner_matching.sql`: five Bay Area Movement locations plus adult-only discovery and atomic invitation/session RPCs
- `supabase/migrations/0005_persistent_crews.sql`: atomic crew creation, member-only reads, and hashed-token invitation acceptance/revocation
- `supabase/functions/resolve-share/index.ts`: trusted share-token resolver that issues short-lived media URLs
- `src/services/supabase.ts`: credential-aware Supabase client and private-media helpers
- `src/services/partnerBackend.ts`: real availability, invitation, session, block, and report adapter
- `src/platform.ts`: platform-independent media, sharing, and preference interfaces
- `src/i18n.ts`: English and Simplified Chinese resources with persisted device preference

The Route Lab research path uses Supabase Auth, Postgres, and private Storage when configured. Find a Partner uses authenticated server-side functions that expose only display name, self-reported experience, gym, and availability to other consented adults. Before converting the remaining social features, add audited media publishing, token exchange through an Edge Function, rate limiting, moderation operations, deletion/export, and guardian consent. Store only token hashes, issue short-lived signed media URLs after server-side authorization, and never put a service-role key in Vite client variables.

## Supabase setup

No backend is connected by default. Without credentials, the application remains in clearly marked local demo mode and does not display backend-dependent success messages.

1. Create a Supabase project and review every numbered file in `supabase/migrations/`.
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
- Email magic-link research login, optional gated Google OAuth, research consent, and account controls
- Local-first Route Lab sync for routes, predictions, attempts, reflections, and private photo/video media
- Owner-scoped research tables, private Storage helpers, account/media deletion, referral attribution, and aggregate recruitment metrics
- Direct My Climbs -> share-card handoff, media-backed downloadable cards, and a landing-page product walkthrough
- Real adult partner availability, discovery, invitations, acceptance/decline, session confirmation, blocking, and reporting when migration `0004` is applied
- Persistent private crews, member-only visibility, atomic invitation acceptance, and revocable seven-day crew links when migration `0005` is applied

Demo-only until a Supabase project is configured:

- Partner discovery only when Supabase is absent; configured deployments do not mix fictional climbers into the real board
- Crew session/recap persistence, guest challenge responses, RSVP delivery, and analytics
- Local object-URL media and links, which are not private cross-device sharing

Blocked on external configuration:

- Activating real accounts, email delivery, and cross-device media in a Supabase pilot project
- Live two-account RLS and private Storage verification against that configured project
- Production moderation, rate limits, deletion/export, and guardian consent
- TestFlight, App Store, and Play Store packages

## Demo journeys

1. **Crew pilot:** My Crew → Sunday Senders → review two sessions → use one crew-chosen challenge → add optional moments, beta, help requests, or encouragement → share the recap → invite the crew to climb again.
2. **Friends:** My Climbs → upload (optional) → Share → Beta Challenge → lock response → reveal → create link.
3. **Solo climber:** Find a Partner → create availability → invite Maya → simulate acceptance → My Crew → plan another session.
4. **Returning climber:** My Crew → open the shared recap → invite the crew to the second session.

## Safety and privacy limitations

This is not a production safety system. In configured mode, partner discovery is limited to consented adults; availability, partner invitations, crew membership, and crew invitation transitions are server-authorized. Crew links contain a high-entropy secret, store only its hash, expire after seven days, and can be revoked, but they are bearer links: anyone who receives an active link can view its limited preview and a consented adult account can accept it. Qualifications are still self-reported, reporting is not yet connected to a staffed moderation operation, and the pilot has no gym-verification integration. A static URL cannot make client-side demo media private. Only the configured Route Lab research path uploads to private Supabase Storage; local social wall/share links are not secure cross-device publishing.

Before real users: implement authenticated server-enforced authorization, content moderation, rate limits, encrypted private storage, audited signed-link access, revocation, consent records for everyone shown in media, and guardian-managed minor accounts that cannot access adult matching.

## Product metrics

The local demo instruments: `availability_created`, `partner_invite_sent`, `invite_accepted`, `session_confirmed`, `session_completed`, `repeat_session_requested`, `climb_uploaded`, `share_card_created`, `challenge_shared`, `challenge_joined`, `crew_created`, `crew_pilot_started`, `crew_pilot_contribution_added`, `crew_pilot_response_added`, `crew_pilot_beta_tried`, `crew_pilot_next_invite_sent`, and `crew_pilot_next_session_observed`. These events record actions, not causes or conclusions. No adoption data is fabricated or transmitted.

## Next experiment

Start with one existing crew of 5–8 climbers at one gym. This is the simpler initial experiment, not an assumption that crew-first sharing is better for engagement or comfort. Let the crew choose one challenge: “Pick one problem together. Explore different approaches. Capture one breakthrough or memorable moment.” Completing the problem, contributing a post, and capturing media are optional.

Distinguish curated beta consumption from participant beta contribution. Observe whether someone tries a curated approach; chooses to contribute an unfinished attempt, question, breakthrough, beta idea, or encouragement within the crew; receives a response; tries that response; and reports whether it helped, did not fit, or inspired another way. Public participant contribution remains untested.

The pilot can reveal sharing behavior and perceived comfort, but it cannot establish that familiarity caused either; that requires a separate audience comparison. Treat interest in, planning of, or attendance at another session as an outcome to observe—not a completion requirement or proof that BETA caused retention.

## Live site

The app deploys to [GitHub Pages](https://angela1-creates.github.io/BETA/) whenever `main` is updated. GitHub Actions runs the tests and production build first.

## Route Lab interaction notes

Select a marker tool and tap the route image. For an arrow, tap once to set its start and again to set its end. Use the Before/After switch to move between prediction and actual beta. Notes and confidence values save automatically.

## Stack

React, Vite, TypeScript, and Tailwind CSS. Route Lab uses locally stored Pexels photography so annotation works offline and no third-party request is made at runtime.
