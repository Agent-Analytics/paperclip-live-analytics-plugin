# Operator Overview

Agent Analytics Live is the Paperclip surface for answering one question quickly:

Which company asset is moving right now, and is that movement worth operator attention?

## Surfaces

- `page`: company-level live monitor with asset cards, world/country emphasis, top pages, top events, and recent evidence
- `dashboardWidget`: compact pulse for the main dashboard
- `sidebar`: left-nav entry that opens the live page directly
- `settingsPage`: connection status, project selection for the current company, account validation, and advanced plugin settings

## Best use cases

- Triage live spikes without leaving the Paperclip workspace
- See whether a launch, campaign, or onboarding change is producing real movement now
- Keep a lightweight company pulse on the main dashboard

## Assumptions

- The plugin is multi-company: each Paperclip company has its own plugin setup state
- One Paperclip company selects one Agent Analytics project in that company's plugin settings
- `/live` and `/stream` are paid live routes, so the account tier must permit live reads
- The plugin is intentionally live-window-only; it is not historical reporting

## What this plugin is not for

- Deep historical analysis
- Funnel building or long-range reporting
- Replacing the rest of the Agent Analytics product surface
