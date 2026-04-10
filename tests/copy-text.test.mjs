import test from 'node:test';
import assert from 'node:assert/strict';

import { PAPERCLIP_SETUP_TASK_CONTENT, PAPERCLIP_SETUP_TASK_TITLE } from '../src/shared/paperclip-setup.js';
import { copyTextWithToast } from '../src/ui/copy-text.js';

test('copyTextWithToast copies text and shows a success toast', async () => {
  const writes = [];
  const toasts = [];

  await copyTextWithToast({
    text: PAPERCLIP_SETUP_TASK_TITLE,
    successTitle: 'Task title copied',
    navigatorImpl: {
      clipboard: {
        writeText: async (value) => {
          writes.push(value);
        },
      },
    },
    toast: (payload) => toasts.push(payload),
  });

  assert.deepEqual(writes, [PAPERCLIP_SETUP_TASK_TITLE]);
  assert.deepEqual(toasts, [{ title: 'Task title copied', tone: 'success' }]);
});

test('copyTextWithToast reports clipboard failures', async () => {
  const toasts = [];

  await assert.rejects(
    copyTextWithToast({
      text: PAPERCLIP_SETUP_TASK_CONTENT,
      successTitle: 'Task content copied',
      navigatorImpl: {
        clipboard: {
          writeText: async () => {
            throw new Error('Clipboard denied');
          },
        },
      },
      toast: (payload) => toasts.push(payload),
    }),
    /Clipboard denied/
  );

  assert.deepEqual(toasts, [{
    title: 'Copy failed',
    body: 'Clipboard denied',
    tone: 'error',
  }]);
});
