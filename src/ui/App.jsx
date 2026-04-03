import { startTransition, useEffect, useState } from 'react';
import { ACTION_KEYS, DATA_KEYS, LIVE_STREAM_CHANNEL } from '../shared/constants.js';
import { demoLiveState } from './demo-data.js';
import { useHostContext, usePluginAction, usePluginData, usePluginStream } from './paperclip-bridge.js';
import { PageSurface } from './surfaces/PageSurface.jsx';
import { SettingsSurface } from './surfaces/SettingsSurface.jsx';
import { WidgetSurface } from './surfaces/WidgetSurface.jsx';

function SurfaceFrame({ surface, children }) {
  return (
    <main className={`aa-app aa-surface-${surface}`}>
      {children}
    </main>
  );
}

export function App() {
  const host = useHostContext();
  const surface = host.surface || 'page';
  const companyId = host.companyId;

  const livePage = usePluginData(DATA_KEYS.livePageLoad, { companyId }, { enabled: surface === 'page' });
  const liveWidget = usePluginData(DATA_KEYS.liveWidgetLoad, { companyId }, { enabled: surface === 'dashboardWidget' });
  const settings = usePluginData(DATA_KEYS.settingsLoad, { companyId }, { enabled: surface === 'settingsPage' });

  const authStart = usePluginAction(ACTION_KEYS.authStart);
  const authReconnect = usePluginAction(ACTION_KEYS.authReconnect);
  const authDisconnect = usePluginAction(ACTION_KEYS.authDisconnect);
  const settingsSave = usePluginAction(ACTION_KEYS.settingsSave);
  const snoozeAsset = usePluginAction(ACTION_KEYS.assetSnooze);
  const unsnoozeAsset = usePluginAction(ACTION_KEYS.assetUnsnooze);

  const [streamState, setStreamState] = useState(demoLiveState);

  useEffect(() => {
    if (surface === 'page' && livePage.data) setStreamState(livePage.data);
  }, [surface, livePage.data]);

  usePluginStream(LIVE_STREAM_CHANNEL, {
    companyId,
    onEvent: (payload) => {
      startTransition(() => {
        setStreamState(payload);
      });
    },
  });

  if (surface === 'dashboardWidget') {
    return (
      <SurfaceFrame surface={surface}>
        <WidgetSurface widget={liveWidget.data || liveWidget.data || { connection: { status: 'idle', label: 'Idle' }, metrics: {}, warnings: [] }} fullPageHref="?surface=page" />
      </SurfaceFrame>
    );
  }

  if (surface === 'settingsPage') {
    return (
      <SurfaceFrame surface={surface}>
        <SettingsSurface
          settingsData={settings.data}
          onStartAuth={() => authStart.run({ companyId })}
          onReconnect={() => authReconnect.run({ companyId })}
          onDisconnect={() => authDisconnect.run({ companyId })}
          onSaveSettings={(nextSettings) => settingsSave.run({ companyId, settings: nextSettings })}
        />
      </SurfaceFrame>
    );
  }

  return (
    <SurfaceFrame surface={surface}>
      <PageSurface
        liveState={streamState}
        onSnooze={(assetKey) => snoozeAsset.run({ companyId, assetKey })}
        onUnsnooze={(assetKey) => unsnoozeAsset.run({ companyId, assetKey })}
      />
    </SurfaceFrame>
  );
}
