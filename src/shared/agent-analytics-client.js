import {
  AGENT_SESSION_SCOPES,
  DEFAULT_BASE_URL,
  PLUGIN_DISPLAY_NAME,
  PLUGIN_ID,
} from './constants.js';
import { PAPERCLIP_SETUP_HELP_URL } from './paperclip-setup.js';

function createJsonHeaders(auth) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (auth?.access_token) headers.Authorization = `Bearer ${auth.access_token}`;
  else if (auth?.api_key) headers['X-API-Key'] = auth.api_key;
  return headers;
}

function buildQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function createApiError(data, response, fallbackMessage) {
  const error = new Error(data.message || data.error || fallbackMessage || `HTTP ${response.status}`);
  error.status = response.status;
  error.code = data.error || null;
  error.payload = data;
  return error;
}

function parseSseEvent(rawEvent) {
  const event = {
    event: 'message',
    data: '',
    comment: null,
  };

  const lines = rawEvent.split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(':')) {
      event.comment = line.slice(1).trim();
      continue;
    }
    const separatorIndex = line.indexOf(':');
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const value = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).trimStart();
    if (field === 'event') event.event = value;
    if (field === 'data') event.data = event.data ? `${event.data}\n${value}` : value;
  }
  return event;
}

function findSseBoundary(buffer) {
  const lfIndex = buffer.indexOf('\n\n');
  const crlfIndex = buffer.indexOf('\r\n\r\n');

  if (lfIndex === -1) {
    return crlfIndex === -1 ? null : { index: crlfIndex, length: 4 };
  }
  if (crlfIndex === -1) {
    return { index: lfIndex, length: 2 };
  }

  return lfIndex < crlfIndex
    ? { index: lfIndex, length: 2 }
    : { index: crlfIndex, length: 4 };
}

export class AgentAnalyticsClient {
  constructor({
    auth = null,
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = globalThis.fetch,
    onAuthUpdate = null,
  } = {}) {
    this.auth = auth ? { ...auth } : null;
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
    this.onAuthUpdate = onAuthUpdate;
  }

  setAuth(auth) {
    this.auth = auth ? { ...auth } : null;
  }

  async request(method, path, body, { retryOnRefresh = true } = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: createJsonHeaders(this.auth),
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 && retryOnRefresh && this.auth?.refresh_token) {
      const refreshed = await this.refreshAgentSession().catch(() => null);
      if (refreshed?.access_token) {
        return this.request(method, path, body, { retryOnRefresh: false });
      }
    }

    if (!response.ok) {
      throw createApiError(data, response);
    }

    return data;
  }

  async startPaperclipAuth({ companyId, label, mode = 'detached', callbackUrl = null, codeChallenge = null } = {}) {
    return this.request(
      'POST',
      '/agent-sessions/start',
      {
        mode,
        client_type: 'paperclip',
        client_name: PLUGIN_DISPLAY_NAME,
        client_instance_id: companyId || null,
        callback_url: callbackUrl,
        label: label || `Paperclip Company ${companyId || ''}`.trim(),
        scopes: AGENT_SESSION_SCOPES,
        ...(codeChallenge ? { code_challenge: codeChallenge } : {}),
        metadata: {
          platform: 'paperclip',
          plugin_id: PLUGIN_ID,
          company_id: companyId || null,
          requires_existing_account: true,
          setup_help_url: PAPERCLIP_SETUP_HELP_URL,
        },
      },
      { retryOnRefresh: false }
    );
  }

  async exchangeAgentSession(authRequestId, exchangeCode, codeVerifier = null) {
    return this.request(
      'POST',
      '/agent-sessions/exchange',
      {
        auth_request_id: authRequestId,
        exchange_code: exchangeCode,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      },
      { retryOnRefresh: false }
    );
  }

  async pollAgentSession(authRequestId, pollToken) {
    return this.request(
      'POST',
      '/agent-sessions/poll',
      {
        auth_request_id: authRequestId,
        poll_token: pollToken,
      },
      { retryOnRefresh: false }
    );
  }

  async refreshAgentSession() {
    if (!this.auth?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const refreshed = await this.request(
      'POST',
      '/agent-sessions/refresh',
      {
        refresh_token: this.auth.refresh_token,
      },
      { retryOnRefresh: false }
    );

    this.auth = {
      ...this.auth,
      ...refreshed.agent_session,
    };
    this.onAuthUpdate?.(this.auth);
    return this.auth;
  }

  async listProjects() {
    return this.request('GET', '/projects');
  }

  async getLive(project, { window } = {}) {
    const query = buildQuery({ project, window });
    return this.request('GET', `/live?${query}`);
  }

  async getProject(projectId) {
    return this.request('GET', `/projects/${encodeURIComponent(projectId)}`);
  }

  async getProjectUsage(projectId, { days } = {}) {
    const query = buildQuery({ days });
    return this.request('GET', `/projects/${encodeURIComponent(projectId)}/usage${query ? `?${query}` : ''}`);
  }

  async subscribeToStream({ project, filter, signal, onConnected, onTrack, onComment }) {
    const query = buildQuery({
      project,
      filter,
    });

    const response = await this.fetchImpl(`${this.baseUrl}/stream?${query}`, {
      method: 'GET',
      headers: createJsonHeaders(this.auth),
      signal,
    });

    if (!response.ok || !response.body) {
      const payload = await response.text().catch(() => '');
      let parsed = {};
      try {
        parsed = payload ? JSON.parse(payload) : {};
      } catch {
        parsed = payload ? { message: payload } : {};
      }
      throw createApiError(parsed, response, `Stream failed with HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let boundary = findSseBoundary(buffer);
      while (boundary) {
        const rawEvent = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        const event = parseSseEvent(rawEvent);

        if (event.comment) {
          onComment?.(event.comment);
        }

        if (event.data) {
          let parsed = {};
          try {
            parsed = JSON.parse(event.data);
          } catch {
            parsed = { raw: event.data };
          }

          if (event.event === 'connected') onConnected?.(parsed);
          if (event.event === 'track') onTrack?.(parsed);
        }

        boundary = findSseBoundary(buffer);
      }
    }
  }
}
