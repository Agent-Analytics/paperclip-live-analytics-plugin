function formatRelativeTime(timestamp) {
  if (!timestamp) return 'No updates yet';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 5) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `Updated ${minutes}m ago`;
}

function CountryPulse({ liveState }) {
  const hotCountry = liveState.world.hotCountry || 'World';
  return (
    <section className="aa-panel aa-world-panel">
      <div className="aa-panel-header">
        <div>
          <p className="aa-kicker">World / Country View</p>
          <h2>Supporting geography, not dashboard wallpaper.</h2>
        </div>
        <div className="aa-world-hot">{hotCountry}</div>
      </div>
      <div className="aa-world-grid">
        <div className="aa-globe">
          <div className="aa-globe-ring aa-globe-ring-one" />
          <div className="aa-globe-ring aa-globe-ring-two" />
          <div className="aa-globe-ring aa-globe-ring-three" />
          <div className="aa-globe-core">
            <span>Live</span>
          </div>
        </div>
        <div className="aa-country-list">
          {liveState.world.countries.map((country) => (
            <div className="aa-country-row" key={country.country}>
              <div>
                <strong>{country.country}</strong>
                <span>{country.visitors} visitors</span>
              </div>
              <div className="aa-country-bar">
                <div
                  className="aa-country-bar-fill"
                  style={{ width: `${Math.min(100, (country.events / Math.max(1, liveState.metrics.eventsPerMinute)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EvidenceColumn({ liveState }) {
  return (
    <section className="aa-panel">
      <div className="aa-panel-header">
        <div>
          <p className="aa-kicker">Operator Evidence</p>
          <h2>Fast feed, top pages, and why the pulse changed.</h2>
        </div>
      </div>
      <div className="aa-evidence-grid">
        <div className="aa-mini-panel">
          <h3>Top Pages</h3>
          {liveState.evidence.topPages.map((page) => (
            <div className="aa-mini-row" key={page.path}>
              <span>{page.path}</span>
              <strong>{page.visitors}</strong>
            </div>
          ))}
        </div>
        <div className="aa-mini-panel">
          <h3>Top Events</h3>
          {liveState.evidence.topEvents.map((event) => (
            <div className="aa-mini-row" key={event.event}>
              <span>{event.event}</span>
              <strong>{event.count}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="aa-feed">
        {liveState.evidence.recentEvents.map((event) => (
          <div className="aa-feed-row" key={event.id}>
            <div>
              <strong>{event.event}</strong>
              <span>{event.assetLabel || 'Unmapped asset'} · {event.path || 'no path'} · {event.country || '??'}</span>
            </div>
            <time>{formatRelativeTime(event.timestamp)}</time>
          </div>
        ))}
      </div>
    </section>
  );
}

function AssetCard({ asset, onSnooze }) {
  return (
    <article className={`aa-asset-card aa-asset-card-${asset.kind}`}>
      <div className="aa-asset-topline">
        <div>
          <p className="aa-kicker">{asset.kind}</p>
          <h3>{asset.label}</h3>
        </div>
        <span className={`aa-status-pill aa-status-${asset.status}`}>{asset.status}</span>
      </div>

      <div className="aa-asset-metrics">
        <div>
          <span>Visitors</span>
          <strong>{asset.activeVisitors}</strong>
        </div>
        <div>
          <span>Sessions</span>
          <strong>{asset.activeSessions}</strong>
        </div>
        <div>
          <span>Events / min</span>
          <strong>{asset.eventsPerMinute}</strong>
        </div>
      </div>

      <div className="aa-asset-details">
        <div>
          <span className="aa-label">Project</span>
          <strong>{asset.agentAnalyticsProject}</strong>
        </div>
        <div>
          <span className="aa-label">Hot country</span>
          <strong>{asset.lastHotCountry || 'Waiting for stream'}</strong>
        </div>
        <div>
          <span className="aa-label">Updated</span>
          <strong>{formatRelativeTime(asset.lastUpdatedAt)}</strong>
        </div>
      </div>

      <div className="aa-asset-evidence">
        <div>
          <span className="aa-label">Top page</span>
          <strong>{asset.topPages[0]?.path || 'No pages yet'}</strong>
        </div>
        <div>
          <span className="aa-label">Top event</span>
          <strong>{asset.topEvents[0]?.event || 'No events yet'}</strong>
        </div>
      </div>

      <div className="aa-asset-actions">
        <span className="aa-muted-note">One Paperclip company, one live Agent Analytics project.</span>
        <button className="aa-button aa-button-ghost" onClick={() => onSnooze(asset.assetKey)}>
          Snooze 30m
        </button>
      </div>
    </article>
  );
}

export function PageSurface({ liveState, onSnooze }) {
  return (
    <div className="aa-page-shell">
      <header className="aa-hero">
        <div>
          <p className="aa-kicker">Agent Analytics Live</p>
          <h1>Ambient pulse for the company, backed by raw evidence.</h1>
          <p className="aa-hero-copy">{liveState.connection.detail}</p>
        </div>
        <div className="aa-hero-status">
          <span className={`aa-status-pill aa-status-${liveState.connection.status}`}>{liveState.connection.label}</span>
          <p>{liveState.account?.email || 'No connected account'}</p>
        </div>
      </header>

      <section className="aa-metric-grid">
        <div className="aa-metric-card">
          <span>Active visitors</span>
          <strong>{liveState.metrics.activeVisitors}</strong>
        </div>
        <div className="aa-metric-card">
          <span>Active sessions</span>
          <strong>{liveState.metrics.activeSessions}</strong>
        </div>
        <div className="aa-metric-card">
          <span>Events / min</span>
          <strong>{liveState.metrics.eventsPerMinute}</strong>
        </div>
        <div className="aa-metric-card">
          <span>Visible assets</span>
          <strong>{liveState.metrics.assetsVisible}</strong>
        </div>
      </section>

      <div className="aa-main-grid">
        <CountryPulse liveState={liveState} />
        <EvidenceColumn liveState={liveState} />
      </div>

      <section className="aa-assets-section">
        <div className="aa-panel-header">
          <div>
            <p className="aa-kicker">Selected Project</p>
            <h2>One company-scoped Agent Analytics project feeds the live monitor.</h2>
          </div>
        </div>
        <div className="aa-asset-grid">
          {liveState.assets.map((asset) => (
            <AssetCard key={asset.assetKey} asset={asset} onSnooze={onSnooze} />
          ))}
        </div>
      </section>
    </div>
  );
}
