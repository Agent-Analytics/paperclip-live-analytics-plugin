# Live Behavior

## Data sources

- `/stream`: incremental live event feed over Server-Sent Events
- `/live`: authoritative rollup snapshot for the short live window

## What the metrics mean

- `Active visitors`: unique users inside the current `/live` window
- `Active sessions`: unique sessions inside the current `/live` window
- `Events / min`: current live-window event rate
- `Recent events`: operator evidence feed, not a full audit log

## What this plugin is not

- Not a rebuild of the Agent Analytics reporting product
- Not a historical dashboard
- Not an automated issue router

