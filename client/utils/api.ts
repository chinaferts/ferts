/**
 * API 工具函数
 * 统一处理 API 基础 URL
 * 
 * Web 端：使用相对路径（开发和生产环境均可用）
 * Native 端（Expo Go）：使用 Metro 开发服务器地址（通过 Metro proxy 转发到后端）
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 获取 API 基础 URL
export const getApiBaseUrl = (): string => {
  // Web 端：使用相对路径，Express 直接处理
  if (Platform.OS === 'web') {
    return '';
  }

  // Native 端（手机 Expo Go）：需要完整 URL
  // hostUri 是 Metro 开发服务器的地址（如 "192.168.1.100:5000" 或 "xxx.exp.direct"）
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    // 判断是否是隧道模式（包含字母）还是局域网模式
    const scheme = hostUri.includes('.exp.direct') || hostUri.includes('.ngrok')
      ? 'https'
      : 'http';
    return `${scheme}://${hostUri}`;
  }

  // 生产环境原生端（如果有独立构建）：使用相对路径
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
