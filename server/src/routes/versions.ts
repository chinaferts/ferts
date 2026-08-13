import express from 'express';

const router = express.Router();

// 版本信息存储（实际项目中应该从数据库或配置文件读取）
const VERSION_INFO = {
  latestVersion: '1.0.1',
  minVersion: '1.0.0',
  updateUrl: '', // APK 下载链接，需要配置对象存储 URL
  releaseNotes: '修复 PDF 报告生成问题，优化条码扫描结果显示',
  forceUpdate: false,
};

/**
 * 获取最新版本信息
 * GET /api/v1/versions/latest
 * 响应：{ latestVersion, minVersion, updateUrl, releaseNotes, forceUpdate }
 */
router.get('/latest', (req, res) => {
  res.json(VERSION_INFO);
});

/**
 * 检查是否需要更新
 * GET /api/v1/versions/check?currentVersion=1.0.0
 * Query 参数：currentVersion: string -- 当前 APP 版本号
 * 响应：{ needUpdate, forceUpdate, latestVersion, updateUrl, releaseNotes }
 */
router.get('/check', (req, res) => {
  const { currentVersion } = req.query;

  if (!currentVersion || typeof currentVersion !== 'string') {
    res.status(400).json({ error: 'currentVersion is required' });
    return;
  }

  const needUpdate = compareVersions(currentVersion, VERSION_INFO.latestVersion) < 0;
  const forceUpdate = needUpdate && compareVersions(currentVersion, VERSION_INFO.minVersion) < 0;

  res.json({
    needUpdate,
    forceUpdate,
    latestVersion: VERSION_INFO.latestVersion,
    updateUrl: VERSION_INFO.updateUrl,
    releaseNotes: VERSION_INFO.releaseNotes,
  });
});

/**
 * 比较两个版本号
 * @returns -1: v1 < v2, 0: v1 === v2, 1: v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }

  return 0;
}

export default router;
