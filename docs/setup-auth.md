# Setup And Auth

## Default auth path

The plugin is login-first.

1. Open the plugin `settingsPage`
2. Click `Start login`
3. Open the returned approval URL
4. Sign in with Google or GitHub
5. Paste the finish code into the settings page
6. The worker exchanges the code, stores the session, validates `GET /projects`, and starts live sync

## After login succeeds

1. Confirm the plugin can read your Agent Analytics projects
2. Add one or more asset mappings in the settings page
3. Enable the surfaces you want operators to see
4. Open the page or dashboard widget and confirm live data is flowing

If the login succeeds but no projects appear, reconnect first and then verify the connected account has access to the projects you expect.

## Worker-owned boundary

- Access token and refresh token are stored in worker-owned company state
- The browser UI never receives a raw Agent Analytics API key
- `/stream` and `/live` are called only from the worker

## Compatibility fallback

The worker code keeps an internal API-key auth adapter for legacy or self-hosted environments, but v1 does not expose API-key entry in the UI.
