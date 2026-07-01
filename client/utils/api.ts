import { Platform } from 'react-native';

/**
 * 获取 API 基础 URL
 * - Web: 使用相对路径（同源）
 * - Native (Expo Go / APK): 使用 EXPO_PUBLIC_BACKEND_BASE_URL
 */
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web') {
    return '';
  }

  // 原生平台：使用环境变量（包含隧道 URL，手机可访问）
  return process.env.EXPO_PUBLIC_BACKEND_BASE_URL || '';
}
