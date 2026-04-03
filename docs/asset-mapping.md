# Asset Mapping Guide

Mappings are explicit and company-scoped.

## Required fields

- `assetKey`
- `label`
- `kind`
- `agentAnalyticsProject`

## Optional fields

- `paperclipProjectId`
- `primaryHostname`
- `allowedOrigins`
- `enabled`

## Important v1 rule

`/live` snapshots are project-scoped. If multiple mappings reuse the same Agent Analytics project, the plugin may mirror the same live totals across more than one asset card. The settings page warns when this happens.

