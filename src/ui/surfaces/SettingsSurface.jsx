import { useEffect, useRef, useState } from 'react';

function normalizeOrigins(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return value || '*';
}

export function SettingsSurface({
  settingsData,
  onStartAuth,
  onReconnect,
  onDisconnect,
  onSaveSettings,
}) {
  const popupRef = useRef(null);
  const pendingPopupLaunchRef = useRef(false);
  const [formState, setFormState] = useState(() => ({
    agentAnalyticsBaseUrl: settingsData.settings.agentAnalyticsBaseUrl,
    liveWindowSeconds: settingsData.settings.liveWindowSeconds,
    pollIntervalSeconds: settingsData.settings.pollIntervalSeconds,
    selectedProjectId: settingsData.settings.selectedProjectId || '',
    selectedProjectName: settingsData.settings.selectedProjectName || '',
    selectedProjectLabel: settingsData.settings.selectedProjectLabel || '',
    selectedProjectAllowedOrigins: settingsData.settings.selectedProjectAllowedOrigins || [],
    pluginEnabled: settingsData.settings.pluginEnabled,
  }));

  useEffect(() => {
    setFormState({
      agentAnalyticsBaseUrl: settingsData.settings.agentAnalyticsBaseUrl,
      liveWindowSeconds: settingsData.settings.liveWindowSeconds,
      pollIntervalSeconds: settingsData.settings.pollIntervalSeconds,
      selectedProjectId: settingsData.settings.selectedProjectId || '',
      selectedProjectName: settingsData.settings.selectedProjectName || '',
      selectedProjectLabel: settingsData.settings.selectedProjectLabel || '',
      selectedProjectAllowedOrigins: settingsData.settings.selectedProjectAllowedOrigins || [],
      pluginEnabled: settingsData.settings.pluginEnabled,
    });
  }, [settingsData.settings]);

  useEffect(() => {
    const authorizeUrl = settingsData.auth.pendingAuthRequest?.authorizeUrl;
    if (!authorizeUrl || !pendingPopupLaunchRef.current || typeof window === 'undefined') return;

    const popup = popupRef.current;
    pendingPopupLaunchRef.current = false;

    if (popup && !popup.closed) {
      try {
        popup.location.href = authorizeUrl;
        popup.focus?.();
        return;
      } catch {
        // Fall through to opening a fresh tab if the host browser blocks direct navigation.
      }
    }

    window.open(authorizeUrl, '_blank');
  }, [settingsData.auth.pendingAuthRequest?.authorizeUrl]);

  async function handleStartLogin() {
    if (typeof window !== 'undefined') {
      popupRef.current = window.open('', '_blank');
      pendingPopupLaunchRef.current = true;
    }

    try {
      const result = await onStartAuth();
      const authorizeUrl = result?.auth?.pendingAuthRequest?.authorizeUrl;
      if (authorizeUrl && typeof window !== 'undefined') {
        const popup = popupRef.current;
        if (popup && !popup.closed) {
          popup.location.href = authorizeUrl;
          popup.focus?.();
          pendingPopupLaunchRef.current = false;
        }
      }
    } catch (error) {
      pendingPopupLaunchRef.current = false;
      const popup = popupRef.current;
      if (popup && !popup.closed) popup.close();
      throw error;
    }
  }

  return (
    <div className="aa-settings-shell">
      <section className="aa-panel">
        <div className="aa-panel-header">
          <div>
            <p className="aa-kicker">Connection</p>
            <h2>Browser approval, worker-held session, no pasted finish code.</h2>
          </div>
          <span className={`aa-status-pill aa-status-${settingsData.auth.status}`}>{settingsData.auth.status}</span>
        </div>

        <div className="aa-settings-grid">
          <div className="aa-settings-stack">
            <div className="aa-settings-row">
              <div>
                <strong>Connected account</strong>
                <span>
                  {settingsData.auth.connected
                    ? settingsData.auth.accountSummary?.email || 'Connected'
                    : settingsData.auth.pendingAuthRequest
                      ? 'Pending browser approval'
                      : 'Not connected'}
                </span>
              </div>
              {settingsData.auth.connected || settingsData.auth.pendingAuthRequest ? (
                <button className="aa-button aa-button-secondary" onClick={onDisconnect}>Disconnect</button>
              ) : (
                <button className="aa-button aa-button-primary" onClick={handleStartLogin}>Connect in browser</button>
              )}
            </div>

            {settingsData.auth.pendingAuthRequest ? (
              <div className="aa-auth-box">
                <p>Approve the Agent Analytics login in the browser. The approval tab should return here and close when it finishes.</p>
                <a href={settingsData.auth.pendingAuthRequest.authorizeUrl} target="_blank" rel="noreferrer">
                  Open approval page
                </a>
                <p className="aa-muted-note">{settingsData.auth.pendingAuthRequest.authorizeUrl}</p>
                <p className="aa-muted-note">If the browser does not close cleanly, use Check approval once.</p>
                <div className="aa-inline-actions">
                  <button className="aa-button aa-button-ghost" onClick={onReconnect}>Check approval</button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="aa-mini-panel">
            <h3>Connected tier</h3>
            <div className="aa-mini-row">
              <span>Billing tier</span>
              <strong>{settingsData.auth.tier || 'unknown'}</strong>
            </div>
            <div className="aa-mini-row">
              <span>Selected project</span>
              <strong>{formState.selectedProjectName || 'None yet'}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="aa-panel">
        <div className="aa-panel-header">
          <div>
            <p className="aa-kicker">Project Selection</p>
            <h2>Choose one Agent Analytics project for this Paperclip company.</h2>
          </div>
        </div>

        <div className="aa-settings-stack">
          {(settingsData.discoveredProjects || []).map((project) => {
            const isSelected = formState.selectedProjectName === project.name;
            return (
              <div className="aa-settings-row" key={project.id || project.name}>
                <div>
                  <strong>{project.name}</strong>
                  <span>{normalizeOrigins(project.allowed_origins)}</span>
                </div>
                <button
                  className={`aa-button ${isSelected ? 'aa-button-secondary' : 'aa-button-primary'}`}
                  onClick={async () => {
                    const nextState = {
                      ...formState,
                      selectedProjectId: project.id || '',
                      selectedProjectName: project.name,
                      selectedProjectLabel: project.name,
                      selectedProjectAllowedOrigins: Array.isArray(project.allowed_origins)
                        ? project.allowed_origins
                        : project.allowed_origins && project.allowed_origins !== '*'
                          ? String(project.allowed_origins).split(',').map((value) => value.trim()).filter(Boolean)
                          : project.allowed_origins === '*'
                            ? ['*']
                            : [],
                    };
                    setFormState(nextState);
                    await onSaveSettings(nextState);
                  }}
                >
                  {isSelected ? 'Selected' : 'Use this project'}
                </button>
              </div>
            );
          })}
          {!settingsData.discoveredProjects?.length ? (
            <div className="aa-settings-stack">
              <p className="aa-muted-note">No projects loaded yet.</p>
              {settingsData.projectListError ? (
                <p className="aa-muted-note">Project load error: {settingsData.projectListError}</p>
              ) : (
                <p className="aa-muted-note">If you connected before this fix, disconnect and connect again so the session includes `projects:read`.</p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="aa-panel">
        <details>
          <summary className="aa-kicker" style={{ cursor: 'pointer', userSelect: 'none' }}>
            Advanced
          </summary>
          <div style={{ marginTop: 16 }}>
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
                Save advanced settings
              </button>
              <button className="aa-button aa-button-ghost" onClick={onReconnect}>
                Revalidate connection
              </button>
            </div>
          </div>
        </details>
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
