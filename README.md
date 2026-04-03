# Agent Analytics Live for Paperclip

Thin live-monitor plugin for Paperclip companies that want Agent Analytics signals where operators already work.

## Install

```bash
npx paperclipai plugin install @agent-analytics/paperclip-live-analytics-plugin
```

## What ships in v1

- `page`: company-level live operator view
- `dashboardWidget`: compact live summary
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

`https://github.com/Agent-Analytics/paperclip-live-analytics-plugin`
