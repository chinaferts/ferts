import * as esbuild from 'esbuild';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');
const dependencies = pkg.dependencies || {};
// 只排除 Node.js 内置模块
const externalList = [
  'fs', 'path', 'os', 'http', 'https', 'url', 'querystring',
  'crypto', 'util', 'stream', 'events', 'buffer', 'net', 'tls',
  'child_process', 'cluster', 'dgram', 'dns', 'domain', 'module',
  'readline', 'repl', 'string_decoder', 'tty', 'v8', 'vm', 'zlib',
  'assert', 'constants', 'errors', 'inspector', 'noderesolver', 'process',
  'sys', 'wasi', 'timers', 'console'
];
const outDir = process.env.NODE_ENV === 'production' ? '/tmp/server_dist' : 'dist';
try {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outdir: outDir,
    outExtension: { '.js': '.cjs' },
    external: externalList,
    banner: {
      js: '#!/usr/bin/env node',
    },
  });
  console.log('⚡ Build complete!');
} catch (e) {
  console.error(e);
  process.exit(1);
}
