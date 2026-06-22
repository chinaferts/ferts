import * as esbuild from 'esbuild';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');
const dependencies = pkg.dependencies || {};
const externalList = Object.keys(dependencies).filter(dep => dep !== 'dayjs');
const outDir = process.env.NODE_ENV === 'production' ? '/tmp/server_dist' : 'dist';
try {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: outDir,
    external: externalList,
  });
  console.log('⚡ Build complete!');
} catch (e) {
  console.error(e);
  process.exit(1);
}
