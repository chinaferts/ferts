import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 获取 API 基础 URL
 * - Web: 使用相对路径（同源）
 * - Native (Expo Go / APK): 使用 Metro 服务器地址
 */
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web') {
    return '';
  }

  // 原生平台：尝试从 expo-constants 获取开发服务器地址
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    // hostUri 格式: "192.168.x.x:5000" 或 "tunnel://..."
    if (hostUri.startsWith('http')) {
      return hostUri;
    }
    return `http://${hostUri}`;
  }

  // 生产环境 APK：使用相对路径（如果后端同源）或回退
  return '';
}
