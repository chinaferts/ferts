/**
 * API 工具函数
 * 统一处理 API 基础 URL
 */

// 获取 API 基础 URL
// 在生产环境中，EXPO_PUBLIC_BACKEND_BASE_URL 由系统注入
// 在开发环境中，使用相对路径（空字符串）
export const getApiBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_BACKEND_BASE_URL || '';
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
