# Asset Mapping Guide

The current public plugin UI does not expose per-asset mapping controls.

## Current behavior

- Each Paperclip company selects one Agent Analytics project.
- The live page and widget render that project's current live state.
- Older worker/state code still understands mapping-shaped data for compatibility, but that is not part of the public setup flow.

## Why this document still exists

- The worker normalizes legacy `monitoredAssets` state if it already exists.
- New installs should be documented and reasoned about as single-project configuration, not asset-by-asset mapping.
