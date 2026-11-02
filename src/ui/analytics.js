const PLUGIN_SURFACE = 'paperclip_live_plugin';
const PLUGIN_PREFIX = 'paperclip_live_plugin_';

function track(event, properties = {}) {
  if (typeof window === 'undefined' || typeof window.aa?.track !== 'function') return;
  window.aa.track(event, {
    surface: PLUGIN_SURFACE,
    ...properties,
  });
}

function withPrefix(value) {
  return value.startsWith(PLUGIN_PREFIX) ? value : `${PLUGIN_PREFIX}${value}`;
}

export function trackPluginImpression(id, properties = {}) {
  track('impression', {
    id: withPrefix(id),
    ...properties,
  });
}

export function trackPluginFeature(feature, properties = {}) {
  track('feature_used', {
    feature: withPrefix(feature),
    ...properties,
  });
}

export function trackPluginCta(id, properties = {}) {
  track('cta_click', {
    id: withPrefix(id),
    ...properties,
  });
}
