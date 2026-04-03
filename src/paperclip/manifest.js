import { PLUGIN_PAGE_ROUTE } from '../shared/constants.js';

const manifest = {
  id: 'agent-analytics.paperclip-live-analytics-plugin',
  apiVersion: 1,
  version: '0.1.0',
  displayName: 'Agent Analytics Live',
  description: 'Thin live monitor for Paperclip companies using Agent Analytics.',
  author: '@agent-analytics',
  categories: ['automation', 'ui'],
  capabilities: [
    'http.outbound',
    'plugin.state.read',
    'plugin.state.write',
    'companies.read',
    'projects.read',
    'ui.page.register',
    'ui.dashboardWidget.register',
    'instance.settings.register',
  ],
  entrypoints: {
    worker: './dist/worker.js',
    ui: './dist/ui',
  },
  ui: {
    slots: [
      {
        type: 'page',
        id: 'agent-analytics-live-page',
        displayName: 'Agent Analytics Live',
        exportName: 'LivePage',
        routePath: PLUGIN_PAGE_ROUTE,
      },
      {
        type: 'dashboardWidget',
        id: 'agent-analytics-live-widget',
        displayName: 'Agent Analytics Live',
        exportName: 'LiveDashboardWidget',
      },
      {
        type: 'settingsPage',
        id: 'agent-analytics-live-settings',
        displayName: 'Agent Analytics Live Settings',
        exportName: 'LiveSettingsPage',
      },
    ],
  },
};

export default manifest;
