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

## Quick checks

If the plugin looks healthy but the data looks wrong, check these first:

1. The connected account has access to the right Agent Analytics projects
2. The mapped projects are the ones actually receiving traffic
3. The account tier supports `/live`
4. The asset is enabled and not snoozed in plugin settings
5. Multiple assets are not pointing at the same Agent Analytics project unless that mirroring is intentional
