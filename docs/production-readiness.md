# Shuvia production readiness report

**Status: not production-ready.** This is a code and configuration audit of the local workspace, not a live Supabase, Vercel, or two-account penetration test. No production deployment was created.

## 1. Implemented product areas

- Supabase Auth signup, verification, login, recovery, reset, logout, and onboarding routes.
- Couple invitation and consent flows, private couple dashboard, games, notes, surprises, memories, and special dates.
- Account settings, private avatar storage, theme and privacy preferences, and confirmed account deletion.
- Seven ordered database migrations in `supabase/migrations/`.

These are implementation claims from code review; provider-backed behavior still needs live verification.

## 2. Local test results

| Check | Result |
| --- | --- |
| `npm test` | Pass, 16 tests |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| Live Auth/email/Storage/two-account tests | Not run: no `.env.local`, Supabase CLI, or project connection configured |
| Browser console, rendered mobile/tablet QA, accessibility scan, performance/Lighthouse | Not verified in this environment |

The current automated tests mainly cover schemas, curated content, image signatures, and date calculations. They do not substitute for integration tests.

## 3. Security findings

### Critical: credentials were stored in `.env.example`

The tracked version of `.env.example` contained values formatted like a database connection credential, a Supabase service-role key, and an application signing secret. The working copy has been replaced with placeholders. The prior value is present in Git history, so changing the file does not revoke or erase it.

Before using or sharing this repository:

1. Rotate the Supabase database password and service-role key in the Supabase project.
2. Generate a new random `AUTH_FLOW_SECRET` and update every deployed environment.
3. Remove the exposed values from Git history before publishing the repository. Coordinate a history rewrite with collaborators.
4. Replace the service-role key and signing secret in Vercel only after rotation; never use them in `NEXT_PUBLIC_*` variables.

### High: photo upload size exceeds Vercel's default request limit

The memory route accepts photos up to 8 MiB and the avatar route up to 5 MiB. Vercel's standard function request-body limit is 4.5 MB. The current API routes therefore cannot reliably accept all sizes advertised by the application on a default Vercel deployment. Vercel documents a 20 MiB public beta that requires `VERCEL_SUPPORT_LARGE_REQUEST_BODY=1` and 4 GB Performance memory; verify availability and cost for the target project, or move uploads to authenticated direct-to-Supabase Storage uploads before launch. [Vercel function limits](https://vercel.com/docs/functions/limitations), [20 MiB request-body beta](https://vercel.com/changelog/vercel-functions-now-support-request-bodies-up-to-20mib).

### Medium: storage cleanup is not atomic with database deletion

Disconnect and account deletion remove database records first and clean private Storage objects afterward. Storage cleanup is a separate API operation; some cleanup results are not checked. A Storage failure can leave unreferenced objects behind. Access remains constrained by private buckets and membership policies, but retention/deletion is incomplete. Add a durable cleanup queue or check-and-retry flow before claiming guaranteed erasure.

### Static review notes

- RLS is enabled for profile/preferences, couple, dashboard, game, letter, surprise, and notification tables. Client table writes are revoked for most shared tables; writes use narrow RPCs or server routes.
- Couple-space RPCs stage member consent and constrain room membership. Invitation link tokens are high-entropy and hashed at rest; code attempts are rate-limited.
- API routes generally validate session, email verification, onboarding, membership, origin, and request shape before privileged work. Service-role access is server-only in code.
- Memory objects use a private bucket and room-scoped paths; avatar objects use a private per-user path. File signatures are checked in addition to MIME type and size.
- These policies were inspected statically. Cross-account/cross-room RLS tests were not run against a database.
- Password recovery is routed through Brevo. Supabase Auth verification email still requires a working Supabase SMTP/email configuration.

## 4. Supabase production setup

1. Create a production Supabase project and set Auth password rules, email confirmations, SMTP delivery, and account/session policies.
2. Apply SQL files in numeric order, `202611250001` through `202611250007`, using the Supabase SQL Editor. Review each migration and take a database backup before applying it. The repository does not currently include Supabase CLI project configuration.
3. Migrations 6 and 7 create the private `shuvia-memories` and `shuvia-avatars` buckets and their object policies. Confirm both buckets remain private; do not publish them.
4. Set the Supabase Site URL to the production origin. Add the production `/auth/callback` URL to the allowed redirect URLs. Add localhost only for local development; keep preview redirect entries narrowly scoped.
5. Keep the Supabase signup/verification email template using its confirmation URL so the configured `emailRedirectTo` can return to `/auth/callback`. Test the actual confirmation link after deployment.
6. Verify the sender in Brevo and configure its API key. Password reset is sent by the server through Brevo; the API key is server-only.

## 5. Environment variables

Configure these in Vercel Production and Preview as appropriate. Do not commit values.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase publishable/anon key; RLS remains mandatory |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged server-side RPC, Storage, and Auth operations |
| `BREVO_API_KEY` | Server only | Password-recovery email delivery |
| `BREVO_SENDER_EMAIL` | Server config | Verified Brevo sender |
| `BREVO_SENDER_NAME` | Server config | Sender display name |
| `AUTH_FLOW_SECRET` | Server only | Invitation-code hashing and recovery-cookie signing; use a new random 32+ character value |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical deployed origin, used for links and metadata |

`.env.example` contains placeholders only after this audit. The exposed historical values still need rotation and Git-history cleanup.

## 6. Vercel deployment and post-deploy checklist

The project uses standard Next.js scripts (`npm run build`); no Vercel project, domain, CLI session, or deployment URL is configured here.

1. Rotate the exposed credentials and clean Git history.
2. Apply and verify all seven migrations in Supabase.
3. Configure the environment variables and Auth/Brevo settings above.
4. Resolve the Vercel upload-size blocker. Test the selected 20 MiB beta configuration on Preview if the plan supports it, or ship an authenticated direct-upload flow / lower limit.
5. Deploy a Preview and test verification, reset email, session expiry, avatar upload, and a memory photo at the maximum supported size.
6. Create two distinct verified users. Exercise invitation acceptance/disconnect, presence, every game, scheduled notes, surprise sync, cross-room read/write attempts, and account deletion.
7. Run a browser console check, responsive checks at phone/tablet/desktop widths, keyboard/screen-reader checks, and Lighthouse against the deployed Preview.
8. After all blockers pass, deploy Production and record the URL here.

**Deployment URL:** none. **Production approval:** withheld; the credential exposure, unverified provider flows, RLS integration tests, and photo-upload limit remain unresolved.
