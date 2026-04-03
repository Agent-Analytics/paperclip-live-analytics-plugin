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
        async get({ namespace, scopeId, key }) {
          return store.get(`${namespace}:${scopeId}:${key}`);
        },
        async set({ namespace, scopeId, key, value }) {
          store.set(`${namespace}:${scopeId}:${key}`, value);
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

test('upsertMapping stores normalized mapping in company state', async () => {
  const { ctx } = createMockCtx();
  await ctx.state.set({ namespace: 'agent-analytics-live', scopeId: 'company_1', key: 'config', value: createDefaultSettings() });
  await ctx.state.set({ namespace: 'agent-analytics-live', scopeId: 'company_1', key: 'auth', value: createDefaultAuthState() });
  const service = new PaperclipLiveAnalyticsService(ctx);

  await service.upsertMapping({
    companyId: 'company_1',
    mapping: {
      label: 'Marketing Site',
      kind: 'website',
      agentAnalyticsProject: 'agentanalytics-sh',
      primaryHostname: 'agentanalytics.sh',
    },
  });

  const settings = await ctx.state.get({ namespace: 'agent-analytics-live', scopeId: 'company_1', key: 'config' });
  assert.equal(settings.monitoredAssets.length, 1);
  assert.equal(settings.monitoredAssets[0].assetKey, 'marketing-site');
});
