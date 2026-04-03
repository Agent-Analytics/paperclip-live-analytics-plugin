import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applySnapshotToAssetState,
  applyTrackEventToAssetState,
  buildCompanyLiveState,
  createEmptyAssetState,
  mappingSignature,
  normalizeAssetMapping,
  validateEnabledMappings,
} from '../src/shared/live-state.js';

test('mappingSignature groups identical project+filter mappings', () => {
  const left = normalizeAssetMapping({
    assetKey: 'docs',
    label: 'Docs',
    agentAnalyticsProject: 'docs-agentanalytics-sh',
    primaryHostname: 'docs.agentanalytics.sh',
  });
  const right = normalizeAssetMapping({
    assetKey: 'docs-two',
    label: 'Docs Alt',
    agentAnalyticsProject: 'docs-agentanalytics-sh',
    primaryHostname: 'docs.agentanalytics.sh',
  });

  assert.equal(mappingSignature(left), mappingSignature(right));
});

test('applySnapshotToAssetState normalizes /live payloads', () => {
  const mapping = normalizeAssetMapping({
    assetKey: 'site',
    label: 'Site',
    kind: 'website',
    agentAnalyticsProject: 'site-live',
  });

  const state = applySnapshotToAssetState(createEmptyAssetState(mapping), {
    project: 'site-live',
    window_seconds: 60,
    timestamp: 1234,
    active_visitors: 7,
    active_sessions: 8,
    events_per_minute: 22,
    top_pages: [{ path: '/pricing', visitors: 5 }],
    top_events: [{ event: 'signup', count: 3 }],
    countries: [{ country: 'US', visitors: 4, sessions: 4, events: 9 }],
    recent_events: [{ event: 'signup', properties: { path: '/signup' }, timestamp: 1230, user_id: 'user1', session_id: 'sess1', country: 'US' }],
  }, mapping);

  assert.equal(state.activeVisitors, 7);
  assert.equal(state.topPages[0].path, '/pricing');
  assert.equal(state.topEvents[0].event, 'signup');
  assert.equal(state.countries[0].country, 'US');
  assert.equal(state.recentEvents[0].assetKey, 'site');
});

test('applyTrackEventToAssetState updates top rows and recent events', () => {
  const mapping = normalizeAssetMapping({
    assetKey: 'site',
    label: 'Site',
    kind: 'website',
    agentAnalyticsProject: 'site-live',
  });
  const initial = createEmptyAssetState(mapping);

  const next = applyTrackEventToAssetState(initial, {
    event: 'page_view',
    properties: { path: '/pricing' },
    user_id: 'user_1',
    session_id: 'session_1',
    timestamp: 2000,
    country: 'DE',
  }, mapping);

  assert.equal(next.topPages[0].path, '/pricing');
  assert.equal(next.topEvents[0].event, 'page_view');
  assert.equal(next.countries[0].country, 'DE');
  assert.equal(next.recentEvents[0].assetLabel, 'Site');
});

test('buildCompanyLiveState aggregates visible assets and snoozes hidden ones', () => {
  const marketing = {
    ...createEmptyAssetState(normalizeAssetMapping({ assetKey: 'marketing', label: 'Marketing', agentAnalyticsProject: 'marketing' })),
    activeVisitors: 5,
    activeSessions: 6,
    eventsPerMinute: 10,
    topPages: [{ path: '/pricing', visitors: 5 }],
    topEvents: [{ event: 'signup', count: 2 }],
    countries: [{ country: 'US', visitors: 5, sessions: 6, events: 10 }],
  };
  const docs = {
    ...createEmptyAssetState(normalizeAssetMapping({ assetKey: 'docs', label: 'Docs', agentAnalyticsProject: 'docs' })),
    activeVisitors: 4,
    activeSessions: 4,
    eventsPerMinute: 9,
    topPages: [{ path: '/guides/paperclip', visitors: 4 }],
    topEvents: [{ event: 'page_view', count: 9 }],
    countries: [{ country: 'DE', visitors: 4, sessions: 4, events: 9 }],
  };

  const liveState = buildCompanyLiveState({
    settings: {
      pluginEnabled: true,
      monitoredAssets: [
        normalizeAssetMapping({ assetKey: 'marketing', label: 'Marketing', agentAnalyticsProject: 'marketing' }),
        normalizeAssetMapping({ assetKey: 'docs', label: 'Docs', agentAnalyticsProject: 'docs' }),
      ],
    },
    auth: {
      status: 'connected',
      tier: 'pro',
      accountSummary: { email: 'ops@example.com' },
    },
    assets: [marketing, docs],
    snoozes: { docs: Date.now() + 60_000 },
  });

  assert.equal(liveState.metrics.activeVisitors, 5);
  assert.equal(liveState.assets.length, 1);
  assert.equal(liveState.assets[0].assetKey, 'marketing');
});

test('validateEnabledMappings enforces account stream limit', () => {
  const mappings = Array.from({ length: 11 }, (_, index) =>
    normalizeAssetMapping({
      assetKey: `asset-${index}`,
      label: `Asset ${index}`,
      agentAnalyticsProject: `project-${index}`,
    })
  );

  const validation = validateEnabledMappings(mappings);
  assert.equal(validation.errors.length, 1);
  assert.match(validation.errors[0], /at most 10 assets/i);
});

