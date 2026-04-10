import { useEffect, useRef, useState } from 'react';
import { BILLING_UPGRADE_URL } from '../../shared/constants.js';
import {
  PAPERCLIP_SETUP_HELP_URL,
  PAPERCLIP_SETUP_TASK_CONTENT,
  PAPERCLIP_SETUP_TASK_TITLE,
} from '../../shared/paperclip-setup.js';
import { BrandMark } from '../components/BrandMark.jsx';
import { trackPluginCta, trackPluginFeature } from '../analytics.js';

function normalizeOrigins(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return value || '*';
}

function SetupSnippet({ label, value, copyLabel, onCopy }) {
  return (
    <div className="aa-settings-setup-snippet">
      <div className="aa-settings-setup-snippet-copy">
        <div className="aa-settings-setup-snippet-body">
          <span className="aa-label">{label}</span>
          <pre>{value}</pre>
        </div>
        <button className="aa-button aa-button-light" onClick={onCopy}>
          {copyLabel}
        </button>
      </div>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="aa-settings-help-link-icon">
      <path
        d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsSurface({
  settingsData,
  onStartAuth,
  onReconnect,
  onDisconnect,
  onSaveSettings,
  onCopyTaskTitle = () => {},
  onCopyTaskContent = () => {},
}) {
  const popupRef = useRef(null);
  const pendingPopupLaunchRef = useRef(false);
  const [isStartingAuth, setIsStartingAuth] = useState(false);
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

  useEffect(() => {
    if (settingsData.auth.connected || settingsData.auth.pendingAuthRequest || settingsData.auth.lastError) {
      setIsStartingAuth(false);
    }
  }, [settingsData.auth.connected, settingsData.auth.pendingAuthRequest, settingsData.auth.lastError]);

  const isConnected = Boolean(settingsData.auth.connected);
  const isPending = Boolean(settingsData.auth.pendingAuthRequest);
  const isWaitingForApproval = isStartingAuth || isPending;

  async function handleStartLogin() {
    trackPluginCta('login_started');
    setIsStartingAuth(true);
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
      setIsStartingAuth(false);
      pendingPopupLaunchRef.current = false;
      const popup = popupRef.current;
      if (popup && !popup.closed) popup.close();
      throw error;
    }
  }

  return (
    <div className="aa-settings-shell">
      <section className={`aa-panel${isConnected ? '' : ' aa-settings-login-shell'}`}>
        {isConnected ? (
          <>
            <div className="aa-panel-header">
              <div>
                <p className="aa-kicker">Connection</p>
                <h2>Connect Agent Analytics</h2>
              </div>
              <span className={`aa-status-pill aa-status-${settingsData.auth.status}`}>{settingsData.auth.status}</span>
            </div>
          <div className="aa-settings-grid">
            <div className="aa-settings-stack">
              <div className="aa-settings-row">
                <div>
                  <strong>Connected account</strong>
                  <span>{settingsData.auth.accountSummary?.email || 'Connected'}</span>
                </div>
                <button
                  className="aa-button aa-button-danger"
                  onClick={() => {
                    trackPluginFeature('disconnect_clicked');
                    onDisconnect();
                  }}
                >
                  Disconnect
                </button>
              </div>
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
              {settingsData.auth.tier && settingsData.auth.tier !== 'pro' ? (
                <div className="aa-tier-callout">
                  <p>Live events require paid access. Free accounts still get the last 7 days for the selected project.</p>
                  <a
                    className="aa-button aa-button-primary aa-button-upgrade"
                    href={BILLING_UPGRADE_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackPluginCta('open_billing_upgrade_settings')}
                  >
                    Upgrade for live events
                  </a>
                </div>
              ) : null}
            </div>
            </div>
          </>
        ) : isWaitingForApproval ? (
          <>
            <div className="aa-settings-login-status">
              <span className={`aa-status-pill aa-status-${settingsData.auth.status}`}>{settingsData.auth.status}</span>
            </div>
            <div className="aa-settings-empty-auth aa-settings-pending-auth">
              <BrandMark className="aa-settings-login-logo" alt="" />
              <div className="aa-settings-empty-auth-copy">
                <strong>Waiting for approval</strong>
                <span>Finish the Agent Analytics login in the browser. This screen will update as soon as the approval completes.</span>
              </div>
              <div className="aa-settings-login-card">
                <div className="aa-spinner" aria-hidden="true" />
                <p className="aa-settings-login-message aa-settings-pending-message">Waiting for browser approval…</p>
                <button
                  className="aa-button aa-button-ghost aa-button-hero"
                  onClick={() => {
                    trackPluginFeature('login_canceled');
                    onDisconnect();
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="aa-settings-login-status">
              <span className={`aa-status-pill aa-status-${settingsData.auth.status}`}>{settingsData.auth.status}</span>
            </div>
            <div className="aa-settings-empty-auth">
              <BrandMark className="aa-settings-login-logo" alt="" />
              <div className="aa-settings-empty-auth-copy">
                <strong>Agent Analytics</strong>
                <span>Live customers and events on a map.</span>
              </div>
              <div className="aa-settings-login-card">
                <p className="aa-settings-login-message">Log in with an existing Agent Analytics account to start the live map in Paperclip.</p>
                <p className="aa-settings-login-subtext">If the account still needs to be created, have the agent do the setup first from the Paperclip task flow below.</p>
                {settingsData.auth.lastError ? (
                  <p className="aa-settings-login-error" role="alert">{settingsData.auth.lastError}</p>
                ) : null}
                <button className="aa-button aa-button-primary aa-button-hero" onClick={handleStartLogin}>
                  Log in to existing account
                </button>
              </div>
              <div className="aa-settings-help-card">
                <div className="aa-settings-help-card-copy">
                  <p className="aa-kicker">How to Set This Up</p>
                  <h3>How to set this up in Paperclip</h3>
                  <p>Use this task in Paperclip first. The agent should create the Agent Analytics account and complete setup before you use this login popup.</p>
                </div>
                <div className="aa-settings-setup-snippets">
                  <SetupSnippet
                    label="Task title"
                    value={PAPERCLIP_SETUP_TASK_TITLE}
                    copyLabel="Copy title"
                    onCopy={onCopyTaskTitle}
                  />
                  <SetupSnippet
                    label="Task content"
                    value={PAPERCLIP_SETUP_TASK_CONTENT}
                    copyLabel="Copy content"
                    onCopy={onCopyTaskContent}
                  />
                </div>
                <a
                  className="aa-settings-help-link"
                  href={PAPERCLIP_SETUP_HELP_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackPluginCta('open_paperclip_setup_help')}
                >
                  <span>Open the Paperclip setup guide</span>
                  <ExternalLinkIcon />
                </a>
              </div>
            </div>
          </>
        )}
      </section>

      {isConnected ? (
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
                    className={`aa-button ${isSelected ? 'aa-button-secondary' : 'aa-button-light'}`}
                    onClick={async () => {
                      trackPluginFeature('project_selected', { project_name: project.name });
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
      ) : null}

      {isConnected ? (
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
                <button
                  className="aa-button aa-button-primary"
                  onClick={() => {
                    trackPluginFeature('advanced_settings_saved', {
                      plugin_enabled: formState.pluginEnabled,
                      live_window_seconds: formState.liveWindowSeconds,
                      poll_interval_seconds: formState.pollIntervalSeconds,
                    });
                    onSaveSettings(formState);
                  }}
                >
                  Save advanced settings
                </button>
                <button
                  className="aa-button aa-button-ghost"
                  onClick={() => {
                    trackPluginFeature('connection_revalidated');
                    onReconnect();
                  }}
                >
                  Revalidate connection
                </button>
              </div>
            </div>
          </details>
        </section>
      ) : null}

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
