import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * 获取 API 基础 URL
 * - Web: 返回空字符串（使用相对路径，同源请求）
 * - Native: 使用 EXPO_PUBLIC_BACKEND_BASE_URL 环境变量，或从 app config 中获取
 */
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web') {
    return '';
  }
  // 优先使用环境变量
  if (process.env.EXPO_PUBLIC_BACKEND_BASE_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
  }
  // 兜底：从 app config 的 extra 中获取
  const extra = (Constants.expoConfig?.extra as Record<string, string> | undefined) || {};
  if (extra.backendBaseUrl) {
    return extra.backendBaseUrl;
  }
  // 最终兜底：使用 COZE_PROJECT_DOMAIN_DEFAULT 环境变量（构建时注入）
  if (process.env.COZE_PROJECT_DOMAIN_DEFAULT) {
    return `https://${process.env.COZE_PROJECT_DOMAIN_DEFAULT}`;
  }
  return '';
}
