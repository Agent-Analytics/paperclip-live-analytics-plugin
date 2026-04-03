import {
  ASSET_KINDS,
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_SNOOZE_MINUTES,
  DEFAULT_LIVE_WINDOW_SECONDS,
  MAX_ENABLED_ASSET_STREAMS,
  MAX_LIVE_WINDOW_SECONDS,
  MAX_POLL_INTERVAL_SECONDS,
  MIN_LIVE_WINDOW_SECONDS,
  MIN_POLL_INTERVAL_SECONDS,
} from './constants.js';
import { createEmptyCompanyLiveState } from './defaults.js';

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function sortCountRows(rows, countKey) {
  return [...rows].sort((left, right) => {
    if ((right[countKey] || 0) !== (left[countKey] || 0)) {
      return (right[countKey] || 0) - (left[countKey] || 0);
    }
    return String(left.label || left.path || left.event || '').localeCompare(
      String(right.label || right.path || right.event || '')
    );
  });
}

function sortCountries(rows) {
  return [...rows].sort((left, right) => {
    if ((right.visitors || 0) !== (left.visitors || 0)) return (right.visitors || 0) - (left.visitors || 0);
    if ((right.sessions || 0) !== (left.sessions || 0)) return (right.sessions || 0) - (left.sessions || 0);
    if ((right.events || 0) !== (left.events || 0)) return (right.events || 0) - (left.events || 0);
    return String(left.country || '').localeCompare(String(right.country || ''));
  });
}

export function clampLiveWindowSeconds(value) {
  return clampNumber(value, MIN_LIVE_WINDOW_SECONDS, MAX_LIVE_WINDOW_SECONDS, DEFAULT_LIVE_WINDOW_SECONDS);
}

export function clampPollIntervalSeconds(value) {
  return clampNumber(value, MIN_POLL_INTERVAL_SECONDS, MAX_POLL_INTERVAL_SECONDS, DEFAULT_POLL_INTERVAL_SECONDS);
}

export function slugifyAssetKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function normalizeAssetMapping(input = {}) {
  const label = String(input.label || '').trim();
  const assetKey = slugifyAssetKey(input.assetKey || label || 'asset');
  const kind = ASSET_KINDS.includes(input.kind) ? input.kind : 'other';
  const project = String(input.agentAnalyticsProject || '').trim();
  return {
    assetKey,
    label: label || assetKey,
    kind,
    paperclipProjectId: input.paperclipProjectId ? String(input.paperclipProjectId).trim() : '',
    agentAnalyticsProject: project,
    primaryHostname: input.primaryHostname ? String(input.primaryHostname).trim() : '',
    allowedOrigins: Array.isArray(input.allowedOrigins)
      ? input.allowedOrigins.map((value) => String(value).trim()).filter(Boolean)
      : [],
    enabled: input.enabled !== false,
  };
}

export function buildStreamFilter(mapping) {
  const clauses = [];
  if (mapping.primaryHostname) clauses.push(`hostname:${mapping.primaryHostname}`);
  return clauses.join(';') || null;
}

export function mappingSignature(mapping) {
  return JSON.stringify({
    project: mapping.agentAnalyticsProject,
    filter: buildStreamFilter(mapping),
  });
}

export function createEmptyAssetState(mapping, now = Date.now()) {
  return {
    assetKey: mapping.assetKey,
    label: mapping.label,
    kind: mapping.kind,
    paperclipProjectId: mapping.paperclipProjectId || '',
    agentAnalyticsProject: mapping.agentAnalyticsProject,
    primaryHostname: mapping.primaryHostname || '',
    allowedOrigins: mapping.allowedOrigins || [],
    enabled: mapping.enabled !== false,
    status: 'idle',
    lastUpdatedAt: now,
    lastSnapshotAt: null,
    lastPolledAt: null,
    lastHotCountry: null,
    activeVisitors: 0,
    activeSessions: 0,
    eventsPerMinute: 0,
    topPages: [],
    topEvents: [],
    countries: [],
    recentEvents: [],
    warnings: [],
    errors: [],
  };
}

export function normalizeLiveSnapshot(snapshot = {}) {
  return {
    project: snapshot.project || '',
    windowSeconds: clampLiveWindowSeconds(snapshot.window_seconds),
    timestamp: snapshot.timestamp || Date.now(),
    activeVisitors: Number(snapshot.active_visitors || 0),
    activeSessions: Number(snapshot.active_sessions || 0),
    eventsPerMinute: Number(snapshot.events_per_minute || 0),
    topPages: (snapshot.top_pages || []).map((row) => ({
      path: String(row.path || ''),
      visitors: Number(row.visitors || 0),
    })),
    topEvents: (snapshot.top_events || []).map((row) => ({
      event: String(row.event || ''),
      count: Number(row.count || 0),
    })),
    countries: sortCountries(
      (snapshot.countries || []).map((row) => ({
        country: String(row.country || ''),
        visitors: Number(row.visitors || 0),
        sessions: Number(row.sessions || 0),
        events: Number(row.events || 0),
      }))
    ),
    recentEvents: (snapshot.recent_events || []).map((row, index) => ({
      id: `${row.session_id || row.user_id || row.timestamp || 'event'}-${index}`,
      event: String(row.event || ''),
      properties: row.properties || {},
      userId: row.user_id || null,
      sessionId: row.session_id || null,
      timestamp: Number(row.timestamp || Date.now()),
      country: row.country || null,
      path: row.properties?.path || null,
      assetKey: null,
      assetLabel: null,
    })),
  };
}

export function normalizeTrackEvent(track = {}, mapping) {
  return {
    id: `${track.session_id || track.user_id || track.timestamp || Date.now()}-${track.event || 'track'}`,
    event: String(track.event || ''),
    properties: track.properties || {},
    userId: track.user_id || null,
    sessionId: track.session_id || null,
    timestamp: Number(track.timestamp || Date.now()),
    country: track.country || null,
    path: track.properties?.path || null,
    assetKey: mapping.assetKey,
    assetLabel: mapping.label,
  };
}

export function applySnapshotToAssetState(currentState, snapshot, mapping, now = Date.now()) {
  const normalized = normalizeLiveSnapshot(snapshot);
  return {
    ...createEmptyAssetState(mapping, now),
    ...currentState,
    ...mapping,
    status: 'live',
    lastUpdatedAt: now,
    lastSnapshotAt: normalized.timestamp,
    lastPolledAt: now,
    activeVisitors: normalized.activeVisitors,
    activeSessions: normalized.activeSessions,
    eventsPerMinute: normalized.eventsPerMinute,
    topPages: normalized.topPages,
    topEvents: normalized.topEvents,
    countries: normalized.countries,
    recentEvents: normalized.recentEvents.map((event) => ({
      ...event,
      assetKey: mapping.assetKey,
      assetLabel: mapping.label,
    })),
    errors: [],
  };
}

export function applyTrackEventToAssetState(currentState, rawTrackEvent, mapping, now = Date.now()) {
  const state = currentState || createEmptyAssetState(mapping, now);
  const trackEvent = normalizeTrackEvent(rawTrackEvent, mapping);
  const next = {
    ...state,
    ...mapping,
    status: state.status === 'idle' ? 'streaming' : state.status,
    lastUpdatedAt: now,
    lastHotCountry: trackEvent.country || state.lastHotCountry,
    recentEvents: [trackEvent, ...state.recentEvents].slice(0, 12),
  };

  if (trackEvent.path) {
    const topPages = [...next.topPages];
    const existing = topPages.find((row) => row.path === trackEvent.path);
    if (existing) existing.visitors += 1;
    else topPages.push({ path: trackEvent.path, visitors: 1 });
    next.topPages = sortCountRows(topPages, 'visitors').slice(0, 10);
  }

  if (trackEvent.event) {
    const topEvents = [...next.topEvents];
    const existing = topEvents.find((row) => row.event === trackEvent.event);
    if (existing) existing.count += 1;
    else topEvents.push({ event: trackEvent.event, count: 1 });
    next.topEvents = sortCountRows(topEvents, 'count').slice(0, 10);
  }

  if (trackEvent.country) {
    const countries = [...next.countries];
    const existing = countries.find((row) => row.country === trackEvent.country);
    if (existing) {
      existing.events += 1;
      if (trackEvent.userId && existing.visitors === 0) existing.visitors = 1;
      if (trackEvent.sessionId && existing.sessions === 0) existing.sessions = 1;
    } else {
      countries.push({
        country: trackEvent.country,
        visitors: trackEvent.userId ? 1 : 0,
        sessions: trackEvent.sessionId ? 1 : 0,
        events: 1,
      });
    }
    next.countries = sortCountries(countries).slice(0, 12);
  }

  next.eventsPerMinute = Math.max(next.eventsPerMinute, next.topEvents.reduce((sum, row) => sum + row.count, 0));
  return next;
}

export function createSnoozeExpiry(minutes = DEFAULT_SNOOZE_MINUTES, now = Date.now()) {
  return now + clampNumber(minutes, 1, 240, DEFAULT_SNOOZE_MINUTES) * 60_000;
}

export function isSnoozed(assetKey, snoozes = {}, now = Date.now()) {
  const snoozeUntil = Number(snoozes[assetKey] || 0);
  return Number.isFinite(snoozeUntil) && snoozeUntil > now;
}

export function validateEnabledMappings(mappings = []) {
  const enabled = mappings.filter((mapping) => mapping.enabled !== false);
  const warnings = [];
  const errors = [];

  if (enabled.length > MAX_ENABLED_ASSET_STREAMS) {
    errors.push(`Enable at most ${MAX_ENABLED_ASSET_STREAMS} assets at once because Agent Analytics live streams are capped per account.`);
  }

  const byProject = new Map();
  for (const mapping of enabled) {
    if (!mapping.agentAnalyticsProject) {
      errors.push(`Asset "${mapping.label}" is missing an Agent Analytics project.`);
      continue;
    }
    const count = byProject.get(mapping.agentAnalyticsProject) || 0;
    byProject.set(mapping.agentAnalyticsProject, count + 1);
  }

  for (const [project, count] of byProject.entries()) {
    if (count > 1) {
      warnings.push(`Project "${project}" is mapped multiple times. /live snapshots are project-scoped, so duplicate mappings can mirror the same activity.`);
    }
  }

  return { warnings, errors };
}

export function buildCompanyLiveState({ settings, auth, assets, snoozes = {}, now = Date.now() }) {
  const liveState = createEmptyCompanyLiveState();
  const visibleAssets = [];
  const topPagesMap = new Map();
  const topEventsMap = new Map();
  const countryMap = new Map();
  const recentEvents = [];

  let activeVisitors = 0;
  let activeSessions = 0;
  let eventsPerMinute = 0;

  for (const asset of assets) {
    if (isSnoozed(asset.assetKey, snoozes, now)) continue;
    visibleAssets.push(asset);
    activeVisitors += asset.activeVisitors || 0;
    activeSessions += asset.activeSessions || 0;
    eventsPerMinute += asset.eventsPerMinute || 0;

    for (const page of asset.topPages || []) {
      const current = topPagesMap.get(page.path) || 0;
      topPagesMap.set(page.path, current + (page.visitors || 0));
    }

    for (const event of asset.topEvents || []) {
      const current = topEventsMap.get(event.event) || 0;
      topEventsMap.set(event.event, current + (event.count || 0));
    }

    for (const country of asset.countries || []) {
      const current = countryMap.get(country.country) || { country: country.country, visitors: 0, sessions: 0, events: 0 };
      current.visitors += country.visitors || 0;
      current.sessions += country.sessions || 0;
      current.events += country.events || 0;
      countryMap.set(country.country, current);
    }

    for (const event of asset.recentEvents || []) {
      recentEvents.push(event);
    }
  }

  const configuredProjectCount = settings.selectedProjectName ? 1 : settings.monitoredAssets?.length || 0;
  const warnings = [];
  if (auth.status === 'connected' && !settings.selectedProjectName) {
    warnings.push('Select one Agent Analytics project in settings to start the live monitor.');
  }
  const countries = sortCountries(Array.from(countryMap.values())).slice(0, 12);
  const sortedAssets = [...visibleAssets].sort((left, right) => {
    if ((right.eventsPerMinute || 0) !== (left.eventsPerMinute || 0)) return (right.eventsPerMinute || 0) - (left.eventsPerMinute || 0);
    if ((right.activeVisitors || 0) !== (left.activeVisitors || 0)) return (right.activeVisitors || 0) - (left.activeVisitors || 0);
    return String(left.label || '').localeCompare(String(right.label || ''));
  });

  liveState.generatedAt = now;
  liveState.pluginEnabled = settings.pluginEnabled !== false;
  liveState.authStatus = auth.status;
  liveState.tier = auth.tier;
  liveState.account = auth.accountSummary;
  liveState.connection = {
    status: auth.status === 'connected' ? 'live' : auth.status === 'error' ? 'error' : 'idle',
    label: auth.status === 'connected' ? 'Connected' : auth.status === 'error' ? 'Attention needed' : 'Not connected',
    detail: auth.status === 'connected'
      ? settings.selectedProjectName
        ? `Showing live state for ${settings.selectedProjectName}.`
        : 'Connected. Select one Agent Analytics project in settings to start the live feed.'
      : auth.lastError || 'Connect Agent Analytics from settings to start the live feed.',
  };
  liveState.metrics = {
    activeVisitors,
    activeSessions,
    eventsPerMinute,
    assetsConfigured: configuredProjectCount,
    assetsVisible: sortedAssets.length,
    countriesTracked: countries.length,
  };
  liveState.world = {
    hotCountry: sortedAssets.find((asset) => asset.lastHotCountry)?.lastHotCountry || countries[0]?.country || null,
    countries,
  };
  liveState.evidence = {
    topPages: sortCountRows(
      Array.from(topPagesMap.entries()).map(([path, visitors]) => ({ path, visitors })),
      'visitors'
    ).slice(0, 10),
    topEvents: sortCountRows(
      Array.from(topEventsMap.entries()).map(([event, count]) => ({ event, count })),
      'count'
    ).slice(0, 10),
    recentEvents: recentEvents.sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0)).slice(0, 20),
    countries,
  };
  liveState.assets = sortedAssets;
  liveState.snoozedAssets = Object.keys(snoozes).filter((assetKey) => isSnoozed(assetKey, snoozes, now));
  liveState.warnings = warnings;
  return liveState;
}

export function deriveWidgetSummary(companyLiveState) {
  return {
    connection: companyLiveState.connection,
    tier: companyLiveState.tier,
    metrics: companyLiveState.metrics,
    topAsset: companyLiveState.assets[0] || null,
    hotCountry: companyLiveState.world.hotCountry,
    warnings: companyLiveState.warnings,
  };
}
