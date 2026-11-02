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
7. Select one Agent Analytics project for the current Paperclip company from plugin settings
8. Open the company live page

## After login succeeds

1. Confirm the plugin can read your Agent Analytics projects
2. Select one Agent Analytics project for the current Paperclip company
3. Open the live page or dashboard widget and confirm live data is flowing

If the login succeeds but no projects appear, reconnect first and then verify the connected account has access to the projects you expect.

## Worker-owned boundary

- Access token and refresh token are stored in worker-owned company state
- The browser UI never receives a raw Agent Analytics API key
- `/stream` and `/live` are called only from the worker

## Multi-company rule

- The plugin is configured per Paperclip company workspace
- Each Paperclip company chooses its own Agent Analytics project in that company's plugin settings
- Do not treat project selection as one global Paperclip-wide setting

## Compatibility fallback

The worker keeps legacy/internal compatibility paths, but the public v1 UI exposes existing-account browser-based agent-session auth only.
