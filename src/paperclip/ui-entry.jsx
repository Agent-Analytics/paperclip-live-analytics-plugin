import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useHostContext, usePluginAction, usePluginData, usePluginToast } from '@paperclipai/plugin-sdk/ui';
import {
  ACTION_KEYS,
  AUTH_ERROR_CODE_ACCOUNT_SETUP_REQUIRED,
  DATA_KEYS,
  DEFAULT_BASE_URL,
  PLUGIN_PAGE_ROUTE,
} from '../shared/constants.js';
import { PAPERCLIP_SETUP_TASK_CONTENT, PAPERCLIP_SETUP_TASK_TITLE } from '../shared/paperclip-setup.js';
import { trackPluginCta, trackPluginFeature, trackPluginImpression } from '../ui/analytics.js';
import { copyTextWithToast } from '../ui/copy-text.js';
import { BrandMark } from '../ui/components/BrandMark.jsx';
import { PageSurface } from '../ui/surfaces/PageSurface.jsx';
import { SettingsSurface } from '../ui/surfaces/SettingsSurface.jsx';
import { WidgetSurface } from '../ui/surfaces/WidgetSurface.jsx';
import sharedVariablesStyles from '@agent-analytics/shared-ui/variables.css';
import sharedRecipesStyles from '@agent-analytics/shared-ui/recipes.css';
import embeddedStyles from '../ui/styles.css';
import leafletStyles from 'leaflet/dist/leaflet.css';

function useInjectedStyles() {
  useEffect(() => {
    const styleId = 'agent-analytics-live-plugin-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `${sharedVariablesStyles}\n${sharedRecipesStyles}\n${leafletStyles}\n${embeddedStyles}`;
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

function buildPluginSettingsHref() {
  return '/instance/settings/plugins';
}

function getAllowedAuthPopupOrigins(agentAnalyticsBaseUrl = DEFAULT_BASE_URL) {
  const origins = new Set();
  if (typeof window !== 'undefined') origins.add(window.location.origin);
  try {
    origins.add(new URL(agentAnalyticsBaseUrl).origin);
  } catch {
    origins.add(new URL(DEFAULT_BASE_URL).origin);
  }
  return origins;
}

function useAutoRefresh(refresh, intervalMs = 5000) {
  useEffect(() => {
    const intervalId = setInterval(() => {
      refresh();
    }, intervalMs);
    return () => clearInterval(intervalId);
  }, [refresh, intervalMs]);
}

function PageInner({ context }) {
  const companyId = useCompanyId(context);
  const toast = usePluginToast();
  const { data, loading, error, refresh } = usePluginData(DATA_KEYS.livePageLoad, { companyId });
  const snoozeAsset = usePluginAction(ACTION_KEYS.assetSnooze);
  const unsnoozeAsset = usePluginAction(ACTION_KEYS.assetUnsnooze);
  useAutoRefresh(refresh, 5000);

  useEffect(() => {
    trackPluginImpression('live_page_viewed', {
      company_id: companyId,
    });
  }, [companyId]);

  const content = useMemo(() => data, [data]);

  if (loading && !content) return React.createElement('div', { className: 'aa-panel' }, 'Loading live data…');
  if (error && !content) return React.createElement('div', { className: 'aa-panel' }, `Live page failed: ${error.message}`);
  if (!content) return React.createElement('div', { className: 'aa-panel' }, 'No live data yet.');

  return React.createElement(PageSurface, {
    liveState: content,
    setupHref: buildPluginSettingsHref(),
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
  useAutoRefresh(refresh, 5000);
  const content = data;

  useEffect(() => {
    trackPluginImpression('dashboard_widget_viewed', {
      company_id: companyId,
    });
  }, [companyId]);

  if (loading && !content) return React.createElement('div', { className: 'aa-widget' }, 'Loading…');
  if (error && !content) return React.createElement('div', { className: 'aa-widget' }, `Widget failed: ${error.message}`);
  if (!content) return React.createElement('div', { className: 'aa-widget' }, 'No live summary yet.');
  const needsSetup = content.connection?.reason === 'not_connected' || content.connection?.reason === 'connection_error';

  return React.createElement(WidgetSurface, {
    widget: content,
    primaryHref: needsSetup ? buildPluginSettingsHref() : buildPluginPageHref(context),
    primaryLabel: needsSetup ? 'Open plugin setup' : 'Open full live page',
  });
}

function SidebarInner({ context }) {
  const companyId = useCompanyId(context);
  const { data, refresh } = usePluginData(DATA_KEYS.liveWidgetLoad, { companyId });
  useAutoRefresh(refresh, 5000);
  const href = buildPluginPageHref(context);
  const isActive = typeof window !== 'undefined' && window.location.pathname === href;
  const content = data;
  const activeVisitors = content?.metrics?.activeVisitors || 0;

  return React.createElement(
    'a',
    {
      href,
      'aria-current': isActive ? 'page' : undefined,
      className: `aa-sidebar-link${isActive ? ' aa-sidebar-link-active' : ''}`,
      onClick: () => trackPluginCta('sidebar_open_live_page'),
    },
    React.createElement(
      'span',
      { className: 'aa-sidebar-brand' },
      React.createElement(BrandMark, {
        className: 'aa-sidebar-logo',
        alt: '',
      }),
      React.createElement('span', { className: 'aa-sidebar-label' }, 'Analytics')
    ),
    activeVisitors > 0
      ? React.createElement('span', { className: 'aa-sidebar-badge' }, activeVisitors)
      : null
  );
}

function SettingsInner({ context }) {
  const companyId = useCompanyId(context);
  const toast = usePluginToast();
  const { data, loading, error, refresh } = usePluginData(DATA_KEYS.settingsLoad, { companyId });
  const authStart = usePluginAction(ACTION_KEYS.authStart);
  const authComplete = usePluginAction(ACTION_KEYS.authComplete);
  const authErrorAcknowledge = usePluginAction(ACTION_KEYS.authErrorAcknowledge);
  const authReconnect = usePluginAction(ACTION_KEYS.authReconnect);
  const authDisconnect = usePluginAction(ACTION_KEYS.authDisconnect);
  const settingsSave = usePluginAction(ACTION_KEYS.settingsSave);
  const completedCallbackRef = useRef(false);
  const authCompletionRef = useRef(false);
  const [callbackState, setCallbackState] = useState(null);

  useEffect(() => {
    trackPluginImpression('settings_page_viewed', {
      company_id: companyId,
    });
  }, [companyId]);

  function copySetupText(text, successTitle) {
    void copyTextWithToast({
      text,
      successTitle,
      navigatorImpl: globalThis.navigator,
      toast,
    }).catch(() => {});
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const allowedOrigins = getAllowedAuthPopupOrigins(data?.settings?.agentAnalyticsBaseUrl || DEFAULT_BASE_URL);
    const handler = (event) => {
      if (!allowedOrigins.has(event?.origin)) return;

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
            trackPluginFeature('login_completed', { company_id: companyId });
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

      if (event?.data?.type === 'agent-analytics-auth-error') {
        const message = event.data.message || 'Finish Agent Analytics account setup in Paperclip first, then try this login again.';
        void (async () => {
          try {
            await authErrorAcknowledge({
              companyId,
              code: event.data.code,
              message,
            });
            toast({
              title: event.data.code === AUTH_ERROR_CODE_ACCOUNT_SETUP_REQUIRED
                ? 'Finish account setup first'
                : 'Agent Analytics login failed',
              body: message,
              tone: 'error',
            });
            refresh();
          } catch (acknowledgeError) {
            toast({
              title: 'Agent Analytics login failed',
              body: acknowledgeError.message || String(acknowledgeError),
              tone: 'error',
            });
          }
        })();
        return;
      }

      if (event?.data?.type === 'agent-analytics-auth-complete') {
        trackPluginFeature('login_completed', { company_id: companyId });
        toast({ title: 'Agent Analytics connected', tone: 'success' });
        refresh();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [authComplete, authErrorAcknowledge, companyId, data?.settings?.agentAnalyticsBaseUrl, refresh, toast]);

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
          trackPluginFeature('login_completed', { company_id: companyId });
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
      trackPluginFeature('disconnect_completed', { company_id: companyId });
      refresh();
    },
    onSaveSettings: async (settings) => {
      await settingsSave({ companyId, settings });
      toast({ title: 'Settings saved', tone: 'success' });
      refresh();
    },
    onCopyTaskTitle: () => copySetupText(PAPERCLIP_SETUP_TASK_TITLE, 'Task title copied'),
    onCopyTaskContent: () => copySetupText(PAPERCLIP_SETUP_TASK_CONTENT, 'Task content copied'),
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

export function LiveSidebarLink(props) {
  useInjectedStyles();
  return React.createElement(SidebarInner, props);
}

export function LiveSettingsPage(props) {
  useInjectedStyles();
  return React.createElement(SettingsInner, props);
}
