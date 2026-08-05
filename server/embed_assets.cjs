/**
 * 构建时生成：将 Python PDF 脚本和 Logo 编码为 base64 嵌入到 TypeScript 中
 * 字体文件不嵌入（太大，会导致构建超时），而是通过 build.js 复制到构建输出目录
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

// 直接覆盖写入（不删除旧文件，兼容生产环境只读文件系统）
// writeFileSync 会直接覆盖已有文件内容

const pyPath = path.join(__dirname, 'scripts', 'generate_pdf.py');
const logoPath = path.join(__dirname, 'scripts', 'feats_logo.png');

try {
  const pyContent = fs.readFileSync(pyPath);
  const logoContent = fs.readFileSync(logoPath);

  const tsContent = `// 此文件由 embed_assets.cjs 自动生成，请勿手动编辑
// 包含 PDF 生成脚本和 Logo，确保与 Express 代码同步部署
// 注意：字体文件不嵌入（太大），而是通过 build.js 复制到构建输出目录

export const PDF_SCRIPT_B64 = '${pyContent.toString('base64')}';
export const FONT_B64 = '';  // 字体文件不嵌入，从文件系统读取
export const LOGO_B64 = '${logoContent.toString('base64')}';
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, tsContent);
  console.log(`Embedded PDF script (${pyContent.length} bytes) and logo (${logoContent.length} bytes) into ${outPath}`);
} catch (e) {
  console.error(`Failed to embed assets: ${e.message}`);
  process.exit(1);
}
