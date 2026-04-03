# Maintainer Notes

## Host contract

- Manifest entrypoints:
  - `entrypoints.worker` → `./src/worker/index.js`
  - `entrypoints.ui` → `./dist`
- Declared surfaces:
  - `page`
  - `dashboardWidget`
  - `settingsPage`

## Worker/UI boundary

- Worker owns auth, refresh, `/stream`, `/live`, per-company cache, and stream emission
- UI consumes worker data/actions/streams only
- No third-party credentials leave the worker boundary

## State ownership

- Company-scoped config: base URL, live window, poll cadence, enabled mappings
- Company-scoped auth: access token, refresh token, tier, pending detached login state
- Company-scoped UI state: snoozed assets

## Stream delivery

- Worker opens one company-scoped host stream channel
- Worker emits normalized full-state payloads
- UI replaces local live state wholesale on each event

