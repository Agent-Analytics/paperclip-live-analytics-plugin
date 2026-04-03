import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useHostContext, usePluginAction, usePluginData, usePluginStream, usePluginToast } from '@paperclipai/plugin-sdk/ui';
import { ACTION_KEYS, DATA_KEYS, LIVE_STREAM_CHANNEL, PLUGIN_PAGE_ROUTE } from '../shared/constants.js';
import { deriveWidgetSummary } from '../shared/live-state.js';
import { PageSurface } from '../ui/surfaces/PageSurface.jsx';
import { SettingsSurface } from '../ui/surfaces/SettingsSurface.jsx';
import { WidgetSurface } from '../ui/surfaces/WidgetSurface.jsx';
import embeddedStyles from '../ui/styles.css';

function useInjectedStyles() {
  useEffect(() => {
    const styleId = 'agent-analytics-live-plugin-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = embeddedStyles;
    document.head.appendChild(style);
    return () => {};
  }, []);
}

function useCompanyId(explicitContext) {
  const hostContext = useHostContext();
  return explicitContext?.companyId || hostContext.companyId;
}

function buildInteractiveCallbackUrl() {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  url.searchParams.delete('request_id');
  url.searchParams.delete('exchange_code');
  url.searchParams.set('aa_auth_callback', '1');
  return url.toString();
}

function buildPluginPageHref(context) {
  const companyPrefix = String(context?.companyPrefix || '').trim();
  if (companyPrefix) return `/${companyPrefix}/${PLUGIN_PAGE_ROUTE}`;
  if (typeof window === 'undefined') return `/${PLUGIN_PAGE_ROUTE}`;

  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments.length >= 2 && segments[1] === 'dashboard') {
    return `/${segments[0]}/${PLUGIN_PAGE_ROUTE}`;
  }
  if (segments.length >= 2 && segments[1] === PLUGIN_PAGE_ROUTE) {
    return `/${segments[0]}/${PLUGIN_PAGE_ROUTE}`;
  }
  return `/${PLUGIN_PAGE_ROUTE}`;
}

function PageInner({ context }) {
  const companyId = useCompanyId(context);
  const toast = usePluginToast();
  const { data, loading, error, refresh } = usePluginData(DATA_KEYS.livePageLoad, { companyId });
  const snoozeAsset = usePluginAction(ACTION_KEYS.assetSnooze);
  const unsnoozeAsset = usePluginAction(ACTION_KEYS.assetUnsnooze);
  const stream = usePluginStream(LIVE_STREAM_CHANNEL, { companyId });
  const [liveState, setLiveState] = useState(data);

  useEffect(() => {
    if (data) setLiveState(data);
  }, [data]);

  useEffect(() => {
    if (stream.lastEvent) setLiveState(stream.lastEvent);
  }, [stream.lastEvent]);

  const content = useMemo(() => liveState || data, [liveState, data]);

  if (loading && !content) return React.createElement('div', { className: 'aa-panel' }, 'Loading live data…');
  if (error && !content) return React.createElement('div', { className: 'aa-panel' }, `Live page failed: ${error.message}`);
  if (!content) return React.createElement('div', { className: 'aa-panel' }, 'No live data yet.');

  return React.createElement(PageSurface, {
    liveState: content,
    onSnooze: async (assetKey) => {
      await snoozeAsset({ companyId, assetKey });
      toast({ title: 'Asset snoozed', body: assetKey, tone: 'success' });
      refresh();
    },
    onUnsnooze: async (assetKey) => {
      await unsnoozeAsset({ companyId, assetKey });
      toast({ title: 'Asset unsnoozed', body: assetKey, tone: 'success' });
      refresh();
    },
  });
}

function WidgetInner({ context }) {
  const companyId = useCompanyId(context);
  const { data, loading, error, refresh } = usePluginData(DATA_KEYS.liveWidgetLoad, { companyId });
  const stream = usePluginStream(LIVE_STREAM_CHANNEL, { companyId });
  const [widgetState, setWidgetState] = useState(data);

  useEffect(() => {
    if (data) setWidgetState(data);
  }, [data]);

  useEffect(() => {
    if (stream.lastEvent) setWidgetState(deriveWidgetSummary(stream.lastEvent));
  }, [stream.lastEvent]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      refresh();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [refresh]);

  const content = widgetState || data;

  if (loading && !content) return React.createElement('div', { className: 'aa-widget' }, 'Loading…');
  if (error && !content) return React.createElement('div', { className: 'aa-widget' }, `Widget failed: ${error.message}`);
  if (!content) return React.createElement('div', { className: 'aa-widget' }, 'No live summary yet.');

  return React.createElement(WidgetSurface, {
    widget: content,
    fullPageHref: buildPluginPageHref(context),
  });
}

function SettingsInner({ context }) {
  const companyId = useCompanyId(context);
  const toast = usePluginToast();
  const { data, loading, error, refresh } = usePluginData(DATA_KEYS.settingsLoad, { companyId });
  const authStart = usePluginAction(ACTION_KEYS.authStart);
  const authComplete = usePluginAction(ACTION_KEYS.authComplete);
  const authReconnect = usePluginAction(ACTION_KEYS.authReconnect);
  const authDisconnect = usePluginAction(ACTION_KEYS.authDisconnect);
  const settingsSave = usePluginAction(ACTION_KEYS.settingsSave);
  const completedCallbackRef = useRef(false);
  const authCompletionRef = useRef(false);
  const [callbackState, setCallbackState] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event) => {
      if (event?.origin !== window.location.origin) return;

      if (event?.data?.type === 'agent-analytics-auth-callback') {
        if (!event.data.requestId || !event.data.exchangeCode || authCompletionRef.current) return;

        authCompletionRef.current = true;
        void (async () => {
          try {
            await authComplete({
              companyId,
              authRequestId: event.data.requestId,
              exchangeCode: event.data.exchangeCode,
            });
            toast({ title: 'Agent Analytics connected', tone: 'success' });
            refresh();
          } catch (completionError) {
            toast({
              title: 'Agent Analytics login failed',
              body: completionError.message || String(completionError),
              tone: 'error',
            });
          } finally {
            authCompletionRef.current = false;
          }
        })();
        return;
      }

      if (event?.data?.type === 'agent-analytics-auth-complete') {
        toast({ title: 'Agent Analytics connected', tone: 'success' });
        refresh();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [authComplete, companyId, refresh, toast]);

  useEffect(() => {
    if (typeof window === 'undefined' || completedCallbackRef.current) return;
    const url = new URL(window.location.href);
    const requestId = url.searchParams.get('request_id');
    const exchangeCode = url.searchParams.get('exchange_code');
    const isCallback = url.searchParams.get('aa_auth_callback') === '1';
    if (!isCallback || !requestId || !exchangeCode) return;

    completedCallbackRef.current = true;
    setCallbackState('completing');

    void (async () => {
      try {
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'agent-analytics-auth-callback',
              requestId,
              exchangeCode,
            },
            window.location.origin
          );
          setCallbackState('connected');
        } else {
          await authComplete({ companyId, authRequestId: requestId, exchangeCode });
          setCallbackState('connected');
        }
        url.searchParams.delete('request_id');
        url.searchParams.delete('exchange_code');
        url.searchParams.delete('aa_auth_callback');
        window.history.replaceState({}, '', url.toString());
        setTimeout(() => {
          window.close();
        }, 300);
      } catch (callbackError) {
        setCallbackState({ type: 'error', message: callbackError.message || String(callbackError) });
      }
    })();
  }, [authComplete, companyId]);

  if (loading && !data) return React.createElement('div', { className: 'aa-panel' }, 'Loading settings…');
  if (error && !data) return React.createElement('div', { className: 'aa-panel' }, `Settings failed: ${error.message}`);
  if (!data) return React.createElement('div', { className: 'aa-panel' }, 'No settings data yet.');

  if (callbackState === 'completing') {
    return React.createElement('div', { className: 'aa-panel' }, 'Finishing Agent Analytics login…');
  }

  if (callbackState === 'connected') {
    return React.createElement('div', { className: 'aa-panel' }, 'Connected. This tab can close.');
  }

  if (callbackState?.type === 'error') {
    return React.createElement('div', { className: 'aa-panel' }, `Login callback failed: ${callbackState.message}`);
  }

  return React.createElement(SettingsSurface, {
    settingsData: data,
    onStartAuth: async () => {
      const result = await authStart({ companyId, callbackUrl: buildInteractiveCallbackUrl() });
      refresh();
      return result;
    },
    onReconnect: async () => {
      const result = await authReconnect({ companyId });
      refresh();
      return result;
    },
    onDisconnect: async () => {
      await authDisconnect({ companyId });
      refresh();
    },
    onSaveSettings: async (settings) => {
      await settingsSave({ companyId, settings });
      toast({ title: 'Settings saved', tone: 'success' });
      refresh();
    },
  });
}

export function LivePage(props) {
  useInjectedStyles();
  return React.createElement(PageInner, props);
}

export function LiveDashboardWidget(props) {
  useInjectedStyles();
  return React.createElement(WidgetInner, props);
}

export function LiveSettingsPage(props) {
  useInjectedStyles();
  return React.createElement(SettingsInner, props);
}
