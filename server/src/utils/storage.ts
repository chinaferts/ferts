import { S3Storage } from "coze-coding-dev-sdk";

// 初始化 S3Storage 单例
let storageInstance: S3Storage | null = null;

export function getStorage(): S3Storage {
  if (!storageInstance) {
    storageInstance = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    });
  }
  return storageInstance;
}

/**
 * 上传照片到对象存储
 * @param buffer 照片buffer
 * @param fileName 文件名（建议格式：photos/xxx.jpg）
 * @param contentType MIME类型
 * @returns 对象存储的key
 */
export async function uploadPhoto(
  buffer: Buffer,
  fileName: string,
  contentType: string = "image/jpeg"
): Promise<string> {
  const storage = getStorage();
  const key = await storage.uploadFile({
    fileContent: buffer,
    fileName,
    contentType,
  });
  return key;
}

/**
 * 生成照片访问URL
 * @param key 对象存储的key
 * @param expireTime 有效期（秒），默认7天
 * @returns 签名URL
 */
export async function getPhotoUrl(
  key: string,
  expireTime: number = 604800
): Promise<string> {
  // 如果已经是完整URL（http/https开头），直接返回
  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }
  const storage = getStorage();
  const url = await storage.generatePresignedUrl({
    key,
    expireTime,
  });
  return url;
}

/**
 * 批量生成照片访问URL
 * @param keys 对象存储key数组
 * @param expireTime 有效期（秒），默认7天
 * @returns URL数组
 */
export async function getPhotoUrls(
  keys: string[],
  expireTime: number = 604800
): Promise<string[]> {
  const urls = await Promise.all(
    keys.map((key) => getPhotoUrl(key, expireTime))
  );
  return urls;
}

/**
 * 删除照片
 * @param key 对象存储的key
 */
export async function deletePhoto(key: string): Promise<boolean> {
  // 如果是本地路径或完整URL，不处理
  if (key.startsWith("/") || key.startsWith("http://") || key.startsWith("https://")) {
    return false;
  }
  const storage = getStorage();
  return await storage.deleteFile({ fileKey: key });
}

/**
 * 检查照片是否存在
 * @param key 对象存储的key
 */
export async function photoExists(key: string): Promise<boolean> {
  // 如果是本地路径或完整URL，返回true（假设存在）
  if (key.startsWith("/") || key.startsWith("http://") || key.startsWith("https://")) {
    return true;
  }
  const storage = getStorage();
  return await storage.fileExists({ fileKey: key });
}
