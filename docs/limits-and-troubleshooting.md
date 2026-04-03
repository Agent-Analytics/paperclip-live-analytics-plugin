# Limits And Troubleshooting

## Hard limits

- `/stream` and `/live` are metered read routes
- `/live` is paid-only
- Upstream live streams are capped at 10 concurrent streams per account
- `/live` keeps only the most recent 5 minutes of backing event history

## Common failure modes

- `unauthorized` or `invalid refresh token`: reconnect from settings
- duplicate project mappings: reduce repeated project use or accept mirrored project totals
- no live data with a free tier: upgrade the connected account
- stale UI while connection is healthy: check whether the asset is snoozed or disabled

