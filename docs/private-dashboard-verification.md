# Private dashboard navigation verification

## Implemented

- Added a reusable Shuvia heart mark and wordmark across public, auth, onboarding, policy, and private dashboard headers.
- Replaced the private sidebar with a responsive top navigation for Home, Games, Love Notes, Surprises, Memories, and Our Days.
- Added a mobile bottom feature bar and a compact secondary menu with invitation and relationship actions.
- Moved account, profile, theme, privacy, invitation, relationship, and logout actions into the profile menu.
- Added a server-backed invitation dialog with code/link copy, native sharing, expiry and status display, explicit owner consent, and regeneration only when requested.
- Added an authenticated, read-only connection status response to the existing couple API. It never returns invitation secrets.
- Added Join with Invitation Code links to the homepage, login/register pages, private navigation, and invitation manager.
- Kept the existing HMAC-secured invitation creation, acceptance, expiry, and connection RPCs. The partner view now waits for owner confirmation before navigating to the shared dashboard.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | Passed — 16 tests |
| `npm run build` | Passed |
| Local public homepage and login smoke check | Passed — HTTP 200; logo and invitation-code entry were present in rendered HTML |

## Not verified in an authenticated browser

No two test accounts or separate authenticated browser contexts were available, so the invitation lifecycle could not be exercised end to end. The following remain unverified manually: account login/logout, profile/avatar updates, invitation generation and copy/share, expiry and invalid-code handling, partner acceptance, owner confirmation, disconnect cleanup, actual online presence, mobile interaction, and theme switching. No automated test failed.

The attempted production server start could not bind port 3000 because another local service already occupied it. The successful build and local public-route smoke check were run against the project output and the existing local service respectively.
