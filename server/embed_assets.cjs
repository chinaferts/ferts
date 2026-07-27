/**
 * 构建时生成：将 Python PDF 脚本编码为 base64 嵌入到 TypeScript 中
 * 这样 Python 脚本会随 Express 代码一起部署，不会出现版本不同步的问题
 */
const fs = require('fs');
const path = require('path');

const pyPath = path.join(__dirname, 'scripts', 'generate_pdf.py');
const fontPath = path.join(__dirname, 'scripts', 'wqy-microhei.ttc');

const pyContent = fs.readFileSync(pyPath);
const fontContent = fs.readFileSync(fontPath);

const tsContent = `// 此文件由 embed_assets.js 自动生成，请勿手动编辑
// 包含 PDF 生成脚本和中文字体，确保与 Express 代码同步部署

export const PDF_SCRIPT_B64 = '${pyContent.toString('base64')}';
export const FONT_B64 = '${fontContent.toString('base64')}';
`;

const outPath = path.join(__dirname, 'src', 'generated', 'pdf_assets.ts');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, tsContent);
console.log(`Embedded PDF script (${pyContent.length} bytes) and font (${fontContent.length} bytes) into ${outPath}`);
