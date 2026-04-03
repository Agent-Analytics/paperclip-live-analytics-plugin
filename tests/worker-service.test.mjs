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
  assert.equal(registrations.actions.size, 9);
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
