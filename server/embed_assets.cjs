/**
 * 构建时生成：将 Python PDF 脚本编码为 base64 嵌入到 TypeScript 中
 * 这样 Python 脚本会随 Express 代码一起部署，不会出现版本不同步的问题
 * 
 * 如果输出文件已存在（生产环境预构建），则跳过生成
 */
const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, 'src', 'generated', 'pdf_assets.ts');

// 确保输出目录存在
const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 删除旧文件，确保总是重新生成（避免生产环境使用旧代码）
if (fs.existsSync(outPath)) {
  console.log('Removing old pdf_assets.ts to force regeneration');
  fs.unlinkSync(outPath);
}

const pyPath = path.join(__dirname, 'scripts', 'generate_pdf.py');
const fontPath = path.join(__dirname, 'scripts', 'wqy-microhei.ttc');
const logoPath = path.join(__dirname, 'scripts', 'feats_logo.png');

try {
  const pyContent = fs.readFileSync(pyPath);
  const fontContent = fs.readFileSync(fontPath);
  const logoContent = fs.readFileSync(logoPath);

  const tsContent = `// 此文件由 embed_assets.cjs 自动生成，请勿手动编辑
// 包含 PDF 生成脚本、中文字体和 Logo，确保与 Express 代码同步部署

export const PDF_SCRIPT_B64 = '${pyContent.toString('base64')}';
export const FONT_B64 = '${fontContent.toString('base64')}';
export const LOGO_B64 = '${logoContent.toString('base64')}';
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, tsContent);
  console.log(`Embedded PDF script (${pyContent.length} bytes), font (${fontContent.length} bytes), and logo (${logoContent.length} bytes) into ${outPath}`);
} catch (e) {
  console.error(`Failed to embed assets: ${e.message}`);
  process.exit(1);
}
