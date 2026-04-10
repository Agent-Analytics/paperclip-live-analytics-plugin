# Operator Overview

Agent Analytics Live is the Paperclip surface for answering one question quickly:

Which company asset is moving right now, and is that movement worth operator attention?

## Surfaces

- `page`: company-level live monitor with asset cards, world/country emphasis, top pages, top events, and recent evidence
- `dashboardWidget`: compact pulse for the main dashboard
- `settingsPage`: connection status, account validation, and advanced plugin settings

## Assumptions

- One Paperclip company connects one Agent Analytics account
- One Paperclip company selects one Agent Analytics project from the company live page in the current public UI
- `/live` and `/stream` are paid live routes, so the account tier must permit live reads
- The plugin is intentionally live-window-only; it is not historical reporting
