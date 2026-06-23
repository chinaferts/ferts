import * as esbuild from 'esbuild';

const outDir = process.env.NODE_ENV === 'production' ? '/tmp/server_dist' : 'dist';

try {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outdir: outDir,
    outExtension: { '.js': '.cjs' },
    external: [],  // 所有依赖都打包进去
    sourcemap: false,
    minify: false,
  });
  console.log('⚡ Build complete!');
} catch (e) {
  console.error(e);
  process.exit(1);
}
