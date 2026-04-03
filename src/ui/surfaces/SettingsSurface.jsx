import { useState } from 'react';

const EMPTY_MAPPING = {
  assetKey: '',
  label: '',
  kind: 'website',
  paperclipProjectId: '',
  agentAnalyticsProject: '',
  primaryHostname: '',
  enabled: true,
};

function MappingRow({ mapping, onRemove }) {
  return (
    <div className="aa-settings-row">
      <div>
        <strong>{mapping.label}</strong>
        <span>{mapping.kind} · {mapping.agentAnalyticsProject}</span>
      </div>
      <button className="aa-button aa-button-ghost" onClick={() => onRemove(mapping.assetKey)}>
        Remove
      </button>
    </div>
  );
}

export function SettingsSurface({
  settingsData,
  onStartAuth,
  onCompleteAuth,
  onReconnect,
  onDisconnect,
  onSaveSettings,
  onUpsertMapping,
  onRemoveMapping,
}) {
  const [formState, setFormState] = useState(() => ({
    agentAnalyticsBaseUrl: settingsData.settings.agentAnalyticsBaseUrl,
    liveWindowSeconds: settingsData.settings.liveWindowSeconds,
    pollIntervalSeconds: settingsData.settings.pollIntervalSeconds,
    pluginEnabled: settingsData.settings.pluginEnabled,
  }));
  const [mappingForm, setMappingForm] = useState(EMPTY_MAPPING);
  const [exchangeCode, setExchangeCode] = useState('');

  return (
    <div className="aa-settings-shell">
      <section className="aa-panel">
        <div className="aa-panel-header">
          <div>
            <p className="aa-kicker">Connection</p>
            <h2>Login-first auth, worker-held tokens.</h2>
          </div>
          <span className={`aa-status-pill aa-status-${settingsData.auth.status}`}>{settingsData.auth.status}</span>
        </div>

        <div className="aa-settings-grid">
          <div className="aa-settings-stack">
            <div className="aa-settings-row">
              <div>
                <strong>Connected account</strong>
                <span>{settingsData.auth.accountSummary?.email || 'Not connected'}</span>
              </div>
              {settingsData.auth.connected ? (
                <button className="aa-button aa-button-secondary" onClick={onDisconnect}>Disconnect</button>
              ) : (
                <button className="aa-button aa-button-primary" onClick={onStartAuth}>Start login</button>
              )}
            </div>

            {settingsData.auth.pendingAuthRequest ? (
              <div className="aa-auth-box">
                <label>
                  Approval URL
                  <a href={settingsData.auth.pendingAuthRequest.authorizeUrl} target="_blank" rel="noreferrer">
                    {settingsData.auth.pendingAuthRequest.authorizeUrl}
                  </a>
                </label>
                <label>
                  Finish code
                  <input value={exchangeCode} onChange={(event) => setExchangeCode(event.target.value)} placeholder="Paste finish code" />
                </label>
                <div className="aa-inline-actions">
                  <button className="aa-button aa-button-primary" onClick={() => onCompleteAuth(settingsData.auth.pendingAuthRequest.authRequestId, exchangeCode)}>
                    Complete login
                  </button>
                  <button className="aa-button aa-button-ghost" onClick={onReconnect}>Refresh session</button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="aa-mini-panel">
            <h3>Discovered projects</h3>
            {(settingsData.discoveredProjects || []).map((project) => (
              <div className="aa-mini-row" key={project.id || project.name}>
                <span>{project.name}</span>
                <strong>{project.allowed_origins || '*'}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="aa-panel">
        <div className="aa-panel-header">
          <div>
            <p className="aa-kicker">Rollout Controls</p>
            <h2>Keep the live window short and the poll cadence explicit.</h2>
          </div>
        </div>

        <div className="aa-form-grid">
          <label>
            Agent Analytics base URL
            <input
              value={formState.agentAnalyticsBaseUrl}
              onChange={(event) => setFormState((current) => ({ ...current, agentAnalyticsBaseUrl: event.target.value }))}
            />
          </label>
          <label>
            Live window seconds
            <input
              type="number"
              value={formState.liveWindowSeconds}
              onChange={(event) => setFormState((current) => ({ ...current, liveWindowSeconds: Number(event.target.value) }))}
            />
          </label>
          <label>
            Poll interval seconds
            <input
              type="number"
              value={formState.pollIntervalSeconds}
              onChange={(event) => setFormState((current) => ({ ...current, pollIntervalSeconds: Number(event.target.value) }))}
            />
          </label>
          <label className="aa-checkbox">
            <input
              type="checkbox"
              checked={formState.pluginEnabled}
              onChange={(event) => setFormState((current) => ({ ...current, pluginEnabled: event.target.checked }))}
            />
            Plugin enabled
          </label>
        </div>

        <div className="aa-inline-actions">
          <button className="aa-button aa-button-primary" onClick={() => onSaveSettings(formState)}>
            Save controls
          </button>
          <button className="aa-button aa-button-ghost" onClick={onReconnect}>
            Revalidate connection
          </button>
        </div>
      </section>

      <section className="aa-panel">
        <div className="aa-panel-header">
          <div>
            <p className="aa-kicker">Asset Mapping</p>
            <h2>Explicit Paperclip asset to Agent Analytics project links.</h2>
          </div>
        </div>

        <div className="aa-form-grid">
          <label>
            Asset key
            <input value={mappingForm.assetKey} onChange={(event) => setMappingForm((current) => ({ ...current, assetKey: event.target.value }))} />
          </label>
          <label>
            Label
            <input value={mappingForm.label} onChange={(event) => setMappingForm((current) => ({ ...current, label: event.target.value }))} />
          </label>
          <label>
            Kind
            <select value={mappingForm.kind} onChange={(event) => setMappingForm((current) => ({ ...current, kind: event.target.value }))}>
              <option value="website">website</option>
              <option value="docs">docs</option>
              <option value="app">app</option>
              <option value="api">api</option>
              <option value="other">other</option>
            </select>
          </label>
          <label>
            Paperclip project ID
            <input value={mappingForm.paperclipProjectId} onChange={(event) => setMappingForm((current) => ({ ...current, paperclipProjectId: event.target.value }))} />
          </label>
          <label>
            Agent Analytics project
            <input value={mappingForm.agentAnalyticsProject} onChange={(event) => setMappingForm((current) => ({ ...current, agentAnalyticsProject: event.target.value }))} />
          </label>
          <label>
            Primary hostname
            <input value={mappingForm.primaryHostname} onChange={(event) => setMappingForm((current) => ({ ...current, primaryHostname: event.target.value }))} />
          </label>
          <label className="aa-checkbox">
            <input
              type="checkbox"
              checked={mappingForm.enabled}
              onChange={(event) => setMappingForm((current) => ({ ...current, enabled: event.target.checked }))}
            />
            Enabled
          </label>
        </div>

        <div className="aa-inline-actions">
          <button
            className="aa-button aa-button-primary"
            onClick={() => {
              onUpsertMapping(mappingForm);
              setMappingForm(EMPTY_MAPPING);
            }}
          >
            Save mapping
          </button>
        </div>

        <div className="aa-settings-stack">
          {settingsData.settings.monitoredAssets.map((mapping) => (
            <MappingRow key={mapping.assetKey} mapping={mapping} onRemove={onRemoveMapping} />
          ))}
        </div>
      </section>

      {settingsData.validation.warnings.length > 0 ? (
        <section className="aa-panel aa-panel-warning">
          <h3>Warnings</h3>
          {settingsData.validation.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      ) : null}
    </div>
  );
}

