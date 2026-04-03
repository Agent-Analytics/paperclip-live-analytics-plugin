import { STATE_NAMESPACE } from '../shared/constants.js';
import {
  createDefaultAuthState,
  createDefaultSettings,
  createDefaultSnoozeState,
} from '../shared/defaults.js';

function createScope(companyId) {
  return {
    scopeKind: 'company',
    scopeId: companyId,
    namespace: STATE_NAMESPACE,
  };
}

async function getValue(ctx, companyId, key, fallbackValue) {
  if (!ctx?.state?.get) return fallbackValue;
  const value = await ctx.state.get({
    ...createScope(companyId),
    key,
  });
  return value ?? fallbackValue;
}

async function setValue(ctx, companyId, key, value) {
  if (!ctx?.state?.set) return value;
  await ctx.state.set({
    ...createScope(companyId),
    key,
    value,
  });
  return value;
}

export async function loadSettings(ctx, companyId) {
  return getValue(ctx, companyId, 'config', createDefaultSettings());
}

export async function saveSettings(ctx, companyId, settings) {
  return setValue(ctx, companyId, 'config', settings);
}

export async function loadAuthState(ctx, companyId) {
  return getValue(ctx, companyId, 'auth', createDefaultAuthState());
}

export async function saveAuthState(ctx, companyId, authState) {
  return setValue(ctx, companyId, 'auth', authState);
}

export async function loadSnoozes(ctx, companyId) {
  return getValue(ctx, companyId, 'snoozes', createDefaultSnoozeState());
}

export async function saveSnoozes(ctx, companyId, snoozes) {
  return setValue(ctx, companyId, 'snoozes', snoozes);
}

