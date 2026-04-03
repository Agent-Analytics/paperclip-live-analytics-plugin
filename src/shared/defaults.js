import {
  DEFAULT_BASE_URL,
  DEFAULT_LIVE_WINDOW_SECONDS,
  DEFAULT_POLL_INTERVAL_SECONDS,
} from './constants.js';

export function createDefaultSettings() {
  return {
    agentAnalyticsBaseUrl: DEFAULT_BASE_URL,
    liveWindowSeconds: DEFAULT_LIVE_WINDOW_SECONDS,
    pollIntervalSeconds: DEFAULT_POLL_INTERVAL_SECONDS,
    selectedProjectId: '',
    selectedProjectName: '',
    selectedProjectLabel: '',
    selectedProjectAllowedOrigins: [],
    monitoredAssets: [],
    pluginEnabled: true,
  };
}

export function createDefaultAuthState() {
  return {
    mode: 'agent_session',
    accessToken: null,
    refreshToken: null,
    accessExpiresAt: null,
    refreshExpiresAt: null,
    accountSummary: null,
    tier: null,
    status: 'disconnected',
    pendingAuthRequest: null,
    lastValidatedAt: null,
    lastError: null,
  };
}

export function createDefaultSnoozeState() {
  return {};
}

export function createEmptyCompanyLiveState() {
  return {
    type: 'live_state',
    generatedAt: Date.now(),
    pluginEnabled: true,
    authStatus: 'disconnected',
    tier: null,
    account: null,
    connection: {
      status: 'idle',
      label: 'Not connected',
      detail: 'Connect Agent Analytics from settings to start the live feed.',
    },
    metrics: {
      activeVisitors: 0,
      activeSessions: 0,
      eventsPerMinute: 0,
      assetsConfigured: 0,
      assetsVisible: 0,
      countriesTracked: 0,
    },
    world: {
      hotCountry: null,
      countries: [],
    },
    evidence: {
      topPages: [],
      topEvents: [],
      recentEvents: [],
      countries: [],
    },
    assets: [],
    snoozedAssets: [],
    warnings: [],
  };
}
