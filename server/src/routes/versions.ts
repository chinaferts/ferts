import express from 'express';

const router = express.Router();

// 版本信息存储 - updateUrl 中的版本号会由 bump-version.sh 自动更新
const VERSION_INFO = {
  latestVersion: '1.8.0',
  minVersion: '1.0.0',
  updateUrl: `https://github.com/chinaferts/ferts/releases/download/v1.7.0/app-release.apk`,
  releaseNotes: '自动版本号管理，每次部署自动增加 0.1',
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

export default router;
