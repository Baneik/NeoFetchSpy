import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';

const watch = process.argv.includes('--watch');
const sourcemap = watch || process.env.SOURCE_MAP === '1' || process.env.SOURCEMAP === 'true';

await viteBuild({
  configFile: 'vite.config.ts',
  build: {
    sourcemap,
    ...(watch ? { watch: {} } : {}),
  },
});

const common = {
  bundle: true,
  sourcemap,
  target: 'es2020',
  platform: 'browser',
  logLevel: 'info',
};

const builds = [
  {
    entryPoints: ['src/extension/background.ts'],
    format: 'esm',
    outfile: 'dist/assets/background.js',
  },
  {
    entryPoints: ['src/extension/content-bridge.ts'],
    format: 'iife',
    outfile: 'dist/assets/contentBridge.js',
  },
  {
    entryPoints: ['src/extension/page-hook.ts'],
    format: 'iife',
    outfile: 'dist/assets/pageHook.js',
  },
];

if (watch) {
  const contexts = await Promise.all(builds.map((entry) => esbuild.context({ ...common, ...entry })));
  await Promise.all(contexts.map((context) => context.watch()));
  console.log('Watching extension entries...');
} else {
  await Promise.all(builds.map((entry) => esbuild({ ...common, ...entry })));
}
