/**
 * API 工具函数
 * 统一处理 API 基础 URL
 * 
 * 开发和生产环境均使用相对路径：
 * - 开发环境：Metro proxy 自动转发 /api/v1/* 到 Express 后端
 * - 生产环境：Express 同时提供静态文件和 API 服务
 */

// 获取 API 基础 URL（始终使用相对路径）
export const getApiBaseUrl = (): string => {
  return '';
};

// 构建完整的 API URL
export const buildApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl();
  // 确保 path 以 / 开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

// API v1 路径
export const apiV1 = (path: string): string => {
  return buildApiUrl(`/api/v1${path.startsWith('/') ? path : `/${path}`}`);
};
