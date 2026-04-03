# Setup And Auth

## Default auth path

The plugin is login-first.

1. Open the plugin `settingsPage`
2. Click `Start login`
3. Open the returned approval URL
4. Sign in with Google or GitHub
5. Paste the finish code into the settings page
6. The worker exchanges the code, stores the session, validates `GET /projects`, and starts live sync

## Worker-owned boundary

- Access token and refresh token are stored in worker-owned company state
- The browser UI never receives a raw Agent Analytics API key
- `/stream` and `/live` are called only from the worker

## Compatibility fallback

The worker code keeps an internal API-key auth adapter for legacy or self-hosted environments, but v1 does not expose API-key entry in the UI.

