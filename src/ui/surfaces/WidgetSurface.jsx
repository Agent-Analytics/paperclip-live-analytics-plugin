export function WidgetSurface({ widget, fullPageHref = '?surface=page' }) {
  return (
    <section className="aa-widget">
      <div className="aa-widget-header">
        <div>
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

      <div className="aa-widget-footer">
        <div>
          <span className="aa-label">Top asset</span>
          <strong>{widget.topAsset?.label || 'No live assets yet'}</strong>
        </div>
        <a className="aa-button aa-button-secondary" href={fullPageHref}>Open full live page</a>
      </div>
    </section>
  );
}

