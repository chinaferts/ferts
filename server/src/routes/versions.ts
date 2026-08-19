import express from 'express';
import multer from 'multer';
import { S3Storage } from 'coze-coding-dev-sdk';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 版本信息存储（实际项目中应该从数据库或配置文件读取）
const VERSION_INFO = {
  latestVersion: '1.4.0',
  minVersion: '1.0.0',
  updateUrl: '', // 下载链接（优先使用镜像）
  releaseNotes: '自动版本号管理，每次部署自动增加 0.1',
  forceUpdate: false,
  apkKey: '', // 对象存储中的 APK key
  githubMirrorUrl: '', // GitHub 镜像下载链接（主要）
};

// 启动时生成下载链接
async function initDownloadUrl() {
  // 使用多个镜像源，优先使用可用的镜像
  const mirrors = [
    `https://ghproxy.com/https://github.com/chinaferts/ferts/releases/download/v${VERSION_INFO.latestVersion}/app-release.apk`,
    `https://mirror.ghproxy.com/https://github.com/chinaferts/ferts/releases/download/v${VERSION_INFO.latestVersion}/app-release.apk`,
    `https://github.com/chinaferts/ferts/releases/download/v${VERSION_INFO.latestVersion}/app-release.apk`,
  ];
  
  // 默认使用第一个镜像，如果失败会自动切换
  VERSION_INFO.githubMirrorUrl = mirrors[0];
  VERSION_INFO.updateUrl = VERSION_INFO.githubMirrorUrl;
  VERSION_INFO.backupUrls = mirrors.slice(1); // 备用链接

  // 如果配置了对象存储，尝试生成签名链接（作为备选）
  if (VERSION_INFO.apkKey) {
    try {
      const ossUrl = await storage.generatePresignedUrl({
        key: VERSION_INFO.apkKey,
        expireTime: 31536000, // 1 年有效期
      });
      // 对象存储链接作为备选（如果镜像失败可以切换）
      console.log('[Version] 对象存储下载链接已生成（备选）');
    } catch (error) {
      console.error('[Version] 生成对象存储链接失败，使用镜像链接:', error);
    }
  }

  console.log('[Version] 主要下载链接（镜像）:', VERSION_INFO.updateUrl);
}

// 从 GitHub Release 同步 APK（带超时）
async function syncFromGitHubRelease() {
  try {
    const version = VERSION_INFO.latestVersion;
    const githubUrl = `https://github.com/chinaferts/ferts/releases/download/v${version}/app-release.apk`;
    // 使用 GitHub 镜像加速（使用多个镜像源）
    const mirrorUrl = `https://mirror.ghproxy.com/${githubUrl}`;
    
    console.log('[Version] 从 GitHub 镜像下载 APK:', mirrorUrl);
    
    // 下载 APK（带超时）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 秒超时
    
    const response = await fetch(mirrorUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('[Version] GitHub 镜像 APK 下载失败:', response.status, '尝试直接下载...');
      // 镜像失败，尝试直接下载
      const directController = new AbortController();
      const directTimeoutId = setTimeout(() => directController.abort(), 120000); // 120 秒超时
      const directResponse = await fetch(githubUrl, { signal: directController.signal });
      clearTimeout(directTimeoutId);
      
      if (!directResponse.ok) {
        console.error('[Version] GitHub 直接下载也失败:', directResponse.status);
        return;
      }
      
      const buffer = Buffer.from(await directResponse.arrayBuffer());
      const key = await storage.uploadFile({
        fileContent: buffer,
        fileName: 'app-release.apk',
        contentType: 'application/vnd.android.package-archive',
      });
      
      const downloadUrl = await storage.generatePresignedUrl({
        key,
        expireTime: 31536000,
      });
      
      VERSION_INFO.apkKey = key;
      VERSION_INFO.updateUrl = downloadUrl;
      console.log('[Version] APK 同步成功（直接下载），key:', key);
      return;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // 上传到对象存储
    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName: 'app-release.apk',
      contentType: 'application/vnd.android.package-archive',
    });
    
    // 生成下载链接
    const downloadUrl = await storage.generatePresignedUrl({
      key,
      expireTime: 31536000, // 1 年有效期
    });
    
    VERSION_INFO.apkKey = key;
    VERSION_INFO.updateUrl = downloadUrl;
    
    console.log('[Version] APK 同步成功（镜像下载），key:', key);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[Version] GitHub APK 下载超时，请手动上传 APK');
    } else {
      console.error('[Version] APK 同步失败:', error);
    }
  }
}

// 如果已有 APK key，初始化下载链接（异步执行，不阻塞服务启动）
initDownloadUrl().catch(err => console.error('[Version] 初始化失败:', err));

/**
 * 获取最新版本信息
 * GET /api/v1/versions/latest
 * 响应：{ latestVersion, minVersion, updateUrl, releaseNotes, forceUpdate }
 */
router.get('/latest', (req, res) => {
  res.json(VERSION_INFO);
});

/**
 * 上传 APK 文件
 * POST /api/v1/versions/upload-apk
 * Body: FormData with 'apk' file field
 * 响应：{ success, downloadUrl }
 */
router.post('/upload-apk', upload.single('apk'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传 APK 文件' });
      return;
    }

    const fileName = `app-release.apk`;
    const key = await storage.uploadFile({
      fileContent: req.file.buffer,
      fileName,
      contentType: 'application/vnd.android.package-archive',
    });

    // 生成下载链接
    const downloadUrl = await storage.generatePresignedUrl({
      key,
      expireTime: 31536000, // 1 年有效期
    });

    // 更新版本信息
    VERSION_INFO.apkKey = key;
    VERSION_INFO.updateUrl = downloadUrl;

    console.log('[Version] APK 上传成功，key:', key);

    res.json({
      success: true,
      downloadUrl,
      key,
    });
  } catch (error) {
    console.error('[Version] APK 上传失败:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

/**
 * 手动同步 APK（从 GitHub Release 下载并上传到对象存储）
 * POST /api/v1/versions/sync-apk
 * 响应：{ success, downloadUrl }
 */
router.post('/sync-apk', async (req, res) => {
  try {
    await syncFromGitHubRelease();
    
    if (VERSION_INFO.updateUrl) {
      res.json({
        success: true,
        downloadUrl: VERSION_INFO.updateUrl,
      });
    } else {
      res.status(500).json({ error: '同步失败，未生成下载链接' });
    }
  } catch (error) {
    console.error('[Version] 手动同步失败:', error);
    res.status(500).json({ error: '同步失败' });
  }
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

  // 确保 updateUrl 不为空，提供多个下载源
  let updateUrl = VERSION_INFO.updateUrl;
  const backupUrls: string[] = [];
  
  if (!updateUrl) {
    // 使用 GitHub 镜像链接作为备选（使用多个镜像源）
    updateUrl = `https://mirror.ghproxy.com/https://github.com/chinaferts/ferts/releases/download/v${VERSION_INFO.latestVersion}/app-release.apk`;
  }
  
  // 添加备用下载链接（多个镜像源）
  backupUrls.push(`https://mirror.ghproxy.com/https://github.com/chinaferts/ferts/releases/download/v${VERSION_INFO.latestVersion}/app-release.apk`);
  backupUrls.push(`https://gh-proxy.com/https://github.com/chinaferts/ferts/releases/download/v${VERSION_INFO.latestVersion}/app-release.apk`);
  backupUrls.push(`https://github.com/chinaferts/ferts/releases/download/v${VERSION_INFO.latestVersion}/app-release.apk`);

  res.json({
    needUpdate,
    forceUpdate,
    latestVersion: VERSION_INFO.latestVersion,
    updateUrl,
    backupUrls,
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
