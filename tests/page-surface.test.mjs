import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('page surface owns project selection UI', async () => {
  const source = await readFile(new URL('../src/ui/surfaces/PageSurface.jsx', import.meta.url), 'utf8');

  assert.match(source, /Choose the Agent Analytics project for this Paperclip company/);
  assert.match(source, /The live map, metrics, and recent activity will appear after you pick the correct project below/);
  assert.match(source, /Mapped Agent Analytics project/);
  assert.match(source, /Use this project/);
});
