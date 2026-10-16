# HelpNest Expo frontend connection test

This is an overlay ZIP for the existing Expo project. It includes only the frontend files needed to test the mobile app -> HTTPS API -> MySQL connection.

## Install into your existing project

1. Extract this ZIP into the root of your existing `help_nest_ke` Expo project.
2. Allow `App.js` to be replaced.
3. Ensure the `src/config` folders and `api.js` file are copied.
4. No additional npm packages are required; this uses React Native's built-in `fetch`.

## Run with Expo Go

From the existing Expo project folder:

```bash
npx expo start -c
```

Scan the QR code using Expo Go. The app displays a diagnostic screen. Tap **Test API connection**.

The app calls:

`https://api.jobready.co.ke/api/health`

A successful result means the mobile app reached the API and the API was able to ping MySQL. This does not mean authentication or database CRUD endpoints have been implemented yet.

## If the test fails

- Open `https://api.jobready.co.ke/api/health` in your phone browser.
- If the response is 503, check the backend's MySQL environment variables and server-to-database access.
- If you see a DNS, TLS, or network error, check the subdomain DNS and SSL certificate.
- If the URL returns 404, verify the Node.js app is mapped to the subdomain and that the backend health route is deployed.
- The database password must remain on the backend and must never be added to Expo files.

## Optional API URL override

The client defaults to `https://api.jobready.co.ke`. To override it for local testing, create a `.env` file in the Expo project root using `.env.example` as a guide, then restart Expo with `npx expo start -c`.

For a physical phone connecting to a development server on your computer, use the computer's LAN IP address rather than `localhost`. The API must be reachable from the phone.
