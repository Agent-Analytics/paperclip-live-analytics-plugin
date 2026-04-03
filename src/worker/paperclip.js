import { LIVE_STREAM_CHANNEL } from '../shared/constants.js';

export async function registerDataHandler(ctx, key, handler) {
  if (ctx?.data?.register) {
    return ctx.data.register(key, handler);
  }
  if (ctx?.registerData) {
    return ctx.registerData(key, handler);
  }
  throw new Error(`Paperclip data registration is unavailable for key "${key}"`);
}

export async function registerActionHandler(ctx, key, handler) {
  if (ctx?.actions?.register) {
    return ctx.actions.register(key, handler);
  }
  if (ctx?.registerAction) {
    return ctx.registerAction(key, handler);
  }
  throw new Error(`Paperclip action registration is unavailable for key "${key}"`);
}

export async function openLiveChannel(ctx, companyId) {
  if (!ctx?.streams?.open) return;
  await ctx.streams.open(LIVE_STREAM_CHANNEL, companyId);
}

export async function emitLiveState(ctx, companyId, payload) {
  if (!ctx?.streams?.emit) return;
  await ctx.streams.emit(LIVE_STREAM_CHANNEL, payload);
}

export async function closeLiveChannel(ctx, companyId) {
  if (!ctx?.streams?.close) return;
  await ctx.streams.close(LIVE_STREAM_CHANNEL, companyId);
}

