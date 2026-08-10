import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.NODE_ENV === 'production' ? '/tmp/server_dist' : 'dist';

// 构建时嵌入 Python 脚本到 TypeScript 代码中
// 优先尝试重新生成（本地开发），失败则使用仓库中已提交的版本（生产环境只读文件系统）
const assetsPath = join(__dirname, 'src/generated/pdf_assets.ts');
try {
  execSync(`node ${join(__dirname, 'embed_assets.cjs')}`, { stdio: 'inherit' });
  console.log('✅ pdf_assets.ts 已从 generate_pdf.py 重新生成');
} catch (e) {
  if (existsSync(assetsPath)) {
    console.log('⚠️ 嵌入失败，使用仓库中已提交的 pdf_assets.ts（生产环境）');
  } else {
    console.error('❌ 嵌入失败且无现有文件，构建终止');
    throw e;
  }
}

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

  // 复制 Python 脚本和字体文件到构建输出目录
  const scriptsDir = join(__dirname, 'scripts');
  const outScriptsDir = join(outDir, 'scripts');
  mkdirSync(outScriptsDir, { recursive: true });
  const pdfScript = join(scriptsDir, 'generate_pdf.py');
  if (existsSync(pdfScript)) {
    copyFileSync(pdfScript, join(outScriptsDir, 'generate_pdf.py'));
    console.log('⚡ Python 脚本已复制到构建输出目录');
  }
  const fontFile = join(scriptsDir, 'wqy-microhei.ttc');
  if (existsSync(fontFile)) {
    copyFileSync(fontFile, join(outScriptsDir, 'wqy-microhei.ttc'));
    console.log('⚡ 中文字体已复制到构建输出目录');
  }

  console.log('⚡ Build complete!');
} catch (e) {
  console.error(e);
  process.exit(1);
}
