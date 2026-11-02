import { BrandMark } from '../components/BrandMark.jsx';
import { trackPluginCta } from '../analytics.js';

function formatShortDate(value) {
  if (!value) return 'none';
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function WidgetSurface({ widget, primaryHref = '?surface=page', primaryLabel = 'Open full live page' }) {
  const summary = widget.historicalSummary;
  const ctaEvent = primaryLabel === 'Open plugin setup'
    ? 'open_plugin_setup_widget'
    : primaryLabel === 'Choose project'
      ? 'open_project_selection_widget'
      : 'open_full_live_page_widget';

  return (
    <section className="aa-widget">
      <div className="aa-widget-header">
        <div>
          <div className="aa-widget-brand">
            <BrandMark className="aa-widget-brandmark" alt="" />
            <span className="aa-widget-brand-label">Agent Analytics</span>
          </div>
          <p className="aa-kicker">Live Status</p>
          <h2>{widget.connection.label}</h2>
        </div>
        <span className={`aa-status-pill aa-status-${widget.connection.status}`}>{widget.tier || 'tier unknown'}</span>
      </div>

      <div className="aa-widget-metrics">
        <div>
          <span>Visitors</span>
          <strong>{widget.metrics.activeVisitors}</strong>
        </div>
        <div>
          <span>Sessions</span>
          <strong>{widget.metrics.activeSessions}</strong>
        </div>
        <div>
          <span>EPM</span>
          <strong>{widget.metrics.eventsPerMinute}</strong>
        </div>
      </div>

      {summary ? (
        <div className="aa-widget-summary">
          <div className="aa-mini-row">
            <span>7d events</span>
            <strong>{summary.totals.events}</strong>
          </div>
          <div className="aa-mini-row">
            <span>Last active</span>
            <strong>{formatShortDate(summary.lastActiveDate)}</strong>
          </div>
        </div>
      ) : null}

      <div className="aa-widget-footer">
        <a
          className="aa-button aa-button-secondary"
          href={primaryHref}
          onClick={() => trackPluginCta(ctaEvent)}
        >
          {primaryLabel}
        </a>
      </div>
    </section>
  );
}
