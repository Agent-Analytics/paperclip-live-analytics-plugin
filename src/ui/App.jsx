import { startTransition, useEffect, useState } from 'react';
import { ACTION_KEYS, DATA_KEYS, LIVE_STREAM_CHANNEL } from '../shared/constants.js';
import { PAPERCLIP_SETUP_TASK_CONTENT, PAPERCLIP_SETUP_TASK_TITLE } from '../shared/paperclip-setup.js';
import { copyTextWithToast } from './copy-text.js';
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

  function copySetupText(text, successTitle) {
    void copyTextWithToast({ text, successTitle, toast: null }).catch(() => {});
  }

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
    const widget = liveWidget.data || { connection: { status: 'idle', label: 'Idle' }, metrics: {}, warnings: [] };
    const needsSetup = widget.connection?.reason === 'not_connected' || widget.connection?.reason === 'connection_error';
    return (
      <SurfaceFrame surface={surface}>
        <WidgetSurface
          widget={widget}
          primaryHref={needsSetup ? '?surface=settingsPage' : '?surface=page'}
          primaryLabel={needsSetup ? 'Open plugin setup' : 'Open full live page'}
        />
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
          onCopyTaskTitle={() => copySetupText(PAPERCLIP_SETUP_TASK_TITLE, 'Task title copied')}
          onCopyTaskContent={() => copySetupText(PAPERCLIP_SETUP_TASK_CONTENT, 'Task content copied')}
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
