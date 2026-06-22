import * as esbuild from 'esbuild';

const outDir = process.env.NODE_ENV === 'production' ? '/tmp/server_dist' : 'dist';

// ESM 格式，全部打入 bundle，不排除任何依赖
try {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: outDir,
    outExtension: { '.js': '.mjs' },  // ESM 文件使用 .mjs 扩展名
    external: [],  // 不排除任何依赖，全部打入 bundle
    sourcemap: false,
    minify: false,
  });
  console.log('⚡ Build complete!');
} catch (e) {
  console.error(e);
  process.exit(1);
}
