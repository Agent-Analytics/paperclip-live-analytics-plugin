# Live Behavior

## Data sources

- `/stream`: incremental live event feed over Server-Sent Events
- `/live`: authoritative rollup snapshot for the short live window

The UI uses both:

- `/stream` keeps the recent evidence feed moving
- `/live` keeps the rollup cards and summary metrics authoritative

## What the metrics mean

- `Active visitors`: unique users inside the current `/live` window
- `Active sessions`: unique sessions inside the current `/live` window
- `Events / min`: current live-window event rate
- `Recent events`: operator evidence feed, not a full audit log

## What to expect

- This plugin is optimized for short live windows, not long reporting ranges
- Totals can change quickly as new live snapshots replace the previous window
- Duplicate project mappings can mirror the same live movement across more than one asset card

## What this plugin is not

- Not a rebuild of the Agent Analytics reporting product
- Not a historical dashboard
- Not an automated issue router
