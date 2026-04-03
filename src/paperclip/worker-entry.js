import { definePlugin, runWorker } from '@paperclipai/plugin-sdk';
import { PLUGIN_ID } from '../shared/constants.js';
import { PaperclipLiveAnalyticsService } from '../worker/service.js';

let service = null;

const plugin = definePlugin({
  async setup(ctx) {
    service = new PaperclipLiveAnalyticsService(ctx, {
      fetchImpl: ctx.http?.fetch?.bind(ctx.http) || globalThis.fetch,
    });
    await service.register();
  },

  async onHealth() {
    return {
      status: 'ok',
      details: {
        pluginId: PLUGIN_ID,
      },
    };
  },

  async onShutdown() {
    await service?.shutdown?.();
  },
});

export default plugin;
runWorker(plugin, import.meta.url);

