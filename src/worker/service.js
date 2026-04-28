import {
  ACTION_KEYS,
  DATA_KEYS,
  DEFAULT_BASE_URL,
  DEFAULT_SNOOZE_MINUTES,
  HISTORICAL_SUMMARY_DAYS,
  HISTORICAL_SUMMARY_REFRESH_MS,
  MAX_ENABLED_ASSET_STREAMS,
} from '../shared/constants.js';
import {
  buildCompanyLiveState,
  buildHistoricalSummary,
  clampLiveWindowSeconds,
  clampPollIntervalSeconds,
  createEmptyAssetState,
  createSnoozeExpiry,
  deriveWidgetSummary,
  mappingSignature,
  normalizeAssetMapping,
  applySnapshotToAssetState,
  applyTrackEventToAssetState,
  validateEnabledMappings,
} from '../shared/live-state.js';
import { createDefaultSettings } from '../shared/defaults.js';
import { AgentAnalyticsClient } from '../shared/agent-analytics-client.js';
import { closeLiveChannel, emitLiveState, openLiveChannel, registerActionHandler, registerDataHandler } from './paperclip.js';
import { loadAuthState, loadSettings, loadSnoozes, saveAuthState, saveSettings, saveSnoozes } from './state.js';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_RUNTIME_IDLE_MS = 30_000;

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  const buffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createPkcePair() {
  const codeVerifier = randomHex(32);
  return {
    codeVerifier,
    codeChallenge: await sha256Hex(codeVerifier),
  };
}

function serializeAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    githubLogin: account.github_login || null,
    googleName: account.google_name || null,
  };
}

function isStreamLimitErrorMessage(message) {
  return /STREAM_LIMIT|maximum 10 concurrent streams/i.test(String(message || ''));
}

function isProRequiredError(error) {
  return error?.code === 'PRO_REQUIRED' || (error?.status === 403 && /paid plans|upgrade/i.test(String(error?.message || '')));
}

function toPublicAuthState(auth) {
  const pendingAuthRequest = auth.pendingAuthRequest
    ? {
        authRequestId: auth.pendingAuthRequest.authRequestId,
        authorizeUrl: auth.pendingAuthRequest.authorizeUrl,
        pollToken: auth.pendingAuthRequest.pollToken,
        expiresAt: auth.pendingAuthRequest.expiresAt,
      }
    : null;
  return {
    status: auth.status,
    mode: auth.mode,
    tier: auth.tier,
    accountSummary: auth.accountSummary,
    accessExpiresAt: auth.accessExpiresAt,
    refreshExpiresAt: auth.refreshExpiresAt,
    pendingAuthRequest,
    lastValidatedAt: auth.lastValidatedAt,
    lastError: auth.lastError,
    connected: Boolean(auth.accessToken),
  };
}

export class PaperclipLiveAnalyticsService {
  constructor(ctx, { fetchImpl = globalThis.fetch, runtimeIdleMs = DEFAULT_RUNTIME_IDLE_MS } = {}) {
    this.ctx = ctx;
    this.fetchImpl = fetchImpl;
    this.runtimeIdleMs = runtimeIdleMs;
    this.runtimes = new Map();
  }

  requireCompanyId(companyId) {
    const normalized = String(companyId || '').trim();
    if (!normalized) {
      throw new Error('companyId is required for company-scoped plugin actions');
    }
    return normalized;
  }

  async register() {
    await registerDataHandler(this.ctx, DATA_KEYS.livePageLoad, (input) => this.loadLivePage(input));
    await registerDataHandler(this.ctx, DATA_KEYS.liveWidgetLoad, (input) => this.loadLiveWidget(input));
    await registerDataHandler(this.ctx, DATA_KEYS.settingsLoad, (input) => this.loadSettingsData(input));

    await registerActionHandler(this.ctx, ACTION_KEYS.authStart, (input) => this.startAuth(input));
    await registerActionHandler(this.ctx, ACTION_KEYS.authComplete, (input) => this.completeAuth(input));
    await registerActionHandler(this.ctx, ACTION_KEYS.authErrorAcknowledge, (input) => this.acknowledgeAuthError(input));
    await registerActionHandler(this.ctx, ACTION_KEYS.authReconnect, (input) => this.reconnectAuth(input));
    await registerActionHandler(this.ctx, ACTION_KEYS.authDisconnect, (input) => this.disconnectAuth(input));
    await registerActionHandler(this.ctx, ACTION_KEYS.settingsSave, (input) => this.savePluginSettings(input));
    await registerActionHandler(this.ctx, ACTION_KEYS.mappingUpsert, (input) => this.upsertMapping(input));
    await registerActionHandler(this.ctx, ACTION_KEYS.mappingRemove, (input) => this.removeMapping(input));
    await registerActionHandler(this.ctx, ACTION_KEYS.assetSnooze, (input) => this.snoozeAsset(input));
    await registerActionHandler(this.ctx, ACTION_KEYS.assetUnsnooze, (input) => this.unsnoozeAsset(input));
  }

  async shutdown() {
    for (const [companyId] of this.runtimes.entries()) {
      await this.stopRuntime(companyId);
    }
  }

  async loadLivePage({ companyId }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    this.touchRuntime(scopeCompanyId);
    const liveState = await this.ensureLiveState(scopeCompanyId);
    return liveState;
  }

  async loadLiveWidget({ companyId }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    this.touchRuntime(scopeCompanyId);
    const liveState = await this.ensureLiveState(scopeCompanyId);
    return deriveWidgetSummary(liveState);
  }

  async loadSettingsData({ companyId }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const settings = this.normalizeSettings(await loadSettings(this.ctx, scopeCompanyId));
    const auth = await loadAuthState(this.ctx, scopeCompanyId);
    const validation = this.validateSettings(settings, auth);
    const projects = await this.listProjectsForCompany(scopeCompanyId).catch((error) => ({
      projects: [],
      tier: auth.tier,
      error: error.message,
    }));
    return {
      settings,
      auth: toPublicAuthState(auth),
      discoveredProjects: projects.projects || [],
      validation,
      projectListError: projects.error || null,
    };
  }

  async startAuth({ companyId, label, callbackUrl = null }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const settings = this.normalizeSettings(await loadSettings(this.ctx, scopeCompanyId));
    const auth = await loadAuthState(this.ctx, scopeCompanyId);
    const client = this.createClient(scopeCompanyId, settings, auth);
    const pkce = callbackUrl ? await createPkcePair() : null;
    const started = await client.startPaperclipAuth({
      companyId: scopeCompanyId,
      label,
      mode: callbackUrl ? 'interactive' : 'detached',
      callbackUrl,
      codeChallenge: pkce?.codeChallenge,
    });

    const nextAuth = {
      ...auth,
      accessToken: null,
      refreshToken: null,
      accessExpiresAt: null,
      refreshExpiresAt: null,
      accountSummary: null,
      tier: null,
      status: 'pending',
      lastError: null,
      pendingAuthRequest: {
        authRequestId: started.auth_request_id,
        authorizeUrl: started.authorize_url,
        pollToken: started.poll_token,
        expiresAt: started.expires_at,
        codeVerifier: pkce?.codeVerifier || null,
      },
    };
    await saveAuthState(this.ctx, scopeCompanyId, nextAuth);
    return this.loadSettingsData({ companyId: scopeCompanyId });
  }

  async completeAuth({ companyId, authRequestId, exchangeCode }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const settings = await loadSettings(this.ctx, scopeCompanyId);
    const auth = await loadAuthState(this.ctx, scopeCompanyId);
    if (auth.accessToken && !auth.pendingAuthRequest) {
      return this.loadSettingsData({ companyId: scopeCompanyId });
    }

    const requestId = authRequestId || auth.pendingAuthRequest?.authRequestId;
    const codeVerifier = auth.pendingAuthRequest?.codeVerifier || null;
    if (!requestId || !exchangeCode) {
      throw new Error('authRequestId and exchangeCode are required');
    }

    const client = this.createClient(scopeCompanyId, settings, auth);
    let exchanged;
    try {
      exchanged = await client.exchangeAgentSession(requestId, exchangeCode, codeVerifier);
    } catch (error) {
      const latestAuth = await loadAuthState(this.ctx, scopeCompanyId);
      if (latestAuth.accessToken && !latestAuth.pendingAuthRequest) {
        return this.loadSettingsData({ companyId: scopeCompanyId });
      }
      throw error;
    }

    const nextAuth = {
      mode: 'agent_session',
      accessToken: exchanged.agent_session.access_token,
      refreshToken: exchanged.agent_session.refresh_token,
      accessExpiresAt: exchanged.agent_session.access_expires_at,
      refreshExpiresAt: exchanged.agent_session.refresh_expires_at,
      accountSummary: serializeAccount(exchanged.account),
      tier: exchanged.account?.tier || null,
      status: 'connected',
      pendingAuthRequest: null,
      lastValidatedAt: Date.now(),
      lastError: null,
    };

    await saveAuthState(this.ctx, scopeCompanyId, nextAuth);
    await this.ensureLiveState(scopeCompanyId, { forceSync: true });
    return this.loadSettingsData({ companyId: scopeCompanyId });
  }

  async acknowledgeAuthError({ companyId, message }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const auth = await loadAuthState(this.ctx, scopeCompanyId);
    const nextAuth = {
      ...auth,
      status: auth.accessToken ? 'connected' : 'disconnected',
      pendingAuthRequest: null,
      lastError: message || auth.lastError || 'Agent Analytics login could not be completed.',
    };
    await saveAuthState(this.ctx, scopeCompanyId, nextAuth);
    return this.loadSettingsData({ companyId: scopeCompanyId });
  }

  async reconnectAuth({ companyId }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const settings = this.normalizeSettings(await loadSettings(this.ctx, scopeCompanyId));
    const auth = await loadAuthState(this.ctx, scopeCompanyId);
    if (auth.pendingAuthRequest?.authRequestId && auth.pendingAuthRequest?.pollToken) {
      return this.pollPendingAuth(scopeCompanyId, settings, auth);
    }
    if (!auth.refreshToken) {
      return this.startAuth({ companyId: scopeCompanyId });
    }

    const client = this.createClient(scopeCompanyId, settings, auth);
    const refreshed = await client.refreshAgentSession();
    const nextAuth = {
      ...auth,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || auth.refreshToken,
      accessExpiresAt: refreshed.access_expires_at,
      refreshExpiresAt: refreshed.refresh_expires_at || auth.refreshExpiresAt,
      status: 'connected',
      lastValidatedAt: Date.now(),
      lastError: null,
    };
    await saveAuthState(this.ctx, scopeCompanyId, nextAuth);
    await this.ensureLiveState(scopeCompanyId, { forceSync: true });
    return this.loadSettingsData({ companyId: scopeCompanyId });
  }

  async disconnectAuth({ companyId }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const settings = this.normalizeSettings(await loadSettings(this.ctx, scopeCompanyId));
    const auth = await loadAuthState(this.ctx, scopeCompanyId);
    const nextAuth = {
      ...auth,
      accessToken: null,
      refreshToken: null,
      accessExpiresAt: null,
      refreshExpiresAt: null,
      accountSummary: null,
      tier: null,
      status: 'disconnected',
      pendingAuthRequest: null,
      lastError: null,
    };
    const nextSettings = {
      ...settings,
      selectedProjectId: '',
      selectedProjectName: '',
      selectedProjectLabel: '',
      selectedProjectAllowedOrigins: [],
      monitoredAssets: [],
    };
    await saveSettings(this.ctx, scopeCompanyId, nextSettings);
    await saveAuthState(this.ctx, scopeCompanyId, nextAuth);
    await this.stopRuntime(scopeCompanyId);
    return this.loadSettingsData({ companyId: scopeCompanyId });
  }

  async savePluginSettings({ companyId, settings: partialSettings = {} }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const currentSettings = this.normalizeSettings(await loadSettings(this.ctx, scopeCompanyId));
    const selectedProjectName = String(partialSettings.selectedProjectName ?? currentSettings.selectedProjectName ?? '').trim();
    const nextSettings = {
      ...currentSettings,
      agentAnalyticsBaseUrl: partialSettings.agentAnalyticsBaseUrl || currentSettings.agentAnalyticsBaseUrl || DEFAULT_BASE_URL,
      liveWindowSeconds: clampLiveWindowSeconds(partialSettings.liveWindowSeconds ?? currentSettings.liveWindowSeconds),
      pollIntervalSeconds: clampPollIntervalSeconds(partialSettings.pollIntervalSeconds ?? currentSettings.pollIntervalSeconds),
      selectedProjectId: selectedProjectName ? String(partialSettings.selectedProjectId ?? currentSettings.selectedProjectId ?? '').trim() : '',
      selectedProjectName,
      selectedProjectLabel: selectedProjectName
        ? String(partialSettings.selectedProjectLabel ?? currentSettings.selectedProjectLabel ?? selectedProjectName).trim()
        : '',
      selectedProjectAllowedOrigins: selectedProjectName
        ? this.normalizeAllowedOrigins(partialSettings.selectedProjectAllowedOrigins ?? currentSettings.selectedProjectAllowedOrigins)
        : [],
      monitoredAssets: [],
      pluginEnabled: partialSettings.pluginEnabled ?? currentSettings.pluginEnabled,
    };
    await saveSettings(this.ctx, scopeCompanyId, nextSettings);
    await this.ensureLiveState(scopeCompanyId, { forceSync: true });
    return this.loadSettingsData({ companyId: scopeCompanyId });
  }

  async upsertMapping({ companyId, mapping }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const settings = await loadSettings(this.ctx, scopeCompanyId);
    const normalized = normalizeAssetMapping(mapping);
    const monitoredAssets = [...settings.monitoredAssets];
    const existingIndex = monitoredAssets.findIndex((entry) => entry.assetKey === normalized.assetKey);

    if (existingIndex === -1) monitoredAssets.push(normalized);
    else monitoredAssets.splice(existingIndex, 1, normalized);

    const validation = validateEnabledMappings(monitoredAssets);
    if (validation.errors.length > 0) {
      throw new Error(validation.errors.join(' '));
    }

    const nextSettings = {
      ...settings,
      monitoredAssets,
    };
    await saveSettings(this.ctx, scopeCompanyId, nextSettings);
    await this.ensureLiveState(scopeCompanyId, { forceSync: true });
    return this.loadSettingsData({ companyId: scopeCompanyId });
  }

  async removeMapping({ companyId, assetKey }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const settings = await loadSettings(this.ctx, scopeCompanyId);
    const nextSettings = {
      ...settings,
      monitoredAssets: settings.monitoredAssets.filter((mapping) => mapping.assetKey !== assetKey),
    };
    await saveSettings(this.ctx, scopeCompanyId, nextSettings);
    await this.ensureLiveState(scopeCompanyId, { forceSync: true });
    return this.loadSettingsData({ companyId: scopeCompanyId });
  }

  async snoozeAsset({ companyId, assetKey, minutes = DEFAULT_SNOOZE_MINUTES }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const snoozes = await loadSnoozes(this.ctx, scopeCompanyId);
    const nextSnoozes = {
      ...snoozes,
      [assetKey]: createSnoozeExpiry(minutes),
    };
    await saveSnoozes(this.ctx, scopeCompanyId, nextSnoozes);
    const liveState = await this.ensureLiveState(scopeCompanyId);
    return {
      snoozes: nextSnoozes,
      liveState,
    };
  }

  async unsnoozeAsset({ companyId, assetKey }) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const snoozes = await loadSnoozes(this.ctx, scopeCompanyId);
    const nextSnoozes = { ...snoozes };
    delete nextSnoozes[assetKey];
    await saveSnoozes(this.ctx, scopeCompanyId, nextSnoozes);
    const liveState = await this.ensureLiveState(scopeCompanyId);
    return {
      snoozes: nextSnoozes,
      liveState,
    };
  }

  async ensureLiveState(companyId, { forceSync = false } = {}) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const settings = this.normalizeSettings(await loadSettings(this.ctx, scopeCompanyId));
    const auth = await loadAuthState(this.ctx, scopeCompanyId);
    const snoozes = await loadSnoozes(this.ctx, scopeCompanyId);

    const runtime = this.getRuntime(scopeCompanyId);
    if (forceSync) {
      await this.syncRuntime(scopeCompanyId, settings, auth, runtime);
    } else if (!runtime.lastState) {
      await this.syncRuntime(scopeCompanyId, settings, auth, runtime);
    }

    await this.syncHistoricalSummary(scopeCompanyId, settings, auth, runtime, { forceSync });

    return this.composeLiveState(scopeCompanyId, settings, auth, snoozes);
  }

  async syncRuntime(companyId, settings, auth, runtime) {
    const selectedMapping = this.getSelectedProjectMapping(settings);
    const mappings = selectedMapping ? [selectedMapping] : [];
    const validation = validateEnabledMappings(mappings);
    if (!settings.pluginEnabled || !auth.accessToken || !selectedMapping || validation.errors.length > 0 || auth.tier !== 'pro') {
      if (validation.errors.length > 0) {
        auth.status = 'error';
        auth.lastError = validation.errors.join(' ');
        await saveAuthState(this.ctx, companyId, auth);
      }
      runtime.assetStates.clear();
      await this.stopRuntime(companyId, { keepState: true });
      return;
    }

    await openLiveChannel(this.ctx, companyId);

    for (const mapping of mappings) {
      const current = runtime.assetStates.get(mapping.assetKey) || createEmptyAssetState(mapping);
      runtime.assetStates.set(mapping.assetKey, {
        ...current,
        ...mapping,
      });
    }

    for (const assetKey of Array.from(runtime.assetStates.keys())) {
      if (!mappings.find((mapping) => mapping.assetKey === assetKey)) {
        runtime.assetStates.delete(assetKey);
      }
    }

    const enabledMappings = mappings.filter((mapping) => mapping.enabled !== false).slice(0, MAX_ENABLED_ASSET_STREAMS);
    const groupedMappings = new Map();
    for (const mapping of enabledMappings) {
      const signature = mappingSignature(mapping);
      const group = groupedMappings.get(signature) || [];
      group.push(mapping);
      groupedMappings.set(signature, group);
    }

    for (const [signature, streamRuntime] of runtime.streams.entries()) {
      if (!groupedMappings.has(signature)) {
        streamRuntime.controller.abort();
        runtime.streams.delete(signature);
      }
    }

    for (const [signature, group] of groupedMappings.entries()) {
      const existing = runtime.streams.get(signature);
      if (existing) {
        existing.mappings = group;
      } else {
        runtime.streams.set(signature, this.startStreamLoop(companyId, settings, auth, group));
      }
    }

    for (const mapping of enabledMappings) {
      const poller = runtime.pollers.get(mapping.assetKey);
      if (poller) {
        clearInterval(poller);
      }

      const intervalId = setInterval(() => {
        this.refreshSnapshot(companyId, mapping).catch((error) => this.recordAssetError(companyId, mapping.assetKey, error));
      }, settings.pollIntervalSeconds * 1000);
      runtime.pollers.set(mapping.assetKey, intervalId);
      await this.refreshSnapshot(companyId, mapping);
    }

    for (const [assetKey, intervalId] of runtime.pollers.entries()) {
      if (!enabledMappings.find((mapping) => mapping.assetKey === assetKey)) {
        clearInterval(intervalId);
        runtime.pollers.delete(assetKey);
      }
    }
  }

  createClient(companyId, settings, auth) {
    return new AgentAnalyticsClient({
      auth: {
        access_token: auth.accessToken,
        refresh_token: auth.refreshToken,
      },
      baseUrl: settings.agentAnalyticsBaseUrl || DEFAULT_BASE_URL,
      fetchImpl: this.fetchImpl,
      onAuthUpdate: async (nextAuth) => {
        const current = await loadAuthState(this.ctx, companyId);
        await saveAuthState(this.ctx, companyId, {
          ...current,
          accessToken: nextAuth.access_token,
          refreshToken: nextAuth.refresh_token || current.refreshToken,
          accessExpiresAt: nextAuth.access_expires_at,
          refreshExpiresAt: nextAuth.refresh_expires_at || current.refreshExpiresAt,
          status: 'connected',
          lastValidatedAt: Date.now(),
          lastError: null,
        });
      },
    });
  }

  getRuntime(companyId) {
    let runtime = this.runtimes.get(companyId);
    if (!runtime) {
      runtime = {
        pollers: new Map(),
        streams: new Map(),
        assetStates: new Map(),
        historicalSummary: null,
        lastHistoricalSyncAt: 0,
        lastState: null,
        lastAccessedAt: 0,
        idleTimeoutId: null,
      };
      this.runtimes.set(companyId, runtime);
    }
    return runtime;
  }

  touchRuntime(companyId) {
    const runtime = this.getRuntime(companyId);
    runtime.lastAccessedAt = Date.now();
    if (runtime.idleTimeoutId) {
      clearTimeout(runtime.idleTimeoutId);
    }
    runtime.idleTimeoutId = setTimeout(() => {
      const current = this.runtimes.get(companyId);
      if (!current) return;
      if (Date.now() - current.lastAccessedAt < this.runtimeIdleMs) return;
      void this.stopRuntime(companyId).catch(() => {});
    }, this.runtimeIdleMs);
    return runtime;
  }

  normalizeAllowedOrigins(input) {
    if (Array.isArray(input)) {
      return input.map((value) => String(value).trim()).filter(Boolean);
    }
    if (typeof input === 'string') {
      return input === '*' ? ['*'] : input.split(',').map((value) => value.trim()).filter(Boolean);
    }
    return [];
  }

  normalizeSettings(settings = {}) {
    const next = {
      ...createDefaultSettings(),
      ...(settings || {}),
    };

    if (!next.selectedProjectName && Array.isArray(next.monitoredAssets) && next.monitoredAssets.length > 0) {
      const legacy = normalizeAssetMapping(next.monitoredAssets[0]);
      next.selectedProjectName = legacy.agentAnalyticsProject;
      next.selectedProjectLabel = legacy.label || legacy.agentAnalyticsProject;
      next.selectedProjectAllowedOrigins = legacy.allowedOrigins || [];
    }

    next.selectedProjectId = String(next.selectedProjectId || '').trim();
    next.selectedProjectName = String(next.selectedProjectName || '').trim();
    next.selectedProjectLabel = String(next.selectedProjectLabel || next.selectedProjectName || '').trim();
    next.selectedProjectAllowedOrigins = this.normalizeAllowedOrigins(next.selectedProjectAllowedOrigins);
    next.monitoredAssets = Array.isArray(next.monitoredAssets) ? next.monitoredAssets : [];
    return next;
  }

  getSelectedProjectMapping(settings) {
    if (!settings.selectedProjectName) return null;
    return normalizeAssetMapping({
      assetKey: settings.selectedProjectName,
      label: settings.selectedProjectLabel || settings.selectedProjectName,
      kind: 'other',
      agentAnalyticsProject: settings.selectedProjectName,
      allowedOrigins: settings.selectedProjectAllowedOrigins,
      enabled: true,
    });
  }

  validateSettings(settings, auth) {
    const warnings = [];
    if (auth.accessToken && auth.tier && auth.tier !== 'pro') {
      warnings.push('Live events are a paid feature. The plugin will show the last 7 days until you upgrade.');
    }
    return { warnings, errors: [] };
  }

  async pollPendingAuth(companyId, settings, auth) {
    const requestId = auth.pendingAuthRequest?.authRequestId;
    const pollToken = auth.pendingAuthRequest?.pollToken;
    if (!requestId || !pollToken) {
      return this.loadSettingsData({ companyId });
    }

    const client = this.createClient(companyId, settings, auth);
    try {
      const polled = await client.pollAgentSession(requestId, pollToken);
      if (polled.status === 'pending') {
        return this.loadSettingsData({ companyId });
      }
      if (!polled.exchange_code) {
        throw new Error('Approval completed without an exchange code.');
      }

      const exchanged = await client.exchangeAgentSession(requestId, polled.exchange_code, auth.pendingAuthRequest?.codeVerifier || null);
      const nextAuth = {
        mode: 'agent_session',
        accessToken: exchanged.agent_session.access_token,
        refreshToken: exchanged.agent_session.refresh_token,
        accessExpiresAt: exchanged.agent_session.access_expires_at,
        refreshExpiresAt: exchanged.agent_session.refresh_expires_at,
        accountSummary: serializeAccount(exchanged.account),
        tier: exchanged.account?.tier || null,
        status: 'connected',
        pendingAuthRequest: null,
        lastValidatedAt: Date.now(),
        lastError: null,
      };

      await saveAuthState(this.ctx, companyId, nextAuth);
      await this.ensureLiveState(companyId, { forceSync: true });
      return this.loadSettingsData({ companyId });
    } catch (error) {
      const message = error.message || String(error);
      if (/expired|revoked|invalid auth request/i.test(message)) {
        await saveAuthState(this.ctx, companyId, {
          ...auth,
          accessToken: null,
          refreshToken: null,
          accessExpiresAt: null,
          refreshExpiresAt: null,
          accountSummary: null,
          tier: null,
          status: 'disconnected',
          pendingAuthRequest: null,
          lastError: message,
        });
      }
      return this.loadSettingsData({ companyId });
    }
  }

  startStreamLoop(companyId, settings, auth, mappings) {
    const controller = new AbortController();
    const runtime = {
      controller,
      mappings,
      run: (async () => {
        while (!controller.signal.aborted) {
          try {
            const currentSettings = await loadSettings(this.ctx, companyId);
            const currentAuth = await loadAuthState(this.ctx, companyId);
            const client = this.createClient(companyId, currentSettings, currentAuth);
            const primaryMapping = mappings[0];
            await client.subscribeToStream({
              project: primaryMapping.agentAnalyticsProject,
              filter: primaryMapping.primaryHostname ? `hostname:${primaryMapping.primaryHostname}` : null,
              signal: controller.signal,
              onTrack: async (track) => {
                await this.applyTrackEvent(companyId, mappings, track);
              },
            });
          } catch (error) {
            if (!controller.signal.aborted) {
              for (const mapping of mappings) {
                await this.recordAssetError(companyId, mapping.assetKey, error);
              }
              await delay(2_000);
            }
          }
        }
      })(),
    };
    return runtime;
  }

  async refreshSnapshot(companyId, mapping) {
    const settings = await loadSettings(this.ctx, companyId);
    const auth = await loadAuthState(this.ctx, companyId);
    const client = this.createClient(companyId, settings, auth);
    const snapshot = await client.getLive(mapping.agentAnalyticsProject, {
      window: settings.liveWindowSeconds,
    });
    const runtime = this.getRuntime(companyId);
    const currentState = runtime.assetStates.get(mapping.assetKey) || createEmptyAssetState(mapping);
    runtime.assetStates.set(mapping.assetKey, applySnapshotToAssetState(currentState, snapshot, mapping));
    if (auth.accessToken && (auth.status !== 'connected' || auth.lastError)) {
      await saveAuthState(this.ctx, companyId, {
        ...auth,
        status: 'connected',
        lastError: null,
      });
    }
    await this.publish(companyId);
  }

  async applyTrackEvent(companyId, mappings, track) {
    const runtime = this.getRuntime(companyId);
    for (const mapping of mappings) {
      const currentState = runtime.assetStates.get(mapping.assetKey) || createEmptyAssetState(mapping);
      runtime.assetStates.set(mapping.assetKey, applyTrackEventToAssetState(currentState, track, mapping));
    }
    await this.publish(companyId);
  }

  async recordAssetError(companyId, assetKey, error) {
    const runtime = this.getRuntime(companyId);
    const current = runtime.assetStates.get(assetKey);
    if (!current) return;
    const message = error.message || String(error);
    runtime.assetStates.set(assetKey, {
      ...current,
      status: isStreamLimitErrorMessage(message) && current.lastSnapshotAt ? 'live' : 'error',
      errors: [message],
      lastUpdatedAt: Date.now(),
    });

    if (!isStreamLimitErrorMessage(message) && !isProRequiredError(error)) {
      const auth = await loadAuthState(this.ctx, companyId);
      await saveAuthState(this.ctx, companyId, {
        ...auth,
        status: 'error',
        lastError: message,
      });
    }
    await this.publish(companyId);
  }

  async publish(companyId) {
    const settings = this.normalizeSettings(await loadSettings(this.ctx, companyId));
    const auth = await loadAuthState(this.ctx, companyId);
    const snoozes = await loadSnoozes(this.ctx, companyId);
    const liveState = this.composeLiveState(companyId, settings, auth, snoozes);
    await emitLiveState(this.ctx, companyId, liveState);
  }

  composeLiveState(companyId, settings, auth, snoozes) {
    const runtime = this.getRuntime(companyId);
    const selectedMapping = this.getSelectedProjectMapping(settings);
    const assetStates = selectedMapping
      ? [runtime.assetStates.get(selectedMapping.assetKey) || createEmptyAssetState(selectedMapping)]
      : [];

    const liveState = buildCompanyLiveState({
      settings,
      auth,
      assets: assetStates,
      historicalSummary: runtime.historicalSummary,
      snoozes,
    });
    runtime.lastState = liveState;
    return liveState;
  }

  async listProjectsForCompany(companyId) {
    const scopeCompanyId = this.requireCompanyId(companyId);
    const settings = this.normalizeSettings(await loadSettings(this.ctx, scopeCompanyId));
    const auth = await loadAuthState(this.ctx, scopeCompanyId);
    if (!auth.accessToken) {
      return { projects: [], tier: auth.tier, error: null };
    }
    const client = this.createClient(scopeCompanyId, settings, auth);
    return client.listProjects();
  }

  async syncHistoricalSummary(companyId, settings, auth, runtime, { forceSync = false } = {}) {
    const now = Date.now();
    const selectedProjectId = String(settings.selectedProjectId || '').trim();

    if (!auth.accessToken || !selectedProjectId) {
      runtime.historicalSummary = null;
      runtime.lastHistoricalSyncAt = 0;
      return;
    }

    if (!forceSync && runtime.historicalSummary && now - runtime.lastHistoricalSyncAt < HISTORICAL_SUMMARY_REFRESH_MS) {
      return;
    }

    try {
      const client = this.createClient(companyId, settings, auth);
      const [project, usage] = await Promise.all([
        client.getProject(selectedProjectId),
        client.getProjectUsage(selectedProjectId, { days: HISTORICAL_SUMMARY_DAYS }),
      ]);

      runtime.historicalSummary = buildHistoricalSummary({
        project,
        usage: usage?.usage || [],
        settings,
      });
      runtime.lastHistoricalSyncAt = now;
    } catch (error) {
      runtime.historicalSummary = runtime.historicalSummary || buildHistoricalSummary({
        project: null,
        usage: [],
        settings,
      });
      runtime.lastHistoricalSyncAt = now;

      if (!isProRequiredError(error)) {
        const authState = await loadAuthState(this.ctx, companyId);
        await saveAuthState(this.ctx, companyId, {
          ...authState,
          status: 'error',
          lastError: error.message || String(error),
        });
      }
    }
  }

  async stopRuntime(companyId, { keepState = false } = {}) {
    const runtime = this.runtimes.get(companyId);
    if (!runtime) return;

    if (runtime.idleTimeoutId) {
      clearTimeout(runtime.idleTimeoutId);
      runtime.idleTimeoutId = null;
    }

    for (const intervalId of runtime.pollers.values()) {
      clearInterval(intervalId);
    }
    runtime.pollers.clear();

    for (const streamRuntime of runtime.streams.values()) {
      streamRuntime.controller.abort();
    }
    runtime.streams.clear();

    if (!keepState) {
      runtime.assetStates.clear();
      runtime.historicalSummary = null;
      runtime.lastHistoricalSyncAt = 0;
      runtime.lastState = null;
      this.runtimes.delete(companyId);
    }

    await closeLiveChannel(this.ctx, companyId);
  }
}
