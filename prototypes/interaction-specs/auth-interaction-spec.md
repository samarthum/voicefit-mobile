# Auth Interaction + State Spec

- Last updated: 2026-03-10
- Screens: Sign In, Sign Up with Email
- Status: Locked for current prototype parity pass

## Source links
- UI source-of-truth index: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/spec-ui-source-of-truth.md`
- Sign-in prototype: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/sign-in.html`
- Sign-up prototype: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/sign-up-email.html`
- Implementations:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/sign-in.tsx`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/sign-up-email.tsx`

## Sign In
- Apple button starts Clerk `oauth_apple` on supported Apple platforms.
- Google button starts Clerk `oauth_google`.
- Email button routes to `/sign-up-email?mode=signin`.
- Success routes to `/(tabs)/dashboard`.
- Auth failure renders inline error copy below the button stack.

## Sign Up / Sign In with Email
- `mode=signin` and `mode=signup` share one screen with a two-tab segmented control.
- `tap_back` returns to the previous screen.
- `tap_toggle_mode` switches between sign-in and sign-up variants in place.
- `tap_submit`:
  - sign in: create session, then route to Home.
  - sign up: create account, then route to Home if complete; otherwise show verification-required copy.
- Password field includes a visual show/hide affordance matching the prototype.
