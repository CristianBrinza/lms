# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

User-specified: two directories, `frontend/` (React + Vite + TypeScript, Yarn) and `backend/` (Node.js API, PostgreSQL), in the same shape as the `nails-by-alynna` project. The frontend deploys to Cloudflare with Wrangler; the backend runs on the owner's machine/server and is published through a Cloudflare Tunnel. Icons: MUI icons (user-specified). Button and other UI components are the app's own.
Delegated details: Hono on Node.js 22, plain SQL on PostgreSQL through `pg` with numbered migrations, zod, jose (JWT in httpOnly cookies), Tailwind CSS v4 tokens, TanStack Query, React Router, vite-plugin-pwa. The Cloudflare Worker serves the app and proxies `/api/*` to the tunnel hostname, so the browser only ever talks to one origin.

## Users

- **Members**: the owner's family and friends, a small private group. Mostly on a phone, often from the Home Screen icon, a few minutes at a time (log a workout, check today's food). Each person manages their own life areas.
- **Admin**: the owner. Creates every account (there is no public sign-up), resets passwords, deactivates people, makes other admins. Also a member.

## Product Purpose

LMS (Life Management System) is one private home for the areas of a person's life: training, food, and ten or more areas to come. Today it ships the foundation: sign-in, the dashboard of area cards, the install guide, accounts and the admin console. Each area's real features are built later by the owner. Success: people install it, stay signed in, and open it daily instead of scattered apps.

## Positioning

Not a marketplace app or a single-purpose tracker: one private, invite-only hub run by the owner for people they know, installable like a native app, with areas added over time without a redesign.

## Operating Context

- Mobile-first web app that installs as a PWA; `/app` explains installation on iPhone (Share → Add to Home Screen), Android (install prompt or menu) and computers (QR code, browser install).
- `/` is the "web or app" start page for signed-out visitors; signed-in people go straight to the dashboard.
- Sessions are remembered (up to a year with "Keep me signed in"); the installed app updates itself as soon as a new version is deployed, without signing anyone out and without losing a form in progress.
- Desktop is fully responsive; phones are the primary device.

## Capabilities and Constraints

- Roles: `member` and `admin`. Every user has a name, surname and email.
- Sign-in with email and password only. No self sign-up and no "forgot password" email flow yet: the admin resets passwords from the console.
- Admin console: list and search users, create a user (with a generated or chosen password), edit name, email and role, deactivate/reactivate, reset password, sign a user out everywhere, delete. The last active admin cannot be demoted, deactivated or deleted.
- Dashboard: a registry of area tiles. Two areas exist now (Training, Food), as tiles only, marked Soon; their screens arrive later (the owner builds them). The registry is built for 10+.
- Bottom menu: Home, Utilities (an empty page for now), Settings, Profile; the admin console is reached from Settings and Home.
- English only; copy kept in components so another language can be added later.
- Undecided: what each area contains, any email delivery, avatars/photos.

## Brand Commitments

- Name: **LMS**, "Life Management System". Repository `lms`.
- User-supplied visual references (five phone mockups: a lavender task app, a cyan/dark mood app, a yellow mood app, a violet/lime learning app, a periwinkle learning app), blended, not copied. The owner keeps the LMS palette fixed and takes UI elements and blocks from new references, not their colours. Surfaces are flat colour (no gradients or lighting) with soft drop shadows. LMS must not look like the nails-by-alynna app.
- Icons: MUI icons.
- Logo (supplied, `frontend/brand/logo.svg`): a red `#E40523` square with a white four-point sparkle fading to transparent. It is the app icon, favicon and splash mark. Red stays inside the logo: it is not the app's theme or action color (user instruction).

## Evidence on Hand

- The five reference mockups (shared in chat, not stored in the repo).
- The supplied logo. No photos, no real user data. Nothing may be presented as real statistics; any illustrative numbers on placeholder screens are labeled as examples.

## Product Principles

1. Open, glance, act: the dashboard answers "what's here today" in one screen, one thumb.
2. Private by default: invite-only, roles enforced on the server, sessions protected.
3. Feels installed: Home Screen icon, splash, standalone window, silent updates.
4. Built to grow: a new life area is a registry entry and a screen, not a redesign.

## Accessibility & Inclusion

- Text meets WCAG 2.2 AA contrast; pastel tiles carry ink text, never pastel-on-white text.
- Touch targets at least 44px, visible focus, reduced motion respected (splash and transitions included).
- Names with diacritics (Romanian) render correctly.
