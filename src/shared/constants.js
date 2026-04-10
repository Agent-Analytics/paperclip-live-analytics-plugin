export const PLUGIN_ID = '@agent-analytics/paperclip-live-analytics-plugin';
export const PLUGIN_DISPLAY_NAME = 'Agent Analytics Live';
export const PLUGIN_PAGE_ROUTE = 'agent-analytics-live';
export const DEFAULT_BASE_URL = 'https://api.agentanalytics.sh';
export const AUTH_ERROR_CODE_ACCOUNT_SETUP_REQUIRED = 'ACCOUNT_SETUP_REQUIRED';
export const DEFAULT_LIVE_WINDOW_SECONDS = 60;
export const DEFAULT_POLL_INTERVAL_SECONDS = 15;
export const HISTORICAL_SUMMARY_DAYS = 7;
export const HISTORICAL_SUMMARY_REFRESH_MS = 60_000;
export const MIN_LIVE_WINDOW_SECONDS = 10;
export const MAX_LIVE_WINDOW_SECONDS = 300;
export const MIN_POLL_INTERVAL_SECONDS = 5;
export const MAX_POLL_INTERVAL_SECONDS = 60;
export const DEFAULT_SNOOZE_MINUTES = 30;
export const MAX_ENABLED_ASSET_STREAMS = 10;
export const LIVE_STREAM_CHANNEL = 'agent-analytics-live';
export const STATE_NAMESPACE = 'agent-analytics-live';
export const BILLING_UPGRADE_URL = 'https://app.agentanalytics.sh/account/billing';

export const DATA_KEYS = {
  livePageLoad: 'live.page.load',
  liveWidgetLoad: 'live.widget.load',
  settingsLoad: 'settings.load',
};

export const ACTION_KEYS = {
  authStart: 'auth.start',
  authComplete: 'auth.complete',
  authDisconnect: 'auth.disconnect',
  authErrorAcknowledge: 'auth.error.acknowledge',
  authReconnect: 'auth.reconnect',
  settingsSave: 'settings.save',
  mappingUpsert: 'mapping.upsert',
  mappingRemove: 'mapping.remove',
  assetSnooze: 'asset.snooze',
  assetUnsnooze: 'asset.unsnooze',
};

export const AGENT_SESSION_SCOPES = [
  'account:read',
  'projects:read',
  'projects:write',
  'analytics:read',
  'live:read',
];

export const ASSET_KINDS = ['website', 'docs', 'app', 'api', 'other'];
