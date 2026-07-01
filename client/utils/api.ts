import { Platform } from 'react-native';

/**
 * 获取 API 基础 URL
 * - Web: 返回空字符串（使用相对路径，同源请求）
 * - Native: 使用 EXPO_PUBLIC_BACKEND_BASE_URL 环境变量
 */
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web') {
    return '';
  }
  return process.env.EXPO_PUBLIC_BACKEND_BASE_URL || '';
}
