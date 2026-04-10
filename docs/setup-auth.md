# Setup And Auth

## Default auth path

The plugin is browser-login-first for an existing Agent Analytics account.

If the account still needs to be created or set up, do that first from the Paperclip task flow:

- [Set up Agent Analytics for your Paperclip company](https://docs.agentanalytics.sh/guides/paperclip/)

1. Open the plugin `settingsPage`
2. Use the Paperclip setup help section if the account is not ready yet
3. Click the existing-account login button
4. Finish approval in the opened browser tab or popup
5. The worker exchanges the returned session code
6. The plugin validates `GET /projects`
7. Select one Agent Analytics project for the Paperclip company

## Worker-owned boundary

- Access token and refresh token are stored in worker-owned company state
- The browser UI never receives a raw Agent Analytics API key
- `/stream` and `/live` are called only from the worker

## Compatibility fallback

The worker keeps legacy/internal compatibility paths, but the public v1 UI exposes existing-account browser-based agent-session auth only.
