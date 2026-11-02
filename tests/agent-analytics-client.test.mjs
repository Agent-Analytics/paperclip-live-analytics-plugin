import test from 'node:test';
import assert from 'node:assert/strict';

import { AgentAnalyticsClient } from '../src/shared/agent-analytics-client.js';
import { PAPERCLIP_SETUP_HELP_URL } from '../src/shared/paperclip-setup.js';

test('request refreshes on 401 and retries once', async () => {
  const calls = [];
  const client = new AgentAnalyticsClient({
    auth: {
      access_token: 'expired',
      refresh_token: 'refresh-1',
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (String(url).endsWith('/projects')) {
        if (calls.length === 1) {
          return new Response(JSON.stringify({ message: 'expired' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ projects: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (String(url).endsWith('/agent-sessions/refresh')) {
        return new Response(JSON.stringify({
          ok: true,
          agent_session: {
            access_token: 'fresh-access',
            refresh_token: 'refresh-1',
            access_expires_at: Date.now() + 60_000,
            refresh_expires_at: Date.now() + 120_000,
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  });

  const result = await client.listProjects();
  assert.deepEqual(result, { projects: [] });
  assert.equal(calls.length, 3);
  assert.match(calls[1].url, /agent-sessions\/refresh$/);
});

test('startPaperclipAuth sends detached paperclip metadata', async () => {
  let body;
  const client = new AgentAnalyticsClient({
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({
        ok: true,
        auth_request_id: 'req_1',
        authorize_url: 'https://api.agentanalytics.sh/agent-sessions/authorize/req_1',
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    },
  });

  await client.startPaperclipAuth({ companyId: 'company_1' });
  assert.equal(body.mode, 'detached');
  assert.equal(body.client_type, 'paperclip');
  assert.equal(body.client_instance_id, 'company_1');
  assert.equal(body.metadata.requires_existing_account, true);
  assert.equal(body.metadata.setup_help_url, PAPERCLIP_SETUP_HELP_URL);
});

test('startPaperclipAuth sends PKCE challenge for interactive callbacks', async () => {
  let body;
  const client = new AgentAnalyticsClient({
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({
        ok: true,
        auth_request_id: 'req_1',
        authorize_url: 'https://api.agentanalytics.sh/agent-sessions/authorize/req_1',
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    },
  });

  await client.startPaperclipAuth({
    companyId: 'company_1',
    mode: 'interactive',
    callbackUrl: 'https://paperclip.example.com/agent-analytics-live?aa_auth_callback=1',
    codeChallenge: 'challenge-1',
  });

  assert.equal(body.mode, 'interactive');
  assert.equal(body.callback_url, 'https://paperclip.example.com/agent-analytics-live?aa_auth_callback=1');
  assert.equal(body.code_challenge, 'challenge-1');
});

test('exchangeAgentSession sends code verifier when provided', async () => {
  let body;
  const client = new AgentAnalyticsClient({
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({
        ok: true,
        agent_session: { access_token: 'aas_1', refresh_token: 'aar_1' },
        account: { email: 'user@example.com' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  await client.exchangeAgentSession('req_1', 'aae_1', 'verifier-1');

  assert.deepEqual(body, {
    auth_request_id: 'req_1',
    exchange_code: 'aae_1',
    code_verifier: 'verifier-1',
  });
});

test('pollAgentSession posts auth request id and poll token', async () => {
  let body;
  const client = new AgentAnalyticsClient({
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({ status: 'pending' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const result = await client.pollAgentSession('req_1', 'aap_1');
  assert.deepEqual(result, { status: 'pending' });
  assert.deepEqual(body, {
    auth_request_id: 'req_1',
    poll_token: 'aap_1',
  });
});

test('subscribeToStream parses connected and track SSE events', async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: connected\ndata: {"project":"site-live"}\n\n'));
      controller.enqueue(encoder.encode(':heartbeat\n\n'));
      controller.enqueue(encoder.encode('event: track\ndata: {"event":"signup","timestamp":42,"country":"US"}\n\n'));
      controller.close();
    },
  });

  const seen = [];
  const client = new AgentAnalyticsClient({
    fetchImpl: async () => new Response(body, { status: 200 }),
  });

  await client.subscribeToStream({
    project: 'site-live',
    onConnected: (payload) => seen.push({ type: 'connected', payload }),
    onTrack: (payload) => seen.push({ type: 'track', payload }),
    onComment: (payload) => seen.push({ type: 'comment', payload }),
  });

  assert.deepEqual(seen, [
    { type: 'connected', payload: { project: 'site-live' } },
    { type: 'comment', payload: 'heartbeat' },
    { type: 'track', payload: { event: 'signup', timestamp: 42, country: 'US' } },
  ]);
});

test('subscribeToStream parses CRLF-delimited SSE events', async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: connected\r\ndata: {"project":"site-live"}\r\n\r\n'));
      controller.enqueue(encoder.encode('event: track\r\ndata: {"event":"page_view","timestamp":43,"country":"IL"}\r\n\r\n'));
      controller.close();
    },
  });

  const seen = [];
  const client = new AgentAnalyticsClient({
    fetchImpl: async () => new Response(body, { status: 200 }),
  });

  await client.subscribeToStream({
    project: 'site-live',
    onConnected: (payload) => seen.push({ type: 'connected', payload }),
    onTrack: (payload) => seen.push({ type: 'track', payload }),
  });

  assert.deepEqual(seen, [
    { type: 'connected', payload: { project: 'site-live' } },
    { type: 'track', payload: { event: 'page_view', timestamp: 43, country: 'IL' } },
  ]);
});
