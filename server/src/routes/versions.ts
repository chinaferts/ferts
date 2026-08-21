import express from 'express';

const router = express.Router();

// GitHub 仓库信息
const GITHUB_REPO = 'chinaferts/ferts';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// 版本信息存储 - updateUrl 由 GitHub Release 动态获取
const VERSION_INFO = {
  latestVersion: '1.10.0',
  minVersion: '1.0.0',
  releaseNotes: '自动版本号管理，每次部署自动增加 0.1',
  forceUpdate: false,
};

/**
 * 获取最新版本信息
 * GET /api/v1/versions/latest
 * 响应：{ latestVersion, minVersion, updateUrl, releaseNotes, forceUpdate }
 * 
 * updateUrl 从 GitHub Release 动态获取，确保始终指向最新版本的 APK
 */
router.get('/latest', async (req, res) => {
  try {
    // 从 GitHub API 获取最新 Release 信息
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'FERTS-App-Update-Checker',
      },
    });

    if (response.ok) {
      const release = await response.json() as {
        tag_name: string;
        assets: Array<{ name: string; browser_download_url: string }>;
      };
      
      // 从 tag_name 提取版本号（去掉 'v' 前缀）
      const githubVersion = release.tag_name.replace(/^v/, '');
      
      // 查找 APK 资产
      const apkAsset = release.assets.find(
        (asset) => asset.name === 'app-release.apk'
      );
      
      if (apkAsset) {
        // 使用 GitHub 镜像加速下载（国内访问 GitHub 可能被拦截）
        const mirrorUrl = `https://ghfast.top/${apkAsset.browser_download_url}`;
        const directUrl = apkAsset.browser_download_url;
        
        return res.json({
          latestVersion: githubVersion,
          minVersion: VERSION_INFO.minVersion,
          updateUrl: mirrorUrl,
          backupUrls: [directUrl],
          releaseNotes: release.tag_name,
          forceUpdate: VERSION_INFO.forceUpdate,
        });
      }
    }
    
    // GitHub API 失败时，使用本地配置兜底（使用镜像加速）
    const fallbackDirectUrl = `https://github.com/${GITHUB_REPO}/releases/latest/download/app-release.apk`;
    res.json({
      latestVersion: VERSION_INFO.latestVersion,
      minVersion: VERSION_INFO.minVersion,
      updateUrl: `https://ghfast.top/${fallbackDirectUrl}`,
      backupUrls: [fallbackDirectUrl],
      releaseNotes: VERSION_INFO.releaseNotes,
      forceUpdate: VERSION_INFO.forceUpdate,
    });
  } catch (error) {
    // 网络错误时，使用本地配置兜底（使用镜像加速）
    const fallbackDirectUrl = `https://github.com/${GITHUB_REPO}/releases/latest/download/app-release.apk`;
    res.json({
      latestVersion: VERSION_INFO.latestVersion,
      minVersion: VERSION_INFO.minVersion,
      updateUrl: `https://ghfast.top/${fallbackDirectUrl}`,
      backupUrls: [fallbackDirectUrl],
      releaseNotes: VERSION_INFO.releaseNotes,
      forceUpdate: VERSION_INFO.forceUpdate,
    });
  }
});

export default router;
