import { ACTION_KEYS, DATA_KEYS, PLUGIN_DISPLAY_NAME, PLUGIN_ID } from '../shared/constants.js';
import { PaperclipLiveAnalyticsService } from './service.js';

export const manifest = {
  id: PLUGIN_ID,
  displayName: PLUGIN_DISPLAY_NAME,
  entrypoints: {
    worker: './src/worker/index.js',
    ui: './dist',
  },
  data: DATA_KEYS,
  actions: ACTION_KEYS,
  surfaces: ['page', 'dashboardWidget', 'settingsPage'],
};

export async function setup(ctx) {
  const service = new PaperclipLiveAnalyticsService(ctx);
  await service.register();

  return {
    async shutdown() {
      await service.shutdown();
    },
    async health() {
      return {
        ok: true,
        plugin: PLUGIN_ID,
      };
    },
    async onConfigChange({ companyId }) {
      await service.ensureLiveState(companyId, { forceSync: true });
    },
  };
}

export default manifest;
