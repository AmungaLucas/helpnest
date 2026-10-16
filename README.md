# HelpNest (help_nest_ke)

React Native (Expo) frontend for HelpNest — connecting employers with trusted domestic workers.

## Current state

- Animated splash screen, then a role selector (Employer / Domestic Worker)
- Central API client in `src/config/api.js` (JSON-only, 15s timeout, dev-only logging)
- Shared brand palette in `src/theme/colors.js` and logo in `src/components/Logo.js`

## Getting started

```bash
npm install
npx expo start -c
```

Scan the QR code with Expo Go, or press `a` (Android) / `i` (iOS).

## API configuration

The client defaults to `https://gateway.jobready.co.ke`. To override it:

1. Copy `.env.example` to `.env`
2. Set `EXPO_PUBLIC_API_URL` to the base URL you want
3. Restart Expo with `npx expo start -c` (env changes are not hot-reloaded)

For a physical device hitting a dev server on your computer, use the computer's
LAN IP address — `localhost` won't resolve from the phone.

## Conventions

- `npx expo install <package>` — always use this instead of `npm install` so package versions stay SDK-compatible
- All colors come from `src/theme/colors.js`; use `withAlpha()` for translucent variants
- The house + heart logo lives in `src/components/Logo.js` — reuse it, don't copy SVG paths

Secrets (database passwords, private keys) must stay on the backend and must never
be added to this repo or committed `.env` files.
