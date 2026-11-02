# Maintainer Notes

## Host contract

- Manifest entrypoints:
  - published worker bundle → `./dist/worker.js`
  - published UI bundle → `./dist/ui`
- Declared surfaces:
  - `page`
  - `dashboardWidget`
  - `sidebar`
  - `settingsPage`

## Worker/UI boundary

- Worker owns auth, refresh, `/stream`, `/live`, per-company cache, and stream emission
- UI consumes worker data/actions/streams only
- No third-party credentials leave the worker boundary

## State ownership

- Company-scoped config: base URL, live window, poll cadence, selected project
- Company-scoped auth: access token, refresh token, tier, pending detached login state
- Company-scoped UI state: snoozed assets
- Legacy `monitoredAssets` state is still normalized for compatibility, but the public v1 UI is single-project

## Stream delivery

- Worker opens one company-scoped host stream channel
- Worker emits normalized full-state payloads
- UI replaces local live state wholesale on each event
