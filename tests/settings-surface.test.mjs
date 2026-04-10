import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PAPERCLIP_SETUP_HELP_URL, PAPERCLIP_SETUP_TASK_CONTENT, PAPERCLIP_SETUP_TASK_TITLE } from '../src/shared/paperclip-setup.js';

test('settings surface wires the Paperclip setup help panel and copy buttons', async () => {
  const source = await readFile(new URL('../src/ui/surfaces/SettingsSurface.jsx', import.meta.url), 'utf8');

  assert.match(source, /How to set this up in Paperclip/);
  assert.match(source, /Copy title/);
  assert.match(source, /Copy content/);
  assert.match(source, /Open the Paperclip setup guide/);
  assert.match(source, /PAPERCLIP_SETUP_TASK_TITLE/);
  assert.match(source, /PAPERCLIP_SETUP_TASK_CONTENT/);
  assert.match(source, /PAPERCLIP_SETUP_HELP_URL/);
  assert.equal(PAPERCLIP_SETUP_TASK_TITLE, 'Hire an analyst to use AgentAnalytics');
  assert.match(PAPERCLIP_SETUP_TASK_CONTENT, /If approval is needed, send me the approval link/);
  assert.equal(PAPERCLIP_SETUP_HELP_URL, 'https://docs.agentanalytics.sh/guides/paperclip/');
});
