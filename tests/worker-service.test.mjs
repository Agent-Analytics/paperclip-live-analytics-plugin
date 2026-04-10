import test from 'node:test';
import assert from 'node:assert/strict';

import { PaperclipLiveAnalyticsService } from '../src/worker/service.js';
import { createDefaultAuthState, createDefaultSettings } from '../src/shared/defaults.js';

function createMockCtx() {
  const store = new Map();
  const registrations = {
    data: new Map(),
    actions: new Map(),
    events: [],
  };

  return {
    registrations,
    ctx: {
      state: {
        async get({ namespace, scopeId, stateKey }) {
          return store.get(`${namespace}:${scopeId}:${stateKey}`);
        },
        async set({ namespace, scopeId, stateKey }, value) {
          store.set(`${namespace}:${scopeId}:${stateKey}`, value);
        },
      },
      data: {
        async register(key, handler) {
          registrations.data.set(key, handler);
        },
      },
      actions: {
        async register(key, handler) {
          registrations.actions.set(key, handler);
        },
      },
      streams: {
        async open() {},
        async emit(_channel, payload) {
          registrations.events.push(payload);
        },
        async close() {},
      },
    },
  };
}

test('service registers expected data and action handlers', async () => {
  const { ctx, registrations } = createMockCtx();
  const service = new PaperclipLiveAnalyticsService(ctx, { fetchImpl: async () => new Response(JSON.stringify({ projects: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }) });
  await service.register();
  assert.equal(registrations.data.size, 3);
  assert.equal(registrations.actions.size, 10);
});

test('savePluginSettings stores the selected project in company state', async () => {
  const { ctx } = createMockCtx();
  await ctx.state.set({ namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'config' }, createDefaultSettings());
  await ctx.state.set({ namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'auth' }, createDefaultAuthState());
  const service = new PaperclipLiveAnalyticsService(ctx);

  await service.savePluginSettings({
    companyId: 'company_1',
    settings: {
      selectedProjectId: 'proj_1',
      selectedProjectName: 'agentanalytics-sh',
      selectedProjectLabel: 'agentanalytics-sh',
      selectedProjectAllowedOrigins: ['*'],
    },
  });

  const settings = await ctx.state.get({ namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'config' });
  assert.equal(settings.selectedProjectId, 'proj_1');
  assert.equal(settings.selectedProjectName, 'agentanalytics-sh');
  assert.deepEqual(settings.selectedProjectAllowedOrigins, ['*']);
});

test('completeAuth is idempotent after the session is already connected', async () => {
  const { ctx } = createMockCtx();
  await ctx.state.set({ namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'config' }, createDefaultSettings());
  await ctx.state.set(
    { namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'auth' },
    {
      ...createDefaultAuthState(),
      accessToken: 'access_1',
      refreshToken: 'refresh_1',
      status: 'connected',
      accountSummary: { email: 'danny@example.com' },
      tier: 'pro',
      pendingAuthRequest: null,
    }
  );

  let fetchCalls = 0;
  const service = new PaperclipLiveAnalyticsService(ctx, {
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ projects: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await service.completeAuth({
    companyId: 'company_1',
    authRequestId: 'req_1',
    exchangeCode: 'aae_duplicate',
  });

  assert.equal(result.auth.connected, true);
  assert.equal(result.auth.accountSummary.email, 'danny@example.com');
  assert.equal(fetchCalls, 1);
});

test('acknowledgeAuthError clears the pending auth request without wiping settings', async () => {
  const { ctx } = createMockCtx();
  await ctx.state.set({ namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'config' }, {
    ...createDefaultSettings(),
    selectedProjectId: 'proj_1',
    selectedProjectName: 'agentanalytics-sh',
  });
  await ctx.state.set(
    { namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'auth' },
    {
      ...createDefaultAuthState(),
      status: 'pending',
      pendingAuthRequest: {
        authRequestId: 'req_1',
        authorizeUrl: 'https://api.agentanalytics.sh/agent-sessions/authorize/req_1',
      },
    }
  );

  const service = new PaperclipLiveAnalyticsService(ctx);
  const result = await service.acknowledgeAuthError({
    companyId: 'company_1',
    message: 'Finish Agent Analytics account setup first.',
  });

  assert.equal(result.auth.pendingAuthRequest, null);
  assert.equal(result.auth.lastError, 'Finish Agent Analytics account setup first.');
  assert.equal(result.settings.selectedProjectName, 'agentanalytics-sh');
});

test('loadLivePage returns free tier fallback with historical summary', async () => {
  const { ctx } = createMockCtx();
  await ctx.state.set(
    { namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'config' },
    {
      ...createDefaultSettings(),
      selectedProjectId: 'proj_1',
      selectedProjectName: 'agentanalytics-sh',
      selectedProjectLabel: 'agentanalytics-sh',
      selectedProjectAllowedOrigins: ['*'],
    }
  );
  await ctx.state.set(
    { namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'auth' },
    {
      ...createDefaultAuthState(),
      accessToken: 'access_1',
      refreshToken: 'refresh_1',
      status: 'connected',
      accountSummary: { email: 'danny@example.com' },
      tier: 'free',
    }
  );

  const service = new PaperclipLiveAnalyticsService(ctx, {
    fetchImpl: async (url) => {
      const text = String(url);
      if (text.endsWith('/projects/proj_1')) {
        return new Response(JSON.stringify({
          id: 'proj_1',
          name: 'agentanalytics-sh',
          usage_today: { event_count: 2, read_count: 0 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (text.includes('/projects/proj_1/usage?days=7')) {
        return new Response(JSON.stringify({
          project_id: 'proj_1',
          usage: [
            { date: '2026-04-02', event_count: 0, read_count: 0 },
            { date: '2026-04-03', event_count: 3, read_count: 0 },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error(`Unexpected URL ${text}`);
    },
  });

  const liveState = await service.loadLivePage({ companyId: 'company_1' });
  assert.equal(liveState.connection.reason, 'live_unavailable_free_tier');
  assert.equal(liveState.historicalSummary.projectId, 'proj_1');
  assert.equal(liveState.historicalSummary.totals.events, 3);
});

test('loadLivePage returns live_empty for pro tier with no current live activity', async () => {
  const { ctx } = createMockCtx();
  await ctx.state.set(
    { namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'config' },
    {
      ...createDefaultSettings(),
      selectedProjectId: 'proj_1',
      selectedProjectName: 'agentanalytics-sh',
      selectedProjectLabel: 'agentanalytics-sh',
      selectedProjectAllowedOrigins: ['*'],
    }
  );
  await ctx.state.set(
    { namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'auth' },
    {
      ...createDefaultAuthState(),
      accessToken: 'access_1',
      refreshToken: 'refresh_1',
      status: 'connected',
      accountSummary: { email: 'danny@example.com' },
      tier: 'pro',
    }
  );

  const service = new PaperclipLiveAnalyticsService(ctx, {
    fetchImpl: async (url) => {
      const text = String(url);
      if (text.includes('/live?project=agentanalytics-sh')) {
        return new Response(JSON.stringify({
          project: 'agentanalytics-sh',
          window_seconds: 60,
          timestamp: Date.now(),
          active_visitors: 0,
          active_sessions: 0,
          events_per_minute: 0,
          top_pages: [],
          top_events: [],
          countries: [],
          recent_events: [],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (text.endsWith('/stream?project=agentanalytics-sh')) {
        return new Response(new ReadableStream({
          start(controller) {
            controller.close();
          },
        }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }
      if (text.endsWith('/projects/proj_1')) {
        return new Response(JSON.stringify({
          id: 'proj_1',
          name: 'agentanalytics-sh',
          usage_today: { event_count: 0, read_count: 0 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (text.includes('/projects/proj_1/usage?days=7')) {
        return new Response(JSON.stringify({
          project_id: 'proj_1',
          usage: [{ date: '2026-04-03', event_count: 5, read_count: 0 }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error(`Unexpected URL ${text}`);
    },
  });

  const liveState = await service.loadLivePage({ companyId: 'company_1' });
  assert.equal(liveState.connection.reason, 'live_empty');
  assert.equal(liveState.historicalSummary.totals.events, 5);
  await service.shutdown();
});

test('disconnectAuth clears selected project state', async () => {
  const { ctx } = createMockCtx();
  await ctx.state.set(
    { namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'config' },
    {
      ...createDefaultSettings(),
      selectedProjectId: 'proj_1',
      selectedProjectName: 'agentanalytics-sh',
      selectedProjectLabel: 'agentanalytics-sh',
      selectedProjectAllowedOrigins: ['*'],
    }
  );
  await ctx.state.set(
    { namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'auth' },
    {
      ...createDefaultAuthState(),
      accessToken: 'access_1',
      refreshToken: 'refresh_1',
      status: 'connected',
      accountSummary: { email: 'danny@example.com' },
      tier: 'pro',
    }
  );

  const service = new PaperclipLiveAnalyticsService(ctx);
  const result = await service.disconnectAuth({ companyId: 'company_1' });
  const settings = await ctx.state.get({ namespace: 'agent-analytics-live', scopeId: 'company_1', stateKey: 'config' });

  assert.equal(result.auth.connected, false);
  assert.equal(settings.selectedProjectId, '');
  assert.equal(settings.selectedProjectName, '');
});
