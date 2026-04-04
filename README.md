# Agent Analytics Live for Paperclip

Thin live-monitor plugin for Paperclip companies that want Agent Analytics signals where operators already work.

Setup guide:

[Install and set up Agent Analytics for Paperclip](https://docs.agentanalytics.sh/guides/paperclip/)

## Install live map analytics plugin in Paperclip UI

1. In Paperclip, open `Settings` -> `Plugins`.
2. Click `Install Plugin`.
3. Paste this npm package name:

```text
@agent-analytics/paperclip-live-analytics-plugin
```

4. Click `Install`.
5. Open the plugin `Configure` page and connect your Agent Analytics account.

## Screenshot

![Agent Analytics Live widget inside the Paperclip dashboard](./src/ui/assets/aa-in-dashboard.jpg)

## Requirements

- An Agent Analytics account
- A Paperclip instance with plugin support

Create or access your Agent Analytics account at:

[agentanalytics.sh](https://agentanalytics.sh)

## Install

```bash
npx paperclipai plugin install @agent-analytics/paperclip-live-analytics-plugin
```

After install, connect the plugin to your Agent Analytics account from the plugin settings page.

## What ships in v1

- `page`: company-level live operator view
- `dashboardWidget`: compact live summary
- `sidebar`: left-nav entry that opens the live page
- `settingsPage`: login-first auth, explicit asset mapping, rollout controls
- Worker-owned Agent Analytics auth, `/live` polling, `/stream` SSE fan-out, and company-scoped live cache

## Package name

`@agent-analytics/paperclip-live-analytics-plugin`

## Local status

This package is scaffolded inside the main Agent Analytics workspace so it can be implemented and reviewed in one place. It is structured to move into its own standalone repo without code changes.

## Scripts

```bash
cd paperclip-live-analytics-plugin
npm test
npm run build
npm pack
```

`npm test` only exercises the dependency-light worker/shared logic. `npm run build` expects the React/Vite dependencies in `package.json`.

## Publish checklist

```bash
cd paperclip-live-analytics-plugin
npm install
npm test
npm run build
npm publish --access public
```

The package is configured for public scoped npm publishing.

## Files

- `paperclip-plugin.manifest.json`: Paperclip-facing manifest contract
- `src/worker/`: worker setup, auth, live polling, SSE fan-out, state persistence
- `src/ui/`: React surfaces for page, widget, and settings
- `docs/`: operator and maintainer docs shipped with the plugin

## Local standalone repo

This directory is intended to become its own repository at:

[https://github.com/Agent-Analytics/paperclip-live-analytics-plugin](https://github.com/Agent-Analytics/paperclip-live-analytics-plugin)
