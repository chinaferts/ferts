import * as esbuild from 'esbuild';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');
const deps = Object.keys(pkg.dependencies || {});

// Node.js 内置模块列表
const builtinModules = [
  'fs', 'path', 'os', 'http', 'https', 'url', 'querystring', 'querystring',
  'crypto', 'util', 'stream', 'events', 'buffer', 'net', 'tls', 'dgram',
  'dns', 'domain', 'module', 'readline', 'repl', 'string_decoder', 'tty',
  'v8', 'vm', 'zlib', 'assert', 'constants', 'errors', 'inspector',
  'noderesolver', 'process', 'sys', 'wasi', 'timers', 'console', 'perf_hooks',
  'cluster', 'child_process', 'readline', 'repl'
];

// 只打包业务代码，所有 npm 依赖都 external
const external = [...builtinModules];

const outDir = process.env.NODE_ENV === 'production' ? '/tmp/server_dist' : 'dist';

try {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: outDir,
    outExtension: { '.js': '.mjs' },
    external: external,
    sourcemap: false,
    minify: false,
  });
  console.log('⚡ Build complete!');
} catch (e) {
  console.error(e);
  process.exit(1);
}
