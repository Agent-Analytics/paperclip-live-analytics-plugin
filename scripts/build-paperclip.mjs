import { build } from 'esbuild';

const shared = {
  bundle: true,
  format: 'esm',
  sourcemap: false,
  target: 'es2022',
  logLevel: 'info',
};

await build({
  ...shared,
  entryPoints: ['src/paperclip/manifest.js'],
  outfile: 'dist/manifest.js',
  platform: 'neutral',
});

await build({
  ...shared,
  entryPoints: ['src/paperclip/worker-entry.js'],
  outfile: 'dist/worker.js',
  platform: 'node',
  external: ['@paperclipai/plugin-sdk'],
});

await build({
  ...shared,
  entryPoints: ['src/paperclip/ui-entry.jsx'],
  outfile: 'dist/ui/index.js',
  platform: 'browser',
  jsx: 'automatic',
  loader: {
    '.css': 'text',
  },
  external: ['react', 'react/jsx-runtime', '@paperclipai/plugin-sdk/ui'],
});

