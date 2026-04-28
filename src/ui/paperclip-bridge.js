import { useEffect, useState } from 'react';
import { ACTION_KEYS, DATA_KEYS } from '../shared/constants.js';
import { deriveWidgetSummary } from '../shared/live-state.js';
import { demoLiveState, demoSettingsData } from './demo-data.js';

function getBridge() {
  return globalThis.__PAPERCLIP_PLUGIN_BRIDGE__ || null;
}

function getFallbackData(key) {
  if (key === DATA_KEYS.livePageLoad) return demoLiveState;
  if (key === DATA_KEYS.liveWidgetLoad) return deriveWidgetSummary(demoLiveState);
  if (key === DATA_KEYS.settingsLoad) return demoSettingsData;
  return null;
}

export function useHostContext() {
  const bridge = getBridge();
  if (bridge?.useHostContext) {
    return bridge.useHostContext();
  }

  const params = new URLSearchParams(globalThis.location?.search || '');
  return {
    companyId: params.get('companyId') || 'demo-company',
    surface: params.get('surface') || 'page',
    basePath: '',
  };
}

export function usePluginData(key, payload, options = {}) {
  const bridge = getBridge();
  if (bridge?.usePluginData) {
    return bridge.usePluginData(key, payload, options);
  }

  const [data, setData] = useState(() => getFallbackData(key));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function reload() {
    setLoading(true);
    try {
      setData(getFallbackData(key));
      setError(null);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (options.enabled === false) return;
    void reload();
  }, [key, JSON.stringify(payload), options.enabled]);

  return { data, loading, error, reload };
}

export function usePluginAction(key) {
  const bridge = getBridge();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function run(payload) {
    setPending(true);
    setError(null);
    try {
      if (bridge?.runAction) {
        return await bridge.runAction(key, payload);
      }

      if (key === ACTION_KEYS.authStart) {
        return {
          auth: {
            ...demoSettingsData.auth,
            status: 'pending',
            pendingAuthRequest: {
              authRequestId: 'req_demo',
              authorizeUrl: 'https://api.agentanalytics.sh/agent-sessions/authorize/req_demo',
              pollToken: 'aap_demo',
              expiresAt: Date.now() + 600_000,
            },
          },
        };
      }

      if (key === ACTION_KEYS.settingsSave) {
        return demoSettingsData;
      }

      if (key === ACTION_KEYS.assetSnooze || key === ACTION_KEYS.assetUnsnooze) {
        return {
          liveState: demoLiveState,
        };
      }

      return { ok: true };
    } catch (actionError) {
      setError(actionError);
      throw actionError;
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error };
}

export function usePluginStream(channel, { companyId, onEvent }) {
  const bridge = getBridge();

  useEffect(() => {
    if (bridge?.subscribeStream) {
      return bridge.subscribeStream(channel, { companyId }, onEvent);
    }

    const intervalId = setInterval(() => {
      onEvent?.(demoLiveState);
    }, 15_000);

    return () => clearInterval(intervalId);
  }, [bridge, channel, companyId, onEvent]);
}
